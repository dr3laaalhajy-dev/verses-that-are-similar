/**
 * Presence grace for group rooms. (The automatic "left the screen = withdrawn" guard was removed:
 * leaving the screen or losing the connection is never a withdrawal; see lib/roomRules.ts for the
 * only consequence, a zero for the question during which the page stayed hidden.)
 */

/** Grace period before a player who dropped out of realtime presence counts as offline. */
export const LEAVE_GRACE_MS = 8000;

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
