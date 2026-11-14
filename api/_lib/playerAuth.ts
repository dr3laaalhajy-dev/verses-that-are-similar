import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { isPlayerTokenRequired, requirePlayer, type SessionDeps } from './playerSession.js';

/**
 * "Who is acting?" for player endpoints, when REQUIRE_PLAYER_TOKEN is on.
 *
 * - The acting player comes ONLY from the session token (requirePlayer -> 401 SESSION_*).
 * - Identity values the client still sends (playerId, username, name, x-player-* headers...)
 *   are used for verification only: each one must name the token's player, otherwise 403
 *   { code: 'FORBIDDEN' } with no details.
 * - After the check, those values are replaced by the token player's own id/name/username, so
 *   the existing handler code always operates on the token player.
 * - With the switch off, nothing here runs: the old behaviour is unchanged.
 */

export type IdentityKind = 'id' | 'name' | 'username';

export interface ActorSpec {
  /** Body/query fields that name the ACTING player (never fields naming another player). */
  fields?: Record<string, IdentityKind>;
  /** Request headers that name the acting player (lower-case). */
  headers?: Record<string, IdentityKind>;
}

export interface ActingPlayer {
  id: number;
  name: string | null;
  username: string | null;
  uniquePlayerId: string | null;
  /** Full players row (server side only; never sent to the client as is). */
  row: any;
}

export type ActorGate =
  | { enforced: false }
  | { enforced: true; actor: ActingPlayer };

export interface PlayerAuthDeps extends SessionDeps {
  env?: Record<string, string | undefined>;
}

export const FORBIDDEN_BODY = { code: 'FORBIDDEN' } as const;
export const UNKNOWN_ACTION_BODY = { code: 'UNKNOWN_ACTION' } as const;

/**
 * Default deny (REQUIRE_PLAYER_TOKEN on): an action that is neither in the endpoint's
 * ACTOR_SPECS nor in its explicit PUBLIC_ACTIONS list is refused with 400 { code: 'UNKNOWN_ACTION' }.
 * Returns true if the response was sent. With the switch off it never refuses anything.
 */
export function rejectUnlistedAction(
  action: unknown,
  actorSpecs: Record<string, ActorSpec>,
  publicActions: ReadonlySet<string>,
  res: VercelResponse,
  env?: Record<string, string | undefined>
): boolean {
  if (!isPlayerTokenRequired(env)) return false;
  const name = typeof action === 'string' ? action : '';
  if (Object.prototype.hasOwnProperty.call(actorSpecs, name) || publicActions.has(name)) return false;
  res.status(400).json(UNKNOWN_ACTION_BODY);
  return true;
}

function stripAt(v: string): string {
  return v.trim().replace(/^@+/, '');
}

/** Values the old app sends for "nothing": they claim no identity. */
export function isEmptyClaim(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const t = value.trim();
    return t === '' || t === 'undefined' || t === 'null';
  }
  return false;
}

/** True if the value names this player by id, uniquePlayerId, username (with or without @) or name. */
export function identifierMatchesPlayer(value: unknown, player: any): boolean {
  if (!player) return false;
  if (typeof value === 'number') return Number.isInteger(value) && value === Number(player.id);
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw) && Number(raw) === Number(player.id)) return true;
  if (player.uniquePlayerId && raw.toUpperCase() === String(player.uniquePlayerId).trim().toUpperCase()) return true;
  const lower = stripAt(raw).toLowerCase();
  if (player.username && lower && lower === stripAt(String(player.username)).toLowerCase()) return true;
  if (player.name && raw.toLowerCase() === String(player.name).trim().toLowerCase()) return true;
  return false;
}

