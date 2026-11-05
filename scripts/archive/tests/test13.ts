import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

const challenge = "وَإِذْ قَالَ مُوسَى لِقَوْمِهِ";
const normalized = normalizeArabicText(challenge);
console.log("Normalized challenge:", normalized);

for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    const normVerse = normalizeArabicText(verse.text);
    if (normVerse.includes("موسي لقومه")) {
      console.log("Found:", normVerse);
    }
  }
}
