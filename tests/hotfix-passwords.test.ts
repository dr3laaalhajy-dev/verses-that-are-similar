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

function likeToRegex(pattern: string) {
  // Tests only feed safe values (no wildcards), so this is a case-insensitive exact match.
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc}$`, 'i');
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
    assert.ok(!/[%_*,()\\"']/.test(p), `unsafe ilike pattern reached DB: ${p}`);
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

before(async () => {
  const supaUrl = new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href;
  mock.module(supaUrl, { namedExports: { supabaseAdmin: fakeDb }, defaultExport: fakeDb });
  const uidUrl = new URL('../api/_lib/uniquePlayerId.ts', import.meta.url).href;
  mock.module(uidUrl, { namedExports: { getOrGenerateUniquePlayerId: async () => 'MT-TEST' } });

  security = await import('../api/_lib/playerSecurity.ts');
  registerHandler = (await import('../api/player-register.ts')).default;
  scoreHandler = (await import('../api/player-score.ts')).default;
  meHandler = (await import('../api/users/me.ts')).default;
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

test('isSafeFilterValue rejects filter/wildcard characters', () => {
  for (const bad of ['a,b', 'a(b', 'a)b', '50%', 'a_b', '*', 'a\\b', 'a"b', "a'b", '', '   ', '%%', '_']) {
    assert.equal(security.isSafeFilterValue(bad), false, bad);
  }
  for (const ok of ['ahmad', 'أحمد', 'MT-AB12', 'ali.k', '@ali']) {
    assert.equal(security.isSafeFilterValue(ok), true, ok);
  }
});

test('findPlayerRow matches legacy "@username" and never uses .or()', async () => {
  seedPlayers([{ id: 7, name: 'Legacy', username: '@legacy', password: 'pw' }]);
  const row = await security.findPlayerRow(fakeDb, { username: 'legacy' });
  assert.equal(row?.id, 7);
});

test('findPlayerRow skips name ilike for injection-like input', async () => {
  seedPlayers([{ id: 1, name: 'Ali', username: 'ali', password: 'pw' }]);
  calls.length = 0;
  const row = await security.findPlayerRow(fakeDb, { username: 'x,id.gt.0', name: 'x,id.gt.0' });
  assert.equal(row, null);
  assert.ok(!calls.includes('players.ilike.name'));
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

test('register rejects names/usernames with filter characters', async () => {
  seedPlayers([]);
  const r1 = await call(registerHandler, 'POST', { body: { name: 'a,b', username: 'ab', password: '123456' } });
  assert.equal(r1.statusCode, 400);
  const r2 = await call(registerHandler, 'POST', { body: { name: 'Ab', username: 'a(b)', password: '123456' } });
  assert.equal(r2.statusCode, 400);
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
