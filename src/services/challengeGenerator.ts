import quranDataRaw from 'quran-json/dist/quran.json';
import { juzBoundaries } from './JuzRepository';
const quranData = quranDataRaw as any[];

const getJuzForVerse = (surahId: number, verseNum: number): number => {
  for (const b of juzBoundaries) {
    if (
      (surahId > b.startSurah || (surahId === b.startSurah && verseNum >= b.startVerse)) &&
      (surahId < b.endSurah || (surahId === b.endSurah && verseNum <= b.endVerse))
    ) {
      return b.juz;
    }
  }
  return 1;
};

interface GeneratedChallenge {
  prompt: string;
  options: string[];
  correctIndex: number;
  verseSource: string;
  surah?: string;
  juz?: number;
}

/**
 * يولد تحديات "تكملة الآية" آلياً مع إمكانية التحديد بالأجزاء أو بسور معينة.
 */
export function generateCompletionChallenges(
  count: number = 20,
  filter?: { juzs?: number[]; surahs?: string[] }
): GeneratedChallenge[] {
  const commonStarts = [
    "يا أيها الذين آمنوا",
    "إن الذين آمنوا",
    "فاتقوا الله",
    "والذين كفروا",
    "إن الله لا يستحي",
    "إن الله يحب",
    "يا أيها الناس"
  ];

  const allVerses: any[] = [];
  quranData.forEach(surah => {
    // If specific surahs are specified
    if (filter?.surahs && filter.surahs.length > 0) {
      const match = filter.surahs.some(s => {
        const cleanS = s.replace(/^سورة\s+/, '').trim();
        return surah.name === cleanS || surah.name.replace(/[أإآ]/g, 'ا') === cleanS.replace(/[أإآ]/g, 'ا');
      });
      if (!match) return;
    }

    surah.verses.forEach((v: any) => {
      const juzNum = getJuzForVerse(surah.id, v.id);
      if (filter?.juzs && filter.juzs.length > 0 && filter.juzs.length < 30) {
        if (!filter.juzs.includes(juzNum)) return;
      }
      allVerses.push({ ...v, surahName: surah.name, surahId: surah.id, juzNum });
    });
  });

  const challenges: GeneratedChallenge[] = [];
  let selectedVerses = allVerses.filter(v => 
    commonStarts.some(start => v.text.startsWith(start)) && v.text.split(' ').length > 8
  );

  // If specific surahs or juzs are chosen and we have fewer matches, allow verses of length >= 6
  if ((filter?.surahs?.length || (filter?.juzs && filter.juzs.length < 30)) && selectedVerses.length < count) {
    const additional = allVerses.filter(v => 
      !selectedVerses.some(sv => sv.id === v.id && sv.surahId === v.surahId) && 
      v.text.split(' ').length >= 6
    );
    selectedVerses = [...selectedVerses, ...additional];
  }

  selectedVerses = selectedVerses.sort(() => 0.5 - Math.random()).slice(0, count);

  selectedVerses.forEach(v => {
    const words = v.text.split(' ');
    // Split at roughly 70% of the verse
    const splitPoint = Math.floor(words.length * 0.7);
    const prompt = words.slice(0, splitPoint).join(' ') + ' ...';
    const correctText = words.slice(splitPoint).join(' ');

    // Generate Distractors
    const distractors: string[] = [];

    // 1. Missing word
    distractors.push(words.slice(splitPoint, words.length - 1).join(' '));

    // 2. Extra word (fake ending)
    const holyEndings = ["غفور رحيم", "عليم حكيم", "على كل شيء قدير", "بما تعملون بصير"];
    const randomEnding = holyEndings[Math.floor(Math.random() * holyEndings.length)];
    distractors.push(correctText + ' ' + randomEnding.split(' ')[0]);

    // 3. Similar start, different ending
    const identicalStart = allVerses.find(other => 
      other.id !== v.id && 
      other.text.startsWith(words.slice(0, 3).join(' ')) &&
      other.text.split(' ').length > splitPoint + 2
    );
    if (identicalStart) {
      const otherWords = identicalStart.text.split(' ');
      distractors.push(otherWords.slice(splitPoint).join(' '));
    } else {
      // Fallback: another random ending
      distractors.push(correctText.split(' ').reverse().join(' ')); // just jumbled for now if no match
    }

    // Prepare and randomize options
    const options = [correctText, ...distractors.slice(0, 3)];
    // Fill if distractors failed
    while (options.length < 4) {
        options.push(correctText + " (خطأ)");
    }

    // Shuffle options and find new correct index
    const shuffled = options
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
    
    const correctIndex = shuffled.indexOf(correctText);

    challenges.push({
      prompt,
      options: shuffled,
      correctIndex,
      verseSource: `سورة ${v.surahName} - الجزء ${v.juzNum || 1} (آية ${v.id})`,
      surah: v.surahName,
      juz: v.juzNum || 1
    });
  });

  return challenges;
}

export interface GeneratedSurahChallenge {
  id: number;
  type: 'SURAH';
  keyword: string;
  verseText: string;
  text: string;
  correctText: string;
  surah: string;
  category: string;
  level: string;
  inRangeAnswers: Array<{ surah: string; juzText: string; verseText: string }>;
  outOfRangeAnswers: Array<{ surah: string; juzText: string; verseText: string }>;
  verses: Array<{
    id: string;
    number: number;
    surah_number: number;
    verse_number: number;
    text: string;
    surah: string;
    juz: number;
  }>;
}

/**
 * يولد تحديات "تحديد اسم السورة" ديناميكياً من آيات القرآن الكريم
 */
export function generateSurahChallenges(
  count: number = 20,
  filter?: { juzs?: number[]; surahs?: string[] }
): GeneratedSurahChallenge[] {
  const allVerses: any[] = [];
  quranData.forEach(surah => {
    if (filter?.surahs && filter.surahs.length > 0) {
      const match = filter.surahs.some(s => {
        const cleanS = s.replace(/^سورة\s+/, '').trim();
        return surah.name === cleanS || surah.name.replace(/[أإآ]/g, 'ا') === cleanS.replace(/[أإآ]/g, 'ا');
      });
      if (!match) return;
    }

    surah.verses.forEach((v: any) => {
      const juzNum = getJuzForVerse(surah.id, v.id);
      if (filter?.juzs && filter.juzs.length > 0 && filter.juzs.length < 30) {
        if (!filter.juzs.includes(juzNum)) return;
      }
      if (v.text && v.text.split(' ').length >= 4) {
        allVerses.push({ ...v, surahName: surah.name, surahId: surah.id, juzNum });
      }
    });
  });

  const shuffled = [...allVerses].sort(() => 0.5 - Math.random()).slice(0, count);

  return shuffled.map((v, idx) => ({
    id: 85000 + idx,
    type: 'SURAH',
    keyword: v.text,
    verseText: v.text,
    text: v.text,
    correctText: JSON.stringify([v.surahName]),
    surah: v.surahName,
    category: `سورة ${v.surahName}`,
    level: 'medium',
    inRangeAnswers: [{ surah: v.surahName, juzText: `الجزء ${v.juzNum}`, verseText: v.text }],
    outOfRangeAnswers: [],
    verses: [{
      id: `gen-surah-${v.surahId}-${v.id}-${idx}`,
      number: v.id,
      surah_number: v.surahId,
      verse_number: v.id,
      text: v.text,
      surah: v.surahName,
      juz: v.juzNum
    }]
  }));
}

