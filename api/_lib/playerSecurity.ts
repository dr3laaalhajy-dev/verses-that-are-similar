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

/** Characters that are meaningful inside PostgREST .or() strings or LIKE patterns. */
const FILTER_FORBIDDEN = /[,()%_*\\"']/;

/**
 * True when a value may be placed inside an .or() string or an .ilike() pattern.
 * Rejects empty/whitespace values and anything containing , ( ) % _ * \ " '
 * (which also covers wildcard-only values).
 */
export function isSafeFilterValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  return !FILTER_FORBIDDEN.test(v);
}

/** Characters never allowed in a NEW username (underscore is allowed: usernames are only matched with .eq()). */
const USERNAME_FORBIDDEN = /[,()%*\\"'\s]/;

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
    if (lookup.usernameCaseInsensitive && isSafeFilterValue(cleanU)) {
      const row = (await firstRow(players().ilike('username', cleanU)))
        || (await firstRow(players().ilike('username', `@${cleanU}`)));
      if (row) return row;
    } else {
      const row = (await firstRow(players().eq('username', cleanU)))
        || (await firstRow(players().eq('username', `@${cleanU}`)));
      if (row) return row;
    }
  }

  const name = String(lookup.name ?? '').trim();
  if (isSafeFilterValue(name)) {
    const row = await firstRow(players().ilike('name', name));
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
