import React, { useRef, useState, useEffect } from 'react';
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
      } catch (_) {}
    }
  };

  // معالجة حفظ وتنزيل الشهادة بجودة فائقة بدون رسم يدوي
  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    setIsDownloading(true);

    try {
      const certEl = certificateRef.current;
      
      // التأكد من توفر مكتبة html2canvas ديناميكياً
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

      if (html2canvasFn) {
        const canvas = await html2canvasFn(certEl, {
          scale: 3, // Ultra-HD 3X
          useCORS: true,
          allowTaint: true,
          backgroundColor: null, // لضمان الشفافية والجودة
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `شهادة_متين_${challengeName.replace(/\s+/g, '_')}_${playerName.replace(/\s+/g, '_')}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Download certificate error:', err);
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
      } catch (_) {}
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
      {isEditingName && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <form
            onSubmit={handleSaveCustomName}
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-amber-200"
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
        </div>
      )}

      {/* ========================================================= */}
      {/* جسم الشهادة الرئيسي المبني على الخلفية المصممة مسبقاً */}
      {/* ========================================================= */}
      <div
        ref={certificateRef}
        id="certificate-print-area"
        className="certificate-container relative w-full max-w-md sm:max-w-lg mx-auto aspect-[511/1024] bg-[#FCFBF7] text-slate-800 rounded-3xl shadow-2xl border-2 border-[#D4AF37]/50 overflow-hidden select-none"
      >
        {/* ============================== */}
        {/* خلفية الشهادة الجاهزة (Clean Image Background) */}
        {/* ============================== */}
        <img
          src="/certificate_general_bg.png"
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          alt="خلفية الشهادة"
        />

        {/* ========================================================= */}
        {/* نصوص الشهادة الديناميكية فوق الفراغات المخصصة فقط */}
        {/* ========================================================= */}
        <div className="relative z-10 w-full h-full pointer-events-none">
          {/* 1. اسم اللاعب المتسابق (فوق الفراغ الأول) */}
          <div className="absolute top-[66%] inset-x-0 flex flex-col items-center justify-center px-6 text-center">
            <h2 className="font-quran text-2xl sm:text-3xl md:text-4xl font-black text-[#0b234f] tracking-wide drop-shadow-xs">
              {playerName}
            </h2>
          </div>

          {/* 2. اسم التحدي والنطاق (فوق الفراغ الثاني) */}
          <div className="absolute top-[72%] inset-x-0 flex items-center justify-center px-6 text-center">
            <div className="inline-flex items-center justify-center flex-wrap gap-1.5 px-4 py-1.5 rounded-full bg-slate-900/5 text-slate-800 text-xs sm:text-sm font-bold">
              <span className="text-slate-600">أتمّ بنجاح خوض:</span>
              <span className="font-black text-[#0b234f]">{challengeName}</span>
              {surahOrJuz && (
                <span className="text-slate-500 font-semibold mr-1">
                  ({surahOrJuz})
                </span>
              )}
            </div>
          </div>

          {/* 3. النتيجة والتقدير (فوق الفراغ الثالث) */}
          <div className="absolute top-[78%] inset-x-0 flex items-center justify-center px-6 text-center">
            <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs sm:text-sm font-bold text-[#064E3B]">
              <span>النتيجة المباركة:</span>
              <span className="font-black font-mono text-emerald-800 text-sm sm:text-base">
                {score}
              </span>
            </div>
          </div>

          {/* 4. تاريخ المنح والرقم التسلسلي/الاعتماد */}
          <div className="absolute bottom-[4.5%] left-[8%] flex flex-col items-start text-right text-[10px] sm:text-xs font-bold text-slate-600 space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-slate-500">تاريخ المنح:</span>
              <span className="font-black text-slate-800">{formattedDate}</span>
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono text-slate-500">
              الاعتماد: <span>{finalCertId}</span>
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

