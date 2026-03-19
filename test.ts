import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

const keyword = "يَا بَنِي إِسْرَائِيلَ اذْكُرُوا";
const normalizedKeyword = normalizeArabicText(keyword);
console.log("Keyword:", normalizedKeyword);

const matches = [];
for (const surah of quranData as any[]) {
  for (const verse of surah.verses) {
    const normalizedVerse = normalizeArabicText(verse.text);
    if (normalizedVerse.startsWith(normalizedKeyword)) {
      matches.push(verse.text);
    }
  }
}
console.log("Matches:", matches.length);
if (matches.length === 0) {
  // Let's find verses that contain "بني اسرائيل اذكروا"
  for (const surah of quranData as any[]) {
    for (const verse of surah.verses) {
      const normalizedVerse = normalizeArabicText(verse.text);
      if (normalizedVerse.includes("بني اسرائيل اذكروا")) {
        console.log("Found similar:", normalizedVerse);
      }
    }
  }
}
