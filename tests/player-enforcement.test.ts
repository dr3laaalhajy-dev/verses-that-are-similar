/**
 * REQUIRE_PLAYER_TOKEN enforcement on player endpoints:
 *   api/player-register.ts (change-password, update-profile, delete-account)
 *   api/friends.ts (send-request, respond-request, remove-friend, list)
 *   api/1v1.ts (every action that acts for a player; start / update-settings owner only)
 * For each: switch on + no token -> 401, another player's token -> 403, own token -> works,
 * switch off -> old behaviour. Public actions stay public.
 * Fully offline (in-memory fake DB). Run with:
 *   node --import tsx --experimental-test-module-mocks --test tests/player-enforcement.test.ts
 */
import { test, mock, before, beforeEach, afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// In-memory fake of the Supabase query builder subset used by these endpoints
// ---------------------------------------------------------------------------
type Row = Record<string, any>;

/** Parses PostgREST or() strings: "a.eq.1,b.eq.2" and "and(a.eq.1,b.eq.2),and(...)". */
function orToPredicate(expr: string): (r: Row) => boolean {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  const cond = (c: string) => {
    const [col, op, ...rest] = c.split('.');
    const val = rest.join('.');
    return (r: Row) => op === 'eq' && String(r[col]) === val;
  };
  const preds = parts.map((p) => {
    const m = /^and\((.*)\)$/.exec(p.trim());
    if (m) {
      const cs = m[1].split(',').map(cond);
      return (r: Row) => cs.every((f) => f(r));
    }
    return cond(p.trim());
  });
  return (r: Row) => preds.some((f) => f(r));
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  seq = 0;
  from(t: string) { return new Query(this, t); }
  rows(t: string) { return (this.tables[t] ||= []); }
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'update' | 'insert' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private max = Infinity;
  constructor(private db: FakeDb, private table: string) {}
  select(_c?: string) { return this; }
  eq(c: string, v: any) { this.filters.push((r) => String(r[c]) === String(v)); return this; }
  neq(c: string, v: any) { this.filters.push((r) => String(r[c]) !== String(v)); return this; }
  is(c: string, v: any) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => String(r[c]) > String(v)); return this; }
  gte(c: string, v: any) { this.filters.push((r) => String(r[c]) >= String(v)); return this; }
  lt(c: string, v: any) { this.filters.push((r) => String(r[c]) < String(v)); return this; }
  lte(c: string, v: any) { this.filters.push((r) => String(r[c]) <= String(v)); return this; }
  in(c: string, vs: any[]) { const s = (vs || []).map(String); this.filters.push((r) => s.includes(String(r[c]))); return this; }
  ilike(c: string, p: string) {
    const re = new RegExp('^' + p.replace(/\\(.)/g, '$1').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
    this.filters.push((r) => typeof r[c] === 'string' && re.test(r[c]));
    return this;
  }
  or(expr: string) { this.filters.push(orToPredicate(expr)); return this; }
  not() { return this; }
  contains() { return this; }
  order() { return this; }
  range() { return this; }
  limit(n: number) { this.max = n; return this; }
  update(d: any) { this.op = 'update'; this.payload = d; return this; }
  insert(d: any) { this.op = 'insert'; this.payload = d; return this; }
  upsert(d: any) { this.op = 'upsert'; this.payload = d; return this; }
  delete() { this.op = 'delete'; return this; }
  private run(): { data: Row[] | null; error: any } {
    const all = this.db.rows(this.table);
    if (this.op === 'insert' || this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const out = items.map((item: Row) => {
        const id = this.table === 'player_sessions' ? `sess-${++this.db.seq}` : item.id ?? all.length + 100;
        const row = this.table === 'player_sessions' ? { id, revoked_at: null, revoked_reason: null, ...item } : { id, ...item };
        all.push(row);
        return { ...row };
      });
      return { data: out, error: null };
    }
    const matched = all.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max);
    if (this.op === 'update') matched.forEach((r) => Object.assign(r, this.payload));
    if (this.op === 'delete') this.db.tables[this.table] = all.filter((r) => !matched.includes(r));
    return { data: matched.map((r) => ({ ...r })), error: null };
  }
  async maybeSingle() { const r = this.run(); return { data: r.data?.[0] ?? null, error: r.error }; }
  async single() { const r = this.run(); return r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: r.error ?? { message: 'no rows' } }; }
  then(resolve: any, reject: any) { return Promise.resolve(this.run()).then(resolve, reject); }
}

let db = new FakeDb();
const proxyDb = { from: (t: string) => db.from(t), channel: () => ({ send: async () => ({}), subscribe: () => ({}) }), removeChannel: async () => ({}) };

function mockRes() {
  return {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
    send(b: any) { this.body = b; return this; },
    end() { return this; },
  };
}

let S: typeof import('../api/_lib/playerSession.ts');
let A: typeof import('../api/_lib/playerAuth.ts');
let registerHandler: any;
let friendsHandler: any;
let duelHandler: any;

