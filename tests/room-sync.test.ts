/**
 * Room sync phase 1:
 *  - late SYNC answer -> 409 { accepted:false, code:'STALE_QUESTION', room }
 *  - advance-question only when everyone answered or the question's time is over (server clock)
 *  - poll never writes a stale copy of playersProgress back
 *  - one player's requests are serialised (no lost updates between their own answers)
 *  - resync triggers (tab visible, online, resume, every 5 s while playing)
 *   node --import tsx --experimental-test-module-mocks --test tests/room-sync.test.ts
 */
import { describe, it, test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_RESYNC_INTERVAL_MS,
  startRoomResync,
  createSerialQueue,
  postWithRetry,
  isQuestionTimeUp as clientTimeUp,
} from '../src/lib/roomSync.ts';

// ---------------------------------------------------------------------------
// Fake DB with a random network delay on every query (reads are snapshots), like Vercel -> Supabase
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const clone = (x: any) => JSON.parse(JSON.stringify(x));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let maxDelay = 0;
let writes: { table: string; payload: any }[] = [];
class Db {
  tables: Record<string, Row[]> = {};
  rows(t: string) { return (this.tables[t] ||= []); }
  from(t: string) { return new Q(this, t); }
}
class Q {
  f: ((r: Row) => boolean)[] = []; op = 'select'; p: any;
  constructor(private db: Db, private t: string) {}
  select() { return this; }
  eq(c: string, v: any) { this.f.push((r) => String(r[c]) === String(v)); return this; }
  in(c: string, vs: any[]) { const s = (vs || []).map(String); this.f.push((r) => s.includes(String(r[c]))); return this; }
  ilike() { return this; } limit() { return this; } order() { return this; } or() { return this; } neq() { return this; } is() { return this; }
  update(p: any) { this.op = 'update'; this.p = p; return this; }
  async run() {
    if (maxDelay) await sleep(Math.random() * maxDelay);
    const m = this.db.rows(this.t).filter((r) => this.f.every((f) => f(r)));
    if (this.op === 'update') { writes.push({ table: this.t, payload: clone(this.p) }); m.forEach((r) => Object.assign(r, clone(this.p))); }
    return { data: clone(m), error: null };
  }
  async maybeSingle() { const r = await this.run(); return { data: r.data[0] ?? null, error: null }; }
  async single() { return this.maybeSingle(); }
  then(a: any, b: any) { return this.run().then(a, b); }
}
let db = new Db();
const proxy = { from: (t: string) => db.from(t), channel: () => ({ send: async () => ({}) }) };
let handler: any;
let server: any;

before(async () => {
  mock.module(new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href, { namedExports: { supabaseAdmin: proxy }, defaultExport: proxy });
  server = await import('../api/1v1.ts');
  handler = server.default;
});
beforeEach(() => { delete process.env.REQUIRE_PLAYER_TOKEN; maxDelay = 0; writes = []; });

const call = async (body: any, method = 'POST') => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {} };
  const req: any = method === 'GET' ? { method, query: body, body: undefined, headers: {} } : { method, body, query: {}, headers: {} };
  const o = console.error, w = console.warn; console.error = console.warn = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; }
  return res;
};
const seed = (mode: 'SYNC' | 'ASYNC', players: number, extra: Row = {}) => {
  db = new Db();
  const pp: any = {};
  for (let i = 1; i <= players; i++) {
    db.rows('players').push({ id: i, name: 'P' + i, username: 'p' + i });
    pp[String(i)] = { name: 'P' + i, score: 0 };
  }
  db.rows('rooms').push({ id: 'r', status: 'PLAYING', transitionMode: mode, player1Id: 1, questionCount: 8, currentQuestionIndex: 0,
    currentAnswers: {}, playersProgress: pp, challengeIds: [], participants: [], ...extra });
};
const room = () => db.rows('rooms')[0];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
describe('late answer (SYNC)', () => {
  it('an answer for a question the room already left -> 409 STALE_QUESTION with the room, nothing stored', async () => {
    seed('SYNC', 2, { currentQuestionIndex: 3 });
    const r = await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 2, isCorrect: true });
    assert.equal(r.statusCode, 409);
    assert.equal(r.body.accepted, false);
    assert.equal(r.body.code, 'STALE_QUESTION');
    assert.equal(r.body.room.currentQuestionIndex, 3);
    assert.deepEqual(room().currentAnswers, {});
  });

  it('an answer for the current question is stored as before', async () => {
    seed('SYNC', 2);
    const r = await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 0, isCorrect: true });
    assert.equal(r.statusCode, 200);
    assert.equal(room().currentAnswers['1'].isCorrect, true);
  });
});

