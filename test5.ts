import { normalizeArabicText } from './src/utils/arabic';
import quranData from 'quran-json/dist/quran.json';

const CHALLENGES = [
  "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا",
  "يَسْأَلُونَكَ عَنِ",
  "وَمِنْهُمْ مَنْ",
  "يَا أَيُّهَا النَّاسُ اتَّقُوا",
  "سَبَّحَ لِلَّهِ",
  "وَمَا أَرْسَلْنَا مِنْ قَبْلِكَ",
  "إِنَّ الَّذِينَ كَفَرُوا",
  "وَلَقَدْ أَرْسَلْنَا",
  "وَمَا أَرْسَلْنَا فِي قَرْيَةٍ",
  "إِنَّ فِي ذَلِكَ لَآيَةً",
  "وَلَقَدْ آتَيْنَا مُوسَى",
  "يَا بَنِي إِسْرَائِيلَ اذْكُرُوا",
  "وَإِذْ قَالَ مُوسَى لِقَوْمِهِ",
  "قُلْ يَا أَيُّهَا النَّاسُ",
  "وَمَنْ أَظْلَمُ مِمَّنِ",
  "ذَلِكَ بِمَا قَدَّمَتْ أَيْدِيكُمْ",
  "وَمَا كَانَ رَبُّكَ",
  "أَلَمْ تَرَ إِلَى الَّذِينَ",
  "وَإِذَا قِيلَ لَهُمْ",
  "إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ",
];

for (const challenge of CHALLENGES) {
  const normalized = normalizeArabicText(challenge);
  let matches = 0;
  for (const surah of quranData as any[]) {
    for (const verse of surah.verses) {
      if (normalizeArabicText(verse.text).startsWith(normalized)) {
        matches++;
      }
    }
  }
  console.log(`${matches} matches for: ${challenge} (${normalized})`);
}
