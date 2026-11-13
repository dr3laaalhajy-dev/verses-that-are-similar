import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Player sessions (server side only).
 *
 * - The client receives a random 32-byte token (base64url, 43 chars) once, at login/register.
 * - The database stores ONLY its SHA-256 hash (table public.player_sessions, service_role only).
 * - Sessions last 30 days and slide forward on use; at most MAX_ACTIVE_SESSIONS per player
 *   (the oldest are revoked).
 * - Tokens and their hashes are never logged and never placed in error messages.
 *
 * Enforcement switch: REQUIRE_PLAYER_TOKEN (off by default). In this step nothing enforces it;
 * endpoints only issue tokens. See isPlayerTokenRequired().
 */

export const SESSION_TABLE = 'player_sessions';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_SESSIONS = 10;
/** Sliding renewal writes at most once per interval per session (avoids a DB write per request). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface SessionDeps {
  /** Supabase-like client (defaults to the shared service-role client). */
  db?: any;
  /** Clock in ms (defaults to Date.now). */
  now?: () => number;
}

export interface IssuedPlayerSession {
  token: string;
  expiresAt: string;
}

export interface PlayerSessionContext {
  playerId: number;
  sessionId: string;
}

function resolve(deps: SessionDeps = {}) {
  return { db: deps.db ?? supabaseAdmin, now: deps.now ?? Date.now };
}

/** Only the error code is ever surfaced/logged: DB messages can echo values (e.g. a unique-key detail). */
function safeCode(error: any): string {
  return String(error?.code ?? 'unknown').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'unknown';
}

function isValidPlayerId(playerId: unknown): playerId is number {
  return typeof playerId === 'number' && Number.isInteger(playerId) && playerId > 0;
}

/** REQUIRE_PLAYER_TOKEN=true|1|yes|on turns enforcement on. Default: off. */
export function isPlayerTokenRequired(env: Record<string, string | undefined> = process.env): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(env.REQUIRE_PLAYER_TOKEN ?? '').trim().toLowerCase());
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Returns the token from "Authorization: Bearer <token>" only if it has the exact expected shape. */
export function extractBearerToken(req: Pick<VercelRequest, 'headers'>): string | null {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(value);
  if (!match) return null;
  return TOKEN_PATTERN.test(match[1]) ? match[1] : null;
}

/** Creates a new session for the player and returns the raw token (shown to the client once). */
export async function issuePlayerSession(playerId: number, deps?: SessionDeps): Promise<IssuedPlayerSession> {
  if (!isValidPlayerId(playerId)) {
    throw new Error('[playerSession] invalid player id');
  }
  const { db, now } = resolve(deps);
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const nowMs = now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + SESSION_TTL_MS).toISOString();

  const { error } = await db.from(SESSION_TABLE).insert({
    player_id: playerId,
    token_hash: hashSessionToken(token),
    created_at: nowIso,
    last_used_at: nowIso,
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error(`[playerSession] could not create session (code ${safeCode(error)})`);
  }

  try {
    await enforceSessionLimit(playerId, deps);
  } catch (e: any) {
    // The new session is valid; trimming old ones can be retried on the next login.
    console.error('[playerSession] session limit not enforced:', e?.message ?? 'unknown');
  }

  return { token, expiresAt };
}

/** Revokes the oldest active sessions so that at most MAX_ACTIVE_SESSIONS remain. */
export async function enforceSessionLimit(playerId: number, deps?: SessionDeps): Promise<number> {
  const { db, now } = resolve(deps);
  const nowMs = now();
  const { data, error } = await db
    .from(SESSION_TABLE)
    .select('id, created_at')
    .eq('player_id', playerId)
    .is('revoked_at', null)
    .gt('expires_at', new Date(nowMs).toISOString());
  if (error) throw new Error(`[playerSession] could not list sessions (code ${safeCode(error)})`);

  const active = (Array.isArray(data) ? data : [])
    .slice()
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const extra = active.slice(MAX_ACTIVE_SESSIONS).map((row: any) => row.id);
  if (extra.length === 0) return 0;

  const { error: revokeErr } = await db
    .from(SESSION_TABLE)
    .update({ revoked_at: new Date(nowMs).toISOString() })
    .in('id', extra)
    .is('revoked_at', null);
  if (revokeErr) throw new Error(`[playerSession] could not revoke old sessions (code ${safeCode(revokeErr)})`);
  return extra.length;
}

