import { islamicCategoriesData } from '../data/islamicCategories';
import { quizQuestions, Question } from '../data/quizQuestionsData';

export interface DailyChestChallengeConfig {
  id: string;
  category: 'akida' | 'seerah' | 'history' | 'figh' | 'tafseer' | 'hadith' | 'general';
  categoryTitle: string;
  title: string;
  actionButtonText: string;
  description: string;
  target: number;
  rewardPoints: number;
  maxLives: number;
}

export const MAX_POINTS = 50;
export const MIN_POINTS = 20;
export const PENALTY_PER_RETRY = 10;

/**
 * خوارزمية النقاط المتناقصة لتحدي الصندوق اليومي بناءً على عدد المحاولات:
 * المحاولة 1: 50 نقطة (الحد الأقصى)
 * المحاولة 2: 40 نقطة
 * المحاولة 3: 30 نقطة
 * المحاولة 4 فما فوق: 20 نقطة (الحد الأدنى الثابت)
 */
export function calculateDecayingPoints(attempts: number = 1): number {
  const attemptsCount = Math.max(1, attempts || 1);
  const calculatedPoints = MAX_POINTS - ((attemptsCount - 1) * PENALTY_PER_RETRY);
  return Math.max(calculatedPoints, MIN_POINTS);
}

export const DAILY_CHEST_PRESETS: DailyChestChallengeConfig[] = [
  {
    id: 'akida_5',
    category: 'akida',
    categoryTitle: 'العقيدة الإسلامية',
    title: 'أجب على 5 أسئلة صحيحة في العقيدة',
    actionButtonText: 'ابدأ تحدي العقيدة',
    description: 'أجب على 5 أسئلة صحيحة في التوحيد وأركان الإيمان مع الحفاظ على أرواحك',
    target: 5,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'seerah_10',
    category: 'seerah',
    categoryTitle: 'السيرة النبوية',
    title: 'حل 10 أسئلة في السيرة النبوية',
    actionButtonText: 'ابدأ تحدي السيرة النبوية',
    description: 'اختبر معلوماتك في سيرة الحبيب المصطفى ﷺ وحقق 10 إجابات صحيحة',
    target: 10,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'history_7',
    category: 'history',
    categoryTitle: 'التاريخ الإسلامي',
    title: 'أجب على 7 أسئلة في التاريخ الإسلامي',
    actionButtonText: 'ابدأ تحدي التاريخ الإسلامي',
    description: '7 إجابات صحيحة في محطات التاريخ الإسلامي وعصر الخلفاء الراشدين',
    target: 7,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'figh_5',
    category: 'figh',
    categoryTitle: 'الفقه الإسلامي',
    title: 'أجب على 5 أسئلة صحيحة في الفقه',
    actionButtonText: 'ابدأ تحدي الفقه الإسلامي',
    description: 'أجب على 5 أسئلة في العبادات والمعاملات وأحكام الشريعة المطهرة',
    target: 5,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'hadith_5',
    category: 'hadith',
    categoryTitle: 'الحديث الشريف',
    title: 'أجب على 5 أسئلة صحيحة في الحديث الشريف',
    actionButtonText: 'ابدأ تحدي الحديث الشريف',
    description: 'اختبر فهمك لهدي وسنة رسول الله ﷺ وحقق 5 إجابات صائبة',
    target: 5,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'tafseer_7',
    category: 'tafseer',
    categoryTitle: 'تفسير القرآن',
    title: 'أجب على 7 أسئلة في تفسير القرآن',
    actionButtonText: 'ابدأ تحدي تفسير القرآن',
    description: 'تدبر آيات الذكر الحكيم ومعانيها وأجب على 7 أسئلة صحيحة',
    target: 7,
    rewardPoints: 50,
    maxLives: 3,
  },
  {
    id: 'general_10',
    category: 'general',
    categoryTitle: 'الثقافة والمعارف الإسلامية',
    title: 'حل 10 أسئلة في الثقافة والمعارف الإسلامية',
    actionButtonText: 'ابدأ التحدي الإسلامي',
    description: 'بنك أسئلة منوعة في مختلف جوانب المعرفة الإسلامية، حقق 10 إجابات صحيحة',
    target: 10,
    rewardPoints: 50,
    maxLives: 3,
  },
];

/**
 * Returns a stable, deterministic challenge preset for any given date string (YYYY-MM-DD).
 */
export function getDailyChallengeConfigForDate(dateStr: string): DailyChestChallengeConfig {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DAILY_CHEST_PRESETS.length;
  return DAILY_CHEST_PRESETS[index];
}

/**
 * Collects and shuffles a rich pool of unique questions for the given category.
 */
export function getQuestionsPoolForCategory(category: string): Question[] {
  let pool: Question[] = [];

  if (category === 'general') {
    pool = quizQuestions.filter((q) => (q.category || 'general') === 'general');
  } else if (category === 'seerah') {
    pool = quizQuestions.filter((q) => q.category === 'seerah');
    if (islamicCategoriesData['arabia']) {
      islamicCategoriesData['arabia'].topics.forEach((t) => {
        Object.values(t.levels).forEach((levelList) => {
          pool.push(...levelList);
        });
      });
    }
  } else if (islamicCategoriesData[category]) {
    const cat = islamicCategoriesData[category];
    cat.topics.forEach((t) => {
      Object.values(t.levels).forEach((levelList) => {
        pool.push(...levelList);
      });
    });
  }

  // Fallback if empty
  if (pool.length === 0) {
    pool = quizQuestions;
  }

  // Deduplicate questions by question text
  const seen = new Set<string>();
  const unique = pool.filter((q) => {
    const trimmed = (q.question || '').trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });

  // Fisher-Yates shuffle
  const shuffled = [...unique];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

