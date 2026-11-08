import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2, Printer, CheckCircle2, Award, Sparkles, Copy, Check, Edit3, X } from 'lucide-react';

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

  // معالجة الطباعة الرسمية
  const handlePrint = () => {
    window.print();
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

  // معالجة حفظ وتنزيل الشهادة بجودة فائقة عبر تصوير HTML/CSS بدقة عالية
  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    setIsDownloading(true);

    try {
      let dataUrl = '';
      const certEl = certificateRef.current;

      // التأكد من توفر مكتبة html2canvas ديناميكياً لتصوير عنصر HTML بالكامل
      let html2canvasFn = (window as any).html2canvas;
      if (!html2canvasFn) {
        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
          });
          html2canvasFn = (window as any).html2canvas;
        } catch (e) {
          console.warn('Could not load html2canvas CDN:', e);
        }
      }

      if (html2canvasFn && certEl) {
        const canvas = await html2canvasFn(certEl, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FCFBF7',
          logging: false
        });
        dataUrl = canvas.toDataURL('image/png');
      } else if ((window as any).htmlToImage && typeof (window as any).htmlToImage.toPng === 'function') {
        dataUrl = await (window as any).htmlToImage.toPng(certEl, {
          quality: 0.98,
          pixelRatio: 3
        });
      }

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `شهادة_متين_${challengeName.replace(/\s+/g, '_')}_${playerName.replace(/\s+/g, '_')}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Download certificate error:', err);
      // في حال حدوث أي مانع نفتح واجهة الطباعة مباشرة لحفظها كـ PDF
      window.print();
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
        <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-3 mb-4 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-amber-200/60 shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-black text-slate-800">
                شهادة الإنجاز الرسمية
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                وثيقة معتمدة ومجهزة للطباعة أو التنزيل الفوري
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* زر تعديل الاسم */}
            {allowNameEdit && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
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
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="طباعة الشهادة بتنسيق ورقي احترافي"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>طباعة</span>
            </button>

            {/* زر المشاركة */}
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white rounded-xl text-xs sm:text-sm font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'جاري التجهيز...' : 'تحميل الشهادة 📥'}</span>
            </button>

            {/* زر الإغلاق إن وُجد */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto print:hidden"
          onClick={() => setIsEditingName(false)}
        >
          <form
            onSubmit={handleSaveCustomName}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-amber-200 overflow-hidden"
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
      <div
        ref={certificateRef}
        id="certificate-print-area"
        className="certificate-container relative w-full max-w-4xl aspect-[1.414/1] bg-[#FCFBF7] text-slate-800 rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl border-[3px] border-[#D4AF37] overflow-hidden select-none flex flex-col justify-between"
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
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#D4AF37]" />
              <h1 className="font-quran text-xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-[#806716] via-[#D4AF37] to-[#806716] bg-clip-text text-transparent drop-shadow-xs">
                شَهَادَةُ إِنجَازٍ وَتَفَوُّق
              </h1>
              <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#D4AF37]" />
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

          {/* المنتصف: الختم الذهبي الملكي (3D Golden Stamp) */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 sm:w-22 sm:h-22 md:w-24 md:h-24">
              {/* شريط الختم المتدلي */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-6 flex justify-center gap-1 pointer-events-none">
                <div className="w-3 h-6 bg-[#806716] transform -rotate-12 rounded-b-xs" />
                <div className="w-3 h-6 bg-[#AA8B24] transform rotate-12 rounded-b-xs" />
              </div>

              {/* الختم الدائري الموشّى */}
              <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-[#806716] via-[#D4AF37] to-[#FDF8ED] p-1 shadow-lg shadow-amber-900/20 flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-dashed border-[#806716] bg-gradient-to-br from-[#AA8B24] to-[#806716] text-[#FDF8ED] flex flex-col items-center justify-center p-1 text-center">
                  <Award className="w-5 h-5 sm:w-7 sm:h-7 text-[#FDF8ED] drop-shadow-xs" />
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter leading-none mt-0.5">
                    مُعْتَمَدٌ
                  </span>
                  <span className="text-[6px] sm:text-[7px] font-bold opacity-90 leading-tight">
                    تطبيق متين
                  </span>
                </div>
              </div>
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

      {/* ========================================================= */}
      {/* ستايل مخصص للطباعة يضمن طباعة الشهادة فقط وبشكل Landscape */}
      {/* ========================================================= */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #certificate-print-area, #certificate-print-area * {
            visibility: visible !important;
          }
          #certificate-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 24px !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ChallengeCertificate;

