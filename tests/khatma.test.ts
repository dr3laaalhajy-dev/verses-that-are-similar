/**
 * Khatma (Quran reading progress): reading timer, local queue, server checks, merge, completion.
 *   node --import tsx --experimental-test-module-mocks --test tests/khatma.test.ts
 */
import { describe, it, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as client from '../src/lib/khatma.ts';
import * as server from '../api/_lib/khatma.ts';

const { createPageReadTracker, requiredSeconds, addReadPage, viewKhatma, applyServerReply, emptyKhatma, loadKhatma, saveKhatma } = client;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('constants (same on app and server)', () => {
  it('604 pages; 20 s for pages 1-2, 45 s otherwise', () => {
    for (const k of ['TOTAL_PAGES', 'PAGE_READ_SECONDS', 'SHORT_PAGE_READ_SECONDS'] as const) assert.equal((client as any)[k], (server as any)[k], k);
    assert.deepEqual([...client.SHORT_PAGES], [...server.SHORT_PAGES]);
    assert.equal(client.TOTAL_PAGES, 604);
    assert.equal(requiredSeconds(1), 20);
    assert.equal(requiredSeconds(2), 20);
    assert.equal(requiredSeconds(3), 45);
    assert.equal(requiredSeconds(604), 45);
    for (let p = 1; p <= 604; p++) assert.equal(requiredSeconds(p), server.requiredSeconds(p));
  });
});

// ---------------------------------------------------------------------------
// Reading timer
// ---------------------------------------------------------------------------
function harness() {
  const listeners = new Map<string, Set<() => void>>();
  const doc: any = {
    visibilityState: 'visible',
    addEventListener: (t: string, fn: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(fn); },
    removeEventListener: (t: string, fn: () => void) => listeners.get(t)?.delete(fn),
  };
  const fire = (t: string) => [...(listeners.get(t) || [])].forEach((fn) => fn());
  let t = 0;
  let tickFn: (() => void) | null = null;
  const read: number[] = [];
  const tracker = createPageReadTracker({
    onRead: (p) => read.push(p),
    doc,
    now: () => t,
    setIntervalFn: (fn) => { tickFn = fn; return 1; },
    clearIntervalFn: () => { tickFn = null; },
  });
  /** Advance the clock second by second (the real tracker ticks every second). */
  const wait = (ms: number) => { for (let i = 0; i < ms; i += 1000) { t += Math.min(1000, ms - i); tickFn?.(); } };
  const hide = () => { doc.visibilityState = 'hidden'; fire('visibilitychange'); };
  const show = () => { doc.visibilityState = 'visible'; fire('visibilitychange'); };
  return { tracker, wait, hide, show, fire, read, listeners, ticking: () => tickFn !== null };
}

describe('reading timer', () => {
  it('a normal page counts after 45 s on screen, not before', () => {
    const h = harness();
    h.tracker.setPage(10);
    h.wait(44_000);
    assert.deepEqual(h.read, []);
    h.wait(1_000);
    assert.deepEqual(h.read, [10]);
    h.wait(60_000);
    assert.deepEqual(h.read, [10], 'once');
  });

  it('pages 1 and 2 count after 20 s', () => {
    const h = harness();
    h.tracker.setPage(1);
    h.wait(20_000);
    h.tracker.setPage(2);
    h.wait(19_000);
    assert.deepEqual(h.read, [1]);
    h.wait(1_000);
    assert.deepEqual(h.read, [1, 2]);
  });

  it('hidden page / background / screen off pauses the timer', () => {
    const h = harness();
    h.tracker.setPage(10);
    h.wait(30_000);
    h.hide();
    h.wait(10 * 60_000);
    assert.deepEqual(h.read, [], 'time while hidden does not count');
    h.show();
    h.wait(14_000);
    assert.deepEqual(h.read, []);
    h.wait(1_000);
    assert.deepEqual(h.read, [10]);
  });

  it('blur (focus loss) does not pause it; Capacitor resume restarts it', () => {
    const h = harness();
    h.tracker.setPage(10);
    h.fire('blur');
    h.wait(45_000);
    assert.deepEqual(h.read, [10]);
    h.tracker.setPage(11);
    h.hide();
    h.wait(30_000);
    h.show();
    h.fire('resume');
    h.wait(45_000);
    assert.deepEqual(h.read, [10, 11]);
  });

  it('jumping through pages counts nothing; time on a page is kept when coming back', () => {
    const h = harness();
    for (const p of [1, 100, 300, 600, 604]) { h.tracker.setPage(p); h.wait(2_000); }
    assert.deepEqual(h.read, []);
    h.tracker.setPage(300);
    h.wait(30_000);
    h.tracker.setPage(301);
    h.wait(5_000);
    h.tracker.setPage(300);
    h.wait(13_000);
    assert.deepEqual(h.read, [300], '2 + 30 + 13 = 45 s on page 300');
  });

  it('no page shown (Mushaf closed): nothing counts; stop removes the listeners and the timer', () => {
    const h = harness();
    h.tracker.setPage(null);
    h.wait(120_000);
    assert.deepEqual(h.read, []);
    h.tracker.stop();
    assert.equal(h.ticking(), false);
    assert.equal(h.listeners.get('visibilitychange')?.size ?? 0, 0);
  });
});

// ---------------------------------------------------------------------------
// Local state
// ---------------------------------------------------------------------------
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe('local progress and queue', () => {
  it('jumping to the last page does not raise the percentage (only read pages count)', () => {
    let s = emptyKhatma();
    assert.equal(viewKhatma(s).percentage, 0);
    s = addReadPage(s, 604);
    const v = viewKhatma(s);
    assert.equal(v.pagesRead, 1);
    assert.equal(v.percentage, 0);
    assert.equal(v.firstUnread, 1);
  });

  it('a page is queued once; the view counts server + queued pages', () => {
    let s = { ...emptyKhatma(), serverRead: [1, 2, 3] };
    s = addReadPage(s, 3);
    s = addReadPage(s, 4);
    s = addReadPage(s, 4);
    s = addReadPage(s, 999);
    assert.deepEqual(s.pending, [4]);
    const v = viewKhatma(s);
    assert.equal(v.pagesRead, 4);
    assert.equal(v.remaining, 600);
    assert.equal(v.firstUnread, 5);
    assert.equal(v.unsynced, true);
  });

  it('603 of 604: 99 %, one page left, the first unread one is known', () => {
    const s = { ...emptyKhatma(), serverRead: Array.from({ length: 604 }, (_, i) => i + 1).filter((p) => p !== 77) };
    const v = viewKhatma(s);
    assert.equal(v.percentage, 99);
    assert.equal(v.remaining, 1);
    assert.equal(v.firstUnread, 77);
  });

  it('offline: the queue survives a restart (stored locally) until the server confirms it', () => {
    const storage = mem();
    let s = emptyKhatma();
    for (const p of [5, 6, 7]) s = addReadPage(s, p);
    saveKhatma('42', s, storage);
    const again = loadKhatma('42', storage);
    assert.deepEqual(again.pending, [5, 6, 7]);
    // a failed send changes nothing: the state is only replaced by a server reply
    assert.deepEqual(applyServerReply(again, {}), again);
  });

  it('server reply: accepted and dropped leave the queue, deferred pages stay for later', () => {
    const s = { ...emptyKhatma(), pending: [5, 6, 7, 8, 9] };
    const next = applyServerReply(s, { accepted: [5, 6], deferred: [7, 8], dropped: [9], khatma: { readPages: [1, 5, 6], completedCount: 0, cycle: 1 } });
    assert.deepEqual(next.serverRead, [1, 5, 6]);
    assert.deepEqual(next.pending, [7, 8]);
  });

  it('khatma completed on the server (new cycle): the old queue is cleared', () => {
    const s = { ...emptyKhatma(), pending: [600, 601] };
    const next = applyServerReply(s, { accepted: [604], khatma: { readPages: [], completedCount: 1, cycle: 2 } });
    assert.deepEqual(next.pending, []);
    assert.equal(next.completedCount, 1);
    assert.equal(next.cycle, 2);
  });
});

// ---------------------------------------------------------------------------
// Server: decideKhatmaPages (pure)
// ---------------------------------------------------------------------------
describe('server checks (decideKhatmaPages)', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const ago = (s: number) => new Date(now - s * 1000).toISOString();

  it('pages outside 1..604, not integers, duplicates and already read pages are dropped', () => {
    const d = server.decideKhatmaPages({ read_pages: [10] }, [0, -3, 605, 1.5, 10, 11, 11, 'x'], now);
    assert.deepEqual(d.accepted, [11]);
    assert.ok(d.dropped.includes(0) && d.dropped.includes(605) && d.dropped.includes(10));
  });

  it('rate: no more pages than the reading time since the last report allows (+ small margin)', () => {
    // 60 s since the last report + 30 s margin = 90 s: two normal pages (2 x 45)
    const d = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(60) }, [10, 11, 12, 13, 14], now);
    assert.deepEqual(d.accepted, [10, 11]);
    assert.deepEqual(d.deferred, [12, 13, 14]);
  });

  it('short pages cost 20 s', () => {
    const d = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(15) }, [1, 2, 3], now);
    assert.deepEqual(d.accepted, [1, 2], '15 + 30 = 45 s: 20 + 20');
  });

  it('read offline: up to 60 min of reading is accepted at once, the rest follows later', () => {
    assert.equal(server.KHATMA_MAX_CATCHUP_MS, 60 * 60 * 1000);
    // 6 h offline, 100 pages queued: 60 min + 30 s = 3630 s -> 80 normal pages now
    const d = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(6 * 3600) }, Array.from({ length: 100 }, (_, i) => i + 3), now);
    assert.equal(d.accepted.length, Math.floor((server.KHATMA_MAX_CATCHUP_MS / 1000 + server.KHATMA_SLACK_SECONDS) / 45));
    assert.equal(d.accepted.length, 80);
    assert.equal(d.deferred.length, 20);
    // 30 min since the last report: only 30 min (+30 s) worth
    const half = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(1800) }, Array.from({ length: 100 }, (_, i) => i + 3), now);
    assert.equal(half.accepted.length, Math.floor((1800 + 30) / 45));
  });

  it('the daily cap still applies after catching up', () => {
    const d = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(6 * 3600), day: server.utcDay(now), day_pages: 250 }, Array.from({ length: 100 }, (_, i) => i + 3), now);
    assert.equal(d.accepted.length, 50);
  });

  it('daily cap: 300 new pages per day', () => {
    const today = server.utcDay(now);
    const d = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(600), day: today, day_pages: 299 }, [10, 11, 12], now);
    assert.deepEqual(d.accepted, [10]);
    const tomorrow = server.decideKhatmaPages({ read_pages: [], last_report_at: ago(600), day: '2026-11-24', day_pages: 300 }, [10], now);
    assert.deepEqual(tomorrow.accepted, [10], 'a new day starts again');
  });
});

