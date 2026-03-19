import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    if (verse.text.includes("مُوسَىٰ") || verse.text.includes("مُوسَى")) {
      console.log("Original:", verse.text);
      break;
    }
  }
}
