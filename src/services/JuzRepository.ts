
export interface JuzBoundary {
  juz: number;
  startSurah: number;
  startVerse: number;
  endSurah: number;
  endVerse: number;
}

export const juzBoundaries: JuzBoundary[] = [
  { juz: 1, startSurah: 1, startVerse: 1, endSurah: 2, endVerse: 141 },
  { juz: 2, startSurah: 2, startVerse: 142, endSurah: 2, endVerse: 252 },
  { juz: 3, startSurah: 2, startVerse: 253, endSurah: 3, endVerse: 92 },
  { juz: 4, startSurah: 3, startVerse: 93, endSurah: 4, endVerse: 23 },
  { juz: 5, startSurah: 4, startVerse: 24, endSurah: 4, endVerse: 147 },
  { juz: 6, startSurah: 4, startVerse: 148, endSurah: 5, endVerse: 81 },
  { juz: 7, startSurah: 5, startVerse: 82, endSurah: 6, endVerse: 110 },
  { juz: 8, startSurah: 6, startVerse: 111, endSurah: 7, endVerse: 87 },
  { juz: 9, startSurah: 7, startVerse: 88, endSurah: 8, endVerse: 40 },
  { juz: 10, startSurah: 8, startVerse: 41, endSurah: 9, endVerse: 92 },
  { juz: 11, startSurah: 9, startVerse: 93, endSurah: 11, endVerse: 5 },
  { juz: 12, startSurah: 11, startVerse: 6, endSurah: 12, endVerse: 52 },
  { juz: 13, startSurah: 12, startVerse: 53, endSurah: 14, endVerse: 52 },
  { juz: 14, startSurah: 15, startVerse: 1, endSurah: 16, endVerse: 128 },
  { juz: 15, startSurah: 17, startVerse: 1, endSurah: 18, endVerse: 74 },
  { juz: 16, startSurah: 18, startVerse: 75, endSurah: 20, endVerse: 135 },
  { juz: 17, startSurah: 21, startVerse: 1, endSurah: 22, endVerse: 78 },
  { juz: 18, startSurah: 23, startVerse: 1, endSurah: 25, endVerse: 20 },
  { juz: 19, startSurah: 25, startVerse: 21, endSurah: 27, endVerse: 55 },
  { juz: 20, startSurah: 27, startVerse: 56, endSurah: 29, endVerse: 45 },
  { juz: 21, startSurah: 29, startVerse: 46, endSurah: 33, endVerse: 30 },
  { juz: 22, startSurah: 33, startVerse: 31, endSurah: 36, endVerse: 27 },
  { juz: 23, startSurah: 36, startVerse: 28, endSurah: 39, endVerse: 31 },
  { juz: 24, startSurah: 39, startVerse: 32, endSurah: 41, endVerse: 46 },
  { juz: 25, startSurah: 41, startVerse: 47, endSurah: 45, endVerse: 37 },
  { juz: 26, startSurah: 46, startVerse: 1, endSurah: 51, endVerse: 30 },
  { juz: 27, startSurah: 51, startVerse: 31, endSurah: 57, endVerse: 29 },
  { juz: 28, startSurah: 58, startVerse: 1, endSurah: 66, endVerse: 12 },
  { juz: 29, startSurah: 67, startVerse: 1, endSurah: 77, endVerse: 50 },
  { juz: 30, startSurah: 78, startVerse: 1, endSurah: 114, endVerse: 6 }
];

export const JUZ_NAMES_AR: Record<number, string> = {
  1: 'الأول',
  2: 'الثاني',
  3: 'الثالث',
  4: 'الرابع',
  5: 'الخامس',
  6: 'السادس',
  7: 'السابع',
  8: 'الثامن',
  9: 'التاسع',
  10: 'العاشر',
  11: 'الحادي عشر',
  12: 'الثاني عشر',
  13: 'الثالث عشر',
  14: 'الرابع عشر',
  15: 'الخامس عشر',
  16: 'السادس عشر',
  17: 'السابع عشر',
  18: 'الثامن عشر',
  19: 'التاسع عشر',
  20: 'العشرون',
  21: 'الحادي والعشرون',
  22: 'الثاني والعشرون',
  23: 'الثالث والعشرون',
  24: 'الرابع والعشرون',
  25: 'الخامس والعشرون',
  26: 'السادس والعشرون',
  27: 'السابع والعشرون',
  28: 'الثامن والعشرون',
  29: 'التاسع والعشرون',
  30: 'الثلاثون'
};