describe('advance-question uses the server clock', () => {
  const startedAgo = (ms: number) => ({ timePerQuestion: 20, questionStartTime: Date.now() - ms });

  it('before the time is over and with a missing answer -> 409 TOO_EARLY (nobody skipped)', async () => {
    seed('SYNC', 3, startedAgo(5_000));
    room().currentAnswers = { '1': { playerId: 1, isCorrect: true, questionIndex: 0 }, '2': { playerId: 2, isCorrect: true, questionIndex: 0 } };
    const r = await call({ action: 'advance-question', roomId: 'r', playerId: 2, questionIndex: 0 });
    assert.equal(r.statusCode, 409);
    assert.equal(r.body.code, 'TOO_EARLY');
    assert.equal(room().currentQuestionIndex, 0);
  });

  it('after the time is over, ANY player (not only the host) can advance; the absent one gets a wrong answer', async () => {
    seed('SYNC', 3, startedAgo(20_000 + server.QUESTION_EXPIRY_SLACK_MS + 100));
    room().currentAnswers = { '1': { playerId: 1, isCorrect: true, questionIndex: 0 } };
    const r = await call({ action: 'advance-question', roomId: 'r', playerId: 3, questionIndex: 0 });
    assert.equal(r.statusCode, 200);
    assert.equal(room().currentQuestionIndex, 1);
    assert.equal(room().playersProgress['1'].correctCount, 1);
    assert.equal(room().playersProgress['2'].correctCount, 0);
  });

  it('everyone answered -> advance allowed at once', async () => {
    seed('SYNC', 2, startedAgo(2_000));
    room().currentAnswers = { '1': { playerId: 1, isCorrect: true, questionIndex: 0 }, '2': { playerId: 2, isCorrect: false, questionIndex: 0 } };
    const r = await call({ action: 'advance-question', roomId: 'r', playerId: 1, questionIndex: 0 });
    assert.equal(r.statusCode, 200);
    assert.equal(room().currentQuestionIndex, 1);
  });

  it('rooms without a question timer keep the old behaviour', async () => {
    seed('SYNC', 2);
    const r = await call({ action: 'advance-question', roomId: 'r', playerId: 1, questionIndex: 0 });
    assert.equal(r.statusCode, 200);
    assert.equal(room().currentQuestionIndex, 1);
  });

  it('server and client agree on when the time is over', () => {
    const now = 1_000_000;
    const r = { timePerQuestion: 10, questionStartTime: now - 10_000 - 1500 };
    assert.equal(server.isQuestionTimeUp(r, now), true);
    assert.equal(clientTimeUp(r, now), true);
    const early = { timePerQuestion: 10, questionStartTime: now - 10_000 };
    assert.equal(server.isQuestionTimeUp(early, now), false);
    assert.equal(clientTimeUp(early, now), false);
  });
});

describe('poll', () => {
  it('never writes playersProgress back (it could erase answers written in between)', async () => {
    seed('SYNC', 2);
    await call({ action: 'poll', roomId: 'r', playerId: '1' }, 'GET');
    assert.equal(writes.filter((w) => w.table === 'rooms' && 'playersProgress' in w.payload && !('currentQuestionIndex' in w.payload)).length, 0);
  });

  it('still advances a SYNC question whose time is over (server-side expiry)', async () => {
    seed('SYNC', 2, { timePerQuestion: 10, questionStartTime: Date.now() - 30_000 });
    await call({ action: 'poll', roomId: 'r', playerId: '1' }, 'GET');
    assert.equal(room().currentQuestionIndex, 1);
  });
});

