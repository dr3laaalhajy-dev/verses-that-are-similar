/**
 * Keeping a group room in step with the server.
 *
 * - startRoomResync: asks for the room's real state when the tab becomes visible again, the
 *   network comes back, the Capacitor app resumes, and every ROOM_RESYNC_INTERVAL_MS while the
 *   room is being played (missed realtime events are otherwise never recovered).
 * - createSerialQueue + postWithRetry: one player's room requests are sent one after another
 *   (never overlapping) and retried on network / server errors, so they cannot overwrite each other.
 * - isQuestionTimeUp: the SYNC question time measured from the server's questionStartTime.
 */

export const ROOM_RESYNC_INTERVAL_MS = 5000;

/**
 * Safety net outside the game screen: the waiting room (start) and the results page while the room
 * is still playing (finish) re-read the room this often, in case a realtime event was missed.
 */
export const ROOM_SAFETY_POLL_MS = 4000;

type DocLike = Pick<Document, 'addEventListener' | 'removeEventListener'> & { visibilityState: DocumentVisibilityState | string };
type WinLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export type ResyncReason = 'visible' | 'online' | 'resume' | 'interval' | 'subscribed' | 'stale';

export interface RoomResyncOptions {
  onResync: (reason: ResyncReason) => void;
  doc?: DocLike;
  win?: WinLike;
  intervalMs?: number;
  setIntervalFn?: (fn: () => void, ms: number) => any;
  clearIntervalFn?: (id: any) => void;
}

/** Starts the resync triggers; returns a function that stops all of them. */
export function startRoomResync(options: RoomResyncOptions): () => void {
  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  const win = options.win ?? (typeof window !== 'undefined' ? window : undefined);
  const setIntervalFn = options.setIntervalFn ?? ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = options.clearIntervalFn ?? ((id) => clearInterval(id));
  const fire = (reason: ResyncReason) => {
    try {
      options.onResync(reason);
    } catch {
      // never break the page because of a resync
    }
  };

  const onVisibility = () => {
    if (doc?.visibilityState === 'visible') fire('visible');
  };
  const onOnline = () => fire('online');
  const onResume = () => fire('resume');

  doc?.addEventListener('visibilitychange', onVisibility);
  doc?.addEventListener('resume', onResume);
  win?.addEventListener('online', onOnline);
  const timer = setIntervalFn(() => {
    // A hidden tab is resynced when it becomes visible; no polling in the background.
    if (!doc || doc.visibilityState !== 'hidden') fire('interval');
  }, options.intervalMs ?? ROOM_RESYNC_INTERVAL_MS);

  return () => {
    doc?.removeEventListener('visibilitychange', onVisibility);
    doc?.removeEventListener('resume', onResume);
    win?.removeEventListener('online', onOnline);
    clearIntervalFn(timer);
  };
}

/** Runs tasks strictly one after another (a failing task does not block the next one). */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

export interface PostResult {
  ok: boolean;
  status: number;
  data: any;
}

/**
 * POSTs JSON and retries on network errors and 5xx (not on 4xx: those are real answers such as
 * STALE_QUESTION). Never throws.
 */
export async function postWithRetry(
  url: string,
  body: unknown,
  opts: {
    fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
    retries?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<PostResult> {
  const fetchImpl = opts.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 600;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: PostResult = { ok: false, status: 0, data: null };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      last = { ok: res.ok, status: res.status, data };
      if (res.ok || (res.status >= 400 && res.status < 500)) return last;
    } catch {
      last = { ok: false, status: 0, data: null };
    }
    if (attempt < retries) await sleep(baseDelayMs * (attempt + 1));
  }
  return last;
}

/** Margin for clock / network differences before a question counts as timed out. */
export const QUESTION_TIME_SLACK_MS = 1500;

/** True when the room's current SYNC question time is over. Rooms without a timer: false. */
export function isQuestionTimeUp(room: any, now: number = Date.now(), slackMs = QUESTION_TIME_SLACK_MS): boolean {
  const seconds = Number(room?.timePerQuestion) || 0;
  const startedAt = Number(room?.questionStartTime) || 0;
  if (seconds <= 0 || !startedAt) return false;
  return now - startedAt >= seconds * 1000 + slackMs;
}