function headerValue(req: Pick<VercelRequest, 'headers'>, name: string): unknown {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

function valueFor(kind: IdentityKind, actor: ActingPlayer): string {
  if (kind === 'id') return String(actor.id);
  if (kind === 'username') return actor.username || actor.name || String(actor.id);
  return actor.name || actor.username || String(actor.id);
}

function sendForbidden(res: VercelResponse): null {
  res.status(403).json(FORBIDDEN_BODY);
  return null;
}

/** Loads the token's player (full row) or answers 401 SESSION_INVALID. */
async function loadActingPlayer(playerId: number, res: VercelResponse, deps?: PlayerAuthDeps): Promise<ActingPlayer | null> {
  const db = deps?.db ?? supabaseAdmin;
  let row: any = null;
  try {
    const { data, error } = await db.from('players').select('*').eq('id', playerId).maybeSingle();
    if (!error) row = data;
  } catch {
    row = null;
  }
  if (!row) {
    res.status(401).json({ code: 'SESSION_INVALID' });
    return null;
  }
  return {
    id: Number(row.id),
    name: row.name ?? null,
    username: row.username ?? null,
    uniquePlayerId: row.uniquePlayerId ?? null,
    row,
  };
}

/**
 * Gate for an action that modifies data of / acts on behalf of a player.
 * Returns { enforced: false } when the switch is off (caller continues exactly as before),
 * { enforced: true, actor } when the token is valid and every claimed identity matches,
 * or null when a 401/403 response has already been sent.
 */
export async function enforcePlayerActor(
  req: VercelRequest,
  res: VercelResponse,
  spec: ActorSpec = {},
  deps?: PlayerAuthDeps
): Promise<ActorGate | null> {
  if (!isPlayerTokenRequired(deps?.env)) return { enforced: false };

  const session = await requirePlayer(req, res, deps);
  if (!session) return null;
  const actor = await loadActingPlayer(session.playerId, res, deps);
  if (!actor) return null;

  const body: any = req.body && typeof req.body === 'object' ? req.body : null;
  const query: any = req.query && typeof req.query === 'object' ? req.query : null;
  const fields = spec.fields ?? {};
  const headers = spec.headers ?? {};

  // 1) Verify: every identity value present in the request must name the token's player.
  for (const field of Object.keys(fields)) {
    for (const source of [body, query]) {
      if (!source || !(field in source)) continue;
      const v = source[field];
      const values = Array.isArray(v) ? v : [v];
      if (Array.isArray(v) && v.length !== 1) return sendForbidden(res);
      for (const one of values) {
        if (!isEmptyClaim(one) && !identifierMatchesPlayer(one, actor.row)) return sendForbidden(res);
      }
    }
  }
  for (const name of Object.keys(headers)) {
    const v = headerValue(req, name);
    if (!isEmptyClaim(v) && !identifierMatchesPlayer(v, actor.row)) return sendForbidden(res);
  }

  // 2) Act as the token's player: overwrite the identity values the handler will read.
  const isGet = (req.method || 'GET').toUpperCase() === 'GET';
  for (const [field, kind] of Object.entries(fields)) {
    const value = valueFor(kind, actor);
    if (body) body[field] = value;
    else if (!isGet) (req as any).body = { ...(req.body || {}), [field]: value };
    if (query && (isGet || field in query)) query[field] = value;
  }
  for (const [name, kind] of Object.entries(headers)) {
    if (headerValue(req, name) !== undefined) (req.headers as any)[name] = valueFor(kind, actor);
  }

  (req as any).actingPlayer = actor;
  return { enforced: true, actor };
}

/** The acting player set by enforcePlayerActor on this request, if enforcement ran. */
export function getActingPlayer(req: VercelRequest): ActingPlayer | null {
  return ((req as any).actingPlayer as ActingPlayer) ?? null;
}

/** 403 unless the actor is the room's owner (rooms.player1Id). Also 403 if the room is missing. */
export async function enforceRoomOwner(
  roomId: unknown,
  actor: ActingPlayer,
  res: VercelResponse,
  deps?: PlayerAuthDeps
): Promise<boolean> {
  const db = deps?.db ?? supabaseAdmin;
  if (isEmptyClaim(roomId) || typeof roomId === 'object') {
    sendForbidden(res);
    return false;
  }
  let room: any = null;
  try {
    const { data } = await db.from('rooms').select('id, player1Id').eq('id', String(roomId)).maybeSingle();
    room = data;
  } catch {
    room = null;
  }
  if (!room || String(room.player1Id) !== String(actor.id)) {
    sendForbidden(res);
    return false;
  }
  return true;
}
