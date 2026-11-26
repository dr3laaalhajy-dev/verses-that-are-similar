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

// One shared copy for the whole app (rooms and khatma): retries network errors and 5xx, never 4xx
// (those are real answers such as STALE_QUESTION). Re-exported so room code keeps importing it here.
export { postWithRetry, type PostResult } from './postWithRetry';

/** Margin for clock / network differences before a question counts as timed out. */
export const QUESTION_TIME_SLACK_MS = 1500;

/** True when the room's current SYNC question time is over. Rooms without a timer: false. */
export function isQuestionTimeUp(room: any, now: number = Date.now(), slackMs = QUESTION_TIME_SLACK_MS): boolean {
  const seconds = Number(room?.timePerQuestion) || 0;
  const startedAt = Number(room?.questionStartTime) || 0;
  if (seconds <= 0 || !startedAt) return false;
  return now - startedAt >= seconds * 1000 + slackMs;
}