export interface QuranSurahItem {
  id: number;
  name: string;
}

export const ALL_QURAN_SURAHS: QuranSurahItem[] = [
  { id: 1, name: 'الفاتحة' },
  { id: 2, name: 'البقرة' },
  { id: 3, name: 'آل عمران' },
  { id: 4, name: 'النساء' },
  { id: 5, name: 'المائدة' },
  { id: 6, name: 'الأنعام' },
  { id: 7, name: 'الأعراف' },
  { id: 8, name: 'الأنفال' },
  { id: 9, name: 'التوبة' },
  { id: 10, name: 'يونس' },
  { id: 11, name: 'هود' },
  { id: 12, name: 'يوسف' },
  { id: 13, name: 'الرعد' },
  { id: 14, name: 'إبراهيم' },
  { id: 15, name: 'الحجر' },
  { id: 16, name: 'النحل' },
  { id: 17, name: 'الإسراء' },
  { id: 18, name: 'الكهف' },
  { id: 19, name: 'مريم' },
  { id: 20, name: 'طه' },
  { id: 21, name: 'الأنبياء' },
  { id: 22, name: 'الحج' },
  { id: 23, name: 'المؤمنون' },
  { id: 24, name: 'النور' },
  { id: 25, name: 'الفرقان' },
  { id: 26, name: 'الشعراء' },
  { id: 27, name: 'النمل' },
  { id: 28, name: 'القصص' },
  { id: 29, name: 'العنكبوت' },
  { id: 30, name: 'الروم' },
  { id: 31, name: 'لقمان' },
  { id: 32, name: 'السجدة' },
  { id: 33, name: 'الأحزاب' },
  { id: 34, name: 'سبأ' },
  { id: 35, name: 'فاطر' },
  { id: 36, name: 'يس' },
  { id: 37, name: 'الصافات' },
  { id: 38, name: 'ص' },
  { id: 39, name: 'الزمر' },
  { id: 40, name: 'غافر' },
  { id: 41, name: 'فصلت' },
  { id: 42, name: 'الشورى' },
  { id: 43, name: 'الزخرف' },
  { id: 44, name: 'الدخان' },
  { id: 45, name: 'الجاثية' },
  { id: 46, name: 'الأحقاف' },
  { id: 47, name: 'محمد' },
  { id: 48, name: 'الفتح' },
  { id: 49, name: 'الحجرات' },
  { id: 50, name: 'ق' },
  { id: 51, name: 'الذاريات' },
  { id: 52, name: 'الطور' },
  { id: 53, name: 'النجم' },
  { id: 54, name: 'القمر' },
  { id: 55, name: 'الرحمن' },
  { id: 56, name: 'الواقعة' },
  { id: 57, name: 'الحديد' },
  { id: 58, name: 'المجادلة' },
  { id: 59, name: 'الحشر' },
  { id: 60, name: 'الممتحنة' },
  { id: 61, name: 'الصف' },
  { id: 62, name: 'الجمعة' },
  { id: 63, name: 'المنافقون' },
  { id: 64, name: 'التغابن' },
  { id: 65, name: 'الطلاق' },
  { id: 66, name: 'التحريم' },
  { id: 67, name: 'الملك' },
  { id: 68, name: 'القلم' },
  { id: 69, name: 'الحاقة' },
  { id: 70, name: 'المعارج' },
  { id: 71, name: 'نوح' },
  { id: 72, name: 'الجن' },
  { id: 73, name: 'المزمل' },
  { id: 74, name: 'المدثر' },
  { id: 75, name: 'القيامة' },
  { id: 76, name: 'الإنسان' },
  { id: 77, name: 'المرسلات' },
  { id: 78, name: 'النبأ' },
  { id: 79, name: 'النازعات' },
  { id: 80, name: 'عبس' },
  { id: 81, name: 'التكوير' },
  { id: 82, name: 'الانفطار' },
  { id: 83, name: 'المطففين' },
  { id: 84, name: 'الانشقاق' },
  { id: 85, name: 'البروج' },
  { id: 86, name: 'الطارق' },
  { id: 87, name: 'الأعلى' },
  { id: 88, name: 'الغاشية' },
  { id: 89, name: 'الفجر' },
  { id: 90, name: 'البلد' },
  { id: 91, name: 'الشمس' },
  { id: 92, name: 'الليل' },
  { id: 93, name: 'الضحى' },
  { id: 94, name: 'الشرح' },
  { id: 95, name: 'التين' },
  { id: 96, name: 'العلق' },
  { id: 97, name: 'القدر' },
  { id: 98, name: 'البينة' },
  { id: 99, name: 'الزلزلة' },
  { id: 100, name: 'العاديات' },
  { id: 101, name: 'القارعة' },
  { id: 102, name: 'التكاثر' },
  { id: 103, name: 'العصر' },
  { id: 104, name: 'الهمزة' },
  { id: 105, name: 'الفيل' },
  { id: 106, name: 'قريش' },
  { id: 107, name: 'الماعون' },
  { id: 108, name: 'الكوثر' },
  { id: 109, name: 'الكافرون' },
  { id: 110, name: 'النصر' },
  { id: 111, name: 'المسد' },
  { id: 112, name: 'الإخلاص' },
  { id: 113, name: 'الفلق' },
  { id: 114, name: 'الناس' }
];

