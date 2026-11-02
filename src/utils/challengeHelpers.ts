// Helper function to find the best subsequence match of targetWords in transcriptWords
// Returns the maximum number of matched words and the maximum consecutive matched words
export function getBestSubsequenceMatch(transcriptWords: string[], targetWords: string[]): { matches: number; consecutiveMatches: number } {
  if (targetWords.length === 0) return { matches: 0, consecutiveMatches: 0 };

  let maxMatches = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < transcriptWords.length; i++) {
    let matches = 0;
    let consecutive = 0;
    let currentConsecutive = 0;
    let tIdx = i;

    for (let vIdx = 0; vIdx < targetWords.length; vIdx++) {
      let found = false;
      // Look ahead up to 3 words in the transcript to allow for small speech recognition insertions
      for (let lookahead = 0; lookahead < 3; lookahead++) {
        if (tIdx + lookahead < transcriptWords.length && transcriptWords[tIdx + lookahead] === targetWords[vIdx]) {
          matches++;
          if (lookahead === 0) {
            currentConsecutive++;
          } else {
            if (currentConsecutive > consecutive) consecutive = currentConsecutive;
            currentConsecutive = 1;
          }
          tIdx += lookahead + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        if (currentConsecutive > consecutive) consecutive = currentConsecutive;
        currentConsecutive = 0;
      }
    }
    if (currentConsecutive > consecutive) consecutive = currentConsecutive;

    if (matches > maxMatches) {
      maxMatches = matches;
      maxConsecutive = consecutive;
    } else if (matches === maxMatches && consecutive > maxConsecutive) {
      maxConsecutive = consecutive;
    }
  }

  return { matches: maxMatches, consecutiveMatches: maxConsecutive };
}

export const superNormalizeArabic = (text: any): string => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '') // حذف التشكيل
    .replace(/[أإآ]/g, 'ا') // توحيد الألف
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة والهاء
    .replace(/ي/g, 'ى') // توحيد الياء
    .replace(/\s+/g, '') // حذف جميع المسافات العادية
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); // حذف المسافات والرموز المخفية
};

// Helper to determine question time in Speed Challenge based on admin level:
// صعب = 20s, سهل = 10s, متوسط = 15s (default)
export const getSpeedQuestionDuration = (challenge: any): number => {
  if (!challenge) return 15;
  const lvl = String(challenge.level || challenge.difficulty || '').toLowerCase().trim();
  if (lvl === 'hard' || lvl === 'صعب') return 20;
  if (lvl === 'easy' || lvl === 'سهل') return 10;
  return 15; // متوسط (medium) default
};
