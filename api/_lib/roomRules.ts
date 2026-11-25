/**
 * Group-room fairness rules for the server. The app has the same constants in
 * src/lib/roomRules.ts (tests/away-rules.test.ts checks they match; change both together).
 * No automatic withdrawal and no penalty for leaving the screen or losing the connection;
 * only the question during which the page was hidden scores zero.
 */

/**
 * The page stayed hidden (visibilitychange: other tab / app / screen off) longer than this
 * during a question: that one question scores zero. Shorter: nothing. Focus loss (blur, the
 * notification shade) and connection loss never count.
 */
export const AWAY_NO_SCORE_MS = 10_000;

/**
 * SYNC rooms: every present player answered and the only ones missing are away (presence
 * reported offline). The room waits this long (server clock, from the last answer / the moment
 * they left, whichever is later), then moves on; the away player simply has no answer for that
 * question and stays in the room. Never later than the question's own time.
 */
export const ABSENT_WAIT_MS = 8_000;