before(async () => {
  const supaUrl = new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href;
  mock.module(supaUrl, { namedExports: { supabaseAdmin: proxyDb }, defaultExport: proxyDb });
  const uidUrl = new URL('../api/_lib/uniquePlayerId.ts', import.meta.url).href;
  mock.module(uidUrl, { namedExports: { getOrGenerateUniquePlayerId: async () => 'MT-TEST' } });
  S = await import('../api/_lib/playerSession.ts');
  A = await import('../api/_lib/playerAuth.ts');
  registerHandler = (await import('../api/player-register.ts')).default;
  friendsHandler = (await import('../api/friends.ts')).default;
  duelHandler = (await import('../api/1v1.ts')).default;
});

const ORIGINAL_FLAG = process.env.REQUIRE_PLAYER_TOKEN;
beforeEach(() => {
  db = new FakeDb();
  process.env.REQUIRE_PLAYER_TOKEN = 'true';
});
afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.REQUIRE_PLAYER_TOKEN;
  else process.env.REQUIRE_PLAYER_TOKEN = ORIGINAL_FLAG;
});
const switchOff = () => { process.env.REQUIRE_PLAYER_TOKEN = 'false'; };

const PASS = 'secret-pass';
const HASH = bcrypt.hashSync(PASS, 4);

/** alice (1) and bob (2), with passwords and usernames; carol (3) for friends. */
function seedPlayers() {
  db.rows('players').push(
    { id: 1, name: 'Alice', username: 'alice', uniquePlayerId: 'MT-AAAA', password: HASH, isBlocked: false, points: 100, cups: 0 },
    { id: 2, name: 'Bob', username: 'bob', uniquePlayerId: 'MT-BBBB', password: HASH, isBlocked: false, points: 100, cups: 0 },
    { id: 3, name: 'Carol', username: 'carol', uniquePlayerId: 'MT-CCCC', password: HASH, isBlocked: false, points: 100, cups: 0 },
  );
}
async function tokenFor(id: number) {
  return (await S.issuePlayerSession(id, { db: proxyDb, maxActiveSessions: 5 })).token;
}
const auth = (t: string | null) => (t ? { authorization: `Bearer ${t}` } : {});

async function call(handler: any, opts: { method?: string; body?: any; query?: any; headers?: Record<string, string> }) {
  const res = mockRes();
  const req: any = {
    method: opts.method ?? 'POST',
    body: opts.body,
    query: opts.query ?? {},
    headers: { ...(opts.headers || {}) },
  };
  await handler(req, res);
  return res;
}
const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  console.error = console.warn = console.log = console.info = () => {};
  try { return await fn(); } finally { Object.assign(console, orig); }
};

// ---------------------------------------------------------------------------
// Unit: matching + the gate
// ---------------------------------------------------------------------------
describe('identity matching', () => {
  const p = { id: 7, name: 'Ali Hasan', username: '@ali', uniquePlayerId: 'MT-AB12' };
  test('matches id, uniquePlayerId, username (with/without @, any case), name', () => {
    for (const v of [7, '7', ' 7 ', 'MT-AB12', 'mt-ab12', 'ali', '@ali', 'ALI', 'Ali Hasan', 'ali hasan']) {
      assert.equal(A.identifierMatchesPlayer(v, p), true, String(v));
    }
  });
  test('rejects anything else', () => {
    for (const v of [8, '8', '7.0', 'alex', 'MT-AB13', 'Ali H', 'ali2', {}, [7], true, 7.5]) {
      assert.equal(A.identifierMatchesPlayer(v, p), false, JSON.stringify(v));
    }
  });
  test('empty claims are ignored', () => {
    for (const v of [undefined, null, '', '  ', 'undefined', 'null']) assert.equal(A.isEmptyClaim(v), true);
    for (const v of [0, 'x', {}]) assert.equal(A.isEmptyClaim(v), false);
  });
});

