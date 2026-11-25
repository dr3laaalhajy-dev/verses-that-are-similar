/**
 * Group-room fairness rules, plus the client-side "page hidden during this question" tracker.
 *
 * The same constants live in api/_lib/roomRules.ts for the server (the app cannot import from
 * /api: in development Vite forwards /api/* to the API server). tests/away-rules.test.ts checks
 * that both files hold the same values; change them together.
 */

/** Page hidden longer than this during a question: that question scores zero. */
export const AWAY_NO_SCORE_MS = 10_000;

/** SYNC: wait this long for away players once everyone present answered (server decides). */
export const ABSENT_WAIT_MS = 8_000;

type DocLike = Pick<Document, 'addEventListener' | 'removeEventListener'> & { visibilityState: DocumentVisibilityState | string };

export interface AwayTracker {
  /** A new question is on screen: forget the previous one (an ongoing hidden stretch restarts now). */
  newQuestion: () => void;
  /** True when, during the current question, the page stayed hidden longer than the threshold. */
  isAway: () => boolean;
  stop: () => void;
}

/**
 * Tracks how long the page is hidden during the current question. Only `visibilitychange`
 * (hidden / visible) and Capacitor `resume` count; blur and offline never do.
 */
export function createAwayTracker(opts: { doc?: DocLike; thresholdMs?: number; now?: () => number } = {}): AwayTracker {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? (document as DocLike) : undefined);
  const threshold = opts.thresholdMs ?? AWAY_NO_SCORE_MS;
  const now = opts.now ?? (() => Date.now());
  let hiddenSince: number | null = doc && doc.visibilityState === 'hidden' ? now() : null;
  let away = false;

  const onVisibility = () => {
    if (!doc) return;
    if (doc.visibilityState === 'hidden') {
      if (hiddenSince === null) hiddenSince = now();
    } else {
      onBack();
    }
  };
  const onBack = () => {
    if (hiddenSince !== null && now() - hiddenSince > threshold) away = true;
    hiddenSince = null;
  };

  doc?.addEventListener('visibilitychange', onVisibility);
  doc?.addEventListener('resume', onBack);

  return {
    newQuestion: () => {
      away = false;
      hiddenSince = doc && doc.visibilityState === 'hidden' ? now() : null;
    },
    isAway: () => away || (hiddenSince !== null && now() - hiddenSince > threshold),
    stop: () => {
      doc?.removeEventListener('visibilitychange', onVisibility);
      doc?.removeEventListener('resume', onBack);
    },
  };
}
