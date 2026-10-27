import ayahBoundsRaw from '../data/quran/ayahBounds.json';
import tafseerRaw from '../data/quran/tafseer_muyassar.json';
import { quranData } from './QuranRepository';
import { normalizeArabicText } from '../utils/arabic';
import { getPageNumber } from './PageRepository';

export interface AyahBoundItem {
  s: number; // Surah number (1-114)
  a: number; // Ayah number (1-286...)
  d: string; // SVG path data
}

export interface PageBoundsData {
  v: string; // SVG viewBox string
  b: AyahBoundItem[];
}

const ayahBoundsMap = ayahBoundsRaw as unknown as Record<string, PageBoundsData>;
const tafseerMap = tafseerRaw as unknown as Record<string, string>;

// Map of Surah names for quick lookup
const surahNamesMap: Record<number, string> = {};
const ayahTextMap: Record<string, string> = {};

for (const surah of quranData) {
  surahNamesMap[surah.id] = surah.name;
  for (const verse of surah.verses) {
    ayahTextMap[`${surah.id}:${verse.id}`] = verse.text;
  }
}

/**
 * Get the SVG polygon bounds for all ayahs on a given page (1-604)
 */
export const getAyahBoundsForPage = (pageNumber: number): PageBoundsData | null => {
  return ayahBoundsMap[pageNumber.toString()] || null;
};

/**
 * Get Surah name by its number (1-114)
 */
export const getSurahName = (surahNumber: number): string => {
  return surahNamesMap[surahNumber] || `سورة ${surahNumber}`;
};

/**
 * Get authentic Quranic text for a given ayah
 */
export const getAyahText = (surahNumber: number, ayahNumber: number): string => {
  return ayahTextMap[`${surahNumber}:${ayahNumber}`] || '';
};

/**
 * Get Tafsir Al-Muyassar (التفسير الميسر) for a given ayah - 100% Offline
 */
export const getAyahTafseer = (surahNumber: number, ayahNumber: number): string => {
  return tafseerMap[`${surahNumber}:${ayahNumber}`] || 'لا يوجد تفسير متاح لهذه الآية حالياً.';
};

/**
 * Audio reciters list
 */
export interface Reciter {
  id: string;
  name: string;
  subfolder: string;
}

export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'مشاري راشد العفاسي', subfolder: 'Alafasy_128kbps' },
  { id: 'abdulbasit', name: 'عبد الباسط عبد الصمد', subfolder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي', subfolder: 'Minshawy_Murattal_128kbps' },
  { id: 'husary', name: 'محمود خليل الحصري', subfolder: 'Husary_128kbps' },
];

/**
 * Build audio URL from EveryAyah CDN
 */
export const getAyahAudioUrl = (surahNumber: number, ayahNumber: number, reciterId = 'alafasy'): string => {
  const reciter = RECITERS.find(r => r.id === reciterId) || RECITERS[0];
  const sStr = surahNumber.toString().padStart(3, '0');
  const aStr = ayahNumber.toString().padStart(3, '0');
  return `https://everyayah.com/data/${reciter.subfolder}/${sStr}${aStr}.mp3`;
};

/**
 * Find similar / matching opening ayahs for the selected ayah (متشابهات أوائل الآيات)
 */
export interface SimilarAyah {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  text: string;
  page: number;
}

export const findSimilarAyahs = (surahNumber: number, ayahNumber: number): SimilarAyah[] => {
  const currentText = getAyahText(surahNumber, ayahNumber);
  if (!currentText) return [];

  // Extract first 2-3 words of the ayah for opening similarity
  const words = currentText.trim().split(/\s+/);
  if (words.length < 2) return [];

  const prefixWords = words.slice(0, Math.min(3, words.length)).join(' ');
  const normalizedPrefix = normalizeArabicText(prefixWords).replace(/\s/g, '');

  const results: SimilarAyah[] = [];

  for (const surah of quranData) {
    for (const verse of surah.verses) {
      // Don't match the same ayah itself
      if (surah.id === surahNumber && verse.id === ayahNumber) continue;

      const normVerse = normalizeArabicText(verse.text).replace(/\s/g, '');
      if (
        normVerse.startsWith(normalizedPrefix) ||
        normVerse.startsWith('و' + normalizedPrefix) ||
        normVerse.startsWith('ف' + normalizedPrefix)
      ) {
        results.push({
          surahNumber: surah.id,
          surahName: surah.name,
          ayahNumber: verse.id,
          text: verse.text,
          page: getPageNumber(surah.id, verse.id),
        });
      }
    }
  }

  return results;
};