// ---------------------------------------------------------------------------
// Server: /api/friends actions (fake DB; khatma_add_pages mirrors the SQL function)
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const clone = (x: any) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Db {
  tables: Record<string, Row[]> = {};
  rows(t: string) { return (this.tables[t] ||= []); }
}
class Q {
  f: ((r: Row) => boolean)[] = []; op = 'select'; p: any;
  constructor(private db: Db, private t: string) {}
  select() { return this; }
  eq(c: string, v: any) { this.f.push((r) => String(r[c]) === String(v)); return this; }
  neq() { return this; } in() { return this; } ilike(c: string, v: any) { this.f.push((r) => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase()); return this; }
  or() { return this; } order() { return this; } limit() { return this; } is() { return this; } not() { return this; } contains() { return this; }
  update(p: any) { this.op = 'update'; this.p = p; return this; }
  insert(p: any) { this.op = 'insert'; this.p = p; return this; }
  async run() {
    const rows = this.db.rows(this.t);
    if (this.op === 'insert') { rows.push(clone(this.p)); return { data: [clone(this.p)], error: null }; }
    const m = rows.filter((r) => this.f.every((f) => f(r)));
    if (this.op === 'update') m.forEach((r) => Object.assign(r, clone(this.p)));
    return { data: clone(m), error: null };
  }
  async maybeSingle() { const r = await this.run(); return { data: r.data[0] ?? null, error: null }; }
  async single() { return this.maybeSingle(); }
  then(a: any, b: any) { return this.run().then(a, b); }
}
let db = new Db();
let lock = Promise.resolve();
/** The SQL function khatma_add_pages (supabase/hotfix/04-player-khatma.sql), row lock included. */
async function khatmaAddPages(args: { p_player: number; p_pages: number[]; p_day: string }) {
  const run = lock.then(async () => {
    await sleep(Math.random() * 5);
    let r = db.rows('player_khatma').find((x) => x.player_id === args.p_player);
    if (!r) { r = { player_id: args.p_player, read_pages: [], pages_read: 0, completed_count: 0, cycle: 1, last_report_at: null, day: null, day_pages: 0 }; db.rows('player_khatma').push(r); }
    const merged = [...new Set([...r.read_pages, ...(args.p_pages || [])])].filter((p) => p >= 1 && p <= 604).sort((a, b) => a - b);
    const added = merged.length - r.read_pages.length;
    if (r.day !== args.p_day) { r.day = args.p_day; r.day_pages = 0; }
    r.day_pages += Math.max(added, 0);
    let pages = merged;
    if (merged.length >= 604) { r.completed_count += 1; r.cycle += 1; pages = []; }
    Object.assign(r, { read_pages: pages, pages_read: pages.length, last_report_at: new Date().toISOString() });
    return clone(r);
  });
  lock = run.then(() => undefined, () => undefined);
  return { data: await run, error: null };
}
const proxy = { from: (t: string) => new Q(db, t), rpc: (name: string, args: any) => (name === 'khatma_add_pages' ? khatmaAddPages(args) : Promise.resolve({ data: null, error: { message: 'no rpc' } })) };
let handler: any;
let friends: any;

