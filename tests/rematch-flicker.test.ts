/**
 * "Play again" flicker / lost rematch, and choices cleared by room updates:
 *  - playersProgress.__rematch must survive concurrent writers on the finished room
 *    (presence, reaction, submit-progress, power-ups, invites)
 *  - a late response for the old room must not change the screen (app, source checks)
 *  - a room update for the SAME question must not reset the player's choice (app, source checks)
 *   node --import tsx --experimental-test-module-mocks --test tests/rematch-flicker.test.ts
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Fake DB (PostgREST-like): JSON-path filters, is null, insert/delete, update ... select
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const clone = (x: any) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let maxDelay = 0;
/** When true, deleting a room "fails" like a real DB error would: { data: null, error }, no throw. */
let failRoomDeletes = false;
let broadcasts: { topic: string; event: string; payload: any }[] = [];
let seq = 0;

/** "playersProgress->__rematch->>nextRoomId" -> value in the row. */
const pathValue = (row: Row, path: string) => {
  const parts = path.split(/->>?/);
  let v: any = row[parts[0]];
  for (const k of parts.slice(1)) v = v == null ? undefined : v[k];
  return v;
};

class Db {
  tables: Record<string, Row[]> = {};
  rows(t: string) { return (this.tables[t] ||= []); }
  from(t: string) { return new Q(this, t); }
}
class Q {
  f: ((r: Row) => boolean)[] = []; op = 'select'; p: any; wantRows = false; lim = Infinity;
  constructor(private db: Db, private t: string) {}
  select() { if (this.op !== 'select') this.wantRows = true; return this; }
  eq(c: string, v: any) { this.f.push((r) => String(pathValue(r, c)) === String(v)); return this; }
  is(c: string, v: any) { this.f.push((r) => (v === null ? pathValue(r, c) == null : pathValue(r, c) === v)); return this; }
  match(o: Row) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  in(c: string, vs: any[]) { const s = (vs || []).map(String); this.f.push((r) => s.includes(String(r[c]))); return this; }
  ilike(c: string, v: any) { this.f.push((r) => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase()); return this; }
  limit(n: number) { this.lim = n; return this; }
  lt(c: string, v: any) { this.f.push((r) => String(r[c]) < String(v)); return this; }
  gte(c: string, v: any) { this.f.push((r) => String(r[c]) >= String(v)); return this; }
  order() { return this; } or() { return this; } neq() { return this; } gt() { return this; }
  update(p: any) { this.op = 'update'; this.p = p; return this; }
  insert(p: any) { this.op = 'insert'; this.p = p; return this; }
  delete() { this.op = 'delete'; return this; }
  async run() {
    if (maxDelay) await sleep(Math.random() * maxDelay);
    const rows = this.db.rows(this.t);
    if (this.op === 'insert') {
      const row = { id: this.t === 'players' ? 1000 + ++seq : `new-${++seq}`, createdAt: new Date().toISOString(), ...clone(this.p) };
      rows.push(row);
      return { data: [clone(row)], error: null };
    }
    const m = rows.filter((r) => this.f.every((f) => f(r))).slice(0, this.lim);
    if (this.op === 'update') m.forEach((r) => Object.assign(r, clone(this.p)));
    if (this.op === 'delete') {
      if (failRoomDeletes && this.t === 'rooms') return { data: null, error: { message: 'delete failed (e.g. a row still references this room)' } };
      this.db.tables[this.t] = rows.filter((r) => !m.includes(r));
    }
    return { data: clone(m), error: null };
  }
  async maybeSingle() { const r = await this.run(); return { data: r.data[0] ?? null, error: null }; }
  async single() { return this.maybeSingle(); }
  then(a: any, b: any) { return this.run().then(a, b); }
}
let db = new Db();
const proxy = {
  from: (t: string) => db.from(t),
  channel: (topic: string) => ({ send: async (m: any) => { broadcasts.push({ topic, event: m.event, payload: m.payload }); return 'ok'; } }),
};
let handler: any;
let playerAuth: any;

before(async () => {
  mock.module(new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href, { namedExports: { supabaseAdmin: proxy }, defaultExport: proxy });
  handler = (await import('../api/1v1.ts')).default;
  playerAuth = await import('../api/_lib/playerAuth.ts');
});
beforeEach(() => { delete process.env.REQUIRE_PLAYER_TOKEN; maxDelay = 0; failRoomDeletes = false; broadcasts = []; });

const call = async (body: any, method = 'POST') => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {} };
  const req: any = method === 'GET' ? { method, query: body, body: undefined, headers: {} } : { method, body, query: {}, headers: {} };
  const o = console.error, w = console.warn, l = console.log; console.error = console.warn = console.log = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; console.log = l; }
  return res;
};