/**
 * Returns an array of Juz numbers (1-30) that a given Surah spans.
 * e.g. for Al-Baqarah (2) returns [1, 2, 3]
 */
export const getJuzsForSurah = (surahIdentifier: string | number): number[] => {
  if (!surahIdentifier) return [];
  let surahId: number | null = null;

  if (typeof surahIdentifier === 'number') {
    surahId = surahIdentifier;
  } else {
    const raw = String(surahIdentifier).trim();
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 1 && num <= 114) {
      surahId = num;
    } else {
      const cleanName = raw.replace(/^سورة\s+/, '').trim();
      const found = ALL_QURAN_SURAHS.find(s => {
        const sClean = s.name.replace(/^سورة\s+/, '').trim();
        return sClean === cleanName || sClean.replace(/[أإآ]/g, 'ا') === cleanName.replace(/[أإآ]/g, 'ا');
      });
      if (found) {
        surahId = found.id;
      }
    }
  }

  if (!surahId || surahId < 1 || surahId > 114) return [];

  const matching: number[] = [];
  for (const b of juzBoundaries) {
    if (surahId >= b.startSurah && surahId <= b.endSurah) {
      matching.push(b.juz);
    }
  }
  return matching;
};

/**
 * Formats an array of Juz numbers into a friendly Arabic phrase.
 * e.g. [1, 2] -> "الجزء الأول والثاني"
 * e.g. [1, 2, 3] -> "الجزء الأول والثاني والثالث"
 */
export const formatJuzsDescription = (juzNumbers: number[]): string => {
  if (!juzNumbers || juzNumbers.length === 0) return '';
  if (juzNumbers.length === 1) {
    const j = juzNumbers[0];
    return `الجزء ${JUZ_NAMES_AR[j] || j}`;
  }
  const ordinals = juzNumbers.map(j => JUZ_NAMES_AR[j] || String(j));
  if (ordinals.length === 2) {
    return `الجزء ${ordinals[0]} و${ordinals[1]}`;
  }
  const last = ordinals.pop();
  return `الأجزاء ${ordinals.join(' و')} و${last}`;
};