// ---------------------------------------------------------------------------
// One player's overlapping requests (the "8 correct -> 4" ASYNC case)
// ---------------------------------------------------------------------------
describe('last question (SYNC, 2 players): P1 answers, P2 has not', () => {
  // questionCount 8 -> index 7 is the last question; 20 s per question, started 3 s ago.
  const lastQ = () => seed('SYNC', 2, { currentQuestionIndex: 7, timePerQuestion: 20, questionStartTime: Date.now() - 3_000 });
  const isOver = () => ['FINISHED', 'completed'].includes(room().status);

  it('the room stays on the question: answer, both players poll, P1 asks end-room -> 409', async () => {
    lastQ();
    const a = await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 7, isCorrect: true });
    assert.equal(a.statusCode, 200);
    assert.equal(room().currentAnswers._firstCorrectUserId, 1, 'the marker that used to be counted as an answer');
    // roomResync polls every 5 s from both players: this used to finish the room
    await call({ action: 'poll', roomId: 'r', playerId: 'p1' }, 'GET');
    await call({ action: 'poll', roomId: 'r', playerId: 'p2' }, 'GET');
    assert.equal(isOver(), false, 'poll must not end the room');
    assert.equal(room().currentQuestionIndex, 7);
    // the host's client used to ask end-room here (same miscount); the server now refuses
    const e = await call({ action: 'end-room', roomId: 'r', playerId: 1 });
    assert.equal(e.statusCode, 409);
    assert.equal(e.body.code, 'TOO_EARLY');
    assert.equal(isOver(), false, 'end-room must not end the room');
    // advance-question is refused as well
    const adv = await call({ action: 'advance-question', roomId: 'r', playerId: 2, questionIndex: 7 });
    assert.equal(adv.statusCode, 409);
    assert.equal(isOver(), false);
  });

  it('P2 answers too -> the room ends (results)', async () => {
    lastQ();
    await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 7, isCorrect: true });
    await call({ action: 'submit-answer', roomId: 'r', playerId: 2, questionIndex: 7, isCorrect: false });
    assert.equal(isOver(), true);
  });

  it('the question time is over (server clock) -> poll ends the room, P2 gets a wrong answer', async () => {
    lastQ();
    await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 7, isCorrect: true });
    room().questionStartTime = Date.now() - (20_000 + server.QUESTION_EXPIRY_SLACK_MS + 100);
    await call({ action: 'poll', roomId: 'r', playerId: 'p1' }, 'GET');
    assert.equal(isOver(), true);
  });

  it('time over -> end-room is accepted', async () => {
    lastQ();
    room().questionStartTime = Date.now() - (20_000 + server.QUESTION_EXPIRY_SLACK_MS + 100);
    const e = await call({ action: 'end-room', roomId: 'r', playerId: 1 });
    assert.equal(e.statusCode, 200);
    assert.equal(isOver(), true);
  });

  it('P2 withdrew -> P1 alone counts as everyone', async () => {
    lastQ();
    room().playersProgress['2'].isResigned = true;
    await call({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: 7, isCorrect: true });
    assert.equal(isOver(), true);
  });

  it('client: the host check is per player (no answer count) and end-room 409 is not treated as finished', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    const ctx = read('../src/contexts/AppContext.tsx');
    assert.doesNotMatch(ctx, /validAnswers\.length >= activeCount/);
    assert.match(ctx, /res\.json\(\)\.then\(body => \(res\.ok \? body : null\)\)/);
    const page = read('../src/pages/ChallengeGamePage.tsx');
    assert.match(page, /if \(res\.status === 409\) \{/);
  });
});

