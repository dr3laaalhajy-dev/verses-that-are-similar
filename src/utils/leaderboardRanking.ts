/**
 * Leaderboard Ranking Algorithm - Weighted Score & Tie-Breaker
 *
 * Requirements:
 * hiddenRankingScore = totalPoints + (trophiesCount * 20) + (streakCount * 5)
 * Tie-Breaker Priority:
 * 1. hiddenRankingScore (descending)
 * 2. trophiesCount (descending)
 * 3. streakCount (descending)
 * 4. totalPoints (descending)
 *
 * NOTE: hiddenRankingScore MUST NEVER be displayed to users in the UI.
 */

export const TROPHY_WEIGHT = 20;
export const STREAK_WEIGHT = 5;

export interface LeaderboardUser {
  name: string;
  username?: string | null;
  totalPoints: number;
  trophiesCount: number;
  streakCount: number;
  // Aliases for compatibility
  points?: number;
  cups?: number;
  streak?: number;
  activeFrame?: string | null;
  equippedTitle?: string | null;
  equippedNameColor?: string | null;
  seerahCompleted?: boolean;
  generalCompleted?: boolean;
  quranCompleted?: boolean;
}

/**
 * Calculates the hidden ranking score based on weighted metrics.
 * @param totalPoints Total points accumulated by the user
 * @param trophiesCount Number of trophies won in multiplayer/challenges
 * @param streakCount Number of consecutive daily streak days
 */
export function calculateHiddenRankingScore(
  totalPoints: number = 0,
  trophiesCount: number = 0,
  streakCount: number = 0
): number {
  const p = Number(totalPoints) || 0;
  const t = Number(trophiesCount) || 0;
  const s = Number(streakCount) || 0;
  return p + (t * TROPHY_WEIGHT) + (s * STREAK_WEIGHT);
}

/**
 * Comparator function to sort leaderboard users according to the weighted score algorithm
 * and tie-breaker rules.
 */
export function compareLeaderboardUsers(a: Partial<LeaderboardUser>, b: Partial<LeaderboardUser>): number {
  const aPoints = a.totalPoints ?? a.points ?? 0;
  const aTrophies = a.trophiesCount ?? a.cups ?? 0;
  const aStreak = a.streakCount ?? a.streak ?? 0;

  const bPoints = b.totalPoints ?? b.points ?? 0;
  const bTrophies = b.trophiesCount ?? b.cups ?? 0;
  const bStreak = b.streakCount ?? b.streak ?? 0;

  const aScore = calculateHiddenRankingScore(aPoints, aTrophies, aStreak);
  const bScore = calculateHiddenRankingScore(bPoints, bTrophies, bStreak);

  // 1. Primary: hiddenRankingScore descending
  if (bScore !== aScore) {
    return bScore - aScore;
  }

  // 2. Tie-breaker 1: trophiesCount descending
  if (bTrophies !== aTrophies) {
    return bTrophies - aTrophies;
  }

  // 3. Tie-breaker 2: streakCount descending
  if (bStreak !== aStreak) {
    return bStreak - aStreak;
  }

  // 4. Tie-breaker 3: totalPoints descending
  return bPoints - aPoints;
}