describe('enforcePlayerActor', () => {
  beforeEach(seedPlayers);
  const spec = { fields: { playerId: 'id', playerName: 'name' }, headers: { 'x-player-id': 'id' } } as const;

  test('switch off: no effect at all (request untouched, no response)', async () => {
    switchOff();
    const req: any = { method: 'POST', body: { playerId: 'bob' }, query: {}, headers: {} };
    const before = JSON.stringify(req);
    const res = mockRes();
    assert.deepEqual(await A.enforcePlayerActor(req, res as any, spec as any), { enforced: false });
    assert.equal(JSON.stringify(req), before);
    assert.equal(res.body, undefined);
  });

  test('no token -> 401 SESSION_INVALID; replaced token -> 401 SESSION_REPLACED', async () => {
    const res = mockRes();
    assert.equal(await A.enforcePlayerActor({ method: 'POST', body: {}, query: {}, headers: {} } as any, res as any, spec as any), null);
    assert.deepEqual([res.statusCode, res.body], [401, { code: 'SESSION_INVALID' }]);

    const old = (await S.issuePlayerSession(1, { db: proxyDb })).token;
    await S.issuePlayerSession(1, { db: proxyDb }); // newer login replaces it
    const res2 = mockRes();
    await A.enforcePlayerActor({ method: 'POST', body: {}, query: {}, headers: auth(old) } as any, res2 as any, spec as any);
    assert.deepEqual([res2.statusCode, res2.body], [401, { code: 'SESSION_REPLACED' }]);
  });

  test('a claim naming another player -> 403 { code: FORBIDDEN } and nothing else', async () => {
    const t = await tokenFor(1);
    for (const req of [
      { body: { playerId: 'bob' } },
      { body: { playerId: 2 } },
      { body: { playerName: 'Bob' } },
      { body: { playerId: ['alice', 'bob'] } },
      { body: {}, query: { playerId: 'MT-BBBB' } },
      { body: {}, headers: { 'x-player-id': '2' } },
    ] as any[]) {
      const res = mockRes();
      const r: any = { method: 'POST', query: {}, ...req, headers: { ...auth(t), ...(req.headers || {}) } };
      assert.equal(await A.enforcePlayerActor(r, res as any, spec as any), null, JSON.stringify(req));
      assert.deepEqual([res.statusCode, res.body], [403, { code: 'FORBIDDEN' }]);
    }
  });

  test('matching claims are replaced by the token player (operation always on the token player)', async () => {
    const t = await tokenFor(1);
    const req: any = { method: 'POST', body: { playerId: 'ALICE', playerName: 'alice' }, query: {}, headers: { ...auth(t), 'x-player-id': 'MT-AAAA' } };
    const gate: any = await A.enforcePlayerActor(req, mockRes() as any, spec as any);
    assert.equal(gate.enforced, true);
    assert.equal(gate.actor.id, 1);
    assert.deepEqual(req.body, { playerId: '1', playerName: 'Alice' });
    assert.equal(req.headers['x-player-id'], '1');
    assert.equal(A.getActingPlayer(req)?.id, 1);
  });

  test('missing identity fields are filled with the token player', async () => {
    const t = await tokenFor(2);
    const post: any = { method: 'POST', body: { roomId: 'r1' }, query: {}, headers: auth(t) };
    await A.enforcePlayerActor(post, mockRes() as any, spec as any);
    assert.deepEqual(post.body, { roomId: 'r1', playerId: '2', playerName: 'Bob' });
    const get: any = { method: 'GET', query: { roomId: 'r1' }, headers: auth(t) };
    await A.enforcePlayerActor(get, mockRes() as any, spec as any);
    assert.equal(get.query.playerId, '2');
  });
});

// ---------------------------------------------------------------------------
// api/player-register.ts
// ---------------------------------------------------------------------------
describe('player-register', () => {
  beforeEach(seedPlayers);
  const reg = (body: any, t: string | null = null) => quiet(() => call(registerHandler, { body, headers: auth(t) }));
  const player = (id: number) => db.rows('players').find((p) => p.id === id);

  const cases: Record<string, any> = {
    'change-password': { action: 'change-password', username: 'alice', currentPassword: PASS, newPassword: 'new-pass-123' },
    'update-profile': { action: 'update-profile', currentUsername: 'alice', currentName: 'Alice', name: 'Alice 2', username: 'alice' },
    'delete-account': { action: 'delete-account', username: 'alice', password: PASS },
  };

  for (const [action, body] of Object.entries(cases)) {
    test(`${action}: on + no token -> 401`, async () => {
      const r = await reg(body);
      assert.deepEqual([r.statusCode, r.body], [401, { code: 'SESSION_INVALID' }]);
      assert.ok(player(1), 'nothing changed');
      assert.equal(player(1).name, 'Alice');
    });
    test(`${action}: on + another player's token -> 403`, async () => {
      const r = await reg(body, await tokenFor(2));
      assert.deepEqual([r.statusCode, r.body], [403, { code: 'FORBIDDEN' }]);
      assert.equal(player(1).name, 'Alice');
      assert.equal(player(1).password, HASH);
      assert.equal(player(2).name, 'Bob');
    });
  }

  test('change-password: on + own token -> works; password still required', async () => {
    const t = await tokenFor(1);
    const wrong = await reg({ ...cases['change-password'], currentPassword: 'nope-nope' }, t);
    assert.equal(wrong.statusCode, 400);
    const r = await reg(cases['change-password'], t);
    assert.equal(r.statusCode, 200);
    assert.ok(bcrypt.compareSync('new-pass-123', player(1).password));
  });

  test('update-profile: on + own token -> works (no password needed)', async () => {
    const r = await reg(cases['update-profile'], await tokenFor(1));
    assert.equal(r.statusCode, 200);
    assert.equal(player(1).name, 'Alice 2');
  });

  test('update-profile: on + token without identity fields acts on the TOKEN player only', async () => {
    const r = await reg({ action: 'update-profile', name: 'Bobby' }, await tokenFor(2));
    assert.equal(r.statusCode, 200);
    assert.equal(player(2).name, 'Bobby');
    assert.equal(player(1).name, 'Alice');
  });

  test('delete-account: on + own token -> works; password still required', async () => {
    const t = await tokenFor(1);
    const wrong = await reg({ ...cases['delete-account'], password: 'nope-nope' }, t);
    assert.equal(wrong.statusCode, 401);
    assert.ok(player(1));
    const r = await reg(cases['delete-account'], t);
    assert.equal(r.statusCode, 200);
    assert.equal(player(1), undefined);
    assert.ok(player(2));
  });

  test('switch off: old behaviour (update-profile without token or password, by username)', async () => {
    switchOff();
    const r = await reg(cases['update-profile']);
    assert.equal(r.statusCode, 200);
    assert.equal(player(1).name, 'Alice 2');
    const d = await reg(cases['delete-account']);
    assert.equal(d.statusCode, 200);
    assert.equal(player(1), undefined);
  });

  test('public actions stay public with the switch on (login, register, check-session, logout, GET)', async () => {
    const login = await reg({ action: 'login', username: 'alice', password: PASS });
    assert.equal(login.statusCode, 200);
    const register = await reg({ name: 'Dan', username: 'dan', password: 'dan-pass-1' });
    assert.equal(register.statusCode, 200);
    assert.deepEqual((await reg({ action: 'check-session' })).body, { ok: true, anonymous: true });
    assert.equal((await reg({ action: 'logout' })).statusCode, 200);
    const get = await quiet(() => call(registerHandler, { method: 'GET', query: { username: 'alice' } }));
    assert.equal(get.statusCode, 200);
  });
});