describe('ASYNC: one player, 8 correct answers + progress updates', () => {
  const play = async (useQueue: boolean) => {
    seed('ASYNC', 2);
    maxDelay = 40;
    const enqueue = createSerialQueue();
    const send = (body: any) => (useQueue ? enqueue(() => call(body)) : call(body));
    const inflight: Promise<any>[] = [];
    for (let q = 0; q < 8; q++) {
      inflight.push(send({ action: 'submit-answer', roomId: 'r', playerId: 1, questionIndex: q, isCorrect: true, timestamp: Date.now() }));
      await sleep(10); // the app moves on while the request is still travelling
      inflight.push(send({ action: 'submit-progress', roomId: 'r', playerId: 1, progress: Math.round(((q + 1) / 8) * 100), score: q + 1 }));
      await sleep(10);
    }
    await Promise.all(inflight);
    return room().playersProgress['1'].correctCount ?? 0;
  };

  it('without the queue answers get lost (reproduction)', async () => {
    const counts: number[] = [];
    for (let i = 0; i < 8; i++) counts.push(await play(false));
    assert.ok(counts.some((c) => c < 8), `expected losses, got ${counts.join(',')}`);
  });

  it('with the per-player queue all 8 are counted, every time', async () => {
    for (let i = 0; i < 8; i++) assert.equal(await play(true), 8);
  });
});

// ---------------------------------------------------------------------------
// Client helpers
// ---------------------------------------------------------------------------
describe('serial queue + retry', () => {
  it('runs tasks one after another, in order, never overlapping', async () => {
    const enqueue = createSerialQueue();
    let running = 0, maxRunning = 0;
    const order: number[] = [];
    await Promise.all([1, 2, 3, 4].map((n) => enqueue(async () => {
      running++; maxRunning = Math.max(maxRunning, running);
      await sleep(5 - n);
      order.push(n); running--;
    })));
    assert.deepEqual(order, [1, 2, 3, 4]);
    assert.equal(maxRunning, 1);
  });

  it('a failing task does not block the next', async () => {
    const enqueue = createSerialQueue();
    await assert.rejects(enqueue(async () => { throw new Error('x'); }));
    assert.equal(await enqueue(async () => 7), 7);
  });

  it('retries network errors and 5xx, not 4xx', async () => {
    const statuses = [0, 503, 200];
    let calls = 0;
    const fetchImpl = async () => { const s = statuses[calls++]; if (s === 0) throw new TypeError('offline'); return new Response('{"ok":1}', { status: s }); };
    const r = await postWithRetry('/api/1v1', {}, { fetchImpl, sleep: async () => {} });
    assert.equal(calls, 3);
    assert.equal(r.ok, true);

    let c2 = 0;
    const r2 = await postWithRetry('/api/1v1', {}, { fetchImpl: async () => { c2++; return new Response('{"code":"STALE_QUESTION"}', { status: 409 }); }, sleep: async () => {} });
    assert.equal(c2, 1, 'no retry on 409');
    assert.equal(r2.data.code, 'STALE_QUESTION');
  });

  it('gives up after the retries without throwing', async () => {
    let c = 0;
    const r = await postWithRetry('/api/1v1', {}, { fetchImpl: async () => { c++; throw new TypeError('offline'); }, retries: 2, sleep: async () => {} });
    assert.equal(c, 3);
    assert.equal(r.ok, false);
  });

  it('one shared postWithRetry: rooms (roomSync) and khatma use the same function', async () => {
    const shared = await import('../src/lib/postWithRetry.ts');
    assert.equal(postWithRetry, shared.postWithRetry);
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    assert.doesNotMatch(src('../src/lib/roomSync.ts'), /function postWithRetry/);
    assert.match(src('../src/hooks/useKhatma.ts'), /from '\.\.\/lib\/postWithRetry'/);
  });
});

