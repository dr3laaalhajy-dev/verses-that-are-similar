import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    if (verse.text.includes("يَسْ")) {
      console.log("Original:", verse.text);
      console.log("Normalized:", normalizeArabicText(verse.text));
      break;
    }
  }
}