/**
 * Verifies the Bearer token (hash lookup, not revoked, not expired) and slides its expiry.
 * Returns null for any failure; never says why.
 */
export async function authenticatePlayer(
  req: Pick<VercelRequest, 'headers'>,
  deps?: SessionDeps
): Promise<PlayerSessionContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  const { db, now } = resolve(deps);

  let row: any;
  try {
    const { data, error } = await db
      .from(SESSION_TABLE)
      .select('id, player_id, expires_at, revoked_at, last_used_at')
      .eq('token_hash', hashSessionToken(token))
      .maybeSingle();
    if (error) {
      console.error(`[playerSession] lookup failed (code ${safeCode(error)})`);
      return null;
    }
    row = data;
  } catch {
    console.error('[playerSession] lookup failed (code exception)');
    return null;
  }

  const nowMs = now();
  if (!row || row.revoked_at) return null;
  const expiresMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return null;
  const playerId = Number(row.player_id);
  if (!isValidPlayerId(playerId)) return null;

  const lastUsedMs = Date.parse(row.last_used_at);
  if (!Number.isFinite(lastUsedMs) || nowMs - lastUsedMs >= SESSION_TOUCH_INTERVAL_MS) {
    try {
      const { error } = await db
        .from(SESSION_TABLE)
        .update({
          last_used_at: new Date(nowMs).toISOString(),
          expires_at: new Date(nowMs + SESSION_TTL_MS).toISOString(),
        })
        .eq('id', row.id)
        .is('revoked_at', null);
      if (error) console.error(`[playerSession] renew failed (code ${safeCode(error)})`);
    } catch {
      console.error('[playerSession] renew failed (code exception)');
    }
  }

  return { playerId, sessionId: String(row.id) };
}

/**
 * For endpoints that require a player: returns the session context, or sends a bare 401 and
 * returns null. The 401 body never explains why (missing, malformed, unknown, expired, revoked).
 */
export async function requirePlayer(
  req: Pick<VercelRequest, 'headers'>,
  res: VercelResponse,
  deps?: SessionDeps
): Promise<PlayerSessionContext | null> {
  const ctx = await authenticatePlayer(req, deps);
  if (!ctx) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return ctx;
}

/** Revokes the session that belongs to this raw token (logout). Returns true if one was revoked. */
export async function revokeSessionByToken(token: string, deps?: SessionDeps): Promise<boolean> {
  if (!TOKEN_PATTERN.test(String(token ?? ''))) return false;
  const { db, now } = resolve(deps);
  const { data, error } = await db
    .from(SESSION_TABLE)
    .update({ revoked_at: new Date(now()).toISOString() })
    .eq('token_hash', hashSessionToken(token))
    .is('revoked_at', null)
    .select('id');
  if (error) throw new Error(`[playerSession] could not revoke session (code ${safeCode(error)})`);
  return Array.isArray(data) && data.length > 0;
}

/** Revokes every active session of the player, optionally keeping one (the caller's own). */
export async function revokeAllPlayerSessions(
  playerId: number,
  options: { exceptSessionId?: string } = {},
  deps?: SessionDeps
): Promise<number> {
  if (!isValidPlayerId(playerId)) return 0;
  const { db, now } = resolve(deps);
  let q = db
    .from(SESSION_TABLE)
    .update({ revoked_at: new Date(now()).toISOString() })
    .eq('player_id', playerId)
    .is('revoked_at', null);
  if (options.exceptSessionId) q = q.neq('id', options.exceptSessionId);
  const { data, error } = await q.select('id');
  if (error) throw new Error(`[playerSession] could not revoke sessions (code ${safeCode(error)})`);
  return Array.isArray(data) ? data.length : 0;
}
