/**
 * Leaving the question screen in group rooms: grace period LEAVE_GRACE_MS, only a hidden page
 * counts (blur never does), coming back / Capacitor "resume" cancels, and brief presence drops
 * do not let the host skip a player's answer.
 *   node --import tsx --test tests/leave-guard.test.ts
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LEAVE_GRACE_MS, presenceWithGrace } from '../src/lib/leaveGuard.ts';

describe('presence grace constant', () => {
  it('8 s', () => assert.equal(LEAVE_GRACE_MS, 8000));
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

  it('no automatic withdrawal when leaving the screen (room game, "Who am I")', async () => {
    for (const f of ['../src/pages/ChallengeGamePage.tsx', '../src/components/WhoAmIGame.tsx']) {
      const src = await read(f);
      assert.doesNotMatch(src, /startLeaveGuard/, f);
      assert.doesNotMatch(src, /تم اعتبارك منسحباً/, f);
      assert.doesNotMatch(src, /onWithdrawRef/, f);
      assert.doesNotMatch(src, /addEventListener\('blur'/, f);
    }
    assert.doesNotMatch(await read('../src/lib/leaveGuard.ts'), /export function startLeaveGuard/);
  });

  it('room presence applies the grace period', async () => {
    const src = await read('../src/contexts/AppContext.tsx');
    assert.match(src, /presenceWithGrace\(currentIds, presenceLastSeen, Date\.now\(\)\)/);
  });
});
