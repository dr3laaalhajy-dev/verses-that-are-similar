import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { isPlayerBlocked } from './playerSecurity.js';

/**
 * Player sessions (server side only).
 *
 * - The client receives a random 32-byte token (base64url, 43 chars) once, at login/register.
 * - The database stores ONLY its SHA-256 hash (table public.player_sessions, service_role only).
 * - Sessions last 30 days and slide forward on use.
 * - One active session per player by default (MAX_ACTIVE_PLAYER_SESSIONS = 1): a new login
 *   revokes the older sessions with revoked_reason = 'replaced'.
 * - Every revocation records why: 'replaced' | 'logout' | 'password_changed' | 'account_deleted'.
 * - A session of a blocked (or deleted) player is rejected.
 * - Tokens and their hashes are never logged and never placed in error messages.
 *
 * Enforcement switch: REQUIRE_PLAYER_TOKEN (off by default). In this step nothing enforces it;
 * endpoints only issue tokens. See isPlayerTokenRequired().
 */

export const SESSION_TABLE = 'player_sessions';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_PLAYER_SESSIONS = 1;
/** Sliding renewal writes at most once per interval per session (avoids a DB write per request). */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export const REVOKE_REASONS = ['replaced', 'logout', 'password_changed', 'account_deleted'] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/** The only two failure codes a client ever sees. */
export type SessionFailureCode = 'SESSION_REPLACED' | 'SESSION_INVALID';

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface SessionDeps {
  /** Supabase-like client (defaults to the shared service-role client). */
  db?: any;
  /** Clock in ms (defaults to Date.now). */
  now?: () => number;
  /** Override for MAX_ACTIVE_PLAYER_SESSIONS (tests only). */
  maxActiveSessions?: number;
}

export interface IssuedPlayerSession {
  token: string;
  expiresAt: string;
}

export interface PlayerSessionContext {
  playerId: number;
  sessionId: string;
}

export type SessionCheck =
  | { ok: true; session: PlayerSessionContext }
  | { ok: false; code: SessionFailureCode };

function resolve(deps: SessionDeps = {}) {
  return {
    db: deps.db ?? supabaseAdmin,
    now: deps.now ?? Date.now,
    maxActive: Math.max(1, Math.floor(deps.maxActiveSessions ?? MAX_ACTIVE_PLAYER_SESSIONS)),
  };
}

/** Only the error code is ever surfaced/logged: DB messages can echo values (e.g. a unique-key detail). */
function safeCode(error: any): string {
  return String(error?.code ?? 'unknown').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'unknown';
}

function isValidPlayerId(playerId: unknown): playerId is number {
  return typeof playerId === 'number' && Number.isInteger(playerId) && playerId > 0;
}

function assertReason(reason: RevokeReason): void {
  if (!REVOKE_REASONS.includes(reason)) throw new Error('[playerSession] invalid revoke reason');
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

/**
 * Creates a new session for the player and returns the raw token (shown to the client once).
 * Older active sessions beyond the limit are revoked with reason 'replaced'.
 */
export async function issuePlayerSession(playerId: number, deps?: SessionDeps): Promise<IssuedPlayerSession> {
  if (!isValidPlayerId(playerId)) {
    throw new Error('[playerSession] invalid player id');
  }
  const { db, now } = resolve(deps);
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const nowMs = now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + SESSION_TTL_MS).toISOString();

  const { data, error } = await db
    .from(SESSION_TABLE)
    .insert({
      player_id: playerId,
      token_hash: hashSessionToken(token),
      created_at: nowIso,
      last_used_at: nowIso,
      expires_at: expiresAt,
    })
    .select('id')
    .single();
  if (error || !data?.id) {
    throw new Error(`[playerSession] could not create session (code ${safeCode(error)})`);
  }

  try {
    await enforceSessionLimit(playerId, String(data.id), nowIso, deps);
  } catch (e: any) {
    // The new session is valid; trimming old ones is retried on the next login.
    console.error('[playerSession] session limit not enforced:', e?.message ?? 'unknown');
  }

  return { token, expiresAt };
}

/**
 * Keeps the new session plus at most (limit - 1) of the most recent older active sessions;
 * revokes the rest with reason 'replaced'. Only sessions created at or before the new one are
 * considered, so a newer concurrent login is never revoked by an older one.
 */
