/**
 * Player sessions: issue, verify, expiry, revoke reasons, sliding renewal, one active session
 * per player (SESSION_REPLACED), blocked players, no token leaks, and the /api/player-register
 * wiring (login, register, change-password, delete-account, logout).
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
  /** Seeds players (unblocked unless stated) so session checks can find them. */
  withPlayers(...ids: number[]) {
    for (const id of ids) this.rows('players').push({ id, name: `P${id}`, isBlocked: false });
    return this;
  }
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: any = null;
  private max = Infinity;
  constructor(private db: FakeDb, private table: string) {}
  select(_c?: string) { return this; }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this; }
  is(c: string, v: any) { this.filters.push(r => (r[c] ?? null) === v); return this; }
  gt(c: string, v: any) { this.filters.push(r => String(r[c]) > String(v)); return this; }
  lte(c: string, v: any) { this.filters.push(r => String(r[c]) <= String(v)); return this; }
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
        const row = this.table === 'player_sessions'
          ? { id, revoked_at: null, revoked_reason: null, ...item }
          : { id, ...item };
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

/** requirePlayer and return {status, body, ctx}. */
async function check(token: string | null, deps: any = {}) {
  const res = mockRes();
  const req = token ? bearer(token) : { headers: {} };
  const ctx = await S.requirePlayer(req as any, res as any, deps);
  return { status: res.statusCode, body: res.body, ctx };
}

// ---------------------------------------------------------------------------
// Unit: playerSession.ts
// ---------------------------------------------------------------------------
test('defaults: one active session per player; REQUIRE_PLAYER_TOKEN off', () => {
  assert.equal(S.MAX_ACTIVE_PLAYER_SESSIONS, 1);
  assert.deepEqual([...S.REVOKE_REASONS], ['replaced', 'logout', 'password_changed', 'account_deleted']);
  assert.equal(S.isPlayerTokenRequired({}), false);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: 'false' }), false);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: 'true' }), true);
  assert.equal(S.isPlayerTokenRequired({ REQUIRE_PLAYER_TOKEN: ' ON ' }), true);
});

test('issue: 32-byte base64url token; DB stores only its SHA-256 hash', async () => {
  const db = new FakeDb().withPlayers(7); const clock = makeClock();
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

test('issue: rejects invalid player ids', async () => {
  for (const bad of [0, -1, 1.5, NaN, '3' as any, null as any]) {
    await assert.rejects(() => S.issuePlayerSession(bad, { db: new FakeDb() }), /invalid player id/);
  }
});

test('verify: valid token -> player id; requirePlayer passes through', async () => {
  const db = new FakeDb().withPlayers(42); const clock = makeClock();
  const { token } = await S.issuePlayerSession(42, { db, now: clock.now });
  const r = await check(token, { db, now: clock.now });
  assert.equal(r.ctx?.playerId, 42);
  assert.equal(r.ctx?.sessionId, db.rows('player_sessions')[0].id);
  assert.equal(r.body, undefined);
});

test('verify: missing/malformed/unknown -> 401 { code: SESSION_INVALID } and nothing else', async () => {
  const db = new FakeDb().withPlayers(42);
  const { token } = await S.issuePlayerSession(42, { db });
  const headerCases = [
    {},
    { authorization: token },                                  // no "Bearer"
    { authorization: `Basic ${token}` },
    { authorization: 'Bearer ' },
    { authorization: `Bearer ${token}x` },                     // wrong length
    { authorization: `Bearer ${token.slice(0, 42)}!` },
    { authorization: `Bearer ${'A'.repeat(43)}` },             // well-formed but unknown
  ];
  for (const headers of headerCases) {
    const res = mockRes();
    assert.equal(await S.requirePlayer({ headers } as any, res as any, { db }), null);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { code: 'SESSION_INVALID' });
  }
});

test('expiry: 30 days without use -> SESSION_INVALID', async () => {
  const db = new FakeDb().withPlayers(5); const clock = makeClock();
  const { token } = await S.issuePlayerSession(5, { db, now: clock.now });
  clock.advance(S.SESSION_TTL_MS + 1000);
  const r = await check(token, { db, now: clock.now });
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { code: 'SESSION_INVALID' });
});

