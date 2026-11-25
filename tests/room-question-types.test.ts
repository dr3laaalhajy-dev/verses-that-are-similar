/**
 * Group rooms get exactly the question types and counts the host chose (no audio when audio was
 * not chosen), in the first round and after "play again".
 *   node --import tsx --experimental-test-module-mocks --test tests/room-question-types.test.ts
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  f: ((r: Row) => boolean)[] = []; op = 'select'; p: any; lim = Infinity;
  constructor(private db: Db, private t: string) {}
  select() { return this; }
  eq(c: string, v: any) { this.f.push((r) => String(pathValue(r, c)) === String(v)); return this; }
  is(c: string, v: any) { this.f.push((r) => (v === null ? pathValue(r, c) == null : pathValue(r, c) === v)); return this; }
  match(o: Row) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  in(c: string, vs: any[]) { const s = (vs || []).map(String); this.f.push((r) => s.includes(String(r[c]))); return this; }
  ilike(c: string, v: any) { this.f.push((r) => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase()); return this; }
  limit(n?: number) { this.lim = n ?? Infinity; return this; } order() { return this; } or() { return this; } neq() { return this; } lt() { return this; } gt() { return this; } gte() { return this; }
  update(p: any) { this.op = 'update'; this.p = p; return this; }
  insert(p: any) { this.op = 'insert'; this.p = p; return this; }
  delete() { this.op = 'delete'; return this; }
  async run() {
    const rows = this.db.rows(this.t);
    if (this.op === 'insert') { const row = { ...clone(this.p) }; rows.push(row); return { data: [clone(row)], error: null }; }
    const m = rows.filter((r) => this.f.every((f) => f(r))).slice(0, this.lim);
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

const call = async (body: any) => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {} };
  const req: any = { method: 'POST', body, query: {}, headers: {} };
  const o = console.error, w = console.warn, l = console.log; console.error = console.warn = console.log = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; console.log = l; }
  return res;
};

/** The challenges table: mostly audio (STANDARD), a few COMPLETION and SURAH rows. */
const seedChallenges = () => {
  for (let i = 1; i <= 30; i++) db.rows('challenges').push({ id: i, type: 'STANDARD', keyword: 'a' + i, verses: [{ surah: 'البقرة', juz: 1 }] });
  for (let i = 31; i <= 36; i++) db.rows('challenges').push({ id: i, type: 'COMPLETION', keyword: 'c' + i, correctText: 'x' });
  for (let i = 37; i <= 39; i++) db.rows('challenges').push({ id: i, type: 'SURAH', keyword: 's' + i, correctText: '["الفاتحة"]' });
};
/** The finished mixed room: 2 "surah name" + 2 "complete the verse" (objects, as the app builds them). */
const seedFinishedMixed = (extra: Row = {}) => {
  db = new Db();
  db.rows('players').push({ id: 1, name: 'P1', username: 'p1' }, { id: 2, name: 'P2', username: 'p2' });
  seedChallenges();
  const q = (id: any, type: string) => ({ id, type, keyword: 'q' + id, verseText: 'q' + id, verses: [{ surah: 'الإخلاص', juz: 30 }] });
  db.rows('rooms').push({ id: 'old', code: 'OLD111', name: 'غرفة', status: 'FINISHED', transitionMode: 'SYNC', player1Id: 1,
    gameMode: 'MIXED', questionCount: 4, timePerQuestion: 20, createdAt: new Date().toISOString(), currentAnswers: {},
    surahFilters: { scopeMode: 'juz', selected_juz: [30], selected_surahs: [] },
    challengeIds: [q(50010, 'SURAH'), q(85001, 'SURAH'), q(98001, 'COMPLETION'), q(98002, 'COMPLETION')],
    playersProgress: { '1': { name: 'P1', finishTime: 1 }, '2': { name: 'P2', finishTime: 2 } }, ...extra });
};
const typeCounts = (qs: any[]) => qs.reduce((m: Record<string, number>, q: any) => { const t = String(q?.type ?? '?'); m[t] = (m[t] || 0) + 1; return m; }, {});

describe('play again keeps the chosen question types and counts', () => {
  it('2 surah name + 2 complete the verse -> 4 questions of exactly those types (no audio)', async () => {
    seedFinishedMixed();
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    assert.equal(r.statusCode, 200);
    const qs = r.body.room.challenges as any[];
    assert.equal(qs.length, 4);
    assert.deepEqual(typeCounts(qs), { SURAH: 2, COMPLETION: 2 }, JSON.stringify(typeCounts(qs)));
    assert.equal(r.body.room.questionCount, 4);
  });
});

