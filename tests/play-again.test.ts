/**
 * "Play again" after a group room:
 *  - leadership (rooms.player1Id): the finished room's leader leads the new room once they are in
 *    it; whoever presses first leads until then; nobody else takes it
 *  - two players pressing at once end up in ONE room
 *  - a play-again room everyone left is replaced, not a dead end
 *  - the shared realtime room channel: page changes never get a closing channel, a removed
 *    channel's own CLOSED never reaches anyone (the false "connection lost" overlay)
 *   node --import tsx --experimental-test-module-mocks --test tests/play-again.test.ts
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  joinRoomChannel,
  sendRoomBroadcast,
  ROOM_CHANNEL_RELEASE_DELAY_MS,
  __resetRoomChannelsForTests,
} from '../src/lib/roomChannel.ts';

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

const call = async (body: any) => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {} };
  const req: any = { method: 'POST', body, query: {}, headers: {} };
  const o = console.error, w = console.warn, l = console.log; console.error = console.warn = console.log = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; console.log = l; }
  return res;
};

/** A finished room 'old' led by `hostId` with players 1..n (1 = A = host by default). */
const seedFinished = (n = 3, hostId = 1) => {
  db = new Db();
  const pp: any = {};
  for (let i = 1; i <= n; i++) {
    db.rows('players').push({ id: i, name: 'P' + i, username: 'p' + i });
    pp[String(i)] = { name: 'P' + i, score: i, finishTime: Date.now() };
  }
  db.rows('rooms').push({ id: 'old', code: 'OLD111', status: 'FINISHED', player1Id: hostId, playersProgress: pp, currentAnswers: {},
    questionCount: 2, challengeIds: [{ id: 50001, type: 'SURAH', keyword: 'a' }, { id: 50002, type: 'SURAH', keyword: 'b' }], gameMode: 'SURAH', transitionMode: 'SYNC', timePerQuestion: 20, name: 'غرفة',
    createdAt: new Date().toISOString() });
};
const room = (id: string) => db.rows('rooms').find((r) => r.id === id)!;
/** Player ids in a room's playersProgress (metadata such as __v / __rematch left out). */
const playerKeys = (r: Row) => Object.keys(r.playersProgress || {}).filter((k) => !k.startsWith('__')).sort();
const oldInfo = () => room('old').playersProgress.__rematch;
const rematch = (pid: number) => call({ action: 'rematch', roomId: 'old', playerId: pid });
const join = (roomId: string, pid: number) => call({ action: 'join', roomId, player2Id: pid });
const isOwner = async (roomId: string, pid: number) => {
  const res: any = { status() { return this; }, json() { return this; } };
  return playerAuth.enforceRoomOwner(roomId, { id: pid }, res);
};

// ---------------------------------------------------------------------------
describe('play again: who leads (rooms.player1Id)', () => {
  it('the original leader presses first -> they lead the new room', async () => {
    seedFinished();
    const r = await rematch(1);
    assert.equal(r.statusCode, 200);
    const id = r.body.nextRoomId;
    assert.equal(room(id).player1Id, 1);
    assert.equal(oldInfo().nextRoomId, id, 'saved on the finished room (was lost before)');
    assert.equal(oldInfo().originalHostId, '1');
  });

  it('B presses first -> B leads for now; A (original) comes back -> A leads; B can no longer start / cancel', async () => {
    seedFinished();
    const id = (await rematch(2)).body.nextRoomId;
    assert.equal(room(id).player1Id, 2, 'temporary leader');
    assert.equal(await isOwner(id, 2), true);

    await rematch(3); // another player: no change
    assert.equal(room(id).player1Id, 2);

    const r = await rematch(1);
    assert.equal(r.statusCode, 200);
    assert.equal(r.body.room.id, id, 'same play-again room');
    assert.equal(room(id).player1Id, 1, 'leadership back to the original leader');
    assert.ok(broadcasts.some((b) => b.topic === `room_sync_${id}` && b.event === 'host_changed' && b.payload.player1Id === 1));

    // permissions follow player1Id (start / update-settings use enforceRoomOwner; cancel / kick check player1Id)
    assert.equal(await isOwner(id, 2), false);
    assert.equal(await isOwner(id, 1), true);
    const cancelByB = await call({ action: 'cancel-room', roomId: id, playerId: 2 });
    assert.equal(cancelByB.statusCode, 403);
    assert.equal(room(id).status, 'WAITING');
    // everybody is in the room
    assert.deepEqual(playerKeys(room(id)), ['1', '2', '3']);
  });

  it('the original leader never comes back -> the temporary leader stays', async () => {
    seedFinished(4);
    const id = (await rematch(3)).body.nextRoomId;
    await rematch(2);
    await rematch(4);
    assert.equal(room(id).player1Id, 3);
  });

  it('the original leader enters through a normal "join" (room list / reload) -> leadership moves too', async () => {
    seedFinished();
    const id = (await rematch(2)).body.nextRoomId;
    const r = await join(id, 1);
    assert.equal(r.statusCode, 200);
    assert.equal(room(id).player1Id, 1);
  });

  it('a non-original player joining never takes the lead', async () => {
    seedFinished();
    const id = (await rematch(2)).body.nextRoomId;
    await join(id, 3);
    assert.equal(room(id).player1Id, 2);
  });

  it('no change once the new game started', async () => {
    seedFinished();
    const id = (await rematch(2)).body.nextRoomId;
    room(id).status = 'PLAYING';
    await join(id, 1);
    assert.equal(room(id).player1Id, 2);
  });

  it('the original leader had withdrawn from the old game (lead moved to P2 then) -> P2 is the "original"', async () => {
    seedFinished(3, 2); // the finished room ended with player1Id = 2
    const id = (await rematch(3)).body.nextRoomId;
    await rematch(1);
    assert.equal(room(id).player1Id, 3, 'P1 gave the lead up by withdrawing');
    await rematch(2);
    assert.equal(room(id).player1Id, 2);
  });
});

