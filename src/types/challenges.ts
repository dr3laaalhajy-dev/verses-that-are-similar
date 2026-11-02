export interface Verse {
  id: string;
  text: string;
  surah: string;
  number: string | number;
  surah_number?: number;
  verse_number?: number;
}

export type View =
  | 'home'
  | 'difficulty'
  | 'challenge'
  | 'mushaf'
  | 'adhkar'
  | 'hadith'
  | 'admin'
  | 'list'
  | 'group_menu'
  | 'group_waiting'
  | 'group_game'
  | 'speed_challenge'
  | 'skills_menu'
  | 'speed_menu'
  | 'group_create'
  | 'group_join'
  | 'book'
  | 'encyclopedia'
  | 'skills_count_selection'
  | 'skills_results'
  | 'islamic_quiz'
  | 'settings'
  | 'library'
  | 'challenges'
  | 'islamic_videos';

export const VALID_VIEWS: View[] = [
  'home',
  'difficulty',
  'challenge',
  'mushaf',
  'adhkar',
  'hadith',
  'admin',
  'list',
  'group_menu',
  'group_waiting',
  'group_game',
  'speed_challenge',
  'skills_menu',
  'speed_menu',
  'group_create',
  'group_join',
  'book',
  'encyclopedia',
  'skills_count_selection',
  'skills_results',
  'islamic_quiz',
  'settings',
  'library',
  'challenges',
  'islamic_videos'
];

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface VerseCardProps {
  verse: Verse;
  keyword: string;
  isMatched: boolean;
  index: number;
  keywordWordCount: number;
  wordStates: Record<number, 'correct' | 'skipped'>;
}