describe('play again: more cases', () => {
  it('no juz/surah scope: fresh questions of the SAME types from the table, same counts', async () => {
    seedFinishedMixed({ surahFilters: {} });
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    const qs = r.body.room.challenges as any[];
    assert.deepEqual(typeCounts(qs), { SURAH: 2, COMPLETION: 2 });
    const fromTable = qs.filter((q) => Number(q.id) >= 31 && Number(q.id) <= 39);
    assert.equal(fromTable.length, 4, 'fresh questions used where available');
  });

  it('with a juz/surah scope: the previous round\'s questions of each type, reshuffled (never another type)', async () => {
    seedFinishedMixed();
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    const ids = (r.body.room.challenges as any[]).map((q) => q.id).sort();
    assert.deepEqual(ids, [50010, 85001, 98001, 98002].sort());
  });

  it('an audio-only room (ids) stays audio-only with the same count, preferring new questions', async () => {
    seedFinishedMixed({ gameMode: 'STANDARD', challengeIds: [1, 2, 3], questionCount: 3, surahFilters: [] });
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    const qs = r.body.room.challenges as any[];
    assert.equal(qs.length, 3);
    assert.ok(qs.every((q) => q.type === 'STANDARD'));
    assert.ok(qs.every((q) => ![1, 2, 3].includes(q.id)), 'new questions');
  });

  it('Islamic questions (app-side data) are reused, never replaced by another type', async () => {
    const isl = (id: number) => ({ id, type: 'ISLAMIC', keyword: 'i' + id });
    seedFinishedMixed({ gameMode: 'ISLAMIC', challengeIds: [isl(1001), isl(1002)], questionCount: 2 });
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    assert.deepEqual(typeCounts(r.body.room.challenges), { ISLAMIC: 2 });
  });

  it('a previous round without questions: clear message, no room of random questions', async () => {
    seedFinishedMixed({ challengeIds: [] });
    const r = await call({ action: 'rematch', roomId: 'old', playerId: 1 });
    assert.equal(r.statusCode, 409);
    assert.match(r.body.message, /تعذّر تجهيز أسئلة الجولة الجديدة/);
    assert.equal(db.rows('rooms').filter((x) => x.status === 'WAITING').length, 0);
  });
});

describe('create / update-settings keep the chosen types', () => {
  const qs = () => {
    const q = (id: any, type: string) => ({ id, type, keyword: 'q' + id });
    return [q(50001, 'SURAH'), q(50002, 'SURAH'), q(98001, 'COMPLETION'), q(98002, 'COMPLETION')];
  };
  const fresh = () => { db = new Db(); db.rows('players').push({ id: 1, name: 'P1', username: 'p1' }); seedChallenges(); };

  it('2 surah name + 2 complete the verse -> the room has exactly those 4 (no audio)', async () => {
    fresh();
    const r = await call({ action: 'create', player1Id: 1, name: 'غرفة', gameMode: 'MIXED', gameModes: ['SURAH', 'COMPLETION'], customChallenges: qs(), questionCount: 4 });
    assert.ok(r.statusCode === 200 || r.statusCode === 201, String(r.statusCode));
    const room = db.rows('rooms')[0];
    assert.deepEqual(typeCounts(room.challengeIds), { SURAH: 2, COMPLETION: 2 });
    assert.equal(room.questionCount, 4);
  });

  it('without app-built questions and none of the chosen type: a clear message, never other types', async () => {
    fresh();
    db.tables.challenges = db.rows('challenges').filter((c) => c.type !== 'COMPLETION');
    const r = await call({ action: 'create', player1Id: 1, name: 'غرفة', gameMode: 'COMPLETION', gameModes: ['COMPLETION'], questionCount: 2 });
    assert.equal(r.statusCode, 400);
    assert.match(r.body.message, /لا توجد أسئلة كافية من الأنواع المختارة/);
    assert.equal(db.rows('rooms').length, 0);
  });

  it('without app-built questions: only the chosen type is picked', async () => {
    fresh();
    const r = await call({ action: 'create', player1Id: 1, name: 'غرفة', gameMode: 'COMPLETION', gameModes: ['COMPLETION'], questionCount: 3 });
    assert.ok(r.statusCode === 200 || r.statusCode === 201, String(r.statusCode));
    const ids = db.rows('rooms')[0].challengeIds as number[];
    assert.equal(ids.length, 3);
    assert.ok(ids.every((id) => db.rows('challenges').find((c) => c.id === id)?.type === 'COMPLETION'));
  });

  it('changing the settings after creation: the room gets exactly the new choice', async () => {
    fresh();
    await call({ action: 'create', player1Id: 1, name: 'غرفة', gameMode: 'MIXED', gameModes: ['SURAH', 'COMPLETION'], customChallenges: qs(), questionCount: 4 });
    const id = db.rows('rooms')[0].id ?? db.rows('rooms')[0].code;
    db.rows('rooms')[0].id = id || 'room1';
    const three = [{ id: 98010, type: 'COMPLETION' }, { id: 98011, type: 'COMPLETION' }, { id: 98012, type: 'COMPLETION' }];
    const r = await call({ action: 'update-settings', roomId: db.rows('rooms')[0].id, updatePayload: { gameMode: 'COMPLETION', challengeIds: three, questionCount: 3 } });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(typeCounts(r.body.room.challenges), { COMPLETION: 3 });
  });
});

describe('app (wiring)', () => {
  const ctx = readFileSync(fileURLToPath(new URL('../src/contexts/AppContext.tsx', import.meta.url)), 'utf8');

  it('create and save-settings add audio only when audio is chosen', () => {
    assert.equal((ctx.match(/if \(effectiveGameModes\.includes\('audio'\) && !systemSettings\.hideAudioChallenge\) \{/g) || []).length, 2);
  });

  it('a short type stops with a message in create and save-settings (no silent fill)', () => {
    assert.equal((ctx.match(/if \(picked\.length < audioCount\) shortages\.push\(/g) || []).length, 2);
    assert.equal((ctx.match(/if \(islamicQs\.length < islamicWanted\) shortages\.push\(/g) || []).length, 2);
    assert.equal((ctx.match(/لا توجد أسئلة كافية: \$\{shortages\.join/g) || []).length, 2);
  });

  it('joining a room in play uses the current question\'s type (a mixed room has no single mode)', () => {
    assert.match(ctx, /const curQType = String\(\(\(data\.challenges \|\| \[\]\)\[data\.currentQuestionIndex \|\| 0\] \|\| \{\}\)\.type \|\| ''\)\.toUpperCase\(\);/);
  });
});