test('sliding renewal: use extends expiry to now+30d; no write within the touch interval', async () => {
  const db = new FakeDb().withPlayers(3); const clock = makeClock();
  const { token } = await S.issuePlayerSession(3, { db, now: clock.now });
  const row = db.rows('player_sessions')[0];

  clock.advance(20 * DAY);
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }));
  assert.equal(Date.parse(row.expires_at), clock.now() + S.SESSION_TTL_MS);
  assert.equal(Date.parse(row.last_used_at), clock.now());

  const prev = row.expires_at;
  clock.advance(S.SESSION_TOUCH_INTERVAL_MS - 1);
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }));
  assert.equal(row.expires_at, prev, 'no renewal write inside the interval');

  clock.advance(25 * DAY); // 45 days after creation, but used within the last 30
  assert.ok(await S.authenticatePlayer(bearer(token), { db, now: clock.now }), 'still valid thanks to renewal');
});

test('two devices: second login revokes the first (reason replaced -> SESSION_REPLACED); second stays valid', async () => {
  const db = new FakeDb().withPlayers(11, 12); const clock = makeClock();
  const deviceA = await S.issuePlayerSession(11, { db, now: clock.now });
  clock.advance(1000);
  const deviceB = await S.issuePlayerSession(11, { db, now: clock.now });
  const other = await S.issuePlayerSession(12, { db, now: clock.now });

  const a = await check(deviceA.token, { db, now: clock.now });
  assert.equal(a.status, 401);
  assert.deepEqual(a.body, { code: 'SESSION_REPLACED' });
  assert.equal(db.rows('player_sessions').find(r => r.token_hash === sha(deviceA.token)).revoked_reason, 'replaced');

  assert.equal((await check(deviceB.token, { db, now: clock.now })).ctx?.playerId, 11);
  assert.equal((await check(other.token, { db, now: clock.now })).ctx?.playerId, 12, 'other players untouched');
  assert.equal(db.rows('player_sessions').filter(r => r.player_id === 11 && !r.revoked_at).length, 1);
});

test('same-millisecond logins: the newer login still revokes the older one', async () => {
  const db = new FakeDb().withPlayers(13); const clock = makeClock();
  const first = await S.issuePlayerSession(13, { db, now: clock.now });
  const second = await S.issuePlayerSession(13, { db, now: clock.now });
  assert.deepEqual((await check(first.token, { db, now: clock.now })).body, { code: 'SESSION_REPLACED' });
  assert.ok((await check(second.token, { db, now: clock.now })).ctx);
});

test('limit override (maxActiveSessions) keeps the newest N', async () => {
  const db = new FakeDb().withPlayers(14); const clock = makeClock();
  const tokens: string[] = [];
  for (let i = 0; i < 5; i++) {
    clock.advance(1000);
    tokens.push((await S.issuePlayerSession(14, { db, now: clock.now, maxActiveSessions: 3 })).token);
  }
  const active = db.rows('player_sessions').filter(r => !r.revoked_at);
  assert.equal(active.length, 3);
  assert.deepEqual((await check(tokens[0], { db, now: clock.now })).body, { code: 'SESSION_REPLACED' });
  assert.deepEqual((await check(tokens[1], { db, now: clock.now })).body, { code: 'SESSION_REPLACED' });
  assert.ok((await check(tokens[4], { db, now: clock.now })).ctx);
});

test('revoke reasons: logout / password_changed / account_deleted all -> SESSION_INVALID', async () => {
  for (const reason of ['logout', 'password_changed', 'account_deleted'] as const) {
    const db = new FakeDb().withPlayers(5);
    const { token } = await S.issuePlayerSession(5, { db });
    if (reason === 'logout') assert.equal(await S.revokeSessionByToken(token, 'logout', { db }), true);
    else assert.equal(await S.revokeAllPlayerSessions(5, reason, {}, { db }), 1);
    assert.equal(db.rows('player_sessions')[0].revoked_reason, reason);
    const r = await check(token, { db });
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { code: 'SESSION_INVALID' }, `${reason} must not reveal the reason`);
  }
});

