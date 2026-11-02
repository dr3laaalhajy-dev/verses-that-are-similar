// تسوية النص العربي لتجاهل الأخطاء الإملائية البسيطة
export function normalizeArabic(input: string = ''): string {
  let s = String(input)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')                       // توحيد الألف
    .replace(/ة/g, 'ه')                            // التاء المربوطة -> هاء
    .replace(/ى/g, 'ي')                            // الألف المقصورة -> ياء
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')             // إزالة الرموز
    .replace(/\s+/g, ' ')
    .trim();

  // "ابن" و "بن" متطابقتان
  s = s.split(' ').map((w) => (w === 'ابن' || w === 'بن' ? 'بن' : w)).join(' ');

  // تجاهل المسافات كلياً (عبد الله = عبدالله)
  return s.replace(/\s/g, '');
}

// الإجابة المخزنة قد تحتوي عدة صيغ مقبولة مفصولة بـ |
export function isAnswerCorrect(userAnswer: string, storedAnswer: string): boolean {
  const u = normalizeArabic(userAnswer);
  if (!u) return false;
  return String(storedAnswer)
    .split('|')
    .some((a) => normalizeArabic(a) === u);
}

