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

  const normalizedKeyword = normalizeArabicText(keyword);
  const results: Ayah[] = [];

  // quranData هو مصفوفة من السور
  for (const surah of quranData) {
    for (const verse of surah.verses) {
      const normalizedVerse = normalizeArabicText(verse.text);
      if (normalizedVerse.startsWith(normalizedKeyword)) {
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
