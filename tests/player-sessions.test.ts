/**
 * Player sessions: issue, verify, expiry, revoke, sliding renewal, max sessions, no token leaks,
 * and the /api/player-register wiring (login, register, change-password, delete-account, logout).
 * Fully offline (in-memory fake DB). Run with:
 *   node --import tsx --experimental-test-module-mocks --test tests/player-sessions.test.ts
 */
import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// In-memory fake of the Supabase query builder subset used by the API
// ---------------------------------------------------------------------------
type Row = Record<string, any>;

function likeToRegex(pattern: string) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (ch === '%' || ch === '*') re += '.*';
    else if (ch === '_') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is');
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  /** When set, any operation on this table returns this error. */
  failTable: string | null = null;
  failError: any = null;
  from(t: string) { return new Query(this, t); }
  rows(t: string) { return (this.tables[t] ||= []); }
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: any = null;
  private max = Infinity;
  private wantRows = false;
  constructor(private db: FakeDb, private table: string) {}
  select(_c?: string) { this.wantRows = true; return this; }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this; }
  is(c: string, v: any) { this.filters.push(r => (r[c] ?? null) === v); return this; }
  gt(c: string, v: any) { this.filters.push(r => String(r[c]) > String(v)); return this; }
  in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this; }
  ilike(c: string, p: string) { const re = likeToRegex(p); this.filters.push(r => typeof r[c] === 'string' && re.test(r[c])); return this; }
  or(_s: string) { this.filters.push(() => false); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  update(d: any) { this.op = 'update'; this.payload = d; return this; }
  insert(d: any) { this.op = 'insert'; this.payload = d; return this; }
  delete() { this.op = 'delete'; return this; }
  private run(): { data: Row[] | null; error: any } {
    if (this.db.failTable === this.table) return { data: null, error: this.db.failError };
    const all = this.db.rows(this.table);
    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const out: Row[] = [];
      for (const item of items) {
        if (this.table === 'player_sessions' && all.some(r => r.token_hash === item.token_hash)) {
          return { data: null, error: { code: '23505', message: 'duplicate key', details: `Key (token_hash)=(${item.token_hash}) already exists.` } };
        }
        const id = this.table === 'player_sessions' ? `sess-${++this.db.seq}` : all.length + 1;
        const row = { id, revoked_at: null, ...item };
        all.push(row);
        out.push({ ...row });
      }
      return { data: out, error: null };
    }
    const matched = all.filter(r => this.filters.every(f => f(r))).slice(0, this.max);
    if (this.op === 'update') matched.forEach(r => Object.assign(r, this.payload));
    if (this.op === 'delete') this.db.tables[this.table] = all.filter(r => !matched.includes(r));
    return { data: matched.map(r => ({ ...r })), error: null };
  }
  async maybeSingle() { const r = this.run(); return { data: r.data?.[0] ?? null, error: r.error }; }
  async single() { const r = this.run(); return r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: r.error ?? { message: 'no rows' } }; }
  then(resolve: any, reject: any) { return Promise.resolve(this.run()).then(resolve, reject); }
}

// Shared DB used by the mocked supabaseAdmin (player-register integration tests).
let sharedDb = new FakeDb();
const proxyDb = { from: (t: string) => sharedDb.from(t) };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const bearer = (t: string) => ({ headers: { authorization: `Bearer ${t}` } });
const DAY = 24 * 60 * 60 * 1000;

function makeClock(start = Date.parse('2026-11-13T12:00:00Z')) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

function mockRes() {
  return {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    end() { return this; },
  };
}

/** Captures console.error/warn/log output during fn. */
async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const out: string[] = [];
  const orig = { error: console.error, warn: console.warn, log: console.log };
  const grab = (...a: any[]) => out.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  console.error = grab; console.warn = grab; console.log = grab;
  try { return { result: await fn(), logs: out.join('\n') }; }
  finally { Object.assign(console, orig); }
}

let S: typeof import('../api/_lib/playerSession.ts');
let registerHandler: any;

before(async () => {
  const supaUrl = new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href;
  mock.module(supaUrl, { namedExports: { supabaseAdmin: proxyDb }, defaultExport: proxyDb });
  const uidUrl = new URL('../api/_lib/uniquePlayerId.ts', import.meta.url).href;
  mock.module(uidUrl, { namedExports: { getOrGenerateUniquePlayerId: async () => 'MT-TEST' } });
  S = await import('../api/_lib/playerSession.ts');
  registerHandler = (await import('../api/player-register.ts')).default;
});

