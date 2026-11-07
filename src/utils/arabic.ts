export const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  let t = text;

  // 1. Remove all diacritics and Quranic punctuation marks
  // This range covers vowels, tanween, shadda, sukun, and small quranic marks
  t = t.replace(/[\u064B-\u065F\u06D6-\u06ED\u0617-\u061A]/g, '');

  // 2. Remove Alif Khanjariyah (Small Alif) - often hidden in modern typing
  t = t.replace(/\u0670/g, '');

  // 3. Normalize Alifs and Hamzas
  // We treat different Alif forms as plain Alif.
  // Standardizing all Hamza forms (on line, on waw, on ya)
  t = t.replace(/[أإآٱ]/g, 'ا');
  t = t.replace(/[ءئؤ]/g, ''); // Remove standalone/attached hamzas for consistency 
  t = t.replace(/ؤ/g, 'و'); // This is redundant but ensures Waw with Hamza is treated as Waw if needed, though often it's just a marker.
  t = t.replace(/ئ/g, 'ي');
  
  // 4. Normalize other letters
  t = t.replace(/ة/g, 'ه');
  t = t.replace(/ى/g, 'ي');
  t = t.replace(/ؤ/g, 'و');
  t = t.replace(/ئ/g, 'ي');

  // 5. Remove Tatweel (stretch character)
  t = t.replace(/ـ/g, '');

  // 6. Handle merged words in Quranic script (e.g., يَٰبَنِي -> يابني -> يا بني)
  // This ensures 'يابني' matches 'يا بني'
  t = t.replace(/(^|\s)يا(ايها|ايتها|بني|اهل|ادم|ابليس|نوح|ابراهيم|موسي|عيسي|يحيي|صالح|لوط|هود|شعيب|داود|داوود|ايوب|مريم|قوم|ويلتي|حسرتي|ليتني|صاحبي|ابت|نساء|عبادي|عباد|اخت|ويلنا|اسفي)(?=\s|$)/g, '$1يا $2');
  
  // 7. Handle common spelling variations for search consistency
  t = t.replace(/اسراييل/g, 'اسرايل'); // Normalize both to 'اسرايل'
  
  t = t.replace(/(^|\s)هاولا(?=\s|$)/g, '$1هولا');
  t = t.replace(/(^|\s)هاذا(?=\s|$)/g, '$1هذا');
  t = t.replace(/(^|\s)هاذان(?=\s|$)/g, '$1هذان');
  t = t.replace(/(^|\s)هاذه(?=\s|$)/g, '$1هذه');
  t = t.replace(/(^|\s)ذالك(?=\s|$)/g, '$1ذلك');
  t = t.replace(/(^|\s)كذالك(?=\s|$)/g, '$1كذلك');
  t = t.replace(/(^|\s)لاكن(?=\s|$)/g, '$1لكن');
  t = t.replace(/(^|\s)الصلوه(?=\s|$)/g, '$1الصلاه');
  t = t.replace(/(^|\s)الزكوه(?=\s|$)/g, '$1الزكاه');
  t = t.replace(/(^|\s)الحيوه(?=\s|$)/g, '$1الحياه');
  t = t.replace(/(^|\s)الربوا(?=\s|$)/g, '$1الربا');
  t = t.replace(/(^|\s)مشكوه(?=\s|$)/g, '$1مشكاه');
  t = t.replace(/(^|\s)النجوه(?=\s|$)/g, '$1النجاه');
  t = t.replace(/(^|\s)الغدوه(?=\s|$)/g, '$1الغداه');
  t = t.replace(/(^|\s)داوود(?=\s|$)/g, '$1داود');
  
  // 8. Handle open Taa in Uthmani script that are closed Taa in standard Arabic
  t = t.replace(/(^|\s)(رحم|نعم|سن|شجر|قر|جن|فطر|بقي|معصي|لعن|كلم|غياب|بين|جمال|امرا|ابن|مرضا)ت(?=\s|$)/g, '$1$2ه');

  // 9. Remove duplicate Alifs that might result from normalization
  t = t.replace(/اا+/g, 'ا');

  // 10. Remove punctuation and literal dots
  t = t.replace(/[.\u06D4،؛؟!,:;"'()<>{}\[\]\\/|_+=*-]/g, '');

  // 11. Remove invisible control characters and directional marks
  t = t.replace(/[\u200B-\u200F\uFEFF\u202A-\u202E\u2060-\u206F]/g, '');

  // 12. Clean up extra spaces and non-Arabic chars
  t = t.replace(/[^\u0020\u0600-\u06FF\s]/g, '');
  t = t.replace(/\s+/g, ' ');
  t = t.trim();

  // 13. Speech Recognition Specific Normalization (Lenient equivalents)
  // These handle common ways speech-to-text engines transcribe Quranic words
  const speechEquivalents: [RegExp, string][] = [
    [/(^|\s)ولا ان(?=\s|$)/g, '$1ولين'],    // 'ولا ان' -> 'ولئن' (normalized to 'ولين')
    [/(^|\s)ولان(?=\s|$)/g, '$1ولين'],     // 'ولان' -> 'ولئن'
    [/(^|\s)فانا(?=\s|$)/g, '$1فاني'],     // 'فانا' -> 'فأنى' (normalized to 'فاني')
    [/(^|\s)يقولون(?=\s|$)/g, '$1ليقولن'], // Common confusion in similar verses
    [/(^|\s)ما(?=\s|$)/g, '$1من'],         // Common confusion between Ma/Man
  ];

  speechEquivalents.forEach(([regex, replacement]) => {
    t = t.replace(regex, replacement);
  });

  return t;
};

export const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

export const getSimilarity = (a: string, b: string): number => {
  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
};

/**
 * Converts Arabic numerals (٠-٩) to English numerals (0-9).
 */
export const convertArabicNumbersToEnglish = (str: string): string => {
  return str.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
};

/**
 * توحيد اسم السورة للتحقق المرن من الإجابة في تحدي السور:
 * تقوم بحذف كلمة 'سورة ' (مع المسافة التي تليها) من الإجابة وتوحيد النص العربي
 */
export const normalizeSurahName = (name?: string | null): string => {
  if (!name) return '';
  const cleaned = name.replace(/^سورة\s+/g, '').replace(/سورة\s+/g, '').replace(/^سورة/g, '').trim();
  return normalizeArabicText(cleaned).trim();
};
