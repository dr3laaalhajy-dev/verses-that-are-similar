/**
 * Unit tests for the password hotfix. Fully offline: Supabase is replaced by an
 * in-memory fake. Run with:
 *   node --import tsx --experimental-test-module-mocks --test tests/hotfix-passwords.test.ts
 */
import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// In-memory fake of the subset of the Supabase query builder the API uses.
// Any .or() on players/admins fails the test (string-built filters are banned there).
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const calls: string[] = [];

const ilikePatterns: string[] = [];

/** Real ILIKE semantics: % and * (PostgREST alias) = any run, _ = one char, backslash escapes. */
function likeToRegex(pattern: string) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (ch === '%' || ch === '*') {
      re += '.*';
    } else if (ch === '_') {
      re += '.';
    } else {
      re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`, 'is');
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private payload: any = null;
  private max = Infinity;
  constructor(private table: string) {}
  select(_cols?: string) { return this; }
  eq(c: string, v: any) { calls.push(`${this.table}.eq.${c}`); this.filters.push(r => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this; }
  ilike(c: string, p: string) {
    calls.push(`${this.table}.ilike.${c}`);
    ilikePatterns.push(p);
    const re = likeToRegex(p);
    this.filters.push(r => typeof r[c] === 'string' && re.test(r[c]));
    return this;
  }
  or(_s: string) {
    if (this.table === 'players' || this.table === 'admins') throw new Error(`.or() used on ${this.table}`);
    return this;
  }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  update(d: any) { this.op = 'update'; this.payload = d; return this; }
  insert(d: any) { this.op = 'insert'; this.payload = d; return this; }
  delete() { this.op = 'delete'; return this; }
  private rows() { return (tables[this.table] ||= []); }
  private run(): Row[] {
    const all = this.rows();
    if (this.op === 'insert') {
      const row = { id: all.length + 1, ...this.payload };
      all.push(row);
      return [row];
    }
    const matched = all.filter(r => this.filters.every(f => f(r))).slice(0, this.max);
    if (this.op === 'update') matched.forEach(r => Object.assign(r, this.payload));
    if (this.op === 'delete') tables[this.table] = all.filter(r => !matched.includes(r));
    return matched.map(r => ({ ...r }));
  }
  async maybeSingle() { const r = this.run(); return { data: r[0] ?? null, error: null }; }
  async single() { const r = this.run(); return r[0] ? { data: r[0], error: null } : { data: null, error: { message: 'no rows' } }; }
  then(resolve: any, reject: any) { return Promise.resolve({ data: this.run(), error: null }).then(resolve, reject); }
}
const fakeDb = { from: (t: string) => new Query(t) };

// ---------------------------------------------------------------------------
// Module mocks (must be registered before importing the handlers)
// ---------------------------------------------------------------------------
let security: typeof import('../api/_lib/playerSecurity.ts');
let registerHandler: any;
let scoreHandler: any;
let meHandler: any;
let friendsHandler: any;

before(async () => {
  const supaUrl = new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href;
  mock.module(supaUrl, { namedExports: { supabaseAdmin: fakeDb }, defaultExport: fakeDb });
  const uidUrl = new URL('../api/_lib/uniquePlayerId.ts', import.meta.url).href;
  mock.module(uidUrl, { namedExports: { getOrGenerateUniquePlayerId: async () => 'MT-TEST' } });

  security = await import('../api/_lib/playerSecurity.ts');
  registerHandler = (await import('../api/player-register.ts')).default;
  scoreHandler = (await import('../api/player-score.ts')).default;
  meHandler = (await import('../api/users/me.ts')).default;
  friendsHandler = (await import('../api/friends.ts')).default;
});

function makeRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; return res; };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
async function call(handler: any, method: string, opts: { body?: any; query?: any } = {}) {
  const res = makeRes();
  await handler({ method, headers: {}, body: opts.body ?? {}, query: opts.query ?? {} }, res);
  return res;
}
function seedPlayers(rows: Row[]) { tables.players = rows.map(r => ({ ...r })); }
function assertNoPassword(obj: any) {
  assert.ok(!JSON.stringify(obj ?? {}).includes('"password"'), `password leaked: ${JSON.stringify(obj)}`);
}

// ---------------------------------------------------------------------------
// Helper tests
// ---------------------------------------------------------------------------
test('verifyPassword: bcrypt hash', async () => {
  const hash = await bcrypt.hash('secret123', 4);
  assert.deepEqual(await security.verifyPassword('secret123', hash), { ok: true, noPassword: false, needsUpgrade: false });
  assert.equal((await security.verifyPassword('wrong', hash)).ok, false);
});

test('verifyPassword: legacy plaintext matches and flags upgrade', async () => {
  assert.deepEqual(await security.verifyPassword('abc123', 'abc123'), { ok: true, noPassword: false, needsUpgrade: true });
  assert.equal((await security.verifyPassword('nope', 'abc123')).ok, false);
});

test('verifyPassword: empty stored password never matches (no 1234 default)', async () => {
  for (const stored of [null, undefined, '', '   ']) {
    const r = await security.verifyPassword('1234', stored);
    assert.equal(r.ok, false);
    assert.equal(r.noPassword, true);
  }
});

test('hashPassword uses bcrypt cost 10', async () => {
  const h = await security.hashPassword('hello123');
  assert.match(h, /^\$2[aby]\$10\$/);
});

test('toSafePlayer is an allow-list and drops password/unknown fields', () => {
  const out = security.toSafePlayer({ id: 1, name: 'a', username: 'u', points: 5, password: 'x', secretCol: 1 });
  assert.deepEqual(out, { id: 1, name: 'a', username: 'u', points: 5 });
});

test('toSafeAdmin drops password', () => {
  assert.deepEqual(security.toSafeAdmin({ id: 1, username: 'a', password: 'h', role: 'ADMIN' }), { id: 1, username: 'a', role: 'ADMIN' });
});

test('isUsableLookupValue: rejects only empty, control chars and wildcard-only values', () => {
  for (const bad of ['', '   ', '%', '_', '*', '%%', '%_*', ' % ', '\\', 'a\u0000b', 'a\nb', 'tab\there']) {
    assert.equal(security.isUsableLookupValue(bad), false, JSON.stringify(bad));
  }
  for (const ok of ['ahmad', 'أحمد', 'Ahmad_99', "O'Brien", 'a,b', 'x,id.gt.0', '50%', 'MT-AB12', '@ali']) {
    assert.equal(security.isUsableLookupValue(ok), true, ok);
  }
});

test('escapeLikePattern escapes % _ * and backslash', () => {
  assert.equal(security.escapeLikePattern('a%b_c*d\\e'), 'a\\%b\\_c\\*d\\\\e');
  assert.equal(security.escapeLikePattern("O'Brien,(x)"), "O'Brien,(x)");
});

test('escaped name lookup matches literally: "A_i" does not match "Ali" but matches "A_i"', async () => {
  seedPlayers([{ id: 1, name: 'Ali', password: 'p' }]);
  assert.equal(await security.findPlayerRow(fakeDb, { name: 'A_i' }), null);
  seedPlayers([{ id: 1, name: 'Ali', password: 'p' }, { id: 2, name: 'A_i', password: 'p' }]);
  assert.equal((await security.findPlayerRow(fakeDb, { name: 'a_I' }))?.id, 2);
});

test('"%", "_" and "*" alone never match everyone (lookup and search)', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali' }, { id: 2, name: 'Sara', username: 'sara' }]);
  for (const w of ['%', '_', '*', '%%', '_%*']) {
    calls.length = 0;
    assert.equal(await security.findPlayerRow(fakeDb, { username: w, name: w }), null, w);
    assert.ok(!calls.some(c => c.includes('.ilike.')), `ilike ran for ${w}`);
    const found = await security.searchContains(() => fakeDb.from('players').select('*'), ['name', 'username'], w);
    assert.deepEqual(found, [], w);
  }
});

test('searchContains escapes wildcards inside the term and never uses .or()', async () => {
  seedPlayers([{ id: 1, name: 'Ahmad_99', username: 'ahmad' }, { id: 2, name: 'Ahmad199', username: 'a2' }, { id: 3, name: 'x', username: 'b_99' }]);
  ilikePatterns.length = 0;
  const rows = await security.searchContains(() => fakeDb.from('players').select('*'), ['name', 'username'], '_99');
  assert.deepEqual(rows.map(r => r.id).sort(), [1, 3]);
  assert.deepEqual(ilikePatterns, ['%\\_99%', '%\\_99%']);
});

test('findPlayerRow matches legacy "@username" and never uses .or()', async () => {
  seedPlayers([{ id: 7, name: 'Legacy', username: '@legacy', password: 'pw' }]);
  const row = await security.findPlayerRow(fakeDb, { username: 'legacy' });
  assert.equal(row?.id, 7);
});

test('injection string "x,id.gt.0" is only a literal value and never alters a query', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'pw' }, { id: 2, name: 'Sara', username: 'sara', password: 'pw' }]);
  calls.length = 0;
  ilikePatterns.length = 0;
  const evil = 'x,id.gt.0';
  const row = await security.findPlayerRow(fakeDb, { username: evil, name: evil });
  assert.equal(row, null);
  // only parameterized .eq / .ilike calls, never .or(); the value is passed through unchanged
  assert.deepEqual(calls, ['players.eq.username', 'players.eq.username', 'players.ilike.name']);
  assert.deepEqual(ilikePatterns, [evil]);
  const search = await security.searchContains(() => fakeDb.from('players').select('*'), ['name', 'username'], evil);
  assert.deepEqual(search, []);
});

test('selectByAnyEq: separate .eq() lookups, merged and deduplicated, injection text is just a value', async () => {
  tables.room_participants = [
    { room_id: 'r1', user_id: 5, name: 'x' },
    { room_id: 'r1', user_id: 9, name: 'Evil,user_id.neq.0' },
    { room_id: 'r2', user_id: 9, name: 'Evil,user_id.neq.0' },
    { room_id: 'r3', user_id: 7, name: 'other' },
  ];
  calls.length = 0;
  const rows = await security.selectByAnyEq(fakeDb, 'room_participants', 'room_id',
    [['user_id', 5], ['name', 'Evil,user_id.neq.0']], 5, 'room_id');
  assert.deepEqual(rows.map(r => r.room_id).sort(), ['r1', 'r2']);
  assert.deepEqual(calls, ['room_participants.eq.user_id', 'room_participants.eq.name']);
});

// ---------------------------------------------------------------------------
// Endpoint tests
// ---------------------------------------------------------------------------
test('login with legacy plaintext succeeds, re-hashes, and returns no password', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'plain99' }]);
  const res = await call(registerHandler, 'POST', { body: { action: 'login', username: 'ali', password: 'plain99' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.player.username, 'ali');
  assertNoPassword(res.body);
  assert.match(tables.players[0].password, /^\$2/);
  assert.ok(await bcrypt.compare('plain99', tables.players[0].password));
});

test('login with bcrypt hash works; wrong password rejected', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: await bcrypt.hash('goodpass', 4) }]);
  const ok = await call(registerHandler, 'POST', { body: { action: 'login', username: '@ali', password: 'goodpass' } });
  assert.equal(ok.statusCode, 200);
  assertNoPassword(ok.body);
  const bad = await call(registerHandler, 'POST', { body: { action: 'login', username: 'ali', password: 'nope' } });
  assert.equal(bad.statusCode, 401);
});

test('login for player with empty password is refused with support message (no 1234)', async () => {
  seedPlayers([{ id: 1, name: 'Old', username: 'old', password: null }]);
  const res = await call(registerHandler, 'POST', { body: { action: 'login', username: 'old', password: '1234' } });
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /الدعم الفني/);
});

test('register: no 1234 default, min 6 chars, stores bcrypt hash, no password in response', async () => {
  seedPlayers([]);
  const missing = await call(registerHandler, 'POST', { body: { name: 'Sara', username: 'sara' } });
  assert.equal(missing.statusCode, 400);
  const short = await call(registerHandler, 'POST', { body: { name: 'Sara', username: 'sara', password: '12345' } });
  assert.equal(short.statusCode, 400);
  const ok = await call(registerHandler, 'POST', { body: { name: 'Sara', username: 'sara', password: '123456' } });
  assert.equal(ok.statusCode, 200);
  assertNoPassword(ok.body);
  assert.match(tables.players[0].password, /^\$2[aby]\$10\$/);
});

test('register accepts display names like "Ahmad_99" and "O\'Brien"', async () => {
  seedPlayers([]);
  const a = await call(registerHandler, 'POST', { body: { name: 'Ahmad_99', username: 'ahmad99', password: '123456' } });
  assert.equal(a.statusCode, 200, JSON.stringify(a.body));
  const b = await call(registerHandler, 'POST', { body: { name: "O'Brien", username: 'obrien', password: '123456' } });
  assert.equal(b.statusCode, 200, JSON.stringify(b.body));
  // "Ahmad199" is a different name: the escaped "_" must not make it look taken
  const c = await call(registerHandler, 'POST', { body: { name: 'Ahmad199', username: 'ahmad199', password: '123456' } });
  assert.equal(c.statusCode, 200, JSON.stringify(c.body));
  // the exact same name (any case) is still detected as taken
  const d = await call(registerHandler, 'POST', { body: { name: 'ahmad_99', username: 'other1', password: '123456' } });
  assert.equal(d.statusCode, 400);
  assert.equal(d.body.message, 'NAME_TAKEN');
});

test('register still rejects control characters, wildcard-only names and unsafe usernames', async () => {
  seedPlayers([]);
  const r1 = await call(registerHandler, 'POST', { body: { name: 'Ab\u0007c', username: 'abc', password: '123456' } });
  assert.equal(r1.statusCode, 400);
  const r2 = await call(registerHandler, 'POST', { body: { name: '%%', username: 'abc', password: '123456' } });
  assert.equal(r2.statusCode, 400);
  const r3 = await call(registerHandler, 'POST', { body: { name: 'Ab', username: 'a(b)', password: '123456' } });
  assert.equal(r3.statusCode, 400);
});

test('update-profile accepts a new display name with _ and \'', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'oldpass' }]);
  const res = await call(registerHandler, 'POST', { body: { action: 'update-profile', currentUsername: 'ali', name: "O'Brien_1", username: 'ali' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(tables.players[0].name, "O'Brien_1");
});

test('friends search: "_" matches literally, "%" alone returns nothing', async () => {
  seedPlayers([
    { id: 1, name: 'Ahmad_99', username: 'ahmad', isBlocked: false },
    { id: 2, name: 'Ahmad199', username: 'a2', isBlocked: false },
  ]);
  const lit = await call(friendsHandler, 'GET', { query: { action: 'search', q: 'd_9' } });
  assert.equal(lit.statusCode, 200);
  assert.deepEqual(lit.body.results.map((r: any) => r.id), [1]);
  const all = await call(friendsHandler, 'GET', { query: { action: 'search', q: '%' } });
  assert.deepEqual(all.body.results, []);
  assertNoPassword(lit.body);
});

test('change-password requires current password and stores bcrypt hash', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'oldpass' }]);
  const wrong = await call(registerHandler, 'POST', { body: { action: 'change-password', username: 'ali', currentPassword: 'x', newPassword: 'newpass1' } });
  assert.equal(wrong.statusCode, 400);
  const ok = await call(registerHandler, 'POST', { body: { action: 'change-password', username: 'ali', currentPassword: 'oldpass', newPassword: 'newpass1' } });
  assert.equal(ok.statusCode, 200);
  assertNoPassword(ok.body);
  assert.ok(await bcrypt.compare('newpass1', tables.players[0].password));
});

test('update-profile: password optional for old clients, but verified when sent', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'oldpass' }]);
  const wrong = await call(registerHandler, 'POST', { body: { action: 'update-profile', currentUsername: 'ali', name: 'Ali2', currentPassword: 'bad' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(tables.players[0].name, 'Ali');
  const ok = await call(registerHandler, 'POST', { body: { action: 'update-profile', currentUsername: 'ali', name: 'Ali2', currentPassword: 'oldpass' } });
  assert.equal(ok.statusCode, 200);
  assertNoPassword(ok.body);
  assert.equal(tables.players[0].name, 'Ali2');
  // Legacy client payload (no password) keeps working, as in the current app
  const legacy = await call(registerHandler, 'POST', { body: { action: 'update-profile', currentUsername: 'ali', currentName: 'Ali2', name: 'Ali3', username: 'ali' } });
  assert.equal(legacy.statusCode, 200);
  assertNoPassword(legacy.body);
  assert.equal(tables.players[0].name, 'Ali3');
});

test('delete-account requires correct password', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: await bcrypt.hash('pw1234', 4) }]);
  const wrong = await call(registerHandler, 'POST', { body: { action: 'delete-account', username: 'ali', password: 'nope' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(tables.players.length, 1);
  const ok = await call(registerHandler, 'POST', { body: { action: 'delete-account', username: 'ali', password: 'pw1234' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(tables.players.length, 0);
});

test('GET player-register / player-score / users/me never return password', async () => {
  seedPlayers([{ id: 3, name: 'Omar', username: 'omar', uniquePlayerId: 'MT-AAAA', password: 'plaintext!', points: 9 }]);
  const a = await call(registerHandler, 'GET', { query: { username: 'omar' } });
  assert.equal(a.statusCode, 200); assertNoPassword(a.body);
  const b = await call(scoreHandler, 'GET', { query: { playerId: '3' } });
  assert.equal(b.statusCode, 200); assertNoPassword(b.body); assert.equal(b.body.points, 9);
  const c = await call(meHandler, 'GET', { query: { uniquePlayerId: 'mt-aaaa' } });
  assert.equal(c.statusCode, 200); assertNoPassword(c.body);
});

test('POST player-score response never returns password', async () => {
  seedPlayers([{ id: 3, name: 'Omar', username: 'omar', password: 'plaintext!', points: 9, cups: 0 }]);
  const res = await call(scoreHandler, 'POST', { body: { username: 'omar', points: 1 } });
  assert.equal(res.statusCode, 200);
  assertNoPassword(res.body);
  assert.equal(res.body.points, 10);
});

// ---------------------------------------------------------------------------
// Admin JWT must fail closed when deployed without JWT_SECRET
// ---------------------------------------------------------------------------
test('admin JWT: no hardcoded fallback when NODE_ENV=production or VERCEL_ENV is set', async () => {
  const jwtLib = await import('../api/_lib/jwt.ts');
  const saved = { JWT_SECRET: process.env.JWT_SECRET, NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  const restore = () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };
  try {
    // local dev (neither set): fallback allowed, so a dev token can be produced
    delete process.env.JWT_SECRET; delete process.env.NODE_ENV; delete process.env.VERCEL_ENV;
    const devToken = jwtLib.signAdminToken({ adminId: 1 });

    for (const env of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'preview' }]) {
      delete process.env.NODE_ENV; delete process.env.VERCEL_ENV; delete process.env.JWT_SECRET;
      Object.assign(process.env, env);
      assert.throws(() => jwtLib.signAdminToken({ adminId: 1 }), /JWT_SECRET/, JSON.stringify(env));
      assert.throws(() => jwtLib.verifyAdminToken(devToken), /JWT_SECRET/, JSON.stringify(env));
      process.env.JWT_SECRET = '   ';
      assert.throws(() => jwtLib.signAdminToken({ adminId: 1 }), /JWT_SECRET/, 'blank secret');
    }

    // deployed with a real secret: works, and a token made with the dev fallback is rejected
    process.env.VERCEL_ENV = 'production';
    process.env.JWT_SECRET = 'unit-test-secret-not-real-0123456789';
    const t = jwtLib.signAdminToken({ adminId: 7 });
    assert.equal(jwtLib.verifyAdminToken(t).adminId, 7);
    assert.throws(() => jwtLib.verifyAdminToken(devToken));
  } finally {
    restore();
  }
});