beforeEach(() => { sharedDb = new FakeDb(); });

// ---------------------------------------------------------------------------
// Unit: playerSession.ts
// ---------------------------------------------------------------------------
test('issue: 32-byte base64url token; DB stores only its SHA-256 hash', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token, expiresAt } = await S.issuePlayerSession(7, { db, now: clock.now });
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(token, 'base64url').length, 32);
  const rows = db.rows('player_sessions');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha(token));
  assert.ok(!JSON.stringify(rows).includes(token), 'raw token must not be stored');
  assert.equal(Date.parse(expiresAt) - clock.now(), S.SESSION_TTL_MS);
  assert.equal(rows[0].player_id, 7);
});

test('issue: two sessions never share a token', async () => {
  const db = new FakeDb();
  const a = await S.issuePlayerSession(1, { db });
  const b = await S.issuePlayerSession(1, { db });
  assert.notEqual(a.token, b.token);
});

test('issue: rejects invalid player ids', async () => {
  for (const bad of [0, -1, 1.5, NaN, '3' as any, null as any]) {
    await assert.rejects(() => S.issuePlayerSession(bad, { db: new FakeDb() }), /invalid player id/);
  }
});

test('verify: valid Bearer token -> player id', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token } = await S.issuePlayerSession(42, { db, now: clock.now });
  const ctx = await S.authenticatePlayer(bearer(token), { db, now: clock.now });
  assert.equal(ctx?.playerId, 42);
  assert.equal(ctx?.sessionId, db.rows('player_sessions')[0].id);
});

test('verify: missing/malformed/unknown tokens -> null', async () => {
  const db = new FakeDb();
  const { token } = await S.issuePlayerSession(42, { db });
  const cases = [
    { headers: {} },
    { headers: { authorization: token } },                       // no "Bearer"
    { headers: { authorization: `Basic ${token}` } },
    { headers: { authorization: 'Bearer ' } },
    { headers: { authorization: `Bearer ${token}x` } },          // wrong length
    { headers: { authorization: `Bearer ${token.slice(0, 42)}!` } },
    bearer('A'.repeat(43)),                                       // well-formed but unknown
  ];
  for (const req of cases) assert.equal(await S.authenticatePlayer(req as any, { db }), null);
});

test('expiry: token stops working after 30 days without use', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token } = await S.issuePlayerSession(5, { db, now: clock.now });
  clock.advance(S.SESSION_TTL_MS - 1000);
  // Look without renewing: read row directly to confirm it's still valid just before expiry.
  assert.ok(Date.parse(db.rows('player_sessions')[0].expires_at) > clock.now());
  clock.advance(2000);
  assert.equal(await S.authenticatePlayer(bearer(token), { db, now: clock.now }), null);
});

test('revoke: revoked token -> null (logout path)', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token } = await S.issuePlayerSession(5, { db, now: clock.now });
  assert.equal(await S.revokeSessionByToken(token, { db, now: clock.now }), true);
  assert.equal(await S.authenticatePlayer(bearer(token), { db, now: clock.now }), null);
  assert.equal(await S.revokeSessionByToken(token, { db, now: clock.now }), false, 'second revoke is a no-op');
  assert.equal(await S.revokeSessionByToken('not-a-token', { db }), false);
});

test('revoke all: keeps only the excepted session', async () => {
  const db = new FakeDb();
  const a = await S.issuePlayerSession(9, { db });
  const b = await S.issuePlayerSession(9, { db });
  const other = await S.issuePlayerSession(10, { db });
  const ctxA = await S.authenticatePlayer(bearer(a.token), { db });
  assert.equal(await S.revokeAllPlayerSessions(9, { exceptSessionId: ctxA!.sessionId }, { db }), 1);
  assert.ok(await S.authenticatePlayer(bearer(a.token), { db }));
  assert.equal(await S.authenticatePlayer(bearer(b.token), { db }), null);
  assert.ok(await S.authenticatePlayer(bearer(other.token), { db }), 'other players untouched');
  assert.equal(await S.revokeAllPlayerSessions(9, {}, { db }), 1);
  assert.equal(await S.authenticatePlayer(bearer(a.token), { db }), null);
});

