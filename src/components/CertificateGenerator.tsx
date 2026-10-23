import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Award, CheckCircle2, User, Share2, Info, Sparkles, Calendar, Edit3, ShieldCheck } from 'lucide-react';

interface CertificateGeneratorProps {
  onClose: () => void;
  onSave?: (cert: { category: string, date: string, name: string }) => void;
  category: string;
  isClaimed?: boolean;
  claimedName?: string;
}

const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({ onClose, onSave, category, isClaimed, claimedName }) => {
  // Initialize with saved name if available, or claimed name if already exists
  const [userName, setUserName] = useState(() => claimedName || localStorage.getItem('quran_user_triple_name') || localStorage.getItem('quran_user_name') || '');
  const [isGenerated, setIsGenerated] = useState(!!isClaimed);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const categoryTitle = category === 'seerah' 
    ? 'تحدي السيرة النبوية الشريفة' 
    : 'الثقافة الإسلامية والأسئلة العامة';

  const categorySubtitle = category === 'seerah'
    ? '3 مجموعات متتالية - 60 سؤالاً'
    : '5 مجموعات متتالية - 100 سؤالاً';

  const currentDate = new Date().toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Template-Based Drawing Logic (Ultra HD 2x Resolution)
  const drawCertificate = () => {
    if (!userName.trim() || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const savedName = localStorage.getItem('quran_user_name') || 'بطل التحدي';
    const finalUserName = userName.trim() || savedName;

    const img = new Image();
    img.src = category === 'general' ? '/certificate-general-bg.jpg' : '/certificate-bg.jpg';

    img.onload = () => {
      // 2x Retina Scale for pristine Ultra HD export & crisp text
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const renderText = () => {
        // Text Overlay Configuration & Premium Arabic Typography
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';

        // Line 1: Congratulations and Name
        ctx.font = `bold ${Math.floor(canvas.width * 0.045)}px "Tajawal", "Cairo", Arial, sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowBlur = 4;
        ctx.fillText(`بارك الله فيك يا ${finalUserName}!`, canvas.width / 2, canvas.height * 0.67);

        // Reset shadow
        ctx.shadowBlur = 0;

        // Line 2: Achievement Title
        ctx.font = `600 ${Math.floor(canvas.width * 0.028)}px "Tajawal", "Cairo", Arial, sans-serif`;
        ctx.fillStyle = '#334155';
        ctx.fillText(`أتممت بنجاح كافة مجموعات [${categoryTitle}]`, canvas.width / 2, canvas.height * 0.72);

        // Line 3: Achievement Details
        ctx.font = `500 ${Math.floor(canvas.width * 0.024)}px "Tajawal", "Cairo", Arial, sans-serif`;
        ctx.fillStyle = '#475569';
        ctx.fillText(`(${categorySubtitle})`, canvas.width / 2, canvas.height * 0.76);

        // Line 4: Motivational Quranic Verse
        ctx.font = `bold ${Math.floor(canvas.width * 0.032)}px "Amiri", "Tajawal", serif`;
        ctx.fillStyle = '#047857';
        ctx.fillText('« يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ »', canvas.width / 2, canvas.height * 0.81);

        // Line 5: Dua / Prayer
        ctx.font = `500 ${Math.floor(canvas.width * 0.030)}px "Tajawal", "Cairo", Arial, sans-serif`;
        ctx.fillStyle = '#b45309';
        ctx.fillText('نفع الله بك الإسلام والمسلمين، وزادك علماً وتوفيقاً', canvas.width / 2, canvas.height * 0.85);

        // Line 6: Date
        ctx.font = `${Math.floor(canvas.width * 0.024)}px "Tajawal", "Cairo", Arial, sans-serif`;
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`تاريخ الإنجاز: ${currentDate}`, canvas.width / 2, canvas.height * 0.92);

        setIsImageLoaded(true);
      };

      if (document.fonts) {
        document.fonts.ready.then(renderText).catch(renderText);
      } else {
        renderText();
      }
    };

    img.onerror = () => {
      console.error('Failed to load certificate template');
      canvas.width = 1200;
      canvas.height = 840;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1200, 840);
      ctx.fillStyle = '#ef4444';
      ctx.font = '28px "Tajawal", Arial';
      ctx.textAlign = 'center';
      ctx.fillText('خطأ في تحميل قالب الشهادة', 600, 420);
    };
  };

  useEffect(() => {
    if (isGenerated) {
      const timer = setTimeout(drawCertificate, 80);
      return () => clearTimeout(timer);
    }
  }, [isGenerated, userName]);

  const handleGenerate = () => {
    if (userName.trim()) {
      setIsGenerated(true);
      localStorage.setItem('quran_user_triple_name', userName.trim());

      if (onSave) {
        onSave({ 
          category, 
          date: currentDate, 
          name: userName.trim() 
        });
      }
    }
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    setIsDownloading(true);
    try {
      const link = document.createElement('a');
      const cleanName = (userName.trim() || 'البطل').replace(/\s+/g, '_');
      link.download = `وسام_${category === 'seerah' ? 'السيرة_النبوية' : 'الثقافة_الإسلامية'}_${cleanName}.jpg`;
      link.href = canvasRef.current.toDataURL('image/jpeg', 0.96);
      link.click();
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  };

  const handleShareCertificate = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const file = new File([blob], `وسام_${category}.jpg`, { type: "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'وسام الشرف والإنجاز',
            text: `الحمد لله أتممت بنجاح ${categoryTitle} في تطبيق متين للقرآن الكريم! 🏆 شاركني التحدي: https://quran-quiz-challenge.vercel.app`,
          });
        } else {
          downloadImage();
        }
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-2xl overflow-y-auto">
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
        className="bg-gradient-to-b from-slate-900/98 via-slate-900/95 to-slate-950/98 border border-amber-500/40 rounded-3xl md:rounded-[2.5rem] w-full max-w-4xl p-4 sm:p-7 md:p-9 relative shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden my-auto text-right"
        dir="rtl"
      >
        {/* Ambient Decorative Lighting */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 w-10 h-10 rounded-2xl bg-slate-800/80 hover:bg-red-500/20 border border-slate-700/80 hover:border-red-400/50 text-slate-400 hover:text-red-400 transition-all flex items-center justify-center z-20 group cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5 transition-transform group-hover:scale-110" />
        </button>

        {/* Top Header Bar */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/80 relative z-10 pl-12">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Award className="w-6 h-6 sm:w-7 sm:h-7 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                وسام الشرف والإنجاز
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>إصدار تذكاري</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-bold mt-0.5">
              {categoryTitle}
            </p>
          </div>
        </div>

        {/* Dynamic Content */}
        {!isGenerated ? (
          /* STEP 1: Enter Name Form */
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="max-w-md mx-auto py-6 sm:py-10 text-center relative z-10"
          >
            <div className="relative inline-block mb-6">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 via-emerald-500/10 to-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center shadow-xl mx-auto">
                <Award className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-amber-400/15 blur-2xl rounded-full pointer-events-none" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
              هنيئاً لك هذا الإنجاز المبارك!
            </h3>
            <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed max-w-sm mx-auto">
              اكتب اسمك الثلاثي أو اللقب الذي تحبه ليُخطَّ رسمياً في وسام التميز ويبقى ذكرى مباركة.
            </p>

            <div className="relative mb-6 text-right">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="مثال: عبد الرحمن محمد الأحمد"
                dir="rtl"
                autoFocus
                className="w-full py-4 sm:py-5 px-5 pr-12 bg-slate-800/90 border-2 border-slate-700/80 focus:border-amber-400 rounded-2xl text-base sm:text-lg font-black text-white placeholder:text-slate-500 outline-none transition-all shadow-inner"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400/70 w-5 h-5 pointer-events-none" />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!userName.trim()}
              className="w-full py-4 sm:py-5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 active:scale-98 text-slate-950 rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-amber-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>إصدار وتوثيق الوسام الآن</span>
            </button>
          </motion.div>
        ) : (
          /* STEP 2: Preview & Download Screen */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full flex flex-col items-center relative z-10"
          >
            {/* Top Status Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-5 p-3 sm:p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-white block">
                    {isClaimed ? 'وسام شرف موثق مسبقاً' : 'تم استخراج وتجهيز وسامك بنجاح'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    مخصص للحائز: <strong className="text-amber-300">{userName}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsGenerated(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-600/60 cursor-pointer"
                title="تعديل الاسم"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل الاسم</span>
              </button>
            </div>

            {/* Framed Canvas Artwork */}
            <div className="w-full max-w-xl mx-auto mb-5 relative group">
              <div className="p-2 sm:p-3 bg-gradient-to-b from-amber-500/20 via-slate-800/80 to-amber-700/20 rounded-2xl sm:rounded-3xl border-2 border-amber-400/40 shadow-2xl shadow-black/60 relative overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-auto h-auto max-h-[58vh] sm:max-h-[62vh] object-contain rounded-xl shadow-xl transition-transform duration-300 group-hover:scale-[1.01]"
                />
                {!isImageLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-10 gap-3">
                    <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-amber-200">جاري نقش الوسام بأعلى جودة...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5 text-center">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-2">
                <User className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-black text-slate-200 truncate">{userName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-black text-slate-200 truncate">{category === 'seerah' ? 'السيرة' : 'العامة'}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-slate-300">{currentDate}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-xl flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={downloadImage}
                disabled={!isImageLoaded || isDownloading}
                className="w-full sm:flex-1 py-4 px-6 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
              >
                <Download className={`w-5 h-5 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span>{isDownloading ? 'جاري التحميل...' : 'تحميل الشهادة فائقة الدقة'}</span>
              </button>

              <button
                onClick={handleShareCertificate}
                disabled={!isImageLoaded}
                className="w-full sm:w-auto py-4 px-6 bg-slate-800 hover:bg-slate-700/90 border border-slate-700 text-slate-200 hover:text-white rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <Share2 className="w-5 h-5 text-amber-400" />
                <span>مشاركة</span>
              </button>
            </div>

            {/* Subtle Footer Note */}
            <div className="mt-5 flex items-center justify-center gap-2 text-slate-500 font-medium text-xs">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>وسام تشجيعي ورقمي صُمم لتوثيق مسيرتك في مدارسة علوم القرآن والسنة.</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default CertificateGenerator;
