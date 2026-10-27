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

export function getIslamicTopicAvailableCount(
  topicName: string,
  categoryId?: string,
  levels: (1 | 2 | 3)[] = [1, 2, 3]
): number {
  if (topicName === 'seerah' || categoryId === 'seerah') {
    return quizQuestions.filter(q => q.category === 'seerah').length;
  }
  if (topicName === 'general' || categoryId === 'general') {
    return quizQuestions.filter(q => (q.category || 'general') === 'general').length;
  }
  
  if (categoryId && islamicCategoriesData[categoryId]) {
    const cat = islamicCategoriesData[categoryId];
    const topic = cat.topics.find(t => t.name === topicName || t.slug === topicName);
    if (topic) {
      let count = 0;
      levels.forEach(lvl => {
        count += (topic.levels[lvl] || []).length;
      });
      return count;
    }
  }

  // Fallback: search across all categories
  for (const cat of Object.values(islamicCategoriesData)) {
    const topic = cat.topics.find(t => t.name === topicName || t.slug === topicName);
    if (topic) {
      let count = 0;
      levels.forEach(lvl => {
        count += (topic.levels[lvl] || []).length;
      });
      return count;
    }
  }

  return 0;
}

export function getTotalIslamicAvailableCount(
  categories: string[],
  levels: (1 | 2 | 3)[] = [1, 2, 3],
  topics: string[] = ['all']
): number {
  if (topics.includes('all')) {
    let total = 0;
    categories.forEach(catId => {
      if (catId === 'seerah') {
        total += quizQuestions.filter(q => q.category === 'seerah').length;
      } else if (catId === 'general') {
        total += quizQuestions.filter(q => (q.category || 'general') === 'general').length;
      } else if (islamicCategoriesData[catId]) {
        islamicCategoriesData[catId].topics.forEach(t => {
          levels.forEach(lvl => {
            total += (t.levels[lvl] || []).length;
          });
        });
      }
    });
    return total;
  }

  let total = 0;
  topics.forEach(tName => {
    total += getIslamicTopicAvailableCount(tName, undefined, levels);
  });
  return total;
}

export function getTargetedIslamicQuestions(
  topicAllocations: Record<string, number | { count: number; categoryId?: string }>,
  levels: (1 | 2 | 3)[] = [1, 2, 3],
  categories: string[] = ['akida']
): RoomCustomChallenge[] {
  const result: RoomCustomChallenge[] = [];

  for (const [topicName, val] of Object.entries(topicAllocations)) {
    const reqCount = typeof val === 'number' ? val : val?.count || 0;
    const catId = typeof val === 'number' ? undefined : val?.categoryId;
    if (reqCount <= 0) continue;

    if (topicName === 'all') {
      const allQs = getRandomIslamicRoomQuestions(categories, levels, ['all'], reqCount);
      result.push(...allQs);
      continue;
    }

    let pool: Array<{ question: string; options: string[]; answer: string }> = [];

    if (topicName === 'seerah' || catId === 'seerah') {
      pool = quizQuestions.filter(q => q.category === 'seerah');
    } else if (topicName === 'general' || catId === 'general') {
      pool = quizQuestions.filter(q => (q.category || 'general') === 'general');
    } else {
      let found = false;
      if (catId && islamicCategoriesData[catId]) {
        const cat = islamicCategoriesData[catId];
        const topic = cat.topics.find(t => t.name === topicName || t.slug === topicName);
        if (topic) {
          levels.forEach(lvl => pool.push(...(topic.levels[lvl] || [])));
          found = true;
        }
      }
      if (!found) {
        for (const cat of Object.values(islamicCategoriesData)) {
          const topic = cat.topics.find(t => t.name === topicName || t.slug === topicName);
          if (topic) {
            levels.forEach(lvl => pool.push(...(topic.levels[lvl] || [])));
            break;
          }
        }
      }
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, reqCount);
    shuffled.forEach(q => {
      result.push({
        id: 990000 + result.length,
        keyword: q.question,
        verseText: q.question,
        text: q.question,
        type: 'COMPLETION',
        options: q.options.map(opt => ({
          text: opt,
          isCorrect: opt === q.answer
        })),
        correctText: q.answer
      });
    });
  }

  return result;
}