describe('play again: no orphan rooms', () => {
  /** WAITING rooms as list-rooms shows them. */
  const listed = async () => (await call({ action: 'list-rooms' })).body.rooms as any[];

  for (const n of [2, 3]) {
    it(`${n} players press at the same moment, deleting a room would fail -> still ONE room, no orphans`, async () => {
      for (let round = 0; round < 10; round++) {
        seedFinished(4);
        failRoomDeletes = true; // the old code relied on deleting the loser's room
        maxDelay = 6;
        const presses = await Promise.all([2, 3, 4].slice(0, n).map((pid) => rematch(pid)));
        maxDelay = 0;
        const ids = new Set(presses.map((r) => r.body.nextRoomId));
        assert.equal(ids.size, 1, 'everyone in one room');
        const waiting = db.rows('rooms').filter((r) => r.status === 'WAITING');
        assert.equal(waiting.length, 1, `exactly one room was created (got ${waiting.length})`);
        assert.equal(playerKeys(waiting[0]).length, n, 'nobody lost by simultaneous joins');
        assert.equal((await listed()).length, 1, 'list-rooms shows one room');
      }
    });
  }
});

describe('orphan play-again rooms: cleanup in list-rooms', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const roomRow = (id: string, name: string, players: number[], ageMs: number, status = 'WAITING') => ({
    id, code: id.toUpperCase(), name, status, player1Id: players[0] ?? 1, createdAt: ago(ageMs), challengeIds: [],
    playersProgress: Object.fromEntries(players.map((p) => [String(p), { name: 'P' + p, status: 'joined' }])),
  });
  const seedLobby = () => {
    db = new Db();
    for (let i = 1; i <= 9; i++) db.rows('players').push({ id: i, name: 'P' + i, username: 'p' + i });
    db.rows('rooms').push(
      roomRow('w', 'غرفة (جولة جديدة)', [2, 3, 4], 120_000),          // the real play-again room
      roomRow('o1', 'غرفة (جولة جديدة)', [3], 120_000),                 // orphan: P3 is in "w"
      roomRow('o2', 'غرفة (جولة جديدة)', [4], 120_000),                 // orphan: P4 is in "w"
      roomRow('o3', 'غرفة (جولة جديدة)', [], 120_000),                  // orphan: nobody
      roomRow('lone', 'غرفة (جولة جديدة)', [5], 120_000),               // host waiting alone: real
      roomRow('fresh', 'غرفة (جولة جديدة)', [2], 10_000),               // too new to judge
      roomRow('normal', 'غرفة أحمد', [], 120_000),                      // not a play-again room
      roomRow('s1', 'غرفة (جولة جديدة)', [6], 120_000),                 // same player, two
      roomRow('s2', 'غرفة (جولة جديدة)', [6], 120_000),                 //   one-player rooms: keep both
      roomRow('p', 'غرفة (جولة جديدة)', [7, 8], 120_000, 'PLAYING'),
      roomRow('o4', 'غرفة (جولة جديدة)', [8], 120_000),                 // orphan: P8 plays in "p"
    );
  };

  it('orphans are cancelled and hidden; real rooms are untouched', async () => {
    seedLobby();
    const r = await call({ action: 'list-rooms' });
    assert.equal(r.statusCode, 200);
    const shown = (r.body.rooms as any[]).map((x) => x.id).sort();
    assert.deepEqual(shown, ['fresh', 'lone', 'normal', 's1', 's2', 'w'].sort());
    for (const id of ['o1', 'o2', 'o3', 'o4']) assert.equal(room(id).status, 'CANCELLED', id);
    for (const id of ['w', 'lone', 'fresh', 'normal', 's1', 's2']) assert.equal(room(id).status, 'WAITING', id);
    assert.equal(room('p').status, 'PLAYING');
  });

  it('a room with a player in it and in no bigger room is never cleaned', async () => {
    seedLobby();
    const orphans = await (await import('../api/1v1.ts')).findOrphanRematchRooms(db.rows('rooms').filter((x) => x.status === 'WAITING'));
    for (const id of ['w', 'lone', 's1', 's2', 'fresh', 'normal']) assert.equal(orphans.has(id), false, id);
  });

  it('players who left (hasLeft) do not keep an orphan alive', async () => {
    seedLobby();
    room('o1').playersProgress['9'] = { name: 'P9', hasLeft: true };
    await call({ action: 'list-rooms' });
    assert.equal(room('o1').status, 'CANCELLED');
  });
});

