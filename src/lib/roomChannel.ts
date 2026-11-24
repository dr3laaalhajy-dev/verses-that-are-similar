/**
 * One shared realtime channel per room topic (`room_sync_<roomId>`).
 *
 * Why: supabase-js returns the SAME channel object for the same topic (`client.channel(topic)`),
 * and `removeChannel` is asynchronous. The game, waiting and results pages each created and
 * removed `room_sync_<id>` themselves (and some senders subscribed / removed it just to send one
 * message), so a page often got a channel that was being closed: its subscribe() did nothing,
 * its listeners died with the old channel, and events such as "rematch_created" were missed.
 *
 * Here every page registers listeners on one channel per topic (reference counted). The channel
 * is removed only a while after the last listener left (page transitions reuse it), and a new
 * channel for the same topic is only created after the previous one is completely removed.
 * Sending never subscribes or removes anything.
 */

export interface RoomChannelListener {
  /** Every broadcast on the topic: (event name, the whole message `{ event, payload, type }`). */
  onBroadcast?: (event: string, message: any) => void;
  /** postgres_changes on this room's row (`{ eventType, new, old }`). */
  onRoomChange?: (change: any) => void;
  /** SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED of the shared channel. */
  onStatus?: (status: string) => void;
}

interface Entry {
  topic: string;
  roomId: string;
  listeners: Set<RoomChannelListener>;
  channel: any | null;
  status: string | null;
  releaseTimer: any;
}

/** Keep the channel this long after the last page left it (navigation game -> results). */
export const ROOM_CHANNEL_RELEASE_DELAY_MS = 4000;

const entries = new Map<string, Entry>();
const closing = new Map<string, Promise<unknown>>();

export const roomTopic = (roomId: string | number) => `room_sync_${roomId}`;

const each = (e: Entry, fn: (l: RoomChannelListener) => void) => {
  for (const l of [...e.listeners]) {
    try {
      fn(l);
    } catch (err) {
      console.warn('[roomChannel] listener error', err);
    }
  }
};

async function start(client: any, e: Entry) {
  const pending = closing.get(e.topic);
  if (pending) await pending.catch(() => undefined);
  if (entries.get(e.topic) !== e) return; // released while waiting

  // A channel with this topic that is not ours and still open (old code path): remove it first,
  // otherwise client.channel(topic) would hand it back to us.
  const stray = client.getChannels?.().find((c: any) => c.topic === `realtime:${e.topic}`);
  if (stray && stray.state && stray.state !== 'closed') {
    await Promise.resolve(client.removeChannel(stray)).catch(() => undefined);
    if (entries.get(e.topic) !== e) return;
  }

  const ch = client.channel(e.topic);
  e.channel = ch;
  ch.on('broadcast', { event: '*' }, (message: any) => {
    if (e.channel !== ch) return;
    each(e, (l) => l.onBroadcast?.(message?.event, message));
  })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${e.roomId}` }, (change: any) => {
      if (e.channel !== ch) return;
      each(e, (l) => l.onRoomChange?.(change));
    })
    .subscribe((status: string) => {
      if (e.channel !== ch) return; // a removed channel's own CLOSED is not news
      e.status = status;
      each(e, (l) => l.onStatus?.(status));
    });
}

function teardown(client: any, e: Entry) {
  e.releaseTimer = null;
  if (e.listeners.size > 0 || entries.get(e.topic) !== e) return;
  entries.delete(e.topic);
  const ch = e.channel;
  e.channel = null;
  e.status = null;
  if (!ch) return;
  const p: Promise<unknown> = Promise.resolve()
    .then(() => client.removeChannel(ch))
    .catch(() => undefined)
    .finally(() => {
      if (closing.get(e.topic) === p) closing.delete(e.topic);
    });
  closing.set(e.topic, p);
}

/**
 * Listen to a room's realtime events. Returns a function that stops listening (safe to call
 * twice). Several pages may listen to the same room at once; they share one channel.
 */
export function joinRoomChannel(
  client: any,
  roomId: string | number,
  listener: RoomChannelListener,
  opts: {
    /** Topic name; default room_sync_<roomId>. */
    topic?: string;
    releaseDelayMs?: number;
    setTimer?: (fn: () => void, ms: number) => any;
    clearTimer?: (t: any) => void;
  } = {}
): () => void {
  const topic = opts.topic ?? roomTopic(roomId);
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((t) => clearTimeout(t));
  let e = entries.get(topic);
  if (!e) {
    e = { topic, roomId: String(roomId), listeners: new Set(), channel: null, status: null, releaseTimer: null };
    entries.set(topic, e);
    void start(client, e);
  }
  const entry = e;
  if (entry.releaseTimer) {
    clearTimer(entry.releaseTimer);
    entry.releaseTimer = null;
  }
  entry.listeners.add(listener);
  if (entry.status === 'SUBSCRIBED') {
    // Joined an already-live channel: tell this listener too (it may want to resync).
    Promise.resolve().then(() => {
      if (entry.listeners.has(listener) && entry.status === 'SUBSCRIBED') listener.onStatus?.('SUBSCRIBED');
    });
  }

  let left = false;
  return () => {
    if (left) return;
    left = true;
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0 && entries.get(topic) === entry && !entry.releaseTimer) {
      entry.releaseTimer = setTimer(() => teardown(client, entry), opts.releaseDelayMs ?? ROOM_CHANNEL_RELEASE_DELAY_MS);
    }
  };
}

/**
 * Broadcast on a room's topic without subscribing or removing anything: through the shared
 * channel when it is live, otherwise over HTTP (Supabase's REST broadcast).
 */
export function sendRoomBroadcast(client: any, roomId: string | number, event: string, payload: any): Promise<unknown> {
  const topic = roomTopic(roomId);
  try {
    const live = entries.get(topic);
    if (live?.channel && live.status === 'SUBSCRIBED') {
      return Promise.resolve(live.channel.send({ type: 'broadcast', event, payload })).catch(() => undefined);
    }
    const ch = live?.channel ?? client.channel(topic);
    if (typeof ch.httpSend === 'function') {
      return Promise.resolve(ch.httpSend(event, payload)).catch(() => undefined);
    }
    return Promise.resolve(ch.send({ type: 'broadcast', event, payload })).catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
}

/** For tests only. */
export function __resetRoomChannelsForTests() {
  for (const e of entries.values()) if (e.releaseTimer) clearTimeout(e.releaseTimer);
  entries.clear();
  closing.clear();
}