// ---------------------------------------------------------------------------
// api/friends.ts
// ---------------------------------------------------------------------------
describe('friends', () => {
  beforeEach(() => {
    seedPlayers();
    db.rows('friendships').push(
      { id: 11, user_id: 1, friend_id: 3, status: 'ACCEPTED' },
      { id: 12, user_id: 2, friend_id: 1, status: 'PENDING' },
    );
  });
  const fr = (opts: any, t: string | null = null) =>
    quiet(() => call(friendsHandler, { ...opts, headers: { ...(opts.headers || {}), ...auth(t) } }));

  const cases: Record<string, any> = {
    'send-request': { body: { action: 'send-request', requesterId: 1, targetId: 3 } },
    'respond-request': { body: { action: 'respond-request', viewerId: 1, requesterId: 2, response: 'ACCEPT' } },
    'remove-friend': { body: { action: 'remove-friend', viewerId: 1, friendId: 3 } },
    list: { method: 'GET', query: { action: 'list', viewerId: '1' } },
  };

  for (const [action, opts] of Object.entries(cases)) {
    test(`${action}: on + no token -> 401`, async () => {
      const r = await fr(opts);
      assert.deepEqual([r.statusCode, r.body], [401, { code: 'SESSION_INVALID' }]);
    });
    test(`${action}: on + another player's token -> 403`, async () => {
      const r = await fr(opts, await tokenFor(2));
      assert.deepEqual([r.statusCode, r.body], [403, { code: 'FORBIDDEN' }]);
      assert.equal(db.rows('friendships').length, 2, 'nothing changed');
    });
    test(`${action}: on + own token -> not refused`, async () => {
      const r = await fr(opts, await tokenFor(1));
      assert.ok(![401, 403].includes(r.statusCode), `${r.statusCode} ${JSON.stringify(r.body)}`);
    });
  }

  test('remove-friend with own token removes alice\'s friendship', async () => {
    const r = await fr(cases['remove-friend'], await tokenFor(1));
    assert.equal(r.statusCode, 200);
    assert.equal(db.rows('friendships').some((f) => f.id === 11), false);
  });

  test('list without viewerId uses the token player', async () => {
    const r = await fr({ method: 'GET', query: { action: 'list' } }, await tokenFor(1));
    assert.equal(r.statusCode, 200);
  });

  test('switch off: old behaviour (remove-friend by body viewerId, no token)', async () => {
    switchOff();
    const r = await fr(cases['remove-friend']);
    assert.equal(r.statusCode, 200);
    assert.equal(db.rows('friendships').some((f) => f.id === 11), false);
  });

  test('public: search and profile need no token', async () => {
    for (const q of [{ action: 'search', q: 'bo' }, { action: 'profile', targetId: '2' }]) {
      const r = await fr({ method: 'GET', query: q });
      assert.ok(![401, 403].includes(r.statusCode), `${q.action}: ${r.statusCode}`);
    }
  });
});