describe('play again: edge cases', () => {
  it('two players press at the same moment -> one room, both in it, the extra room is deleted', async () => {
    for (let round = 0; round < 15; round++) {
      seedFinished(3);
      maxDelay = 6;
      const [a, b] = await Promise.all([rematch(2), rematch(3)]);
      maxDelay = 0;
      assert.equal(a.statusCode, 200);
      assert.equal(b.statusCode, 200);
      assert.equal(a.body.nextRoomId, b.body.nextRoomId, 'same room');
      const id = a.body.nextRoomId;
      const waiting = db.rows('rooms').filter((r) => r.status === 'WAITING');
      assert.equal(waiting.length, 1, 'no orphan room');
      assert.deepEqual(playerKeys(room(id)), ['2', '3']);
      assert.ok(['2', '3'].includes(String(room(id).player1Id)));
      // and the original leader still takes over
      await rematch(1);
      assert.equal(room(id).player1Id, 1);
    }
  });

  it('a player pressed and left: the lead passes on; the original leader can still come back', async () => {
    seedFinished(3);
    const id = (await rematch(2)).body.nextRoomId;
    await rematch(3);
    const left = await call({ action: 'leave', roomId: id, playerId: 2 });
    assert.equal(left.statusCode, 200);
    assert.equal(room(id).player1Id, 3, 'host migration on leave');
    await rematch(1);
    assert.equal(room(id).player1Id, 1);
  });

  it('everybody left the play-again room (CANCELLED) -> the next press makes a new one instead of a dead end', async () => {
    seedFinished(3);
    const first = (await rematch(2)).body.nextRoomId;
    await call({ action: 'leave', roomId: first, playerId: 2 });
    assert.equal(room(first).status, 'CANCELLED');
    const r = await rematch(3);
    assert.equal(r.statusCode, 200);
    assert.notEqual(r.body.nextRoomId, first);
    assert.equal(room(r.body.nextRoomId).status, 'WAITING');
    assert.equal(oldInfo().nextRoomId, r.body.nextRoomId);
    assert.equal(oldInfo().originalHostId, '1', 'original leader remembered');
  });

  it('pressing again (double click / after a reload) does not duplicate anything', async () => {
    seedFinished(3);
    const id = (await rematch(2)).body.nextRoomId;
    const again = await rematch(2);
    assert.equal(again.body.nextRoomId, id);
    assert.equal(db.rows('rooms').filter((r) => r.status === 'WAITING').length, 1);
    assert.equal(oldInfo().playAgainUsers.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Shared realtime room channel
// ---------------------------------------------------------------------------
/** Behaves like supabase-js 2.118: channel(topic) returns the existing object; removeChannel is async. */
function fakeRealtime() {
  const channels: any[] = [];
  let created = 0;
  const client: any = {
    getChannels: () => channels,
    channel(topic: string) {
      const t = `realtime:${topic}`;
      const ex = channels.find((c) => c.topic === t);
      if (ex) return ex;
      const ch: any = {
        n: ++created, topic: t, state: 'closed', bindings: [] as any[], cbs: [] as any[], sent: [] as any[], http: [] as any[],
        on(type: string, filter: any, cb: any) { this.bindings.push({ type, filter, cb }); return this; },
        subscribe(cb: any) {
          if (this.state !== 'closed') return this; // supabase: no-op unless closed
          this.state = 'joining';
          this.cbs.push(cb);
          setTimeout(() => { if (this.state === 'joining') { this.state = 'joined'; this.cbs.forEach((f: any) => f('SUBSCRIBED')); } }, 1);
          return this;
        },
        send(m: any) { this.sent.push(m); return Promise.resolve('ok'); },
        httpSend(event: string, payload: any) { this.http.push({ event, payload }); return Promise.resolve({ success: true }); },
        emit(event: string, payload: any) { this.bindings.filter((b: any) => b.type === 'broadcast').forEach((b: any) => b.cb({ type: 'broadcast', event, payload })); },
      };
      channels.push(ch);
      return ch;
    },
    async removeChannel(ch: any) {
      await sleep(5); // round trip
      ch.state = 'closed';
      ch.cbs.forEach((f: any) => f('CLOSED'));
      const i = channels.indexOf(ch);
      if (i >= 0) channels.splice(i, 1);
      return 'ok';
    },
    created: () => created,
  };
  return client;
}
const tick = (ms = 10) => sleep(ms);

describe('shared room channel', () => {
  beforeEach(() => __resetRoomChannelsForTests());

  it('game -> results: the results page reuses the live channel (no removal, no closing channel)', async () => {
    const c = fakeRealtime();
    const gameEvents: string[] = [];
    const resultsEvents: string[] = [];
    const leaveGame = joinRoomChannel(c, 'r1', { onBroadcast: (e) => gameEvents.push(e) });
    await tick();
    const ch = c.getChannels()[0];
    assert.equal(ch.state, 'joined');
    leaveGame(); // navigation
    const leaveResults = joinRoomChannel(c, 'r1', { onBroadcast: (e) => resultsEvents.push(e) });
    await tick(20);
    assert.equal(c.created(), 1, 'one channel only');
    assert.equal(ch.state, 'joined');
    ch.emit('rematch_created', { nextRoomId: 'n' });
    assert.deepEqual(resultsEvents, ['rematch_created'], 'the results page hears play-again events');
    assert.deepEqual(gameEvents, [], 'the game page is gone');
    leaveResults();
  });

  it('an effect re-running on every render (deps like `app`) never kills the channel', async () => {
    const c = fakeRealtime();
    let got = 0;
    let leave = joinRoomChannel(c, 'r1', { onBroadcast: () => got++ });
    for (let i = 0; i < 20; i++) { leave(); leave = joinRoomChannel(c, 'r1', { onBroadcast: () => got++ }); }
    await tick(20);
    c.getChannels()[0].emit('player_answered', {});
    assert.equal(got, 1);
    assert.equal(c.created(), 1);
  });

  it('after the last page left, the channel is removed; a new page waits for that and gets a NEW channel', async () => {
    const c = fakeRealtime();
    const timers: any[] = [];
    const opts = { setTimer: (fn: () => void) => { timers.push(fn); return timers.length; }, clearTimer: () => {} };
    const leave = joinRoomChannel(c, 'r1', {}, opts);
    await tick();
    const first = c.getChannels()[0];
    leave();
    timers.shift()!(); // release delay passed -> removal starts (async)
    const statuses: string[] = [];
    joinRoomChannel(c, 'r1', { onStatus: (s) => statuses.push(s) }, opts);
    await tick(30);
    assert.equal(first.state, 'closed');
    const now = c.getChannels();
    assert.equal(now.length, 1);
    assert.notEqual(now[0], first, 'not the closing channel');
    assert.equal(now[0].state, 'joined');
    assert.deepEqual(statuses, ['SUBSCRIBED'], 'the removed channel\'s CLOSED never reaches anyone');
  });

  it('a new page on an already-live channel is told SUBSCRIBED (so it can resync)', async () => {
    const c = fakeRealtime();
    joinRoomChannel(c, 'r1', {});
    await tick();
    const statuses: string[] = [];
    joinRoomChannel(c, 'r1', { onStatus: (s) => statuses.push(s) });
    await tick();
    assert.deepEqual(statuses, ['SUBSCRIBED']);
  });

  it('sending never subscribes or removes the shared channel', async () => {
    const c = fakeRealtime();
    await sendRoomBroadcast(c, 'r2', 'room_completed', { roomId: 'r2' });
    assert.equal(c.getChannels()[0].state, 'closed', 'not subscribed, sent over HTTP');
    assert.equal(c.getChannels()[0].http.length, 1);
    const leave = joinRoomChannel(c, 'r2', {});
    await tick();
    await sendRoomBroadcast(c, 'r2', 'player_left', {});
    assert.equal(c.getChannels()[0].sent.length, 1, 'through the live channel');
    assert.equal(c.getChannels()[0].state, 'joined');
    leave();
  });

  it('the release delay is a few seconds (page transitions)', () => {
    assert.ok(ROOM_CHANNEL_RELEASE_DELAY_MS >= 2000 && ROOM_CHANNEL_RELEASE_DELAY_MS <= 10000);
  });
});

describe('wiring', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

  it('no page creates / removes room_sync_<id> itself any more', () => {
    for (const f of ['../src/pages/ChallengeGamePage.tsx', '../src/pages/GroupWaitingPage.tsx', '../src/pages/GroupGameResultsPage.tsx', '../src/components/WhoAmIGame.tsx', '../src/contexts/AppContext.tsx']) {
      const src = read(f);
      assert.doesNotMatch(src, /supabase\.channel\(`room_sync_/, f);
      assert.doesNotMatch(src, /topic === `realtime:room_sync_\$\{/, f);
    }
  });

  it('the "connection lost" overlay ignores the room channel after its effect ended', () => {
    const ctx = read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /onStatus: \(status: string\) => \{\n\s+if \(!isCurrent\) return;/);
    assert.match(ctx, /isCurrent = false;\n\s+setIsReconnecting\(false\);\n\s+stopRoomChannel\(\);/);
    assert.match(ctx, /\{ topic: `room_sync_app_\$\{room\.id\}` \}/);
  });

  it('the waiting page follows a leadership change (no stale player1 object)', () => {
    const src = read('../src/pages/GroupWaitingPage.tsx');
    assert.match(src, /broadcastHandlers\['host_changed'\]/);
    assert.doesNotMatch(src, /player1: prev\?\.player1 \|\| newRow\.player1/);
  });
});

// ---------------------------------------------------------------------------
// playersProgress metadata (__rematch, __kicked, __lastReaction, _firstCorrectUserId) is never a player
// ---------------------------------------------------------------------------
describe('playersProgress metadata is never counted as a player', () => {
  let server: any;
  before(async () => { server = await import('../api/1v1.ts'); });

  const META = () => ({
    __rematch: { nextRoomId: 'x', playAgainUsers: [{ id: 9, name: 'Z' }], originalHostId: '1' },
    __kicked: ['p7'],
    __lastReaction: { type: 'r', emoji: '👍', timestamp: 1 },
  });
  /** Room 'g' with players 1 and 2 + all metadata keys. */
  const seedGame = (extra: Row = {}) => {
    db = new Db();
    db.rows('players').push({ id: 1, name: 'P1', username: 'p1' }, { id: 2, name: 'P2', username: 'p2' });
    db.rows('rooms').push({ id: 'g', code: 'GGG111', status: 'PLAYING', transitionMode: 'SYNC', player1Id: 1, questionCount: 2,
      currentQuestionIndex: 1, currentAnswers: {}, challengeIds: [], timePerQuestion: 0, createdAt: new Date().toISOString(),
      playersProgress: { '1': { name: 'P1', score: 0 }, '2': { name: 'P2', score: 0 }, ...META() }, ...extra });
  };
  const g = () => room('g');
  const metaUntouched = () => assert.deepEqual(
    { __rematch: g().playersProgress.__rematch, __kicked: g().playersProgress.__kicked, __lastReaction: g().playersProgress.__lastReaction },
    META(), 'metadata left as it was (no score / trophy / answer fields written into it)');

  it('isRoomPlayerKey', () => {
    for (const k of ['__rematch', '__kicked', '__lastReaction', '_firstCorrectUserId']) assert.equal(server.isRoomPlayerKey(k), false, k);
    for (const k of ['1', '42', 'ali']) assert.equal(server.isRoomPlayerKey(k), true, k);
  });

  it('haveAllActivePlayersAnswered ignores metadata', () => {
    seedGame();
    g().currentAnswers = { '1': { questionIndex: 1 }, '2': { questionIndex: 1 } };
    assert.equal(server.haveAllActivePlayersAnswered(g()), true);
    g().currentAnswers = { '1': { questionIndex: 1 }, _firstCorrectUserId: 1 };
    assert.equal(server.haveAllActivePlayersAnswered(g()), false);
  });

  it('SYNC last question: both answer -> results; the winner is a real player; metadata untouched', async () => {
    seedGame();
    await call({ action: 'submit-answer', roomId: 'g', playerId: 1, questionIndex: 1, isCorrect: true, score: 1 });
    assert.equal(g().status, 'PLAYING');
    await call({ action: 'submit-answer', roomId: 'g', playerId: 2, questionIndex: 1, isCorrect: false });
    assert.equal(g().status, 'completed');
    assert.ok(['1', '2'].includes(String(g().winnerId)), `winner ${g().winnerId}`);
    metaUntouched();
  });

  it('the room shows "answered 1 of 2" after one correct answer (not 2: _firstCorrectUserId)', async () => {
    seedGame();
    const r = await call({ action: 'submit-answer', roomId: 'g', playerId: 1, questionIndex: 1, isCorrect: true });
    assert.equal(r.body.answeredCount, 1);
    assert.equal(r.body.participants.length, 2);
  });

  it('ASYNC: everyone finished -> FINISHED (metadata without finishTime no longer blocks it)', async () => {
    seedGame({ transitionMode: 'ASYNC', currentQuestionIndex: 0 });
    for (const pid of [1, 2]) {
      for (const q of [0, 1]) await call({ action: 'submit-answer', roomId: 'g', playerId: pid, questionIndex: q, isCorrect: true });
    }
    assert.equal(g().status, 'FINISHED');
    metaUntouched();
  });

  it('results recalculated on a finished room that has __rematch (submit-progress) leave __rematch alone', async () => {
    seedGame({ status: 'completed' });
    await call({ action: 'submit-progress', roomId: 'g', playerId: 1, progress: 100, isFinished: true, score: 3 });
    metaUntouched();
  });

  it('all real players withdraw -> the game ends (__kicked / __rematch are not "remaining players")', async () => {
    seedGame();
    await call({ action: 'resign', roomId: 'g', playerId: 1 });
    assert.equal(g().status, 'PLAYING');
    await call({ action: 'resign', roomId: 'g', playerId: 2 });
    assert.equal(g().status, 'FINISHED');
  });

  it('advancing a question gives default answers to players only', async () => {
    seedGame({ currentQuestionIndex: 0, timePerQuestion: 20, questionStartTime: Date.now() - 60_000 });
    const r = await call({ action: 'advance-question', roomId: 'g', playerId: 1, questionIndex: 0 });
    assert.equal(r.statusCode, 200);
    assert.equal(g().currentQuestionIndex, 1);
    metaUntouched();
  });
});

describe('play again button (results page)', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/pages/GroupGameResultsPage.tsx', import.meta.url)), 'utf8');
  const handler = src.slice(src.indexOf('const handlePlayAgain = async'), src.indexOf("if (room?.gameMode === 'WHO_AM_I')"));

  it('a double tap sends one request: the lock is a ref, taken before any await', () => {
    assert.match(handler, /if \(rematchInFlightRef\.current \|\| hasNavigatedRef\.current \|\| !room\?\.id\) return;\n\s+rematchInFlightRef\.current = true;/);
    assert.equal((handler.match(/action: 'rematch'/g) || []).length, 1);
  });

  it('only the server decides (no direct DB read / join that could race a room being created)', () => {
    assert.doesNotMatch(handler, /supabase\s*\.from\('rooms'\)/);
    assert.doesNotMatch(handler, /navigateToRematchRoom\(liveNextRoomId\)/);
  });

  it('shows "جارٍ الانضمام…" and keeps the button disabled for a few seconds after a failure', () => {
    assert.match(src, /'جارٍ الانضمام…'/);
    assert.match(src, /disabled=\{isWaitingForRematch\}/);
    assert.match(src, /export const PLAY_AGAIN_COOLDOWN_MS = 3000;/);
    assert.match(handler, /PLAY_AGAIN_COOLDOWN_MS - \(Date\.now\(\) - startedAt\)/);
  });

  it('a broadcast does not start a second join while our own request is on its way', () => {
    assert.match(src, /isWaitingForRematchRef\.current && !hasNavigatedRef\.current && !rematchInFlightRef\.current/);
  });
});