test('sliding renewal: use extends expiry to now+30d; no write within the touch interval', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token } = await S.issuePlayerSession(3, { db, now: clock.now });
  const row = db.rows('player_sessions')[0];

  clock.advance(20 * DAY);
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }));
  assert.equal(Date.parse(row.expires_at), clock.now() + S.SESSION_TTL_MS);
  assert.equal(Date.parse(row.last_used_at), clock.now());

  const before = row.expires_at;
  clock.advance(S.SESSION_TOUCH_INTERVAL_MS - 1);
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }));
  assert.equal(row.expires_at, before, 'no renewal write inside the interval');

  clock.advance(25 * DAY); // 45 days after creation, but used within the last 30
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }), 'still valid thanks to renewal');
});

test(`max sessions: at most ${10} active per player, oldest revoked`, async () => {
  const db = new FakeDb(); const clock = makeClock();
  const tokens: string[] = [];
  for (let i = 0; i < S.MAX_ACTIVE_SESSIONS + 2; i++) {
    clock.advance(1000);
    tokens.push((await S.issuePlayerSession(11, { db, now: clock.now })).token);
  }
  const active = db.rows('player_sessions').filter(r => !r.revoked_at);
  assert.equal(active.length, S.MAX_ACTIVE_SESSIONS);
  assert.equal(await S.authenticatePlayer(bearer(tokens[0]), { db, now: clock.now }), null, 'oldest revoked');
  assert.equal(await S.authenticatePlayer(bearer(tokens[1]), { db, now: clock.now }), null, '2nd oldest revoked');
  assert.ok(await S.authenticatePlayer(bearer(tokens[2]), { db, now: clock.now }));
  assert.ok(await S.authenticatePlayer(bearer(tokens.at(-1)!), { db, now: clock.now }));
  // Other players are not counted
  await S.issuePlayerSession(12, { db, now: clock.now });
  assert.equal(db.rows('player_sessions').filter(r => r.player_id === 11 && !r.revoked_at).length, S.MAX_ACTIVE_SESSIONS);
});

test('requirePlayer: bare 401 without details; context when valid', async () => {
  const db = new FakeDb();
  const res = mockRes();
  assert.equal(await S.requirePlayer({ headers: {} } as any, res as any, { db }), null);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Unauthorized' });

  const { token } = await S.issuePlayerSession(8, { db });
  await S.revokeSessionByToken(token, { db });
  const res2 = mockRes();
  assert.equal(await S.requirePlayer(bearer(token) as any, res2 as any, { db }), null);
  assert.deepEqual(res2.body, { error: 'Unauthorized' }, 'revoked looks identical to missing');

  const fresh = await S.issuePlayerSession(8, { db });
  const res3 = mockRes();
  const ctx = await S.requirePlayer(bearer(fresh.token) as any, res3 as any, { db });
  assert.equal(ctx?.playerId, 8);
  assert.equal(res3.body, undefined);
});

test('no leaks: DB errors that echo the hash never reach error messages or logs', async () => {
  const db = new FakeDb(); const clock = makeClock();
  const { token } = await S.issuePlayerSession(4, { db, now: clock.now });
  const hash = sha(token);
  // Simulate PostgREST echoing the value back in its error.
  db.failTable = 'player_sessions';
  db.failError = { code: '23505', message: `dup ${hash} ${token}`, details: `Key (token_hash)=(${hash})`, hint: token };

  const { result: err, logs } = await captureLogs(async () => {
    const e1 = await S.issuePlayerSession(4, { db, now: clock.now }).then(() => null, (e: Error) => e);
    const ctx = await S.authenticatePlayer(bearer(token), { db, now: clock.now });
    const e2 = await S.revokeSessionByToken(token, { db }).then(() => null, (e: Error) => e);
    const e3 = await S.revokeAllPlayerSessions(4, {}, { db }).then(() => null, (e: Error) => e);
    assert.equal(ctx, null);
    return [e1, e2, e3];
  });
  for (const e of err) {
    assert.ok(e instanceof Error);
    assert.ok(!e.message.includes(hash) && !e.message.includes(token), `leak in: ${e.message}`);
    assert.match(e.message, /code 23505/);
  }
  assert.ok(!logs.includes(hash) && !logs.includes(token), 'leak in logs');
});

test('REQUIRE_PLAYER_TOKEN is off by default', () => {
  assert.equal(S.isPlayerTokenRequired({}), false);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: '' }), false);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: 'false' }), false);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: 'true' }), true);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: ' ON ' }), true);
});

// ---------------------------------------------------------------------------
// Integration: /api/player-register
// ---------------------------------------------------------------------------
async function call(body: any, headers: Record<string, string> = {}) {
  const res = mockRes();
  await registerHandler({ method: 'POST', body, headers, query: {} }, res);
  return res;
}

