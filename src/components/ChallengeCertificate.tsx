import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2, Printer, CheckCircle2, Award, Sparkles, Copy, Check, Edit3, X } from 'lucide-react';
import html2canvas from 'html2canvas';

export interface ChallengeCertificateProps {
  playerName: string;
  challengeName: string;
  score: string | number;
  date?: string;
  rank?: string;
  certificateId?: string;
  surahOrJuz?: string;
  onClose?: () => void;
  showControls?: boolean;
  allowNameEdit?: boolean;
}

/**
 * مكون شهادة إكمال التحدي - تطبيق متين لعلوم القرآن الكريم
 * مصمم بنمط إسلامي فاخر وأبعاد عرضية (Landscape) متجاوبة
 * متوافق مع معايير الطباعة عالية الجودة والتصدير المباشر والمشاركة
 */
export const ChallengeCertificate: React.FC<ChallengeCertificateProps> = ({
  playerName: initialPlayerName,
  challengeName,
  score,
  date,
  rank = 'متقن ومتميز',
  certificateId,
  surahOrJuz,
  onClose,
  showControls = true,
  allowNameEdit = true
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [playerName, setPlayerName] = useState(initialPlayerName || 'فارس القرآن');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // تحديث الاسم عند تغير الـ Prop
  useEffect(() => {
    if (initialPlayerName) {
      setPlayerName(initialPlayerName);
      setTempName(initialPlayerName);
    }
  }, [initialPlayerName]);

  // Body scroll lock when editing name modal is open
  useEffect(() => {
    if (isEditingName) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isEditingName]);

  // توليد رقم مسلسل فريد وثابت للشهادة إذا لم يُمرر
  const finalCertId = useRef(
    certificateId || `MTN-${Math.floor(100000 + Math.random() * 900000)}`
  ).current;

  // التاريخ الحالي بصيغة عربية أنيقة
  const formattedDate = date || new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // معالجة الطباعة المعزولة عبر iframe لمنع تكرار النسخ وضمان طباعة صفحة واحدة
  const handlePrint = () => {
    const certElement = document.getElementById('certificate-wrapper') || certificateRef.current;
    if (!certElement) return;

    // إنشاء iframe مخفي
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    // جلب ملفات الـ CSS الخاصة بالمشروع (Tailwind) لضمان نفس التنسيق
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(s => s.outerHTML)
      .join('');

    // كتابة محتوى الشهادة داخل الـ iframe
    frameDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة الشهادة</title>
          ${styles}
          <style>
            /* إجبار المتصفح على طباعة ألوان الخلفية والتدرجات بدقة تامة */
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page { size: A4 landscape; margin: 0; }
              body { margin: 0; padding: 0; background: white !important; }
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { size: A4 landscape; margin: 0; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white !important; }
            #certificate-wrapper { transform: scale(0.9); transform-origin: center; width: 100% !important; max-width: 1000px !important; }
          </style>
        </head>
        <body>
          ${certElement.outerHTML}
        </body>
      </html>
    `);
    frameDoc.close();

    // انتظار تحميل الصور والخطوط ثم الطباعة
    printFrame.contentWindow?.focus();
    setTimeout(() => {
      printFrame.contentWindow?.print();
      // إزالة الـ iframe بعد الطباعة لمنع التكرار
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 500);
    }, 500);
  };

  // معالجة المشاركة عبر واجهة المتصفح Native Web Share API
  const handleShare = async () => {
    const shareData = {
      title: `شهادة إنجاز - تطبيق متين`,
      text: `الحمد لله! أتممت بنجاح "${challengeName}" بنتيجة ${score} عبر تطبيق متين لعلوم القرآن الكريم.`,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: نسخ النص للحافظة
      try {
        await navigator.clipboard.writeText(
          `🏆 حصلت على شهادة إنجاز في "${challengeName}" بنتيجة ${score} من تطبيق متين لعلوم القرآن الكريم!\nرقم الاعتماد: ${finalCertId}`
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (_) { }
    }
  };

  // معالجة حفظ وتنزيل الشهادة بجودة فائقة عبر تصوير HTML/CSS بدقة عالية تدعم الهواتف
  const handleDownloadImage = async () => {
    const certElement = document.getElementById('certificate-wrapper') || certificateRef.current;
    if (!certElement) return;

    try {
      setIsDownloading(true);
      const canvas = await html2canvas(certElement, {
        scale: 2, // لزيادة دقة الصورة
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('certificate-wrapper');
          if (el) {
            el.style.transform = 'none';
          }
        }
      });

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `certificate_${playerName}.png`;
      link.href = image;
      link.click();
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveCustomName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setPlayerName(tempName.trim());
      try {
        localStorage.setItem('quran_user_triple_name', tempName.trim());
      } catch (_) { }
    }
    setIsEditingName(false);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 md:p-6" dir="rtl">
      {/* ========================================================= */}
      {/* أزرار التحكم والخيارات العلوية (يتم إخفاؤها تلقائياً عند الطباعة) */}
      {/* ========================================================= */}
      {showControls && (
        <div className="w-full max-w-4xl flex flex-col-reverse md:flex-row justify-between items-center gap-4 mb-4 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-amber-200/60 shadow-xs">
          <div className="flex items-center justify-center md:justify-start gap-2 text-center md:text-right w-full md:w-auto">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="text-center md:text-right w-full md:w-auto">
              <h4 className="text-sm sm:text-base font-black text-slate-800">
                شهادة الإنجاز الرسمية
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                وثيقة معتمدة ومجهزة للطباعة أو التنزيل الفوري
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 w-full md:w-auto">
            {/* زر تعديل الاسم */}
            {allowNameEdit && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
                title="تعديل اسم المستلم على الشهادة"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>تعديل الاسم</span>
              </button>
            )}

            {/* زر الطباعة المباشرة */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
              title="طباعة الشهادة بتنسيق ورقي احترافي"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>طباعة</span>
            </button>

            {/* زر المشاركة */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
              title="مشاركة الإنجاز مع الأصدقاء"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-indigo-600" />}
              <span>{copied ? 'تم النسخ!' : 'مشاركة'}</span>
            </button>

            {/* زر التحميل الرئيسي */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isDownloading}
              className="flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'جاري التجهيز...' : 'تحميل الشهادة 📥'}</span>
            </button>

            {/* زر الإغلاق إن وُجد */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* نافذة منبثقة بسيطة لتعديل الاسم */}
      {isEditingName && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setIsEditingName(false)}
        >
          <form
            onSubmit={handleSaveCustomName}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 shadow-2xl border border-amber-200"
          >
            <h3 className="text-base font-black text-slate-800 mb-1">
              تخصيص الاسم على الشهادة
            </h3>
            <p className="text-xs text-slate-500 mb-3 font-medium">
              اكتب اسمك الثلاثي أو اللقب المفضل ليظهر في الشهادة المعتمدة:
            </p>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="مثال: عبد الله أحمد المنصور"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-amber-500 text-sm font-bold text-slate-800 mb-4"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-black bg-amber-600 hover:bg-amber-700 text-white"
              >
                حفظ على الشهادة
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* جسم الشهادة الرئيسي (Landscape Certificate) */}
      {/* ========================================================= */}
      <div className="w-full flex justify-center items-start overflow-hidden py-2 sm:py-4 h-[280px] sm:h-[420px] md:h-auto">
        <div
          ref={certificateRef}
          id="certificate-wrapper"
          className="certificate-container relative origin-top scale-[0.42] min-[390px]:scale-[0.46] sm:scale-[0.68] md:scale-100 w-[800px] shrink-0 aspect-[1.414/1] bg-[#FCFBF7] text-slate-800 rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl border-[3px] border-[#D4AF37] overflow-hidden select-none flex flex-col justify-between transition-transform"
        style={{
          boxShadow: '0 25px 60px -15px rgba(6, 78, 59, 0.18), 0 0 0 1px rgba(212, 175, 55, 0.3)',
          backgroundImage: 'radial-gradient(#F5EEDB 0.75px, transparent 0.75px), radial-gradient(#F5EEDB 0.75px, #FCFBF7 0.75px)',
          backgroundSize: '30px 30px',
          backgroundPosition: '0 0, 15px 15px'
        }}
      >
        {/* ============================== */}
        {/* الزخارف الهندسية المدمجة (SVG Background Pattern) */}
        {/* ============================== */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06] flex items-center justify-center overflow-hidden">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="islamic-girih-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
                {/* 8-fold Islamic Star Polygon Geometry */}
                <path
                  d="M40 0 L51.7 11.7 L68.3 11.7 L68.3 28.3 L80 40 L68.3 51.7 L68.3 68.3 L51.7 68.3 L40 80 L28.3 68.3 L11.7 68.3 L11.7 51.7 L0 40 L11.7 28.3 L11.7 11.7 L28.3 11.7 Z"
                  fill="none"
                  stroke="#064E3B"
                  strokeWidth="1.2"
                />
                <circle cx="40" cy="40" r="18" fill="none" stroke="#D4AF37" strokeWidth="1" />
                <path
                  d="M40 10 L47 23 L61 23 L50 32 L54 46 L40 37 L26 46 L30 32 L19 23 L33 23 Z"
                  fill="none"
                  stroke="#064E3B"
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#islamic-girih-pattern)" />
          </svg>
        </div>

        {/* إطار هندسي داخلي رفيع وأنيق يحيط بالشهادة دون أن يطغى على النصوص */}
        <div className="absolute inset-2.5 sm:inset-4 border border-[#D4AF37]/50 rounded-2xl pointer-events-none" />
        <div className="absolute inset-3.5 sm:inset-5 border border-dashed border-[#D4AF37]/40 rounded-xl pointer-events-none" />

        {/* ========================================================= */}
        {/* الترويسة العلوية (Header & Basmala) */}
        {/* ========================================================= */}
        <div className="relative z-10 flex flex-col items-center text-center pt-2 sm:pt-4">
          {/* البسملة الشريفة */}
          <div className="flex items-center gap-2 mb-1 sm:mb-2 opacity-90">
            <span className="w-8 sm:w-16 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]" />
            <span className="font-quran text-xs sm:text-base md:text-lg text-[#064E3B] font-bold tracking-wide">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </span>
            <span className="w-8 sm:w-16 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]" />
          </div>

          {/* وسام التاج والترويسة المركزية */}
          <div className="relative inline-block mt-0.5 sm:mt-1">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c29631]" />
              <h1 className="font-quran text-xl sm:text-3xl md:text-4xl font-bold text-[#c29631] drop-shadow-sm">
                شَهَادَةُ إِنجَازٍ وَتَفَوُّق
              </h1>
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c29631]" />
            </div>

            {/* مسافة عمودية كافية لفك الضغط البصري mt-3 sm:mt-4 */}
            <p className="text-[10px] sm:text-xs md:text-sm font-tajawal font-bold text-[#064E3B] tracking-wider mt-3 sm:mt-4">
              تَطْبِيقُ مَتِين لِعُلُومِ القُرْآنِ الكَرِيمِ وَالمُتَشَابِهَات
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* المتن النصي الرئيسي للشهادة (Certificate Core Body) */}
        {/* ========================================================= */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto px-4 sm:px-12 md:px-16 space-y-2 sm:space-y-4">
          {/* تمهيد الشهادة */}
          <p className="text-xs sm:text-sm md:text-base font-tajawal font-semibold text-slate-600">
            تَشْهَدُ إِدَارَةُ تَطْبِيقِ <span className="font-bold text-[#064E3B]">مَتِين لِعُلُومِ القُرْآنِ الكَرِيمِ</span> بِأَنَّ الأَخ المُتَسَابِق /
          </p>

          {/* اسم اللاعب المميز والمزخرف */}
          <div className="relative inline-flex items-center justify-center px-6 sm:px-10 py-1.5 sm:py-2.5 my-1">
            {/* خط زخرفي تحت الاسم */}
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <h2 className="font-quran text-xl sm:text-3xl md:text-4xl font-black text-[#064E3B] tracking-wide drop-shadow-xs">
              {playerName}
            </h2>
          </div>

          {/* تفاصيل إتمام التحدي - مجهزة للإنجازات الكبرى */}
          <div className="space-y-1 sm:space-y-2 max-w-2xl w-full">
            <p className="text-xs sm:text-base md:text-lg font-tajawal text-slate-700 leading-relaxed">
              قَدْ أَتَمَّ بِنَجَاحٍ وَإِتْقَانٍ:{' '}
              <span className="font-black text-[#806716] px-2.5 py-1 rounded-lg bg-amber-50/80 border border-amber-200/70 inline-block my-1 leading-snug break-words max-w-full">
                {challengeName}
              </span>
              {surahOrJuz && (
                <span className="text-xs sm:text-sm text-slate-500 font-bold mr-1">
                  ({surahOrJuz})
                </span>
              )}
            </p>

            {/* النتيجة */}
            <div className="inline-flex items-center gap-2 sm:gap-3 px-5 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 via-amber-50 to-emerald-50 border border-amber-200 shadow-2xs text-xs sm:text-sm md:text-base font-bold text-[#064E3B]">
              <span>النَّتِيجَة:</span>
              <span className="font-black text-amber-700 font-mono text-sm sm:text-lg">
                {score}
              </span>
            </div>

            {/* الدعاء الختامي */}
            <p className="text-[11px] sm:text-xs md:text-sm font-quran text-slate-500 italic pt-1">
              سَائِلِينَ المَوْلَى عَزَّ وَجَلَّ لَهُ التَّوْفِيقَ وَالسَّدَادَ، وَأَنْ يَجْعَلَ القُرْآنَ العَظِيمَ رَبِيعَ قَلْبِهِ وَنُورَ صَدْرِهِ.
            </p>
          </div>
        </div>

        {/* ========================================================= */}
        {/* التذييل والأختام الرسمية (Official Seals & Signatures) */}
        {/* ========================================================= */}
        <div className="relative z-10 grid grid-cols-3 items-end pt-3 sm:pt-6 border-t border-[#D4AF37]/30 px-2 sm:px-6">
          {/* الجانب الأيمن: تاريخ الإنجاز بخلفية نقية واضحة */}
          <div className="flex flex-col items-start text-right bg-white/70 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-[#D4AF37]/20 shadow-2xs">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400">تَارِيخُ المَنْح</span>
            <span className="text-xs sm:text-sm font-black text-[#064E3B] mt-0.5">
              {formattedDate}
            </span>
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 mt-0.5">
              الاعتماد: {finalCertId}
            </span>
          </div>

          {/* المنتصف: الختم الذهبي الملكي المعتمد SVG (Pure Vector Gold Stamp - يضمن الطباعة الملونة بنسبة 100%) */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 sm:w-22 sm:h-22 md:w-24 md:h-24 flex items-center justify-center">
              <svg
                viewBox="0 0 120 135"
                className="w-full h-full drop-shadow-md overflow-visible select-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="chalStampRibbonL" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#806716" />
                    <stop offset="50%" stopColor="#AA8B24" />
                    <stop offset="100%" stopColor="#55440E" />
                  </linearGradient>
                  <linearGradient id="chalStampRibbonR" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#AA8B24" />
                    <stop offset="50%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#705912" />
                  </linearGradient>
                  <linearGradient id="chalStampOuterGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#806716" />
                    <stop offset="25%" stopColor="#D4AF37" />
                    <stop offset="50%" stopColor="#FFF4D0" />
                    <stop offset="75%" stopColor="#AA8B24" />
                    <stop offset="100%" stopColor="#665210" />
                  </linearGradient>
                  <radialGradient id="chalStampInnerGold" cx="45%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#E5C768" />
                    <stop offset="40%" stopColor="#C49E2C" />
                    <stop offset="85%" stopColor="#806716" />
                    <stop offset="100%" stopColor="#5A470C" />
                  </radialGradient>
                  <filter id="chalStampGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#3F2703" floodOpacity="0.25" />
                  </filter>
                </defs>

                {/* أشرطة الختم المتدلية */}
                <g filter="url(#chalStampGlow)">
                  <polygon
                    points="46,80 32,126 46,118 54,126 52,80"
                    fill="url(#chalStampRibbonL)"
                    stroke="#55440E"
                    strokeWidth="0.5"
                  />
                  <polygon
                    points="68,80 66,126 74,118 88,126 74,80"
                    fill="url(#chalStampRibbonR)"
                    stroke="#55440E"
                    strokeWidth="0.5"
                  />
                </g>

                {/* قرص الختم المذهب المتقن */}
                <g filter="url(#chalStampGlow)">
                  <circle cx="60" cy="54" r="50" fill="url(#chalStampOuterGold)" stroke="#806716" strokeWidth="1" />
                  <circle cx="60" cy="54" r="46.5" fill="none" stroke="#FFF7D6" strokeWidth="0.8" opacity="0.8" />
                  <circle cx="60" cy="54" r="43" fill="none" stroke="#665210" strokeWidth="1.2" strokeDasharray="2.5,2" />
                  <circle cx="60" cy="54" r="40" fill="url(#chalStampInnerGold)" stroke="#D4AF37" strokeWidth="1" />
                </g>

                {/* وسام الجائزة في الوسط */}
                <g transform="translate(46, 26) scale(1.15)" stroke="#FDF8ED" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6" fill="#FDF8ED" fillOpacity="0.15" />
                  <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-4.182-3.137-4.182 3.137a.5.5 0 0 1-.81-.47l1.515-8.526" fill="#FDF8ED" fillOpacity="0.2" />
                </g>

                {/* النصوص المعتمدة الرسمية */}
                <text
                  x="60"
                  y="68"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="'Cairo', 'Tajawal', sans-serif"
                  style={{ letterSpacing: '0.8px', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                  مُعْتَمَدٌ
                </text>

                <text
                  x="60"
                  y="79"
                  textAnchor="middle"
                  fill="#FFF4D0"
                  fontSize="7.5"
                  fontWeight="700"
                  fontFamily="'Cairo', 'Tajawal', sans-serif"
                  style={{ letterSpacing: '0.3px', textShadow: '0 1px 1px rgba(0,0,0,0.3)' }}
                >
                  تطبيق متين
                </text>

                {/* نجوم التميز والتألق */}
                <text
                  x="60"
                  y="87"
                  textAnchor="middle"
                  fill="#FDF8ED"
                  fontSize="6"
                  fontWeight="bold"
                  style={{ letterSpacing: '2px' }}
                >
                  ★ ★ ★
                </text>
              </svg>
            </div>
          </div>

          {/* الجانب الأيسر: اعتماد الإدارة والتوقيع بخلفية نقية واضحة */}
          <div className="flex flex-col items-end text-left bg-white/70 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-[#D4AF37]/20 shadow-2xs">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400">إِدَارَةُ التَّطْبِيقِ</span>
            <div className="font-quran text-sm sm:text-lg font-black text-[#064E3B] my-0.5 italic">
              متين لعلوم القرآن
            </div>
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>شهادة موثقة رقمياً</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ChallengeCertificate;

