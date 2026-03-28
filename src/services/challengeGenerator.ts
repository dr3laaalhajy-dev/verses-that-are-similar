import quranDataRaw from 'quran-json/dist/quran.json';
const quranData = quranDataRaw as any[];

interface GeneratedChallenge {
  prompt: string;
  options: string[];
  correctIndex: number;
  verseSource: string;
}

/**
 * يولد تحديات "تكملة الآية" آلياً.
 */
export function generateCompletionChallenges(count: number = 20): GeneratedChallenge[] {
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
    surah.verses.forEach((v: any) => {
      allVerses.push({ ...v, surahName: surah.name });
    });
  });

  const challenges: GeneratedChallenge[] = [];
  const selectedVerses = allVerses.filter(v => 
    commonStarts.some(start => v.text.startsWith(start)) && v.text.split(' ').length > 8
  ).sort(() => 0.5 - Math.random()).slice(0, count);

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
      verseSource: `سورة ${v.surahName} آية ${v.id}`
    });
  });

  return challenges;
}
