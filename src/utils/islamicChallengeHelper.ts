import { islamicCategoriesData, islamicCategoriesList } from '../data/islamicCategories';
import { quizQuestions } from '../data/quizQuestionsData';

export interface RoomCustomChallenge {
  id: number;
  keyword: string;
  verseText: string;
  text: string;
  type: string;
  options: Array<{ text: string; isCorrect: boolean }>;
  correctText: string;
}

export function getRandomIslamicRoomQuestions(
  categoriesInput: string[] | string,
  levelsInput: (1 | 2 | 3)[] | (1 | 2 | 3) | number[] | number,
  topicsInput: string[] | string,
  count: number
): RoomCustomChallenge[] {
  const categories = Array.isArray(categoriesInput)
    ? (categoriesInput.length > 0 ? categoriesInput : ['akida'])
    : [categoriesInput || 'akida'];

  const levelsRaw = Array.isArray(levelsInput)
    ? (levelsInput.length > 0 ? levelsInput : [1, 2, 3])
    : [levelsInput || 1];
  const levels = levelsRaw.map(Number) as (1 | 2 | 3)[];

  const topics = Array.isArray(topicsInput)
    ? (topicsInput.length > 0 ? topicsInput : ['all'])
    : [topicsInput || 'all'];

  let pool: Array<{ question: string; options: string[]; answer: string }> = [];

  for (const categoryId of categories) {
    if (categoryId === 'general') {
      for (const lvl of levels) {
        const diff = lvl === 1 ? 'easy' : 'hard';
        const qs = quizQuestions.filter(q => (q.category || 'general') === 'general' && q.difficulty === diff);
        pool.push(...qs);
      }
    } else if (categoryId === 'seerah') {
      const qs = quizQuestions.filter(q => q.category === 'seerah');
      pool.push(...qs);
    } else if (islamicCategoriesData[categoryId]) {
      const cat = islamicCategoriesData[categoryId];
      cat.topics.forEach(t => {
        if (topics.length > 0 && !topics.includes('all') && !topics.includes(t.name)) return;
        for (const lvl of levels) {
          const levelQuestions = t.levels[lvl as (1 | 2 | 3)] || [];
          pool.push(...levelQuestions);
        }
      });
    }
  }

  // Fallback if pool is empty
  if (pool.length === 0) {
    pool = quizQuestions;
  }

  // Deduplicate questions by question text
  const seen = new Set<string>();
  const uniquePool = pool.filter(q => {
    if (seen.has(q.question)) return false;
    seen.add(q.question);
    return true;
  });

  // Shuffle pool randomly
  const shuffled = [...uniquePool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.max(1, count));

  return selected.map((q, idx) => ({
    id: 990000 + idx,
    keyword: q.question,
    verseText: q.question,
    text: q.question,
    type: 'COMPLETION',
    options: q.options.map(opt => ({
      text: opt,
      isCorrect: opt === q.answer
    })),
    correctText: q.answer
  }));
}
