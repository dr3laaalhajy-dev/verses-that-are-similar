export const normalizeArabicText = (text: string): string => {
  if (!text) return '';
  let t = text;

  // 1. Remove all diacritics and Quranic punctuation marks
  // This range covers vowels, tanween, shadda, sukun, and small quranic marks
  t = t.replace(/[\u064B-\u065F\u06D6-\u06ED\u0617-\u061A]/g, '');

  // 2. Normalize Alif Khanjariyah (Small Alif) to regular Alif
  t = t.replace(/\u0670/g, 'ا');

  // 3. Normalize Alifs and Hamzas
  // We treat different Alif forms as plain Alif.
  // IMPORTANT: Hamza on line (ء) is removed to match Quranic spellings like 'اسرايل'
  t = t.replace(/[أإآٱ]/g, 'ا');
  t = t.replace(/ء/g, '');
  
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
  t = t.replace(/(^|\s)داوود(?=\s|$)/g, '$1داود');
  
  // 8. Handle open Taa in Uthmani script that are closed Taa in standard Arabic
  t = t.replace(/(^|\s)(رحم|نعم|سن|شجر|قر|جن|فطر|بقي|معصي|لعن|كلم|غياب|بين|جمال|امرا|ابن|مرضا)ت(?=\s|$)/g, '$1$2ه');

  // 9. Remove duplicate Alifs that might result from normalization
  t = t.replace(/اا+/g, 'ا');

  // 10. Clean up extra spaces and non-Arabic chars
  t = t.replace(/[^\u0600-\u06FF\s]/g, '');
  t = t.replace(/\s+/g, ' ');

  return t.trim();
};