describe('resync triggers', () => {
  const setup = () => {
    const ls = new Map<string, Set<() => void>>();
    const target = () => ({
      addEventListener: (t: string, fn: () => void) => { if (!ls.has(t)) ls.set(t, new Set()); ls.get(t)!.add(fn); },
      removeEventListener: (t: string, fn: () => void) => ls.get(t)?.delete(fn),
    });
    const doc: any = { ...target(), visibilityState: 'visible' };
    const win: any = target();
    let tick: (() => void) | null = null;
    let intervalMs = 0;
    const reasons: string[] = [];
    const stop = startRoomResync({
      onResync: (r) => reasons.push(r), doc, win,
      setIntervalFn: (fn, ms) => { tick = fn; intervalMs = ms; return 1; },
      clearIntervalFn: () => { tick = null; },
    });
    const fire = (t: string) => [...(ls.get(t) || [])].forEach((fn) => fn());
    return { doc, fire, reasons, stop, tick: () => tick?.(), intervalMs: () => intervalMs, hasTimer: () => tick !== null, listeners: ls };
  };

  it('tab back to visible -> resync (hidden -> nothing)', () => {
    const g = setup();
    g.doc.visibilityState = 'hidden'; g.fire('visibilitychange');
    assert.deepEqual(g.reasons, []);
    g.doc.visibilityState = 'visible'; g.fire('visibilitychange');
    assert.deepEqual(g.reasons, ['visible']);
  });

  it('network back and Capacitor resume -> resync', () => {
    const g = setup();
    g.fire('online'); g.fire('resume');
    assert.deepEqual(g.reasons, ['online', 'resume']);
  });

  it('every 5 s while visible, not while hidden', () => {
    const g = setup();
    assert.equal(g.intervalMs(), ROOM_RESYNC_INTERVAL_MS);
    assert.equal(ROOM_RESYNC_INTERVAL_MS, 5000);
    g.tick();
    g.doc.visibilityState = 'hidden'; g.tick();
    assert.deepEqual(g.reasons, ['interval']);
  });

  it('stops completely outside the room (no timer, no listeners)', () => {
    const g = setup();
    g.stop();
    assert.equal(g.hasTimer(), false);
    for (const set of g.listeners.values()) assert.equal(set.size, 0);
  });
});

// ---------------------------------------------------------------------------
// Wiring in the app
// ---------------------------------------------------------------------------
describe('wiring', () => {
  const read = async (rel: string) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  };

  test('resync runs only while playing a room and on (re)subscribe', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /if \(!room\?\.id \|\| view !== 'challenge' \|\| challengeMode === 'daily' \|\| room\.status !== 'PLAYING'\) return;\s*return startRoomResync\(/);
    assert.match(ctx, /setIsReconnecting\(false\);\s*\/\/[^\n]*\n\s*roomResyncRef\.current\('subscribed'\);/);
    assert.match(ctx, /resetQuestionUIState\(data\.currentQuestionIndex, data\);/);
  });

  test('every SYNC answer response handles STALE_QUESTION by resyncing', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.equal((ctx.match(/STALE_QUESTION'\) \{? ?roomResyncRef\.current\('stale'\)/g) || []).length, 4);
  });

  test('ASYNC answers and progress go through the per-player queue (no direct fetch)', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.equal((ctx.match(/roomSendQueueRef\.current\(\(\) => postWithRetry\('\/api\/1v1'/g) || []).length, 5);
    assert.doesNotMatch(ctx, /fetch\('\/api\/1v1', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*action: 'submit-progress'/);
  });

  test('the host no longer skips an offline-looking player before the question time is over', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /const mayBeSkippedIfOffline = !hasQuestionTimer \|\| isQuestionTimeUp\(data\);/);
    assert.match(ctx, /return \(isParticipantOnline\(p\) \|\| !mayBeSkippedIfOffline\)/);
  });

  test('non-host players also ask the server to advance after a timeout', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.match(ctx, /if \(!isHost && !isLastQuestion && !isAdvancingRef\.current\) \{/);
    assert.match(ctx, /action: 'advance-question',\s*roomId: roomIdAtTimeout/);
  });

  test('no automatic withdrawal when leaving the screen (owner decision; see away-rules tests)', async () => {
    const page = await read('../src/pages/ChallengeGamePage.tsx');
    assert.doesNotMatch(page, /startLeaveGuard\(/);
  });
});