// ---------------------------------------------------------------------------
// api/1v1.ts
// ---------------------------------------------------------------------------
describe('1v1', () => {
  const ROOM = 'room-1';
  beforeEach(() => {
    seedPlayers();
    db.rows('rooms').push({
      id: ROOM, code: 'ABC123', status: 'WAITING', player1Id: 1, player2Id: null,
      playersProgress: { '1': { name: 'Alice', isOnline: true }, '3': { name: 'Carol', isOnline: true } },
      createdAt: new Date().toISOString(), challengeIds: [], currentAnswers: {}, maxPlayers: 4,
    });
  });
  const duel = (opts: any, t: string | null = null) =>
    quiet(() => call(duelHandler, { ...opts, headers: { ...(opts.headers || {}), ...auth(t) } }));
  const room = () => db.rows('rooms').find((r) => r.id === ROOM);

  // Every action that acts for a player, with a request whose identity names ALICE (id 1).
  const POST = (action: string, extra: any) => ({ body: { action, roomId: ROOM, ...extra } });
  const GET = (action: string, extra: any) => ({ method: 'GET', query: { action, roomId: ROOM, ...extra } });
  const ACTOR_CASES: Record<string, any> = {
    create: POST('create', { player1Id: 1, player1Name: 'Alice', category: 'x' }),
    join: POST('join', { code: 'ABC123', player2Id: 'alice', playerName: 'Alice' }),
    poll: GET('poll', { playerId: 'alice' }),
    'check-active': GET('check-active', { playerId: 'alice' }),
    'submit-answer': POST('submit-answer', { playerId: 'alice', questionIndex: 0, isCorrect: true }),
    'advance-question': POST('advance-question', { playerId: 'alice', questionIndex: 0 }),
    'end-room': POST('end-room', { playerId: 'alice' }),
    'finish-room': POST('finish-room', { playerId: 'alice' }),
    'submit-progress': POST('submit-progress', { playerId: 'alice', progress: 1 }),
    presence: POST('presence', { playerId: 'alice', isOnline: false }),
    'cancel-room': POST('cancel-room', { playerId: 'alice' }),
    reaction: POST('reaction', { playerId: 'alice', playerName: 'Alice', emoji: 'x' }),
    'dnd-cooldown': POST('dnd-cooldown', { senderId: 'alice', receiverId: 'carol' }),
    resign: POST('resign', { playerId: 'alice' }),
    withdraw: POST('withdraw', { playerId: 'alice' }),
    leaveRoom: POST('leaveRoom', { playerId: 'alice' }),
    leave: POST('leave', { playerId: 'alice' }),
    kick: POST('kick', { hostId: 'alice', targetPlayerId: 3 }),
    'kick-player': POST('kick-player', { hostId: 'alice', targetPlayerId: 3 }),
    kickPlayer: POST('kickPlayer', { hostId: 'alice', targetPlayerId: 3 }),
    invite: POST('invite', { senderId: 'alice', receiverId: 3 }),
    'send-invite': POST('send-invite', { senderId: 'alice', receiverId: 3 }),
    'check-invite': POST('check-invite', { senderId: 'alice', receiverId: 3 }),
    rematch: POST('rematch', { playerId: 'alice', playerName: 'Alice' }),
    'play-again': POST('play-again', { playerId: 'alice' }),
    playAgain: POST('playAgain', { playerId: 'alice' }),
    'purchase-powerup': POST('purchase-powerup', { playerId: 'alice', powerupType: 'x' }),
    'buy-powerup': POST('buy-powerup', { playerId: 'alice', powerupType: 'x' }),
    purchasePowerup: POST('purchasePowerup', { playerId: 'alice', powerupType: 'x' }),
    buyPowerup: POST('buyPowerup', { playerId: 'alice', powerupType: 'x' }),
  };
  const OWNER_CASES: Record<string, any> = {
    start: POST('start', {}),
    'update-settings': POST('update-settings', { updatePayload: { roomName: 'New' } }),
    updateSettings: POST('updateSettings', { updatePayload: { roomName: 'New' } }),
    'update-room': POST('update-room', { updatePayload: { roomName: 'New' } }),
  };

  for (const [action, opts] of Object.entries({ ...ACTOR_CASES, ...OWNER_CASES })) {
    test(`${action}: on + no token -> 401`, async () => {
      const before = JSON.stringify(db.tables);
      const r = await duel(opts);
      assert.deepEqual([r.statusCode, r.body], [401, { code: 'SESSION_INVALID' }]);
      assert.equal(JSON.stringify(db.tables), before, 'nothing changed');
    });
  }

  for (const [action, opts] of Object.entries(ACTOR_CASES)) {
    test(`${action}: on + bob's token claiming alice -> 403`, async () => {
      const t = await tokenFor(2);
      const before = JSON.stringify(db.tables.rooms) + JSON.stringify(db.tables.players);
      const r = await duel(opts, t);
      assert.deepEqual([r.statusCode, r.body], [403, { code: 'FORBIDDEN' }]);
      assert.equal(JSON.stringify(db.tables.rooms) + JSON.stringify(db.tables.players), before, 'nothing changed');
    });
    test(`${action}: on + alice's own token -> not refused`, async () => {
      const r = await duel(opts, await tokenFor(1));
      assert.ok(![401, 403].includes(r.statusCode) || r.body?.code === undefined, `${r.statusCode} ${JSON.stringify(r.body)}`);
      assert.notDeepEqual(r.body, { code: 'FORBIDDEN' });
    });
  }

  for (const [action, opts] of Object.entries(OWNER_CASES)) {
    test(`${action}: owner only -> bob (not owner) 403, alice (owner) works`, async () => {
      const bob = await duel(opts, await tokenFor(2));
      assert.deepEqual([bob.statusCode, bob.body], [403, { code: 'FORBIDDEN' }]);
      assert.equal(room().status, 'WAITING');
      assert.equal(room().roomName, undefined);
      const alice = await duel(opts, await tokenFor(1));
      assert.equal(alice.statusCode, 200, JSON.stringify(alice.body));
      if (action === 'start') assert.equal(room().status, 'PLAYING');
      else assert.equal(room().roomName, 'New');
    });
  }

  test('owner check: unknown room -> 403', async () => {
    const r = await duel({ body: { action: 'start', roomId: 'nope' } }, await tokenFor(1));
    assert.deepEqual([r.statusCode, r.body], [403, { code: 'FORBIDDEN' }]);
  });

  test('presence with own token updates the TOKEN player (by id), even if the body names them by username', async () => {
    const r = await duel(POST('presence', { playerId: 'ALICE', isOnline: false }), await tokenFor(1));
    assert.equal(r.statusCode, 200);
    assert.equal(room().playersProgress['1'].isOnline, false);
    assert.equal(room().playersProgress['3'].isOnline, true);
  });

  test('presence without any identity in the body acts as the token player', async () => {
    const r = await duel(POST('presence', { isOnline: false }), await tokenFor(3));
    assert.equal(r.statusCode, 200);
    assert.equal(room().playersProgress['3'].isOnline, false);
    assert.equal(room().playersProgress['1'].isOnline, true);
  });

  test('join with own token: never creates a player or renames one', async () => {
    const t = await tokenFor(2);
    const before = db.rows('players').length;
    const r = await duel(POST('join', { code: 'ABC123', player2Id: 'bob', playerName: 'bob' }), t);
    assert.ok(![401, 403].includes(r.statusCode), `${r.statusCode} ${JSON.stringify(r.body)}`);
    assert.equal(db.rows('players').length, before, 'no new player');
    assert.equal(db.rows('players').find((p) => p.id === 2).name, 'Bob', 'not renamed to "bob"');
  });

  test('join: a claimed name that is not the token player -> 403 (no rename, no new player)', async () => {
    const t = await tokenFor(2);
    const before = JSON.stringify(db.tables.players);
    const r = await duel(POST('join', { code: 'ABC123', player2Id: 2, playerName: 'Someone Else' }), t);
    assert.deepEqual([r.statusCode, r.body], [403, { code: 'FORBIDDEN' }]);
    assert.equal(JSON.stringify(db.tables.players), before);
  });

  test('switch off: old behaviour (no token needed; start and update-settings by anyone)', async () => {
    switchOff();
    const p = await duel(POST('presence', { playerId: 1, isOnline: false }));
    assert.equal(p.statusCode, 200);
    assert.equal(room().playersProgress['1'].isOnline, false);
    const s = await duel(OWNER_CASES['update-settings']);
    assert.equal(s.statusCode, 200);
    assert.equal(room().roomName, 'New');
    const st = await duel(OWNER_CASES.start);
    assert.equal(st.statusCode, 200);
    assert.equal(room().status, 'PLAYING');
  });

  test('switch off: join still auto-creates an unknown player (old behaviour)', async () => {
    switchOff();
    const before = db.rows('players').length;
    await duel(POST('join', { code: 'ABC123', playerName: 'Newcomer' }));
    assert.equal(db.rows('players').length, before + 1);
  });

  test('public actions need no token with the switch on', async () => {
    for (const q of ['list-rooms', 'available-counts', 'list-challenges']) {
      const r = await duel({ method: 'GET', query: { action: q } });
      assert.ok(![401, 403].includes(r.statusCode), `${q}: ${r.statusCode}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Client: presence goes through fetch (wrapper adds the token), not sendBeacon
// ---------------------------------------------------------------------------
test('client: no sendBeacon left in src/ (it cannot send the player token)', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = fileURLToPath(new URL('../src', import.meta.url));
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(n) && /sendBeacon\(/.test(readFileSync(p, 'utf8'))) hits.push(p);
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});

// ---------------------------------------------------------------------------
// Default deny: every action a handler processes is either in ACTOR_SPECS or PUBLIC_ACTIONS
// ---------------------------------------------------------------------------
describe('default deny', () => {
  const read = async (rel: string) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  };
  const handled = (src: string, re: RegExp) => new Set([...src.matchAll(re)].map((m) => m[1]));

  const endpoints = [
    { file: '../api/1v1.ts', re: /case '([^']+)'/g, extra: [] as string[] },
    { file: '../api/friends.ts', re: /action === '([^']+)'/g, extra: [] },
    // Any other POST action falls through to registration.
    { file: '../api/player-register.ts', re: /action === '([^']+)'/g, extra: ['register'] },
  ];

  for (const ep of endpoints) {
    test(`${ep.file}: every handled action is listed exactly once (actor or public), and nothing stale`, async () => {
      const mod: any = await import(ep.file.replace('../', '../'));
      const actions = handled(await read(ep.file), ep.re);
      for (const a of ep.extra) actions.add(a);
      assert.ok(actions.size > 0);
      const actor = new Set(Object.keys(mod.ACTOR_SPECS));
      const pub = new Set<string>(mod.PUBLIC_ACTIONS);
      for (const a of actions) {
        assert.ok(actor.has(a) || pub.has(a), `${a} is neither in ACTOR_SPECS nor PUBLIC_ACTIONS`);
        assert.ok(!(actor.has(a) && pub.has(a)), `${a} is in both lists`);
      }
      for (const a of [...actor, ...pub]) assert.ok(actions.has(a), `${a} is listed but not handled`);
    });
  }

  test('switch on: unknown actions are refused with 400 UNKNOWN_ACTION and touch nothing', async () => {
    seedPlayers();
    const t = await tokenFor(1);
    const before = JSON.stringify(db.tables);
    const calls = [
      () => call(duelHandler, { body: { action: 'drop-table', playerId: 1 }, headers: auth(t) }),
      () => call(friendsHandler, { body: { action: 'make-admin', viewerId: 1 }, headers: auth(t) }),
      () => call(registerHandler, { body: { action: 'set-points', name: 'X', username: 'xx', password: 'xx-pass-1' } }),
      () => call(registerHandler, { body: { action: 'set-points', name: 'X', username: 'xx', password: 'xx-pass-1' }, headers: auth(t) }),
    ];
    for (const c of calls) {
      const r = await quiet(c);
      assert.deepEqual([r.statusCode, r.body], [400, { code: 'UNKNOWN_ACTION' }]);
    }
    const withoutSessions = (t: any) => JSON.stringify({ ...t, player_sessions: undefined });
    assert.equal(withoutSessions(db.tables), withoutSessions(JSON.parse(before)), 'nothing but session rows exists');
    assert.deepEqual(db.rows('players').map((p) => p.id), [1, 2, 3], 'no player created');
  });

  test('switch on: registration without an action still works (public)', async () => {
    const r = await quiet(() => call(registerHandler, { body: { name: 'Eve', username: 'eve', password: 'eve-pass-1' } }));
    assert.equal(r.statusCode, 200);
  });

  test('switch off: old behaviour for unknown actions (1v1 "Invalid action", player-register registers)', async () => {
    switchOff();
    const d = await quiet(() => call(duelHandler, { body: { action: 'drop-table' } }));
    assert.deepEqual([d.statusCode, d.body], [400, { message: 'Invalid action' }]);
    const r = await quiet(() => call(registerHandler, { body: { action: 'whatever', name: 'Old App', username: 'oldapp', password: 'old-pass-1' } }));
    assert.equal(r.statusCode, 200);
    assert.ok(db.rows('players').some((p) => p.username === 'oldapp'));
  });
});

// ---------------------------------------------------------------------------
// fix-small-bundle: room cancel via server (idempotent), addPoint request, context exports
// ---------------------------------------------------------------------------
describe('cancel-room (server)', () => {
  const ROOM = 'room-c';
  beforeEach(() => {
    seedPlayers();
    db.rows('rooms').push({ id: ROOM, status: 'WAITING', player1Id: 1, playersProgress: {}, challengeIds: [] });
    db.rows('who_am_i_rounds').push({ id: 1, room_id: ROOM }, { id: 2, room_id: 'other' });
    db.rows('who_am_i_answers').push({ id: 1, room_id: ROOM });
    db.rows('who_am_i_submissions').push({ id: 1, room_id: ROOM });
  });
  const cancel = (body: any, t: string | null = null) =>
    quiet(() => call(duelHandler, { body: { action: 'cancel-room', ...body }, headers: auth(t) }));

  for (const mode of ['off', 'on'] as const) {
    test(`switch ${mode}: a room that does not exist -> 200 (idempotent), nothing touched`, async () => {
      if (mode === 'off') switchOff();
      const t = mode === 'on' ? await tokenFor(1) : null;
      const before = JSON.stringify(db.tables.rooms);
      const r = await cancel({ roomId: 'gone', playerId: 'alice' }, t);
      assert.equal(r.statusCode, 200);
      assert.deepEqual(r.body, { success: true, alreadyGone: true });
      assert.equal(JSON.stringify(db.tables.rooms), before);
    });

    test(`switch ${mode}: host cancels -> CANCELLED and Who-am-I rows of that room removed`, async () => {
      if (mode === 'off') switchOff();
      const t = mode === 'on' ? await tokenFor(1) : null;
      const r = await cancel({ roomId: ROOM, playerId: 'alice' }, t);
      assert.equal(r.statusCode, 200);
      assert.equal(db.rows('rooms').find((x) => x.id === ROOM).status, 'CANCELLED');
      assert.deepEqual(db.rows('who_am_i_rounds').map((x) => x.room_id), ['other']);
      assert.equal(db.rows('who_am_i_answers').length, 0);
      assert.equal(db.rows('who_am_i_submissions').length, 0);
    });

    test(`switch ${mode}: a non-host cannot cancel (403), nothing touched`, async () => {
      if (mode === 'off') switchOff();
      const t = mode === 'on' ? await tokenFor(2) : null;
      const r = await cancel({ roomId: ROOM, playerId: 'bob' }, t);
      assert.equal(r.statusCode, 403);
      assert.equal(db.rows('rooms').find((x) => x.id === ROOM).status, 'WAITING');
      assert.equal(db.rows('who_am_i_rounds').length, 2);
    });
  }
});

describe('client source checks (fix-small-bundle)', () => {
  const src = async (rel: string) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  };
  const block = (text: string, start: string, end: string) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));

  test('room cancel: only POST /api/1v1 cancel-room, no direct table deletes', async () => {
    const ctx = await src('../src/contexts/AppContext.tsx');
    const fn = block(ctx, 'const confirmCancelRoomByHost = async', 'const syncGroupProgress');
    assert.match(fn, /action: 'cancel-room'/);
    assert.doesNotMatch(fn, /supabase\.from\(/);
    assert.doesNotMatch(fn, /'Room'|room_participants/);
  });

  test('addPoint: no roomId sent to /api/player-score; no challengeId inside a room', async () => {
    const ctx = await src('../src/contexts/AppContext.tsx');
    const fn = block(ctx, 'const addPoint = useCallback', '}, [');
    assert.match(fn, /\/api\/player-score/);
    assert.doesNotMatch(fn, /roomId: metadata/);
    assert.match(fn, /challengeId: metadata\?\.roomId \? undefined : metadata\?\.challengeId/);
  });

  test('context exposes fetchChallenges and fetchCompletionChallenges (used by App.tsx / AppRouter)', async () => {
    const ctx = await src('../src/contexts/AppContext.tsx');
    const value = block(ctx, '  const value = {', '\n  };');
    assert.match(value, /\n\s+fetchChallenges,/);
    assert.match(value, /\n\s+fetchCompletionChallenges,/);
  });

  test('certificate captures convert oklch colours on the clone', async () => {
    for (const f of ['../src/components/CertificateModal.tsx', '../src/components/ChallengeCertificate.tsx']) {
      assert.match(await src(f), /inlineLegacyColors\(el, clonedDoc\.defaultView\)/, f);
    }
  });
});

test('replaceModernColors: replaces every modern colour function, keeps the rest', async () => {
  // Minimal canvas stub: paints a fixed colour so we can check the parsing, not the browser.
  const g: any = globalThis as any;
  const hadDocument = 'document' in g;
  g.document = { createElement: () => ({ getContext: () => ({ clearRect() {}, fillRect() {}, set fillStyle(_v: string) {}, getImageData: () => ({ data: [1, 2, 3, 255] }) }) }) };
  try {
    const { replaceModernColors } = await import('../src/utils/html2canvasColors.ts');
    assert.equal(
      replaceModernColors('linear-gradient(to right, oklch(0.769 0.188 70.08) 0%, oklab(0.5 0.1 0.1 / 0.3) 100%)'),
      'linear-gradient(to right, rgba(1, 2, 3, 1) 0%, rgba(1, 2, 3, 1) 100%)'
    );
    assert.equal(replaceModernColors('rgb(0, 0, 0)'), 'rgb(0, 0, 0)');
    assert.equal(replaceModernColors('0 1px 2px color(srgb 1 0 0)'), '0 1px 2px rgba(1, 2, 3, 1)');
  } finally {
    if (!hadDocument) delete g.document;
  }
});

describe('daily challenge after a group game (fix 5)', () => {
  const ctxSrc = async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL('../src/contexts/AppContext.tsx', import.meta.url)), 'utf8');
  };

  test('starting the daily challenge drops a leftover room locally (no server call)', async () => {
    const ctx = await ctxSrc();
    const start = ctx.indexOf('const handleStartDaily = () => {');
    const fn = ctx.slice(start, ctx.indexOf('const handleStartNormal', start));
    assert.match(fn, /clearLocalRoomState\(\);/);
    assert.ok(fn.indexOf('clearLocalRoomState()') < fn.indexOf("setView('challenge')"), 'cleared before opening the challenge');
    const clear = ctx.slice(ctx.indexOf('const clearLocalRoomState = () => {'), start);
    assert.match(clear, /setRoom\(null\)/);
    assert.match(clear, /removeItem\('activeRoomId'\)/);
    assert.match(clear, /removeItem\('currentRoomId'\)/);
    assert.doesNotMatch(clear, /fetch\(|supabase\./, 'local only');
  });

  test('back on Home, a finished / cancelled / expired room is forgotten locally', async () => {
    const ctx = await ctxSrc();
    const i = ctx.indexOf("// Back on Home after a group game");
    assert.ok(i > 0);
    const effect = ctx.slice(i, ctx.indexOf('}, [view, room?.status]);', i));
    assert.match(effect, /view !== 'home' \|\| !room/);
    assert.match(effect, /'FINISHED', 'completed', 'CANCELLED', 'EXPIRED'/);
    assert.match(effect, /setRoom\(null\)/);
    assert.doesNotMatch(effect, /fetch\(|supabase\./, 'local only');
  });
});

describe('daily challenge is never hijacked by a room the player left (fix 6)', () => {
  const read = async (rel: string) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  };

  test('setView refuses group_game when there is no room (in memory or saved)', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    const fn = ctx.slice(ctx.indexOf('const setView = useCallback'), ctx.indexOf('const setView = useCallback') + 1400);
    assert.match(fn, /nextView === 'group_game' && !roomRef\.current/);
    assert.match(fn, /localStorage\.getItem\('activeRoomId'\)/);
    assert.match(fn, /return prev;/);
  });

  test('the daily challenge screen never receives a room', async () => {
    const router = await read('../src/routes/AppRouter.tsx');
    assert.match(router, /room=\{app\.challengeMode === 'daily' \? null : app\.room\}/);
  });

  test('room poll is skipped and a revived room is cleared during the daily challenge', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /if \(view === 'challenge' && challengeMode === 'daily'\) return; \/\/ the daily challenge is not a room/);
    assert.match(ctx, /if \(view === 'challenge' && challengeMode === 'daily' && room\) \{\s*setRoom\(null\);/);
  });

  test('starting the daily challenge always clears the saved room', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    const start = ctx.indexOf('const handleStartDaily = () => {');
    const fn = ctx.slice(start, ctx.indexOf('const handleStartNormal', start));
    assert.match(fn, /\n\s+clearLocalRoomState\(\);/);
    assert.doesNotMatch(fn, /if \(room\) clearLocalRoomState/);
  });

  test('game page realtime update never brings back a cleared room', async () => {
    const page = await read('../src/pages/ChallengeGamePage.tsx');
    assert.match(page, /setRoom\(\(prev: any\) => prev \? \(\{ \.\.\.prev, \.\.\.updated \}\) : prev\);/);
    assert.doesNotMatch(page, /\.\.\.updated \}\) : updated\)/);
  });
});