before(async () => {
  mock.module(new URL('../api/_lib/supabaseAdmin.ts', import.meta.url).href, { namedExports: { supabaseAdmin: proxy }, defaultExport: proxy });
  friends = await import('../api/friends.ts');
  handler = friends.default;
});
beforeEach(() => {
  delete process.env.REQUIRE_PLAYER_TOKEN;
  db = new Db();
  db.rows('players').push({ id: 7, name: 'قارئ', username: 'reader', uniquePlayerId: 'MT-AAAA', isBlocked: false });
});

const call = async (body: any, method = 'POST') => {
  const res: any = { statusCode: 200, body: null, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, setHeader() {}, end() { return this; } };
  const req: any = method === 'GET' ? { method, query: body, body: undefined, headers: {} } : { method, body, query: {}, headers: {} };
  const o = console.error, w = console.warn, l = console.log; console.error = console.warn = console.log = () => {};
  try { await handler(req, res); } finally { console.error = o; console.warn = w; console.log = l; }
  return res;
};
const report = (pages: number[]) => call({ action: 'khatma-progress', playerId: 7, pages });
const row = () => db.rows('player_khatma').find((r) => r.player_id === 7);

describe('server: khatma-progress action', () => {
  it('only for the token player (ACTOR_SPECS, not public)', () => {
    assert.deepEqual(friends.ACTOR_SPECS['khatma-progress'], { fields: { playerId: 'id' } });
    assert.equal(friends.PUBLIC_ACTIONS.has('khatma-progress'), false);
  });

  it('first report: accepted pages are stored; the answer has the summary', async () => {
    const r = await report([1, 2, 3, 4]);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body.accepted, [1, 2, 3, 4]);
    assert.deepEqual(row().read_pages, [1, 2, 3, 4]);
    assert.equal(r.body.khatma.pagesRead, 4);
    assert.equal(r.body.khatma.percentage, 0);
  });

  it('an empty report just returns the player own progress', async () => {
    await report([1, 2]);
    const r = await report([]);
    assert.deepEqual(r.body.khatma.readPages, [1, 2]);
    assert.deepEqual(r.body.accepted, []);
  });

  it('too fast: pages beyond the reading time are deferred (not stored)', async () => {
    db.rows('player_khatma').push({ player_id: 7, read_pages: [], pages_read: 0, completed_count: 0, cycle: 1, last_report_at: new Date(Date.now() - 60_000).toISOString(), day: null, day_pages: 0 });
    const r = await report([10, 11, 12, 13, 14]);
    assert.deepEqual(r.body.accepted, [10, 11]);
    assert.deepEqual(r.body.deferred, [12, 13, 14]);
    assert.deepEqual(row().read_pages, [10, 11]);
  });

  it('two devices at the same time: both sets of pages are kept (merge)', async () => {
    const [a, b] = await Promise.all([report([10, 11, 12]), report([20, 21, 22])]);
    assert.equal(a.statusCode, 200);
    assert.equal(b.statusCode, 200);
    assert.deepEqual(row().read_pages, [10, 11, 12, 20, 21, 22]);
  });

  it('the 604th page completes the khatma: completed_count + 1, a new cycle starts empty', async () => {
    db.rows('player_khatma').push({ player_id: 7, read_pages: Array.from({ length: 603 }, (_, i) => i + 1), pages_read: 603, completed_count: 0, cycle: 1, last_report_at: null, day: null, day_pages: 0 });
    const r = await report([604]);
    assert.deepEqual(r.body.accepted, [604]);
    assert.equal(r.body.khatma.completedCount, 1);
    assert.equal(r.body.khatma.cycle, 2);
    assert.equal(r.body.khatma.pagesRead, 0);
    assert.deepEqual(row().read_pages, []);
  });

  it('unknown player: 404', async () => {
    const r = await call({ action: 'khatma-progress', playerId: 999, pages: [1] });
    assert.equal(r.statusCode, 404);
  });
});