test('revoke: second logout is a no-op; garbage token ignored; unknown reason rejected', async () => {
  const db = new FakeDb().withPlayers(5);
  const { token } = await S.issuePlayerSession(5, { db });
  assert.equal(await S.revokeSessionByToken(token, 'logout', { db }), true);
  assert.equal(await S.revokeSessionByToken(token, 'logout', { db }), false);
  assert.equal(db.rows('player_sessions')[0].revoked_reason, 'logout', 'reason not overwritten');
  assert.equal(await S.revokeSessionByToken('not-a-token', 'logout', { db }), false);
  await assert.rejects(() => S.revokeAllPlayerSessions(5, 'hacked' as any, {}, { db }), /invalid revoke reason/);
});

test('revoke all: exceptSessionId keeps the caller', async () => {
  const db = new FakeDb().withPlayers(9);
  const a = await S.issuePlayerSession(9, { db, maxActiveSessions: 5 });
  const b = await S.issuePlayerSession(9, { db, maxActiveSessions: 5 });
  const ctxA = await S.authenticatePlayer(bearer(a.token), { db });
  assert.equal(await S.revokeAllPlayerSessions(9, 'password_changed', { exceptSessionId: ctxA!.sessionId }, { db }), 1);
  assert.ok(await S.authenticatePlayer(bearer(a.token), { db }));
  assert.equal(await S.authenticatePlayer(bearer(b.token), { db }), null);
});

test('blocked player: valid session is rejected (SESSION_INVALID); unblocking restores it', async () => {
  const db = new FakeDb().withPlayers(21);
  const { token } = await S.issuePlayerSession(21, { db });
  db.rows('players')[0].isBlocked = true;
  const r = await check(token, { db });
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { code: 'SESSION_INVALID' });
  db.rows('players')[0].isBlocked = false;
  assert.equal((await check(token, { db })).ctx?.playerId, 21);
});

test('deleted player: session rejected even if the row was not revoked', async () => {
  const db = new FakeDb().withPlayers(22);
  const { token } = await S.issuePlayerSession(22, { db });
  db.tables.players = [];
  assert.deepEqual((await check(token, { db })).body, { code: 'SESSION_INVALID' });
});

test('no leaks: DB errors that echo the hash never reach error messages, logs or responses', async () => {
  const db = new FakeDb().withPlayers(4); const clock = makeClock();
  const { token } = await S.issuePlayerSession(4, { db, now: clock.now });
  const hash = sha(token);
  db.failTable = 'player_sessions';
  db.failError = { code: '23505', message: `dup ${hash} ${token}`, details: `Key (token_hash)=(${hash})`, hint: token };

  const { result, logs } = await captureLogs(async () => {
    const e1 = await S.issuePlayerSession(4, { db, now: clock.now }).then(() => null, (e: Error) => e);
    const r = await check(token, { db, now: clock.now });
    const e2 = await S.revokeSessionByToken(token, 'logout', { db }).then(() => null, (e: Error) => e);
    const e3 = await S.revokeAllPlayerSessions(4, 'password_changed', {}, { db }).then(() => null, (e: Error) => e);
    return { errors: [e1, e2, e3], r };
  });
  for (const e of result.errors) {
    assert.ok(e instanceof Error);
    assert.ok(!e.message.includes(hash) && !e.message.includes(token), `leak in: ${e.message}`);
    assert.match(e.message, /code 23505/);
  }
  assert.deepEqual(result.r.body, { code: 'SESSION_INVALID' });
  assert.ok(!logs.includes(hash) && !logs.includes(token), 'leak in logs');
});

// ---------------------------------------------------------------------------
// Integration: /api/player-register
// ---------------------------------------------------------------------------
async function call(body: any, headers: Record<string, string> = {}) {
  const res = mockRes();
  await registerHandler({ method: 'POST', body, headers, query: {} }, res);
  return res;
}

function seedPlayer(id: number, username: string, password: string, isBlocked = false) {
  sharedDb.rows('players').push({
    id, name: `Player ${id}`, username, uniquePlayerId: `MT-P${id}`,
    password: bcrypt.hashSync(password, 4), isBlocked,
  });
}

const sessionRow = (token: string) => sharedDb.rows('player_sessions').find(r => r.token_hash === sha(token));

