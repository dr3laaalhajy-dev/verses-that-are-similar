import bcrypt from 'bcryptjs';

/**
 * Hotfix helpers: password hashing/verification, safe player serialization,
 * and filter-injection guards. This module must NOT import supabaseAdmin so it
 * can be unit-tested with a mocked query client.
 */

export const BCRYPT_COST = 10;
export const MIN_NEW_PASSWORD_LENGTH = 6;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function isBcryptHash(stored: unknown): boolean {
  return typeof stored === 'string' && stored.startsWith('$2');
}

export function hasStoredPassword(stored: unknown): boolean {
  return typeof stored === 'string' && stored.trim().length > 0;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export type PasswordCheck = {
  ok: boolean;
  /** true when the account has no password at all (must contact support). */
  noPassword: boolean;
  /** true when the stored value was legacy plaintext and matched (caller should re-hash). */
  needsUpgrade: boolean;
};

/**
 * Verifies a player password. Stored values starting with "$2" are bcrypt hashes;
 * anything else is treated as legacy plaintext. Empty/missing stored passwords never match.
 */
export async function verifyPassword(input: unknown, stored: unknown): Promise<PasswordCheck> {
  if (!hasStoredPassword(stored)) {
    return { ok: false, noPassword: true, needsUpgrade: false };
  }
  const candidate = typeof input === 'string' ? input : '';
  if (!candidate) {
    return { ok: false, noPassword: false, needsUpgrade: false };
  }
  const storedStr = stored as string;
  if (isBcryptHash(storedStr)) {
    try {
      const ok = await bcrypt.compare(candidate, storedStr);
      return { ok, noPassword: false, needsUpgrade: false };
    } catch {
      return { ok: false, noPassword: false, needsUpgrade: false };
    }
  }
  const ok = storedStr === candidate;
  return { ok, noPassword: false, needsUpgrade: ok };
}

export const NO_PASSWORD_MESSAGE =
  'لا توجد كلمة مرور مسجلة لهذا الحساب. يرجى التواصل مع الدعم الفني لإعادة تعيينها.';

export const NEW_PASSWORD_TOO_SHORT_MESSAGE =
  `كلمة المرور يجب أن لا تقل عن ${MIN_NEW_PASSWORD_LENGTH} خانات`;

// ---------------------------------------------------------------------------
// Serializers (allow-lists — password is never included)
// ---------------------------------------------------------------------------

export const SAFE_PLAYER_FIELDS = [
  'id',
  'uniquePlayerId',
  'deviceId',
  'name',
  'username',
  'usernameChangedAt',
  'points',
  'cups',
  'streak',
  'completedChallengeIds',
  'seerahCompleted',
  'generalCompleted',
  'quranCompleted',
  'activeFrame',
  'equippedNameColor',
  'ownedCosmetics',
  'powerUps',
  'isBlocked',
  'createdAt',
  'updatedAt',
] as const;

export function toSafePlayer(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const key of SAFE_PLAYER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

export const SAFE_ADMIN_FIELDS = [
  'id',
  'username',
  'name',
  'role',
  'isSuperAdmin',
  'canManageUsers',
  'createdAt',
  'updatedAt',
] as const;

export function toSafeAdmin(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, unknown> = {};
  for (const key of SAFE_ADMIN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filter-injection guards
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
/** Values made only of LIKE wildcards / escape chars / whitespace (e.g. "%", "_", "*", "%_*"). */
const WILDCARD_ONLY = /^[%_*\\\s]+$/;

/**
 * True when a value may be used as a lookup/search term: non-empty, no control characters,
 * and not wildcard-only. Characters such as _ ' , ( ) are allowed: values are only ever passed
 * as parameters (.eq) or as ESCAPED .ilike() patterns, never inside string-built .or() filters.
 */
export function isUsableLookupValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (CONTROL_CHARS.test(v)) return false;
  return !WILDCARD_ONLY.test(v);
}

/**
 * Escapes LIKE/ILIKE metacharacters so the value matches literally:
 * backslash, % and _ (SQL wildcards) and * (PostgREST alias for %).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, (ch) => `\\${ch}`);
}

/** Characters never allowed in a NEW username (underscore is allowed: usernames are only matched with .eq()). */
const USERNAME_FORBIDDEN = /[,()%*\\"'\s\u0000-\u001F\u007F]/;

export function isAcceptableNewUsername(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  return !USERNAME_FORBIDDEN.test(v);
}

export function stripAt(value: unknown): string {
  return String(value ?? '').trim().replace(/^@+/, '').trim();
}

// ---------------------------------------------------------------------------
// Player lookup without string-built .or() filters
// ---------------------------------------------------------------------------

export type PlayerLookup = {
  id?: unknown;
  uniquePlayerId?: unknown;
  username?: unknown;
  name?: unknown;
  /** Match username case-insensitively (only when the value is filter-safe). Default false (exact .eq()). */
  usernameCaseInsensitive?: boolean;
};

async function firstRow(query: any): Promise<any | null> {
  try {
    const { data, error } = await query.limit(1).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Finds a single player using separate lookups in priority order:
 * id → uniquePlayerId → username → "@"+username (legacy) → name (case-insensitive exact).
 * `db` is the Supabase client (injected for testability).
 */
export async function findPlayerRow(db: any, lookup: PlayerLookup, columns = '*'): Promise<any | null> {
  const players = () => db.from('players').select(columns);

  const numId = Number(lookup.id);
  if (lookup.id !== undefined && lookup.id !== null && lookup.id !== '' && Number.isInteger(numId) && numId > 0) {
    const row = await firstRow(players().eq('id', numId));
    if (row) return row;
  }

  const unique = String(lookup.uniquePlayerId ?? '').trim().toUpperCase();
  if (unique) {
    const row = await firstRow(players().eq('uniquePlayerId', unique));
    if (row) return row;
  }

  const cleanU = stripAt(lookup.username);
  if (cleanU) {
    if (lookup.usernameCaseInsensitive && isUsableLookupValue(cleanU)) {
      const pattern = escapeLikePattern(cleanU);
      const row = (await firstRow(players().ilike('username', pattern)))
        || (await firstRow(players().ilike('username', `@${pattern}`)));
      if (row) return row;
    } else {
      const row = (await firstRow(players().eq('username', cleanU)))
        || (await firstRow(players().eq('username', `@${cleanU}`)));
      if (row) return row;
    }
  }

  const name = String(lookup.name ?? '').trim();
  if (isUsableLookupValue(name)) {
    const row = await firstRow(players().ilike('name', escapeLikePattern(name)));
    if (row) return row;
  }

  return null;
}

/**
 * Replacement for a string-built `.or(a.eq.X,b.eq.Y)` filter: runs one parameterized
 * `.eq()` query per (column, value) pair and merges the rows (deduplicated by `dedupeKey`),
 * keeping at most `limit` rows. Empty/null values are skipped.
 */
export async function selectByAnyEq(
  db: any,
  table: string,
  columns: string,
  pairs: Array<[column: string, value: unknown]>,
  limit: number,
  dedupeKey?: string
): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const [column, value] of pairs) {
    if (out.length >= limit) break;
    if (value === undefined || value === null || String(value).trim() === '') continue;
    try {
      const { data, error } = await db.from(table).select(columns).eq(column, value).limit(limit);
      if (error || !Array.isArray(data)) continue;
      for (const row of data) {
        const key = dedupeKey ? String(row?.[dedupeKey]) : JSON.stringify(row);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
        if (out.length >= limit) break;
      }
    } catch {
      // ignore a failed branch, like a non-matching .or() branch
    }
  }
  return out;
}

/**
 * Case-insensitive "contains" search over several columns WITHOUT a string-built .or():
 * one escaped .ilike('%term%') query per column, merged and de-duplicated by `id`.
 * `makeQuery` must return a fresh base query (select + any fixed filters) each call.
 * Returns [] for unusable terms (empty, control chars, wildcard-only).
 */
export async function searchContains(
  makeQuery: () => any,
  columns: string[],
  term: string,
  limit?: number
): Promise<any[]> {
  if (!isUsableLookupValue(term)) return [];
  const pattern = `%${escapeLikePattern(term.trim())}%`;
  const out: any[] = [];
  const seen = new Set<string>();
  for (const column of columns) {
    let q = makeQuery().ilike(column, pattern);
    if (limit !== undefined) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    for (const row of data || []) {
      const key = String(row?.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return limit !== undefined ? out.slice(0, limit) : out;
}

/** Returns the id of another player that already uses this username (or "@"+username), else null. */
export async function findUsernameOwnerId(db: any, username: string, excludeId?: number): Promise<number | null> {
  const clean = stripAt(username);
  if (!clean) return null;
  for (const candidate of [clean, `@${clean}`]) {
    let q = db.from('players').select('id').eq('username', candidate);
    if (excludeId !== undefined) q = q.neq('id', excludeId);
    const row = await firstRow(q);
    if (row) return Number(row.id);
  }
  return null;
}
