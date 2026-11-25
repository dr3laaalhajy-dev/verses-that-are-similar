/**
 * Room start / finish reach every player without a refresh.
 *
 * Root cause: setRoom(prev => next) stored the FUNCTION in roomRef, so roomRef.current.id was
 * undefined and isCurrentRoomResponse (added for the play-again flicker) dropped every later room
 * answer: the waiting room never started and results never showed for the second player.
 *   node --import tsx --test tests/realtime-delivery.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRoomSetter, isCurrentRoom } from '../src/lib/roomState.ts';
import { ROOM_SAFETY_POLL_MS } from '../src/lib/roomSync.ts';
import { joinRoomChannel, __resetRoomChannelsForTests } from '../src/lib/roomChannel.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const memStorage = () => {
  const m = new Map<string, string>();
  return { setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), get: (k: string) => m.get(k) };
};

/** The wrapper as it was before (kept here to show the failure). */
const oldSetter = (setState: (v: any) => void, ref: { current: any }) => (val: any) => { ref.current = val; setState(val); };

describe('room setter keeps roomRef an object', () => {
  it('reproduction: the old wrapper put the updater function in roomRef -> valid answers were dropped', () => {
    const ref = { current: null as any };
    let state: any = null;
    const setRoom = oldSetter((v) => { state = typeof v === 'function' ? v(state) : v; }, ref);
    setRoom({ id: 'r1', status: 'WAITING' });
    setRoom((prev: any) => ({ ...prev, status: 'PLAYING' })); // waiting page: realtime row update
    assert.equal(typeof ref.current, 'function');
    assert.equal(isCurrentRoom(ref, { id: 'r1', status: 'PLAYING' }), false, 'the start answer was thrown away');
  });

  it('fixed: functional updates keep the room object (id) in roomRef', () => {
    const ref = { current: null as any };
    let state: any = null;
    const storage = memStorage();
    const setRoom = createRoomSetter((v) => { state = v; }, ref, storage);
    setRoom({ id: 'r1', status: 'WAITING', participants: [] });
    setRoom((prev: any) => (prev ? { ...prev, status: 'PLAYING' } : prev));
    assert.equal(ref.current.id, 'r1');
    assert.equal(ref.current.status, 'PLAYING');
    assert.equal(state.status, 'PLAYING');
    assert.equal(isCurrentRoom(ref, { id: 'r1', status: 'PLAYING' }), true);
    assert.equal(storage.get('activeRoomId'), 'r1');
  });

  it('a functional update that returns null clears the room (and the remembered id)', () => {
    const ref = { current: null as any };
    const storage = memStorage();
    const setRoom = createRoomSetter(() => {}, ref, storage);
    setRoom({ id: 'r1' });
    setRoom(() => null);
    assert.equal(ref.current, null);
    assert.equal(storage.get('activeRoomId'), undefined);
  });

  it('a late answer for ANOTHER room is still ignored (the play-again fix stays)', () => {
    const ref = { current: null as any };
    const setRoom = createRoomSetter(() => {}, ref, memStorage());
    setRoom({ id: 'new' });
    setRoom((prev: any) => ({ ...prev, participants: [1, 2] }));
    assert.equal(isCurrentRoom(ref, { id: 'old', status: 'FINISHED' }), false);
    assert.equal(isCurrentRoom(ref, { id: 'new', status: 'PLAYING' }), true);
  });
});

describe('safety polling in the waiting room and while waiting for results', () => {
  const ctx = readFileSync(fileURLToPath(new URL('../src/contexts/AppContext.tsx', import.meta.url)), 'utf8');

  it('interval of a few seconds', () => {
    assert.ok(ROOM_SAFETY_POLL_MS >= 3000 && ROOM_SAFETY_POLL_MS <= 5000);
  });

  it('runs only in the waiting room (WAITING) and on the results page while the room still plays, and drives the room poll', () => {
    assert.match(ctx, /const waitingToStart = view === 'group_waiting' && room\.status === 'WAITING';/);
    assert.match(ctx, /const waitingForResults = view === 'group_game' && room\.status === 'PLAYING';/);
    assert.match(ctx, /setRoomPollTick\(n => n \+ 1\)/);
    assert.match(ctx, /roomPresenceOnlineIds, playerId, uniquePlayerId, challengeMode, roomPollTick\]\);/);
  });

  it('the room poll starts the game from the waiting room and shows results when finished (current-room guard kept)', () => {
    assert.match(ctx, /if \(!isCurrentRoomResponse\(data\)\) return;/);
    assert.match(ctx, /if \(view === 'group_waiting' && data\.status === 'PLAYING'\) \{/);
    assert.match(ctx, /if \(data\.status === 'FINISHED' \|\| data\.status === 'completed'\) \{\n\s+recordDailyGiftRoomMatch\(\);\n\s+setRoom\(data\);/);
  });

  it('AppContext uses the shared setter (no function stored in roomRef)', () => {
    assert.match(ctx, /const setRoom = createRoomSetter\(_setRoom, roomRef\);/);
    assert.match(ctx, /const isCurrentRoomResponse = \(data: any\) => isCurrentRoom\(roomRef, data\);/);
  });
});

// ---------------------------------------------------------------------------
// Hypothesis 1: the shared channel (lib/roomChannel) delivers to a page that joins it late
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

describe('shared room channel: a page joining an already-open channel gets start / finish', () => {
  it('row update (start) and room_completed (finish) reach the second listener', async () => {
    __resetRoomChannelsForTests();
    const c = fakeRealtime();
    joinRoomChannel(c, 'r1', {});                       // another page opened it first
    await sleep(10);
    const ch = c.getChannels()[0];
    assert.equal(ch.state, 'joined');
    const got: string[] = [];
    joinRoomChannel(c, 'r1', {                          // the waiting room joins the live channel
      onRoomChange: (change) => got.push('row:' + change?.new?.status),
      onBroadcast: (event) => got.push('bc:' + event),
    });
    await sleep(5);
    ch.bindings.filter((b: any) => b.type === 'postgres_changes').forEach((b: any) => b.cb({ eventType: 'UPDATE', new: { id: 'r1', status: 'PLAYING' } }));
    ch.emit('room_completed', { roomId: 'r1' });
    assert.deepEqual(got, ['row:PLAYING', 'bc:room_completed']);
    assert.equal(c.created(), 1, 'one channel, handlers bound before subscribe');
  });
});