test('login returns a playerToken that verifies; response/logs have no hash', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const { result: res, logs } = await captureLogs(() => call({ action: 'login', username: 'alice', password: 'secret-pass' }));
  assert.equal(res.statusCode, 200);
  assert.match(res.body.playerToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(res.body.playerTokenExpiresAt) > Date.now());
  assert.equal(res.body.player.password, undefined);
  assert.equal((await S.authenticatePlayer(bearer(res.body.playerToken)))?.playerId, 1);
  const hash = sha(res.body.playerToken);
  assert.ok(!JSON.stringify(res.body).includes(hash));
  assert.ok(!logs.includes(res.body.playerToken) && !logs.includes(hash));
});

test('login from two devices: first gets SESSION_REPLACED, second stays valid', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const phone = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const tablet = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const r1 = await check(phone);
  assert.equal(r1.status, 401);
  assert.deepEqual(r1.body, { code: 'SESSION_REPLACED' });
  assert.equal(sessionRow(phone).revoked_reason, 'replaced');
  assert.equal((await check(tablet)).ctx?.playerId, 1);
});

test('blocked player: login refused (403, no token) and an existing session is rejected', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const token = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  sharedDb.rows('players')[0].isBlocked = true;
  const r = await check(token);
  assert.equal(r.status, 401);
  assert.deepEqual(r.body, { code: 'SESSION_INVALID' });
  const login = await call({ action: 'login', username: 'alice', password: 'secret-pass' });
  assert.equal(login.statusCode, 403);
  assert.equal(login.body.playerToken, undefined);
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
  assert.equal((await S.authenticatePlayer(bearer(res.body.playerToken)))?.playerId, res.body.player.id);
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

test('change-password with own token: other sessions revoked with password_changed, caller kept', async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  const mine = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  // Another still-active session (e.g. created before the 1-session limit, or a concurrent login).
  const extra = await S.issuePlayerSession(1, { db: proxyDb, maxActiveSessions: 5 });
  const res = await call(
    { action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' },
    { authorization: `Bearer ${mine}` }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.playerToken, undefined, 'caller keeps its own token');
  assert.ok((await check(mine)).ctx);
  assert.equal(sessionRow(extra.token).revoked_reason, 'password_changed');
  assert.deepEqual((await check(extra.token)).body, { code: 'SESSION_INVALID' });
});

test('change-password without token (old app): all revoked with password_changed, fresh token returned', async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const res = await call({ action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' });
  assert.equal(res.statusCode, 200);
  assert.equal(sessionRow(t1).revoked_reason, 'password_changed', 'not "replaced"');
  assert.deepEqual((await check(t1)).body, { code: 'SESSION_INVALID' });
  assert.ok((await check(res.body.playerToken)).ctx);
});

test("change-password with ANOTHER player's token: that token is not kept for alice", async () => {
  seedPlayer(1, 'alice', 'old-pass-1');
  seedPlayer(2, 'mallory', 'mal-pass-1');
  const ta = (await call({ action: 'login', username: 'alice', password: 'old-pass-1' })).body.playerToken;
  const tm = (await call({ action: 'login', username: 'mallory', password: 'mal-pass-1' })).body.playerToken;
  const res = await call(
    { action: 'change-password', username: 'alice', currentPassword: 'old-pass-1', newPassword: 'new-pass-2' },
    { authorization: `Bearer ${tm}` }
  );
  assert.equal(res.statusCode, 200);
  assert.equal(sessionRow(ta).revoked_reason, 'password_changed');
  assert.ok((await check(tm)).ctx, "mallory's own session untouched");
  assert.ok(res.body.playerToken, 'alice gets a fresh token');
});

test('logout: revokes the current session with reason logout; idempotent; no token -> still 200', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const res = await call({ action: 'logout' }, { authorization: `Bearer ${t1}` });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
  assert.equal(sessionRow(t1).revoked_reason, 'logout');
  assert.deepEqual((await check(t1)).body, { code: 'SESSION_INVALID' });
  assert.equal((await call({ action: 'logout' }, { authorization: `Bearer ${t1}` })).statusCode, 200);
  assert.deepEqual((await call({ action: 'logout' })).body, { success: true });
});

test('delete-account: sessions revoked with account_deleted', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const res = await call({ action: 'delete-account', username: 'alice', password: 'secret-pass' });
  assert.equal(res.statusCode, 200);
  assert.equal(sessionRow(t1).revoked_reason, 'account_deleted');
  assert.deepEqual((await check(t1)).body, { code: 'SESSION_INVALID' });
});

