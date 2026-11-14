/**
 * Leaving the question screen in group rooms: grace period LEAVE_GRACE_MS, only a hidden page
 * counts (blur never does), coming back / Capacitor "resume" cancels, and brief presence drops
 * do not let the host skip a player's answer.
 *   node --import tsx --test tests/leave-guard.test.ts
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LEAVE_GRACE_MS, startLeaveGuard, presenceWithGrace } from '../src/lib/leaveGuard.ts';

/** Fake document + manual clock. */
function setup() {
  const listeners = new Map<string, Set<() => void>>();
  const doc: any = {
    visibilityState: 'visible',
    addEventListener: (t: string, fn: () => void) => { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t)!.add(fn); },
    removeEventListener: (t: string, fn: () => void) => listeners.get(t)?.delete(fn),
  };
  const fire = (t: string) => [...(listeners.get(t) || [])].forEach((fn) => fn());
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  const setTimer = (fn: () => void, ms: number) => { const id = ++seq; timers.push({ at: now + ms, fn, id }); return id as any; };
  const clearTimer = (id: any) => { timers = timers.filter((t) => t.id !== id); };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at;
      timers = timers.filter((t) => t !== due);
      due.fn();
    }
    now = target;
  };
  const hide = () => { doc.visibilityState = 'hidden'; fire('visibilitychange'); };
  const show = () => { doc.visibilityState = 'visible'; fire('visibilitychange'); };
  let leaves = 0;
  const stop = startLeaveGuard({ doc, onLeave: () => leaves++, setTimer, clearTimer });
  return { doc, fire, advance, hide, show, stop, listeners, leaves: () => leaves, pending: () => timers.length };
}

describe('leave guard', () => {
  it('uses one shared 8 s grace period', () => {
    assert.equal(LEAVE_GRACE_MS, 8000);
  });

  it('hidden for less than the grace period, then back: no penalty, timer cancelled', () => {
    const g = setup();
    g.hide();
    g.advance(LEAVE_GRACE_MS - 1);
    g.show();
    assert.equal(g.pending(), 0);
    g.advance(60_000);
    assert.equal(g.leaves(), 0);
  });

  it('hidden longer than the grace period: penalty once', () => {
    const g = setup();
    g.hide();
    g.advance(LEAVE_GRACE_MS - 1);
    assert.equal(g.leaves(), 0);
    g.advance(1);
    assert.equal(g.leaves(), 1);
    g.advance(60_000);
    assert.equal(g.leaves(), 1, 'only once');
  });

  it('blur / focus loss only (page still visible): never a penalty, no timer', () => {
    const g = setup();
    g.fire('blur');
    g.fire('focusout');
    g.advance(60_000);
    assert.equal(g.leaves(), 0);
    assert.equal(g.pending(), 0);
    assert.equal(g.listeners.has('blur'), false, 'no blur listener at all');
  });

  it('Capacitor "resume" cancels the countdown', () => {
    const g = setup();
    g.hide();
    g.advance(3000);
    g.fire('resume');
    g.advance(60_000);
    assert.equal(g.leaves(), 0);
  });

  it('several quick hide/show cycles never add up to a penalty', () => {
    const g = setup();
    for (let i = 0; i < 10; i++) {
      g.hide();
      g.advance(LEAVE_GRACE_MS - 1000);
      g.show();
      g.advance(500);
    }
    assert.equal(g.leaves(), 0);
  });

  it('a second "hidden" event does not restart or double the timer', () => {
    const g = setup();
    g.hide();
    g.advance(5000);
    g.hide();
    assert.equal(g.pending(), 1);
    g.advance(LEAVE_GRACE_MS - 5000);
    assert.equal(g.leaves(), 1);
  });

  it('stopping the guard (leaving the room screen) cancels everything', () => {
    const g = setup();
    g.hide();
    g.stop();
    g.advance(60_000);
    assert.equal(g.leaves(), 0);
    assert.equal(g.listeners.get('visibilitychange')?.size ?? 0, 0);
    assert.equal(g.listeners.get('resume')?.size ?? 0, 0);
  });
});

describe('presence with grace (host waits for a briefly disconnected player)', () => {
  let lastSeen: Map<string, number>;
  beforeEach(() => { lastSeen = new Map(); });

  /** What the host does: wait for every ONLINE active player before advancing. */
  const hostCanAdvance = (online: Set<string>, answered: Set<string>, players: string[]) =>
    players.filter((p) => online.has(p)).every((p) => answered.has(p));

  it('a brief presence drop does not let the host skip the player', () => {
    const players = ['1', '2'];
    presenceWithGrace(['1', '2'], lastSeen, 0);
    // Player 2 drops out for 3 s (app briefly in background); player 1 has answered.
    const during = presenceWithGrace(['1'], lastSeen, 3000);
    assert.ok(during.online.has('2'), 'still considered online');
    assert.equal(hostCanAdvance(during.online, new Set(['1']), players), false, 'host keeps waiting');
    assert.equal(during.nextCheckInMs, LEAVE_GRACE_MS - 3000);
    // Back before the grace period ends: nothing happened.
    const back = presenceWithGrace(['1', '2'], lastSeen, 5000);
    assert.ok(back.online.has('2'));
    assert.equal(back.nextCheckInMs, null);
  });

  it('a player gone longer than the grace period is treated as offline', () => {
    presenceWithGrace(['1', '2'], lastSeen, 0);
    presenceWithGrace(['1'], lastSeen, 1000);
    const later = presenceWithGrace(['1'], lastSeen, LEAVE_GRACE_MS);
    assert.equal(later.online.has('2'), false);
    assert.equal(later.nextCheckInMs, null);
    assert.equal(lastSeen.has('2'), false, 'forgotten');
    assert.equal(hostCanAdvance(later.online, new Set(['1']), ['1', '2']), true);
  });

  it('never invents players that were never seen', () => {
    const r = presenceWithGrace(['1'], lastSeen, 0);
    assert.deepEqual([...r.online], ['1']);
  });
});

describe('wiring', () => {
  const read = async (rel: string) => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  };

  it('room game and "Who am I" use the shared guard, no own timers, no blur', async () => {
    for (const f of ['../src/pages/ChallengeGamePage.tsx', '../src/components/WhoAmIGame.tsx']) {
      const src = await read(f);
      assert.match(src, /startLeaveGuard\(/, f);
      assert.doesNotMatch(src, /cheatTimerRef/, f);
      assert.doesNotMatch(src, /setTimeout\([^)]*\}, 5000\)/, f);
      assert.doesNotMatch(src, /addEventListener\('blur'/, f);
    }
  });

  it('the room game guard does not depend on `app` (it changes every render)', async () => {
    const src = await read('../src/pages/ChallengeGamePage.tsx');
    assert.match(src, /\}, \[isMultiplayer, room\?\.id, room\?\.status\]\);/);
  });

  it('room presence applies the grace period', async () => {
    const src = await read('../src/contexts/AppContext.tsx');
    assert.match(src, /presenceWithGrace\(currentIds, presenceLastSeen, Date\.now\(\)\)/);
  });

  it('no new leave check in the daily challenge', async () => {
    const ctx = await read('../src/contexts/AppContext.tsx');
    assert.doesNotMatch(ctx, /startLeaveGuard/);
  });
});
