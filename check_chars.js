import fs from 'fs';

const normalizeArabicText = (text) => {
  if (!text) return '';
  return text
    // إزالة جميع الحركات وعلامات الوقف القرآنية
    .replace(/[\u0617-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') 
    .replace(/[أإآٱ]/g, 'ا') // توحيد الهمزات وألف الوصل
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة
    .replace(/ى/g, 'ي') // توحيد الألف المقصورة
    .replace(/ؤ/g, 'و') // توحيد الواو المهموزة
    .replace(/ئ/g, 'ي') // توحيد الياء المهموزة
    .replace(/ـ/g, '') // إزالة التطويل
    .replace(/[^\u0600-\u06FF\s]/g, '') // إزالة علامات الترقيم وأي رموز غير عربية
    .replace(/\s+/g, ' ') // إزالة المسافات الزائدة
    .trim();
};

const quran = JSON.parse(fs.readFileSync('./node_modules/quran-json/dist/quran.json', 'utf8'));

const chars = new Set();
for (const surah of quran) {
  for (const verse of surah.verses) {
    const norm = normalizeArabicText(verse.text);
    for (const char of norm) {
      chars.add(char);
    }
  }
}

console.log(Array.from(chars).sort().map(c => `${c} (${c.charCodeAt(0).toString(16)})`).join('\n'));
