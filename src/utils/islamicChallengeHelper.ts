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
  categoryId: string,
  levelNum: 1 | 2 | 3,
  topicName: string,
  count: number
): RoomCustomChallenge[] {
  let pool: Array<{ question: string; options: string[]; answer: string }> = [];

  if (categoryId === 'general') {
    const diff = levelNum === 1 ? 'easy' : 'hard';
    pool = quizQuestions.filter(q => (q.category || 'general') === 'general' && q.difficulty === diff);
  } else if (categoryId === 'seerah') {
    pool = quizQuestions.filter(q => q.category === 'seerah');
  } else if (islamicCategoriesData[categoryId]) {
    const cat = islamicCategoriesData[categoryId];
    cat.topics.forEach(t => {
      if (topicName && topicName !== 'all' && t.name !== topicName) return;
      const levelQuestions = t.levels[levelNum] || [];
      pool.push(...levelQuestions);
    });
  }

  // Fallback if pool is empty
  if (pool.length === 0) {
    pool = quizQuestions;
  }

  // Shuffle pool randomly
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

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
