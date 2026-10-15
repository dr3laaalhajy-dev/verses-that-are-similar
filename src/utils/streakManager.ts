export type StreakStatus = 'active' | 'warning' | 'zero';

export interface StreakInfo {
  streak: number;
  status: StreakStatus;
  isGracePeriod: boolean;
  hoursRemaining: number;
  timeLeftFormatted: string;
  lastPlayedTime: number | null;
  lastPlayedDate: string;
  message: string;
}

const FULL_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 hours grace
const TOTAL_ALLOWABLE_MS = FULL_DAY_MS + GRACE_PERIOD_MS; // 36 hours total

/**
 * Calculates the current status and time remaining for the daily streak.
 * Rule:
 * - 0 to 24 hours: Active flame (مشتعلة)
 * - 24 to 36 hours: Grace period (الشعلة طافية مؤقتاً في مهلة الإنقاذ 12 ساعة)
 * - > 36 hours: Streak broken (0)
 */
export const calculateStreakInfo = (
  savedStreak: number,
  savedLastPlayedDate: string,
  savedLastPlayedTimeStr: string | null
): StreakInfo => {
  const now = Date.now();

  // If no streak at all
  if (savedStreak <= 0) {
    return {
      streak: 0,
      status: 'zero',
      isGracePeriod: false,
      hoursRemaining: 0,
      timeLeftFormatted: '00:00:00',
      lastPlayedTime: null,
      lastPlayedDate: savedLastPlayedDate || '',
      message: 'ابدأ سلسلتك اليوم بإكمال التحدي اليومي!'
    };
  }

  // Derive timestamp if only date was saved previously
  let lastPlayedTime: number;
  if (savedLastPlayedTimeStr && !isNaN(parseInt(savedLastPlayedTimeStr))) {
    lastPlayedTime = parseInt(savedLastPlayedTimeStr);
  } else if (savedLastPlayedDate) {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (savedLastPlayedDate === today) {
      lastPlayedTime = now - 2 * 3600 * 1000; // ~2 hours ago
    } else if (savedLastPlayedDate === yesterday) {
      lastPlayedTime = now - 22 * 3600 * 1000; // ~22 hours ago
    } else {
      lastPlayedTime = now - 40 * 3600 * 1000; // > 36h ago
    }
  } else {
    lastPlayedTime = now;
  }

  const elapsedMs = Math.max(0, now - lastPlayedTime);

  // Case 1: Active Flame (Within 24 hours)
  if (elapsedMs <= FULL_DAY_MS) {
    const remainingMs = FULL_DAY_MS - elapsedMs;
    const hoursRemaining = Math.max(0, remainingMs / (1000 * 60 * 60));
    return {
      streak: savedStreak,
      status: 'active',
      isGracePeriod: false,
      hoursRemaining,
      timeLeftFormatted: formatMilliseconds(remainingMs),
      lastPlayedTime,
      lastPlayedDate: savedLastPlayedDate,
      message: 'شعلتك مشتعلة ومتقدة بنجاح! حافظ عليها بإنجاز تحدياتك بانتظام.'
    };
  }

  // Case 2: Grace Period (Between 24 and 36 hours) - 12 hours rescue window
  if (elapsedMs <= TOTAL_ALLOWABLE_MS) {
    const remainingGraceMs = TOTAL_ALLOWABLE_MS - elapsedMs;
    const hoursRemaining = Math.max(0, remainingGraceMs / (1000 * 60 * 60));
    return {
      streak: savedStreak,
      status: 'warning',
      isGracePeriod: true,
      hoursRemaining,
      timeLeftFormatted: formatMilliseconds(remainingGraceMs),
      lastPlayedTime,
      lastPlayedDate: savedLastPlayedDate,
      message: 'شعلتك انطفأت مؤقتاً! أمامك مهلة 12 ساعة لإكمال التحدي اليومي وإعادة إشعالها.'
    };
  }

  // Case 3: Expired (> 36 hours) -> Streak Broken
  return {
    streak: 0,
    status: 'zero',
    isGracePeriod: false,
    hoursRemaining: 0,
    timeLeftFormatted: '00:00:00',
    lastPlayedTime,
    lastPlayedDate: savedLastPlayedDate,
    message: 'انقضت مهلة الـ 36 ساعة وانكسرت السلسلة. أكمل تحدي اليوم لبدء سلسلة جديدة!'
  };
};

export const formatMilliseconds = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
