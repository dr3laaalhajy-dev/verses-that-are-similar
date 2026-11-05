import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    const normalized = normalizeArabicText(verse.text);
    if (normalized.includes("بني")) {
      console.log("Original:", verse.text);
      console.log("Normalized:", normalized);
    }
  }
}
