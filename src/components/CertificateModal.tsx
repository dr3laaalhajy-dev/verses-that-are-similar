import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Printer, Download, Check, Award, Sparkles, CheckCircle2 } from 'lucide-react';
import html2canvas from 'html2canvas';

export interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  challengeName: string;
  score: string | number;
  surahOrJuz?: string;
  certificateId?: string;
  date?: string;
}

/**
 * نافذة عرض الشهادة المنبثقة (Certificate Modal Overlay)
 * تعرض الشهادة في أعلى طبقة منبثقة (z-[100]) مع شريط أدوات تحكم علوي كامل (إغلاق، مشاركة، طباعة، تحميل)
 */
export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  playerName,
  challengeName,
  score,
  surahOrJuz,
  certificateId,
  date
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const finalCertId = certificateId || `MTN-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
  const formattedDate = date || new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

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

  // معالجة المشاركة عبر navigator.share أو النسخ للحافظة
  const handleShare = async () => {
    const shareText = `🏆 شهادة إنجاز معتمدة من تطبيق متين لعلوم القرآن الكريم!\nالمتسابق: ${playerName}\nالتحدي: ${challengeName}\nالنتيجة: ${score}\nرقم الاعتماد: ${finalCertId}`;
    if (navigator.share && navigator.canShare && navigator.canShare({ title: 'شهادة إنجاز متين', text: shareText, url: window.location.href })) {
      try {
        await navigator.share({
          title: `شهادة إنجاز - ${playerName}`,
          text: shareText,
          url: window.location.href
        });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (_) {}
    }
  };

  // معالجة التحميل عالي الدقة عبر html2canvas بإعدادات تدعم الهواتف وتمنع التشويه
  const handleDownload = async () => {
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

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        dir="rtl"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col items-center"
        >
          {/* ========================================================= */}
          {/* شريط الأدوات العلوي (Top Controls) */}
          {/* ========================================================= */}
          <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 w-full p-4 mb-3 sm:mb-4 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-amber-500/30 shadow-2xl text-white">
            <div className="flex items-center justify-center md:justify-start gap-2.5 text-center md:text-right w-full md:w-auto">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="text-center md:text-right w-full md:w-auto">
                <h3 className="text-xs sm:text-sm font-black text-amber-300">
                  شهادة إنجاز معتمدة
                </h3>
                <span className="text-[10px] text-slate-300 block">
                  الوثيقة الرسمية لإتمام التحدي القرآني
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2 w-full md:w-auto">
              {/* زر تنزيل عالي الدقة */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="تنزيل الشهادة كصورة فائقة الدقة"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{isDownloading ? 'جاري التحميل...' : 'تحميل الشهادة 📥'}</span>
              </button>

              {/* زر طباعة */}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/30 transition-all cursor-pointer active:scale-95"
                title="طباعة الشهادة بتنسيق ورقي احترافي"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-300" />
                <span>طباعة 🖨️</span>
              </button>

              {/* زر مشاركة */}
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 transition-all cursor-pointer active:scale-95"
                title="مشاركة رابط وتفاصيل الشهادة"
              >
                {copied ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-indigo-300" />}
                <span>{copied ? 'تم النسخ!' : 'مشاركة 🔗'}</span>
              </button>

              {/* زر إغلاق بارز */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 border border-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                title="إغلاق النافذة (✖️)"
              >
                <X className="w-5 h-5 font-black" />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* قالب الشهادة البرمجي الكامل (HTML / CSS / Tailwind / SVG) */}
          {/* ========================================================= */}
          <div className="w-full flex justify-center items-start overflow-hidden py-2 sm:py-4 h-[280px] sm:h-[420px] md:h-auto">
            <div
              ref={certificateRef}
              id="certificate-wrapper"
              className="certificate-container relative origin-top scale-[0.42] min-[390px]:scale-[0.46] sm:scale-[0.68] md:scale-100 w-[800px] shrink-0 aspect-[1.414/1] bg-[#FCFBF7] text-slate-800 rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl border-[3px] border-[#D4AF37] overflow-hidden select-none flex flex-col justify-between transition-transform"
            style={{
              boxShadow: '0 25px 60px -15px rgba(6, 78, 59, 0.25), 0 0 0 1px rgba(212, 175, 55, 0.4)',
              backgroundImage: 'radial-gradient(#F5EEDB 0.75px, transparent 0.75px), radial-gradient(#F5EEDB 0.75px, #FCFBF7 0.75px)',
              backgroundSize: '30px 30px',
              backgroundPosition: '0 0, 15px 15px'
            }}
          >
            {/* الزخرفة الهندسية الإسلامية المدمجة SVG (6% Opacity) */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.06] flex items-center justify-center overflow-hidden">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="modal-islamic-pattern" width="80" height="80" patternUnits="userSpaceOnUse">
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
                <rect width="100%" height="100%" fill="url(#modal-islamic-pattern)" />
              </svg>
            </div>

            {/* إطار هندسي داخلي مزدوج (Solid & Dashed Gold Borders) */}
            <div className="absolute inset-2.5 sm:inset-4 border border-[#D4AF37]/50 rounded-2xl pointer-events-none" />
            <div className="absolute inset-3.5 sm:inset-5 border border-dashed border-[#D4AF37]/40 rounded-xl pointer-events-none" />

            {/* 1. الترويسة العلوية والبسملة */}
            <div className="relative z-10 flex flex-col items-center text-center pt-2 sm:pt-4">
              <div className="flex items-center gap-2 mb-1 sm:mb-2 opacity-90">
                <span className="w-8 sm:w-16 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]" />
                <span className="font-quran text-xs sm:text-base md:text-lg text-[#064E3B] font-bold tracking-wide">
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </span>
                <span className="w-8 sm:w-16 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]" />
              </div>

              <div className="relative inline-block mt-0.5 sm:mt-1">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c29631]" />
                  <h1 className="font-quran text-xl sm:text-3xl md:text-4xl font-bold text-[#c29631] drop-shadow-sm">
                    شَهَادَةُ إِنجَازٍ وَتَفَوُّق
                  </h1>
                  <Sparkles className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#c29631]" />
                </div>
                <p className="text-[10px] sm:text-xs md:text-sm font-tajawal font-bold text-[#064E3B] tracking-wider mt-2 sm:mt-3">
                  تَطْبِيقُ مَتِين لِعُلُومِ القُرْآنِ الكَرِيمِ وَالمُتَشَابِهَات
                </p>
              </div>
            </div>

            {/* 2. المتن النصي الرئيسي */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto px-4 sm:px-12 md:px-16 space-y-2 sm:space-y-4">
              <p className="text-xs sm:text-sm md:text-base font-tajawal font-semibold text-slate-600">
                تَشْهَدُ إِدَارَةُ تَطْبِيقِ <span className="font-bold text-[#064E3B]">مَتِين لِعُلُومِ القُرْآنِ الكَرِيمِ</span> بِأَنَّ البَطَلَ المُتَسَابِق /
              </p>

              <div className="relative inline-flex items-center justify-center px-6 sm:px-10 py-1.5 sm:py-2.5 my-1">
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
                <h2 className="font-quran text-xl sm:text-3xl md:text-4xl font-black text-[#064E3B] tracking-wide drop-shadow-xs">
                  {playerName}
                </h2>
              </div>

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

                {/* بطاقة النتيجة (بدون كلمة المباركة وبدون التقدير وفقاً للقواعد الصارمة) */}
                <div className="inline-flex items-center gap-2 sm:gap-3 px-5 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 via-amber-50 to-emerald-50 border border-amber-200 shadow-2xs text-xs sm:text-sm md:text-base font-bold text-[#064E3B]">
                  <span>النَّتِيجَة:</span>
                  <span className="font-black text-amber-700 font-mono text-sm sm:text-lg">
                    {score}
                  </span>
                </div>

                <p className="text-[11px] sm:text-xs md:text-sm font-quran text-slate-500 italic pt-1">
                  سَائِلِينَ المَوْلَى عَزَّ وَجَلَّ لَهُ التَّوْفِيقَ وَالسَّدَادَ، وَأَنْ يَجْعَلَ القُرْآنَ العَظِيمَ رَبِيعَ قَلْبِهِ وَنُورَ صَدْرِهِ.
                </p>
              </div>
            </div>

            {/* 3. التذييل والأختام الرسمية */}
            <div className="relative z-10 grid grid-cols-3 items-end pt-3 sm:pt-6 border-t border-[#D4AF37]/30 px-2 sm:px-6">
              {/* تاريخ المنح */}
              <div className="flex flex-col items-start text-right bg-white/70 backdrop-blur-xs rounded-xl p-2 sm:p-2.5 border border-[#D4AF37]/20 shadow-2xs">
                <span className="text-[10px] sm:text-xs font-bold text-slate-400">تَارِيخُ المَنْح</span>
                <span className="text-xs sm:text-sm font-black text-[#064E3B] mt-0.5">
                  {formattedDate}
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 mt-0.5">
                  الاعتماد: {finalCertId}
                </span>
              </div>

              {/* الختم الذهبي الملكي المعتمد SVG (Pure Vector Gold Stamp - يضمن الطباعة الملونة بنسبة 100%) */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-16 h-16 sm:w-22 sm:h-22 md:w-24 md:h-24 flex items-center justify-center">
                  <svg
                    viewBox="0 0 120 135"
                    className="w-full h-full drop-shadow-md overflow-visible select-none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="certModalStampRibbonL" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#806716" />
                        <stop offset="50%" stopColor="#AA8B24" />
                        <stop offset="100%" stopColor="#55440E" />
                      </linearGradient>
                      <linearGradient id="certModalStampRibbonR" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#AA8B24" />
                        <stop offset="50%" stopColor="#D4AF37" />
                        <stop offset="100%" stopColor="#705912" />
                      </linearGradient>
                      <linearGradient id="certModalStampOuterGold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#806716" />
                        <stop offset="25%" stopColor="#D4AF37" />
                        <stop offset="50%" stopColor="#FFF4D0" />
                        <stop offset="75%" stopColor="#AA8B24" />
                        <stop offset="100%" stopColor="#665210" />
                      </linearGradient>
                      <radialGradient id="certModalStampInnerGold" cx="45%" cy="40%" r="60%">
                        <stop offset="0%" stopColor="#E5C768" />
                        <stop offset="40%" stopColor="#C49E2C" />
                        <stop offset="85%" stopColor="#806716" />
                        <stop offset="100%" stopColor="#5A470C" />
                      </radialGradient>
                      <filter id="certModalStampGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#3F2703" floodOpacity="0.25" />
                      </filter>
                    </defs>

                    {/* أشرطة الختم المتدلية */}
                    <g filter="url(#certModalStampGlow)">
                      <polygon
                        points="46,80 32,126 46,118 54,126 52,80"
                        fill="url(#certModalStampRibbonL)"
                        stroke="#55440E"
                        strokeWidth="0.5"
                      />
                      <polygon
                        points="68,80 66,126 74,118 88,126 74,80"
                        fill="url(#certModalStampRibbonR)"
                        stroke="#55440E"
                        strokeWidth="0.5"
                      />
                    </g>

                    {/* قرص الختم المذهب المتقن */}
                    <g filter="url(#certModalStampGlow)">
                      <circle cx="60" cy="54" r="50" fill="url(#certModalStampOuterGold)" stroke="#806716" strokeWidth="1" />
                      <circle cx="60" cy="54" r="46.5" fill="none" stroke="#FFF7D6" strokeWidth="0.8" opacity="0.8" />
                      <circle cx="60" cy="54" r="43" fill="none" stroke="#665210" strokeWidth="1.2" strokeDasharray="2.5,2" />
                      <circle cx="60" cy="54" r="40" fill="url(#certModalStampInnerGold)" stroke="#D4AF37" strokeWidth="1" />
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

              {/* اعتماد الإدارة والتوثيق الرقمي */}
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
      </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null;
};

export default CertificateModal;
