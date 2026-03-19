import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    const normVerse = normalizeArabicText(verse.text);
    if (normVerse.includes("موسيا") && normVerse.includes("لقومه")) {
      console.log("Found:", normVerse);
    }
  }
}
