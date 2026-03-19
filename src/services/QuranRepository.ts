import quranData from 'quran-json/dist/quran.json';
import { normalizeArabicText } from '../utils/arabic';

export interface Ayah {
  id: string;
  verseNumber: number;
  text: string;
  surah: string;
  surahId: number;
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
  for (const surah of quranData as any[]) {
    for (const verse of surah.verses) {
      const normalizedVerse = normalizeArabicText(verse.text);
      if (normalizedVerse.startsWith(normalizedKeyword)) {
        results.push({
          id: `${surah.id}-${verse.id}`,
          verseNumber: verse.id,
          text: verse.text,
          surah: surah.name,
          surahId: surah.id,
        });
      }
    }
  }

  return results;
};
