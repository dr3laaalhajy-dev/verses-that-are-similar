import quranDataRaw from 'quran-json/dist/quran.json';
export const quranData = quranDataRaw as any[];
import { normalizeArabicText } from '../utils/arabic';
import { getPageNumber } from './PageRepository';

export interface Ayah {
  id: string;
  verseNumber: number;
  text: string;
  surah: string;
  surahId: number;
  page: number;
}

/**
 * يبحث عن جميع الآيات التي تبدأ بالكلمة المفتاحية المحددة.
 * @param keyword الكلمة المفتاحية للبحث (مثال: "يا أيها الذين آمنوا")
 * @returns قائمة بالآيات المطابقة
 */
export const searchAyahsByStart = (keyword: string): Ayah[] => {
  if (!keyword || keyword.trim() === '') return [];

  const normalizedKeyword = normalizeArabicText(keyword).replace(/\s/g, '');
  const results: Ayah[] = [];

  // quranData هو مصفوفة من السور
  for (const surah of quranData) {
    for (const verse of surah.verses) {
      const normalizedVerse = normalizeArabicText(verse.text).replace(/\s/g, '');
      
      // المباراة إذا كانت تبدأ بالكلمة، أو تبدأ بـ "و" + الكلمة، أو "ف" + الكلمة
      const isMatch = 
        normalizedVerse.startsWith(normalizedKeyword) || 
        normalizedVerse.startsWith('و' + normalizedKeyword) ||
        normalizedVerse.startsWith('ف' + normalizedKeyword);

      if (isMatch) {
        results.push({
          id: `${surah.id}-${verse.id}`,
          verseNumber: verse.id,
          text: verse.text,
          surah: surah.name,
          surahId: surah.id,
          page: getPageNumber(surah.id, verse.id),
        });
      }
    }
  }

  return results;
};

export interface GroupedAyah {
  text: string;
  occurrences: { surah: string; verseNumber: number; id: string }[];
}

/**
 * يبحث عن الآيات ويقوم بتجميع المتطابقة تماماً.
 */
export const searchGroupedAyahsByStart = (keyword: string): GroupedAyah[] => {
  const matches = searchAyahsByStart(keyword);
  const groups: Record<string, GroupedAyah> = {};

  for (const match of matches) {
    const normalizedText = normalizeArabicText(match.text).replace(/\s/g, '');
    if (!groups[normalizedText]) {
      groups[normalizedText] = {
        text: match.text,
        occurrences: []
      };
    }
    groups[normalizedText].occurrences.push({
      surah: match.surah,
      verseNumber: match.verseNumber,
      id: match.id
    });
  }

  return Object.values(groups);
};