function seedPlayer(id: number, username: string, password: string) {
  sharedDb.rows('players').push({
    id, name: `Player ${id}`, username, uniquePlayerId: `MT-P${id}`,
    password: bcrypt.hashSync(password, 4), isBlocked: false,
  });
}

test('login returns a playerToken that verifies; response has no hash', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const { result: res, logs } = await captureLogs(() => call({ action: 'login', username: 'alice', password: 'secret-pass' }));
  assert.equal(res.statusCode, 200);
  assert.match(res.body.playerToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(res.body.playerTokenExpiresAt) > Date.now());
  assert.equal(res.body.player.password, undefined);
  const ctx = await S.authenticatePlayer(bearer(res.body.playerToken));
  assert.equal(ctx?.playerId, 1);
  const hash = sha(res.body.playerToken);
  assert.ok(!JSON.stringify(res.body).includes(hash));
  assert.ok(!logs.includes(res.body.playerToken) && !logs.includes(hash));
});

test('wrong password: no token issued', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const res = await call({ action: 'login', username: 'alice', password: 'nope-nope' });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.playerToken, undefined);
  assert.equal(sharedDb.rows('player_sessions').length, 0);
});

test('register returns a playerToken', async () => {
  const res = await call({ name: 'Bob Test', username: 'bob', password: 'bob-pass-1' });
  assert.equal(res.statusCode, 200);
  const ctx = await S.authenticatePlayer(bearer(res.body.playerToken));
  assert.equal(ctx?.playerId, res.body.player.id);
});

test('login still succeeds (without token) if the sessions table is unavailable', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  sharedDb.failTable = 'player_sessions';
  sharedDb.failError = { code: '42P01', message: 'relation "player_sessions" does not exist' };
  const { result: res } = await captureLogs(() => call({ action: 'login', username: 'alice', password: 'secret-pass' }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.playerToken, undefined);
});

test('change-password with own token: other sessions revoked, current kept', async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const t2 = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const res = await call(
    { action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' },
    { authorization: `Bearer ${t1}` }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.playerToken, undefined, 'caller keeps its own token');
  assert.ok(await S.authenticatePlayer(bearer(t1)));
  assert.equal(await S.authenticatePlayer(bearer(t2)), null);
});

test('change-password without token (old app): all sessions revoked, fresh token returned', async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const res = await call({ action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' });
  assert.equal(res.statusCode, 200);
  assert.equal(await S.authenticatePlayer(bearer(t1)), null);
  assert.ok(await S.authenticatePlayer(bearer(res.body.playerToken)));
});

test("change-password with ANOTHER player's token does not keep that token's player sessions alive", async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  seedPlayer(2, 'mallory', 'mal-pass-1');
  const ta = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const tm = (await call({ action: 'login', username: 'mallory', password: 'mal-pass-1' })).body.playerToken;
  const res = await call(
    { action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' },
    { authorization: `Bearer ${tm}` }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(await S.authenticatePlayer(bearer(ta)), null, "alice's old session revoked");
  assert.ok(await S.authenticatePlayer(bearer(tm)), "mallory's own session untouched");
  assert.ok(res.body.playerToken, 'alice gets a fresh token');
});

test('logout revokes only the current session; idempotent; no token -> still 200', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const t2 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const res = await call({ action: 'logout' }, { authorization: `Bearer ${t1}` });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
  assert.equal(await S.authenticatePlayer(bearer(t1)), null);
  assert.ok(await S.authenticatePlayer(bearer(t2)));
  assert.equal((await call({ action: 'logout' }, { authorization: `Bearer ${t1}` })).statusCode, 200);
  assert.deepEqual((await call({ action: 'logout' })).body, { success: true });
});

test('delete-account revokes all sessions of that player', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const t2 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const res = await call({ action: 'delete-account', username: 'alice', password: 'secret-pass' });
  assert.equal(res.statusCode, 200);
  assert.equal(await S.authenticatePlayer(bearer(t1)), null);
  assert.equal(await S.authenticatePlayer(bearer(t2)), null);
  assert.ok(sharedDb.rows('player_sessions').every(r => r.revoked_at));
});

test('old endpoints still work without a token (enforcement off)', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const res = await call({ action: 'update-profile', currentUsername: 'alice', name: 'Alice Renamed' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.player.name, 'Alice Renamed');
});