/** A finished room 'old' (players 1..3, P1 leads) with two questions. */
const seedFinished = (status = 'completed') => {
  db = new Db();
  const pp: any = {};
  for (let i = 1; i <= 3; i++) {
    db.rows('players').push({ id: i, name: 'P' + i, username: 'p' + i, totalPoints: 1000 });
    pp[String(i)] = { name: 'P' + i, score: i, finishTime: Date.now(), answersCount: 2 };
  }
  db.rows('rooms').push({ id: 'old', code: 'OLD111', status, player1Id: 1, playersProgress: pp, currentAnswers: {},
    questionCount: 2, challengeIds: [{ id: 50001, type: 'SURAH', keyword: 'a' }, { id: 50002, type: 'SURAH', keyword: 'b' }],
    gameMode: 'SURAH', transitionMode: 'SYNC', timePerQuestion: 20, name: 'غرفة', createdAt: new Date().toISOString() });
};
const room = (id: string) => db.rows('rooms').find((r) => r.id === id)!;

describe('__rematch survives other writers on the finished room', () => {
  const writers: Record<string, (pid: number) => any> = {
    presence: (pid) => call({ action: 'presence', roomId: 'old', playerId: pid, isOnline: pid % 2 === 0 }),
    reaction: (pid) => call({ action: 'reaction', roomId: 'old', playerId: pid, playerName: 'P' + pid, emoji: '👍' }),
    'submit-progress': (pid) => call({ action: 'submit-progress', roomId: 'old', playerId: pid, progress: 100, isFinished: true, score: 3 }),
  };
  for (const [name, write] of Object.entries(writers)) {
    it(`${name} at the same moment as "play again" never erases it`, async () => {
      for (let round = 0; round < 12; round++) {
        seedFinished();
        maxDelay = 8;
        // Writers at random moments around the press (as with real players on the results page).
        const later = (pid: number) => sleep(Math.random() * 60).then(() => write(pid));
        const [r] = await Promise.all([call({ action: 'rematch', roomId: 'old', playerId: 1 }), later(2), later(3), later(2), later(3), later(1)]);
        maxDelay = 0;
        assert.equal(r.statusCode, 200);
        assert.equal(room('old').playersProgress.__rematch?.nextRoomId, r.body.nextRoomId, `${name}: __rematch was erased (round ${round})`);
        // and the second player joins the SAME room (no new room of their own)
        const b = await call({ action: 'rematch', roomId: 'old', playerId: 2 });
        assert.equal(b.body.nextRoomId, r.body.nextRoomId);
        assert.equal(db.rows('rooms').filter((x) => x.status === 'WAITING').length, 1);
      }
    });
  }
});

describe('updatePlayersProgress (compare-and-set on __v)', () => {
  let server: any;
  before(async () => { server = await import('../api/1v1.ts'); });

  it('20 concurrent writers: every change is kept, nothing erased', async () => {
    seedFinished();
    room('old').playersProgress.__rematch = { nextRoomId: 'x', playAgainUsers: [] };
    maxDelay = 6;
    await Promise.all(Array.from({ length: 20 }, (_, i) => server.updatePlayersProgress('old', (p: any) => { p['k' + i] = i; })));
    maxDelay = 0;
    const p = room('old').playersProgress;
    for (let i = 0; i < 20; i++) assert.equal(p['k' + i], i, 'k' + i);
    assert.equal(p.__rematch.nextRoomId, 'x');
  });

  it('mutate returning false writes nothing', async () => {
    seedFinished();
    const before = JSON.stringify(room('old').playersProgress);
    await server.updatePlayersProgress('old', () => false);
    assert.equal(JSON.stringify(room('old').playersProgress), before);
  });
});

describe('app: late answers for an old room and same-question updates', () => {
  const ctx = readFileSync(fileURLToPath(new URL('../src/contexts/AppContext.tsx', import.meta.url)), 'utf8');

  it('a late poll answer for a room that is no longer on screen is ignored', () => {
    assert.match(ctx, /const isCurrentRoomResponse = \(data: any\) => Boolean\(data\?\.id\) && String\(data\.id\) === String\(roomRef\.current\?\.id \?\? ''\);/);
    assert.match(ctx, /action=poll&roomId=\$\{room\.id\}&playerId=\$\{playerIdParam\}`\);\n\s+const data = await res\.json\(\);\n(\s+\/\/.*\n)+\s+if \(!isCurrentRoomResponse\(data\)\) return;/);
  });

  it('answer / skip / timeout / advance / end-room answers are checked too', () => {
    assert.equal((ctx.match(/if \(data && data\.status && isCurrentRoomResponse\(data\)\) \{/g) || []).length, 6);
    assert.match(ctx, /if \(res\.ok && data && isCurrentRoomResponse\(data\)\) \{/);
    assert.match(ctx, /if \(advData && isCurrentRoomResponse\(advData\)\) \{/);
    assert.match(ctx, /endedData && isCurrentRoomResponse\(endedData\)/);
    assert.doesNotMatch(ctx, /if \(data && data\.status\) \{\n\s+setRoom\(data\);/);
  });

  it('the room channel compares with the question on screen (not the index at subscribe time)', () => {
    const block = ctx.slice(ctx.indexOf('const stopRoomChannel = joinRoomChannel('), ctx.indexOf("}, { topic: `room_sync_app_${room.id}` });"));
    assert.ok(block.length > 100);
    assert.doesNotMatch(block, /> currentChallengeIndex\)/);
    assert.equal((block.match(/> currentChallengeIndexRef\.current\)/g) || []).length, 2);
    assert.match(ctx, /currentChallengeIndexRef\.current = currentChallengeIndex;/);
  });
});