export async function enforceSessionLimit(
  playerId: number,
  newSessionId: string,
  newCreatedAtIso: string,
  deps?: SessionDeps
): Promise<number> {
  const { db, now, maxActive } = resolve(deps);
  const nowIso = new Date(now()).toISOString();
  const { data, error } = await db
    .from(SESSION_TABLE)
    .select('id, created_at')
    .eq('player_id', playerId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .lte('created_at', newCreatedAtIso)
    .neq('id', newSessionId);
  if (error) throw new Error(`[playerSession] could not list sessions (code ${safeCode(error)})`);

  const older = (Array.isArray(data) ? data : [])
    .slice()
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const extra = older.slice(maxActive - 1).map((row: any) => row.id);
  if (extra.length === 0) return 0;

  const { error: revokeErr } = await db
    .from(SESSION_TABLE)
    .update({ revoked_at: nowIso, revoked_reason: 'replaced' satisfies RevokeReason })
    .in('id', extra)
    .is('revoked_at', null);
  if (revokeErr) throw new Error(`[playerSession] could not revoke old sessions (code ${safeCode(revokeErr)})`);
  return extra.length;
}

/**
 * Full check of the Bearer token: hash lookup, not revoked, not expired, player exists and is
 * not blocked. Slides the expiry on success. Failure codes:
 *   SESSION_REPLACED  the session was revoked because the player logged in elsewhere
 *   SESSION_INVALID   anything else (missing, malformed, unknown, expired, logged out,
 *                     password changed, account deleted, player blocked, lookup error)
 */
export async function verifyPlayerSession(
  req: Pick<VercelRequest, 'headers'>,
  deps?: SessionDeps
): Promise<SessionCheck> {
  const invalid: SessionCheck = { ok: false, code: 'SESSION_INVALID' };
  const token = extractBearerToken(req);
  if (!token) return invalid;
  const { db, now } = resolve(deps);

  let row: any;
  try {
    const { data, error } = await db
      .from(SESSION_TABLE)
      .select('id, player_id, expires_at, revoked_at, revoked_reason, last_used_at')
      .eq('token_hash', hashSessionToken(token))
      .maybeSingle();
    if (error) {
      console.error(`[playerSession] lookup failed (code ${safeCode(error)})`);
      return invalid;
    }
    row = data;
  } catch {
    console.error('[playerSession] lookup failed (code exception)');
    return invalid;
  }

  if (!row) return invalid;
  if (row.revoked_at) {
    return row.revoked_reason === 'replaced' ? { ok: false, code: 'SESSION_REPLACED' } : invalid;
  }
  const nowMs = now();
  const expiresMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return invalid;
  const playerId = Number(row.player_id);
  if (!isValidPlayerId(playerId)) return invalid;

  // Same rule as login: a blocked (or deleted) player has no valid session.
  try {
    const { data: player, error } = await db
      .from('players')
      .select('id, isBlocked')
      .eq('id', playerId)
      .maybeSingle();
    if (error) {
      console.error(`[playerSession] player check failed (code ${safeCode(error)})`);
      return invalid;
    }
    if (!player || isPlayerBlocked(player)) return invalid;
  } catch {
    console.error('[playerSession] player check failed (code exception)');
    return invalid;
  }

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

  return { ok: true, session: { playerId, sessionId: String(row.id) } };
}

/** Convenience wrapper: the session context, or null for any failure. */
export async function authenticatePlayer(
  req: Pick<VercelRequest, 'headers'>,
  deps?: SessionDeps
): Promise<PlayerSessionContext | null> {
  const check = await verifyPlayerSession(req, deps);
  return check.ok ? check.session : null;
}

/**
 * For endpoints that require a player: returns the session context, or sends 401 with only
 * { code: 'SESSION_REPLACED' | 'SESSION_INVALID' } and returns null.
 */
export async function requirePlayer(
  req: Pick<VercelRequest, 'headers'>,
  res: VercelResponse,
  deps?: SessionDeps
): Promise<PlayerSessionContext | null> {
  const check = await verifyPlayerSession(req, deps);
  if (check.ok === false) {
    res.status(401).json({ code: check.code });
    return null;
  }
  return check.session;
}

/** Revokes the session that belongs to this raw token (logout). Returns true if one was revoked. */
export async function revokeSessionByToken(
  token: string,
  reason: RevokeReason = 'logout',
  deps?: SessionDeps
): Promise<boolean> {
  assertReason(reason);
  if (!TOKEN_PATTERN.test(String(token ?? ''))) return false;
  const { db, now } = resolve(deps);
  const { data, error } = await db
    .from(SESSION_TABLE)
    .update({ revoked_at: new Date(now()).toISOString(), revoked_reason: reason })
    .eq('token_hash', hashSessionToken(token))
    .is('revoked_at', null)
    .select('id');
  if (error) throw new Error(`[playerSession] could not revoke session (code ${safeCode(error)})`);
  return Array.isArray(data) && data.length > 0;
}

/** Revokes every active session of the player with the given reason, optionally keeping one. */
export async function revokeAllPlayerSessions(
  playerId: number,
  reason: RevokeReason,
  options: { exceptSessionId?: string } = {},
  deps?: SessionDeps
): Promise<number> {
  assertReason(reason);
  if (!isValidPlayerId(playerId)) return 0;
  const { db, now } = resolve(deps);
  let q = db
    .from(SESSION_TABLE)
    .update({ revoked_at: new Date(now()).toISOString(), revoked_reason: reason })
    .eq('player_id', playerId)
    .is('revoked_at', null);
  if (options.exceptSessionId) q = q.neq('id', options.exceptSessionId);
  const { data, error } = await q.select('id');
  if (error) throw new Error(`[playerSession] could not revoke sessions (code ${safeCode(error)})`);
  return Array.isArray(data) ? data.length : 0;
}
