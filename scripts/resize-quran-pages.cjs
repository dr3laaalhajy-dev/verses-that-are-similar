const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const QURAN_DIR = path.resolve(__dirname, '../public/quran-pages');

async function main() {
  console.log('====================================================');
  console.log('  بدء تصغير وتحسين صور صفحات المصحف الشريف (WebP)  ');
  console.log('====================================================');
  console.log(`المجلد المستهدف: ${QURAN_DIR}\n`);

  if (!fs.existsSync(QURAN_DIR)) {
    console.error(`خطأ: المجلد ${QURAN_DIR} غير موجود!`);
    process.exit(1);
  }

  // جمع جميع ملفات صفحات القرآن (من 000.webp إلى 604.webp)
  const allFiles = fs.readdirSync(QURAN_DIR)
    .filter(f => /^\d+\.webp$/i.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  console.log(`تم العثور على ${allFiles.length} صفحة قرآنية.\n`);

  let totalOriginalBytes = 0;
  let totalNewBytes = 0;
  let processedCount = 0;

  const startTime = Date.now();

  for (const file of allFiles) {
    const filePath = path.join(QURAN_DIR, file);
    const origStat = fs.statSync(filePath);
    const origSize = origStat.size;
    totalOriginalBytes += origSize;

    // قراءة الصورة وضبط العرض إلى 1080 بكسل مع حساب الارتفاع تلقائياً للحفاظ على نسبة العرض للارتفاع
    // وضغط WebP بجودة 70
    const buffer = await sharp(filePath)
      .resize({
        width: 1080,
        withoutEnlargement: true,
      })
      .webp({
        quality: 70,
        alphaQuality: 0,
        effort: 6,
      })
      .toBuffer();

    const newSize = buffer.length;
    totalNewBytes += newSize;

    // استبدال الملف القديم بالملف الجديد المصغر
    fs.writeFileSync(filePath, buffer);
    processedCount++;

    if (processedCount % 50 === 0 || processedCount === allFiles.length) {
      const pct = ((processedCount / allFiles.length) * 100).toFixed(1);
      const runningSaved = (totalOriginalBytes - totalNewBytes) / (1024 * 1024);
      console.log(`[${pct}%] تمت معالجة ${processedCount}/${allFiles.length} صفحة... (المساحة الموفرة حتى الآن: ${runningSaved.toFixed(2)} MB)`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const origMB = (totalOriginalBytes / (1024 * 1024)).toFixed(2);
  const newMB = (totalNewBytes / (1024 * 1024)).toFixed(2);
  const savedBytes = totalOriginalBytes - totalNewBytes;
  const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
  const savedPercent = ((savedBytes / totalOriginalBytes) * 100).toFixed(2);

  console.log('\n====================================================');
  console.log('                اكتملت العملية بنجاح                ');
  console.log('====================================================');
  console.log(`عدد الصور التي تمت معالجتها: ${processedCount} صورة`);
  console.log(`وقت التنفيذ: ${durationSec} ثانية`);
  console.log(`الحجم الإجمالي الأصلي:      ${origMB} MB`);
  console.log(`الحجم الإجمالي الجديد:       ${newMB} MB`);
  console.log(`إجمالي المساحة الموفرة (Total Space Saved): ${savedMB} MB (${savedPercent}%)`);
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('حدث خطأ أثناء المعالجة:', err);
  process.exit(1);
});