test('old endpoints still work without a token (enforcement off)', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const res = await call({ action: 'update-profile', currentUsername: 'alice', name: 'Alice Renamed' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.player.name, 'Alice Renamed');
});

// ---------------------------------------------------------------------------
// action: 'check-session'
// ---------------------------------------------------------------------------

test('check-session: valid token -> 200 { ok: true }', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const res = await call({ action: 'check-session' }, { authorization: `Bearer ${t}` });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('check-session: no Authorization header (old app) -> 200 { ok: true, anonymous: true }', async () => {
  const res = await call({ action: 'check-session' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, anonymous: true });
});

test('check-session: replaced by a login on another device -> 401 SESSION_REPLACED', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const phone = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const tablet = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  const r1 = await call({ action: 'check-session' }, { authorization: `Bearer ${phone}` });
  assert.equal(r1.statusCode, 401);
  assert.deepEqual(r1.body, { code: 'SESSION_REPLACED' });
  const r2 = await call({ action: 'check-session' }, { authorization: `Bearer ${tablet}` });
  assert.deepEqual([r2.statusCode, r2.body], [200, { ok: true }]);
});

test('check-session: logout / password change / deleted / blocked / unknown / malformed -> 401 SESSION_INVALID only', async () => {
  const expectInvalid = async (authorization: string) => {
    const r = await call({ action: 'check-session' }, { authorization });
    assert.equal(r.statusCode, 401);
    assert.deepEqual(r.body, { code: 'SESSION_INVALID' }, 'no extra details');
  };

  seedPlayer(1, 'alice', 'secret-pass');
  const t1 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  await call({ action: 'logout' }, { authorization: `Bearer ${t1}` });
  await expectInvalid(`Bearer ${t1}`);

  const t2 = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  await call({ action: 'change-password', username: 'alice', currentPassword: 'secret-pass', newPassword: 'new-pass-2' });
  await expectInvalid(`Bearer ${t2}`);

  const t3 = (await call({ action: 'login', username: 'alice', password: 'new-pass-2' })).body.playerToken;
  sharedDb.rows('players')[0].isBlocked = true;
  await expectInvalid(`Bearer ${t3}`);
  sharedDb.rows('players')[0].isBlocked = false;

  const t4 = (await call({ action: 'login', username: 'alice', password: 'new-pass-2' })).body.playerToken;
  await call({ action: 'delete-account', username: 'alice', password: 'new-pass-2' });
  await expectInvalid(`Bearer ${t4}`);

  await expectInvalid(`Bearer ${'Q'.repeat(43)}`); // well-formed but unknown
  await expectInvalid('Bearer not-a-token'); // header present but malformed: not "anonymous"
  await expectInvalid('Basic abc');
});

test('check-session: expired token -> 401 SESSION_INVALID', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  sessionRow(t).expires_at = new Date(Date.now() - 1000).toISOString();
  const r = await call({ action: 'check-session' }, { authorization: `Bearer ${t}` });
  assert.deepEqual([r.statusCode, r.body], [401, { code: 'SESSION_INVALID' }]);
});

test('check-session: DB failure -> 401 SESSION_INVALID without leaking details', async () => {
  seedPlayer(1, 'alice', 'secret-pass');
  const t = (await call({ action: 'login', username: 'alice', password: 'secret-pass' })).body.playerToken;
  sharedDb.failTable = 'player_sessions';
  sharedDb.failError = { code: '42P01', message: 'relation "player_sessions" does not exist' };
  const { result: r, logs } = await captureLogs(() => call({ action: 'check-session' }, { authorization: `Bearer ${t}` }));
  assert.deepEqual([r.statusCode, r.body], [401, { code: 'SESSION_INVALID' }]);
  assert.ok(!logs.includes(t));
});