describe('profile shows the khatma (counts only)', () => {
  it('pages read / 604, percentage, completed khatmas; never the page list', async () => {
    db.rows('player_khatma').push({ player_id: 7, read_pages: [1, 2, 3], completed_count: 2, cycle: 3 });
    const r = await call({ action: 'profile', targetId: '7', viewerId: '' }, 'GET');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body.khatma, { pagesRead: 3, totalPages: 604, percentage: 0, completedCount: 2, cycle: 3 });
  });
});

describe('wiring (app)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  it('the Mushaf runs the reading timer on the page on screen', () => {
    assert.match(read('../src/pages/MushafPage.tsx'), /useKhatmaReading\(app, isPageModeActive \? currentPage : null\);/);
  });
  it('the home page shows read pages (not the last page opened) and "pages left" with a jump', () => {
    const home = read('../src/pages/HomePage.tsx');
    assert.match(home, /const khatmahPercentage = khatma\.percentage;/);
    assert.doesNotMatch(home, /Math\.round\(\(currentPage \/ 604\) \* 100\)/);
    assert.match(home, /handleResumeReadingWird\(khatma\.firstUnread!\)/);
  });
  it('the profile has a khatma card separate from the wird card', () => {
    const modal = read('../src/components/profile/PublicProfileModal.tsx');
    assert.match(modal, /data-testid="profile-khatma"/);
    assert.match(modal, /الورد القرآني اليومي/);
  });
  it('one batch can carry the whole 60-minute catch-up (80 pages)', () => {
    const hook = read('../src/hooks/useKhatma.ts');
    const m = hook.match(/const MAX_BATCH = (\d+);/);
    assert.ok(m && Number(m[1]) >= Math.ceil((server.KHATMA_MAX_CATCHUP_MS / 1000 + server.KHATMA_SLACK_SECONDS) / server.PAGE_READ_SECONDS));
  });

  it('batches: every few pages, every few minutes, on hide / close / back online (no per-second sends)', () => {
    const hook = read('../src/hooks/useKhatma.ts');
    assert.match(hook, /if \(markKhatmaPageRead\(key, p\) >= KHATMA_FLUSH_PAGES\) syncKhatma\(key, playerId\);/);
    assert.match(hook, /\}, KHATMA_FLUSH_MS\);/);
    assert.match(hook, /syncKhatma\(key, playerId, \{ keepalive: true \}\); \/\/ leaving the Mushaf/);
    assert.match(hook, /window\.addEventListener\('online', onOnline\);/);
  });
});
