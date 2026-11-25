/**
 * No automatic withdrawal / penalty for leaving the screen. New fair rules:
 *  - page hidden > AWAY_NO_SCORE_MS during a question -> that question scores zero, nothing else
 *  - offline / channel loss -> never penalised
 *  - SYNC: everyone present answered, the rest are away -> wait ABSENT_WAIT_MS (server clock),
 *    then move on; the away player just has no answer and stays in the room
 *  - manual withdraw still works
 *   node --import tsx --experimental-test-module-mocks --test tests/away-rules.test.ts
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAwayTracker, AWAY_NO_SCORE_MS, ABSENT_WAIT_MS } from '../src/lib/roomRules.ts';
import * as serverRules from '../api/_lib/roomRules.ts';

// ---------------------------------------------------------------------------
// Client: away tracker
// ---------------------------------------------------------------------------
function fakeDoc() {
  const listeners = new Map<string, Set<() => void>>();
  const doc: any = {
    visibilityState: 'visible',
    addEventListener: (t: string, fn: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(fn); },
    removeEventListener: (t: string, fn: () => void) => listeners.get(t)?.delete(fn),
  };
  const fire = (t: string) => [...(listeners.get(t) || [])].forEach((fn) => fn());
  let t = 0;
  const now = () => t;
  const wait = (ms: number) => { t += ms; };
  const hide = () => { doc.visibilityState = 'hidden'; fire('visibilitychange'); };
  const show = () => { doc.visibilityState = 'visible'; fire('visibilitychange'); };
  return { doc, fire, now, wait, hide, show, listeners };
}

describe('constants (one shared definition)', () => {
  it('10 s / 8 s, same values on client and server', () => {
    assert.equal(AWAY_NO_SCORE_MS, 10_000);
    assert.equal(ABSENT_WAIT_MS, 8_000);
    assert.equal(serverRules.AWAY_NO_SCORE_MS, AWAY_NO_SCORE_MS);
    assert.equal(serverRules.ABSENT_WAIT_MS, ABSENT_WAIT_MS);
  });
});

describe('away tracker (page hidden during a question)', () => {
  it('hidden less than 10 s, then back: no effect', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.hide(); d.wait(AWAY_NO_SCORE_MS - 1); d.show();
    assert.equal(tr.isAway(), false);
  });

  it('hidden more than 10 s: this question is "away" (zero)', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.hide(); d.wait(AWAY_NO_SCORE_MS + 1); d.show();
    assert.equal(tr.isAway(), true);
  });

  it('only this question: the next question starts clean', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.hide(); d.wait(15_000); d.show();
    assert.equal(tr.isAway(), true);
    tr.newQuestion();
    assert.equal(tr.isAway(), false);
  });

  it('several short absences never add up', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    for (let i = 0; i < 5; i++) { d.hide(); d.wait(6_000); d.show(); d.wait(500); }
    assert.equal(tr.isAway(), false);
  });

  it('blur, notification shade, offline: never count', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.fire('blur'); d.fire('focusout'); d.fire('offline'); d.wait(60_000);
    assert.equal(tr.isAway(), false);
    assert.equal(d.listeners.has('blur'), false);
    assert.equal(d.listeners.has('offline'), false);
  });

  it('Capacitor resume counts as back', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.hide(); d.wait(3_000); d.doc.visibilityState = 'visible'; d.fire('resume'); d.wait(60_000);
    assert.equal(tr.isAway(), false);
  });

  it('a new question shown while still hidden counts only from then', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    d.hide(); d.wait(30_000);
    tr.newQuestion();          // the room moved on while hidden
    d.wait(4_000); d.show();   // back 4 s into the new question
    assert.equal(tr.isAway(), false);
  });

  it('stop removes every listener', () => {
    const d = fakeDoc();
    const tr = createAwayTracker({ doc: d.doc, now: d.now });
    tr.stop();
    assert.equal(d.listeners.get('visibilitychange')?.size ?? 0, 0);
    assert.equal(d.listeners.get('resume')?.size ?? 0, 0);
  });
});

// ---------------------------------------------------------------------------
// Server (fake DB)
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const clone = (x: any) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
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
  f: ((r: Row) => boolean)[] = []; op = 'select'; p: any;
  constructor(private db: Db, private t: string) {}
  select() { return this; }
  eq(c: string, v: any) { this.f.push((r) => String(pathValue(r, c)) === String(v)); return this; }
  is(c: string, v: any) { this.f.push((r) => (v === null ? pathValue(r, c) == null : pathValue(r, c) === v)); return this; }
  match(o: Row) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  in(c: string, vs: any[]) { const s = (vs || []).map(String); this.f.push((r) => s.includes(String(r[c]))); return this; }
  ilike(c: string, v: any) { this.f.push((r) => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase()); return this; }
  limit() { return this; } order() { return this; } or() { return this; } neq() { return this; } lt() { return this; } gt() { return this; } gte() { return this; }
  update(p: any) { this.op = 'update'; this.p = p; return this; }
  insert(p: any) { this.op = 'insert'; this.p = p; return this; }
  delete() { this.op = 'delete'; return this; }
  async run() {
    const rows = this.db.rows(this.t);
    if (this.op === 'insert') { const row = { ...clone(this.p) }; rows.push(row); return { data: [clone(row)], error: null }; }
    const m = rows.filter((r) => this.f.every((f) => f(r)));
    if (this.op === 'update') m.forEach((r) => Object.assign(r, clone(this.p)));
    if (this.op === 'delete') this.db.tables[this.t] = rows.filter((r) => !m.includes(r));
    return { data: clone(m), error: null };
  }
  async maybeSingle() { const r = await this.run(); return { data: r.data[0] ?? null, error: null }; }
  async single() { return this.maybeSingle(); }
  then(a: any, b: any) { return this.run().then(a, b); }
}
let db = new Db();
const proxy = { from: (t: string) => db.from(t), channel: () => ({ send: async () => 'ok' }) };
let handler: any;
let server: any;

before(async () => {
  mock.module(new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href, { namedExports: { supabaseAdmin: proxy }, defaultExport: proxy });
  server = await import('../api/1v1.ts');
  handler = server.default;
});
beforeEach(() => { delete process.env.REQUIRE_PLAYER_TOKEN; });

const call = async (body: any, method = 'POST') => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {} };
  const req: any = method === 'GET' ? { method, query: body, body: undefined, headers: {} } : { method, body, query: {}, headers: {} };
  const o = console.error, w = console.warn, l = console.log; console.error = console.warn = console.log = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; console.log = l; }
  return res;
};
const seed = (mode: 'SYNC' | 'ASYNC', extra: Row = {}) => {
  db = new Db();
  db.rows('players').push({ id: 1, name: 'P1', username: 'p1' }, { id: 2, name: 'P2', username: 'p2' });
  db.rows('rooms').push({ id: 'r', code: 'RRR111', status: 'PLAYING', transitionMode: mode, player1Id: 1, questionCount: 3, currentQuestionIndex: 0,
    currentAnswers: {}, challengeIds: [], timePerQuestion: 60, questionStartTime: Date.now() - 1_000, createdAt: new Date().toISOString(),
    playersProgress: { '1': { name: 'P1', score: 0 }, '2': { name: 'P2', score: 0 } }, ...extra });
};
const room = () => db.rows('rooms')[0];
const answer = (pid: number, q: number, isCorrect: boolean, awayFlag = false) =>
  call({ action: 'submit-answer', roomId: 'r', playerId: pid, questionIndex: q, isCorrect, awayFlag, ...(isCorrect ? { basePoints: 1, pointsEarned: 1 } : {}) });
const poll = () => call({ action: 'poll', roomId: 'r', playerId: 'p1' }, 'GET');
const presence = (pid: number, isOnline: boolean) => call({ action: 'presence', roomId: 'r', playerId: pid, isOnline });

describe('server: away > 10 s scores zero for that question only', () => {
  it('SYNC: the away correct answer gives nothing, the next question counts normally', async () => {
    seed('SYNC');
    await answer(1, 0, true, true);   // P1 was away > 10 s during question 0
    assert.equal(room().currentAnswers['1'].away, true);
    assert.equal(room().currentAnswers['1'].isCorrect, false);
    assert.equal(room().currentAnswers._firstCorrectUserId, undefined, 'no speed bonus');
    await answer(2, 0, true);
    assert.equal(room().currentQuestionIndex, 1);
    assert.equal(room().playersProgress['1'].correctCount, 0);
    assert.equal(room().playersProgress['1'].basePoints, 0);
    assert.equal(room().playersProgress['2'].correctCount, 1);

    await answer(1, 1, true);         // back, question 1: counts
    await answer(2, 1, false);
    assert.equal(room().playersProgress['1'].correctCount, 1);
    assert.equal(room().playersProgress['1'].basePoints, 1);
    assert.notEqual(room().playersProgress['1'].isAbandoned, true, 'never treated as withdrawn');
  });

  it('ASYNC: same rule', async () => {
    seed('ASYNC');
    await answer(1, 0, true, true);
    assert.equal(room().playersProgress['1'].correctCount ?? 0, 0);
    assert.equal(room().playersProgress['1'].answersCount, 1, 'the question still counts as answered');
    await answer(1, 1, true);
    assert.equal(room().playersProgress['1'].correctCount, 1);
  });

  it('connection loss is never penalised: offline then back, the answer counts', async () => {
    seed('SYNC');
    await presence(1, false);
    await presence(1, true);
    await answer(1, 0, true);
    assert.equal(room().currentAnswers['1'].isCorrect, true);
    assert.equal(room().currentAnswers['1'].away, undefined);
  });
});

describe('server: absent-player wait (ABSENT_WAIT_MS, server clock)', () => {
  it('presence records when the player became away, and clears it on return', async () => {
    seed('SYNC');
    await presence(2, false);
    assert.equal(room().playersProgress['2'].isOnline, false);
    assert.ok(Math.abs(room().playersProgress['2'].awaySince - Date.now()) < 1000);
    await presence(2, true);
    assert.equal(room().playersProgress['2'].awaySince, undefined);
    assert.equal(room().playersProgress['2'].isOnline, true);
  });

  it('before 8 s: nobody is skipped (poll does not advance, advance-question is refused)', async () => {
    seed('SYNC');
    await answer(1, 0, true);
    room().playersProgress['2'].isOnline = false;
    room().playersProgress['2'].awaySince = Date.now() - 3_000;
    await poll();
    assert.equal(room().currentQuestionIndex, 0);
    const r = await call({ action: 'advance-question', roomId: 'r', playerId: 1, questionIndex: 0 });
    assert.equal(r.statusCode, 409);
  });

  it('after 8 s: the room moves on, the away player has "no answer" and stays in the room', async () => {
    seed('SYNC');
    await answer(1, 0, true);
    room().currentAnswers['1'].serverTime = Date.now() - (ABSENT_WAIT_MS + 500);
    room().playersProgress['2'].isOnline = false;
    room().playersProgress['2'].awaySince = Date.now() - (ABSENT_WAIT_MS + 500);
    await poll();
    assert.equal(room().currentQuestionIndex, 1);
    const p2 = room().playersProgress['2'];
    assert.equal(p2.correctCount, 0);
    assert.equal(p2.roundHistory.at(-1).isCorrect, false);
    assert.notEqual(p2.hasLeft, true);
    assert.notEqual(p2.isAbandoned, true);
    assert.equal(room().status, 'PLAYING');
  });

  it('the 8 s count from the LATER of the last answer and the moment they left', async () => {
    seed('SYNC');
    await answer(1, 0, true);
    room().currentAnswers['1'].serverTime = Date.now() - 20_000;
    room().playersProgress['2'].isOnline = false;
    room().playersProgress['2'].awaySince = Date.now() - 2_000; // just left
    assert.equal(server.absentWaitIsOver(room()), false);
  });

  it('came back before the wait was over: waited for, can answer', async () => {
    seed('SYNC');
    await answer(1, 0, true);
    room().currentAnswers['1'].serverTime = Date.now() - 20_000;
    room().playersProgress['2'].awaySince = Date.now() - 20_000;
    room().playersProgress['2'].isOnline = false;
    await presence(2, true); // back
    await poll();
    assert.equal(room().currentQuestionIndex, 0, 'still on the question');
    await answer(2, 0, true);
    assert.equal(room().currentQuestionIndex, 1);
    assert.equal(room().playersProgress['2'].correctCount, 1);
  });

  it('a present player who has not answered yet is always waited for', async () => {
    seed('SYNC');
    await answer(1, 0, true);
    room().currentAnswers['1'].serverTime = Date.now() - 60_000;
    // P2 is online (not away): no early move
    assert.equal(server.absentWaitIsOver(room()), false);
  });

  it('nobody present answered: no early move (only the question time)', async () => {
    seed('SYNC');
    room().playersProgress['1'].isOnline = false; room().playersProgress['1'].awaySince = Date.now() - 60_000;
    room().playersProgress['2'].isOnline = false; room().playersProgress['2'].awaySince = Date.now() - 60_000;
    assert.equal(server.absentWaitIsOver(room()), false);
  });

  it('never later than the question time: time over -> moves on anyway', async () => {
    seed('SYNC', { questionStartTime: Date.now() - 70_000 });
    room().playersProgress['2'].isOnline = false;
    room().playersProgress['2'].awaySince = Date.now() - 1_000;
    await poll();
    assert.equal(room().currentQuestionIndex, 1);
  });

  it('ASYNC rooms never wait for anyone', () => {
    seed('ASYNC');
    assert.equal(server.absentWaitIsOver(room()), false);
  });
});

describe('manual withdraw still works', () => {
  it('resign during the game: the player is out (explicit choice)', async () => {
    seed('SYNC');
    const r = await call({ action: 'resign', roomId: 'r', playerId: 2 });
    assert.equal(r.statusCode, 200);
    assert.equal(room().playersProgress['2'].isAbandoned, true);
  });
});

describe('wiring (client)', () => {
  const ctx = readFileSync(fileURLToPath(new URL('../src/contexts/AppContext.tsx', import.meta.url)), 'utf8');

  it('every scored room answer sends awayFlag (complete x2, surah x2)', () => {
    assert.equal((ctx.match(/awayFlag: away,/g) || []).length, 4);
  });

  it('no points / addPoint for an away question', () => {
    assert.match(ctx, /const basePoints = away \? 0 : matchedRequiredCount \* 1;/);
    assert.match(ctx, /if \(!away\) \{\n\s+setSessionScore\(prev => prev \+ 1\);/);
    assert.match(ctx, /if \(!isAwayThisQuestion\(\)\) \{\n\s+addPoint\(/);
  });

  it('away = page hidden only; presence reports hidden / visible / resume (never a withdrawal)', () => {
    assert.match(ctx, /const handleVisibility = \(\) => sendPresence\(document\.visibilityState !== 'hidden'\);/);
    assert.match(ctx, /document\.addEventListener\('resume', handleResume\);/);
    assert.match(ctx, /awayTrackerRef\.current\?\.newQuestion\(\);/);
  });

  it('the returning player is resynced to the current question (visible -> resync)', () => {
    const sync = readFileSync(fileURLToPath(new URL('../src/lib/roomSync.ts', import.meta.url)), 'utf8');
    assert.match(sync, /if \(doc\?\.visibilityState === 'visible'\) fire\('visible'\);/);
  });

  it('other players see "غائب" (a label, no penalty)', () => {
    const page = readFileSync(fileURLToPath(new URL('../src/pages/ChallengeGamePage.tsx', import.meta.url)), 'utf8');
    assert.match(page, /const isAway = !isMe && !isWithdrawn && !hasAns && pProg\?\.isOnline === false;/);
    assert.match(page, />غائب</);
  });
});
