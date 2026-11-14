/**
 * "Left the question screen" handling for group rooms (anti-cheat), shared by the room game,
 * "Who am I" and the room presence check.
 *
 * - Only a really hidden page counts (tab switch, minimised window, app sent to background):
 *   document.visibilityState === 'hidden'. Losing focus (blur), the notification shade, or
 *   clicking another window next to this one never counts.
 * - A grace period of LEAVE_GRACE_MS runs before any penalty. Coming back (visible, or
 *   Capacitor's native "resume" event) within it cancels everything.
 */

/** Grace period before leaving the screen / dropping out of presence has any effect. */
export const LEAVE_GRACE_MS = 8000;

type Timer = ReturnType<typeof setTimeout>;

export interface LeaveGuardOptions {
  /** Called once when the page stayed hidden for the whole grace period. */
  onLeave: () => void;
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener'> & { visibilityState: DocumentVisibilityState | string };
  graceMs?: number;
  setTimer?: (fn: () => void, ms: number) => Timer;
  clearTimer?: (t: Timer) => void;
}

/** Starts watching; returns a function that stops watching and cancels any pending penalty. */
export function startLeaveGuard(options: LeaveGuardOptions): () => void {
  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!doc) return () => {};
  const graceMs = options.graceMs ?? LEAVE_GRACE_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((t) => clearTimeout(t));
  let timer: Timer | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      if (timer === null) {
        timer = setTimer(() => {
          timer = null;
          // Still hidden after the whole grace period: the player really left.
          if (doc.visibilityState === 'hidden') options.onLeave();
        }, graceMs);
      }
    } else {
      cancel();
    }
  };

  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('resume', cancel); // Capacitor: app back in the foreground

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('resume', cancel);
    cancel();
  };
}

/**
 * Presence with a grace period: a player who dropped out of the realtime presence list is still
 * considered online for LEAVE_GRACE_MS (a brief disconnect must not let the host skip their
 * answer). `lastSeen` is updated in place.
 * Returns the ids to treat as online and the delay until the next one expires (or null).
 */
export function presenceWithGrace(
  currentIds: Iterable<string>,
  lastSeen: Map<string, number>,
  now: number,
  graceMs: number = LEAVE_GRACE_MS
): { online: Set<string>; nextCheckInMs: number | null } {
  const online = new Set<string>();
  for (const id of currentIds) {
    lastSeen.set(id, now);
    online.add(id);
  }
  let nextCheckInMs: number | null = null;
  for (const [id, seenAt] of lastSeen) {
    if (online.has(id)) continue;
    const left = graceMs - (now - seenAt);
    if (left > 0) {
      online.add(id);
      nextCheckInMs = nextCheckInMs === null ? left : Math.min(nextCheckInMs, left);
    } else {
      lastSeen.delete(id);
    }
  }
  return { online, nextCheckInMs };
}
