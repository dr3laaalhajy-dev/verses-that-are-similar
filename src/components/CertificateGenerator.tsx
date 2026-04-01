import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Award, CheckCircle2, User, Share2, Info } from 'lucide-react';

interface CertificateGeneratorProps {
  onClose: () => void;
  category: string;
}

const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({ onClose, category }) => {
  // Initialize with saved name if available
  const [userName, setUserName] = useState(() => localStorage.getItem('quran_user_name') || '');
  const [isGenerated, setIsGenerated] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const categoryNames: Record<string, string> = {
    seerah: 'السيرة النبوية',
    general: 'الأسئلة العامة',
    quran: 'المتشابهات القرآنية'
  };

  // 1. Template-Based Drawing Logic
  const drawCertificate = () => {
    if (!userName.trim() || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prepare Dynamic Variables
    const savedName = localStorage.getItem('quran_user_name') || 'بطل التحدي';
    const finalUserName = userName.trim() || savedName;

    let categoryTitle = '';
    let categoryDetails = '';

    if (category === 'seerah') {
      categoryTitle = 'تحدي السيرة النبوية';
      categoryDetails = '3 مجموعات متتالية - 60 سؤالاً';
    } else {
      categoryTitle = 'الأسئلة العامة';
      categoryDetails = '5 مجموعات متتالية - 100 سؤالاً';
    }

    const currentDate = new Date().toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const img = new Image();
    img.src = '/certificate-bg.jpg';

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Text Overlay Configuration & Premium Typography
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';

      // Line 1: Congratulations and Name
      ctx.font = `bold ${Math.floor(canvas.width * 0.045)}px "Tajawal", "Cairo", Arial, sans-serif`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`بارك الله فيك يا ${finalUserName}!`, canvas.width / 2, canvas.height * 0.67);

      // Line 2: Achievement Title
      ctx.font = `600 ${Math.floor(canvas.width * 0.028)}px "Tajawal", "Cairo", Arial, sans-serif`;
      ctx.fillStyle = '#334155';
      ctx.fillText(`أتممت بنجاح كافة مجموعات [${categoryTitle}]`, canvas.width / 2, canvas.height * 0.72);

      // Line 3: Achievement Details
      ctx.font = `500 ${Math.floor(canvas.width * 0.024)}px "Tajawal", "Cairo", Arial, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.fillText(`(${categoryDetails})`, canvas.width / 2, canvas.height * 0.76);

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

    img.onerror = () => {
      console.error('Failed to load certificate template');
      canvas.width = 1200;
      canvas.height = 840;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 1200, 840);
      ctx.fillStyle = '#ef4444';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('خطأ في تحميل قالب الشهادة', 600, 420);
    };
  };

  useEffect(() => {
    if (isGenerated) {
      const timer = setTimeout(drawCertificate, 100);
      return () => clearTimeout(timer);
    }
  }, [isGenerated]);

  const handleGenerate = () => {
    if (userName.trim()) {
      setIsGenerated(true);
      localStorage.setItem('quran_user_name', userName);
    }
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `وسام_الإنجاز_${userName || 'التحدي'}.jpg`;
    link.href = canvasRef.current.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const handleShareCertificate = async () => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const file = new File([blob], "achievement.jpg", { type: "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'وسام الإنجاز',
            text: 'لقد أتممت التحدي في تطبيق المتشابهات القرآنية! هل يمكنك التفوق علي؟ 🏆 جرب التطبيق من هنا: https://quran-quiz-challenge.vercel.app',
          });
        } else {
          alert('عذراً، متصفحك لا يدعم المشاركة المباشرة للصور. يرجى تحميل الوسام ومشاركته يدوياً.');
        }
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/95 rounded-[3rem] w-full max-w-4xl p-6 md:p-10 relative shadow-2xl overflow-y-auto max-h-[90vh] my-8"
      >
        <button
          onClick={onClose}
          className="absolute top-6 left-6 p-2 text-slate-400 hover:text-red-500 transition-colors z-10"
        >
          <X className="w-8 h-8" />
        </button>

        <div className="relative z-10 text-center">
          {!isGenerated ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="max-w-md mx-auto py-8"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-emerald-600 shadow-sm relative group">
                <Award className="w-10 h-10 transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full scale-150 animate-pulse" />
              </div>

              <h2 className="text-3xl font-black text-brand-emerald mb-4">أهلاً بك يا بطل!</h2>
              <p className="text-slate-500 font-bold mb-8 italic">اكتب اسمك الثلاثي كما تحب أن يظهر في وسام الإنجاز</p>

              <div className="relative mb-8">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="الاسم الكامل..."
                  dir="rtl"
                  className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-xl font-black text-slate-800 placeholder:text-slate-300 focus:border-emerald-500 focus:outline-none transition-all pr-12 shadow-inner"
                />
                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6" />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!userName.trim()}
                className="w-full py-5 bg-linear-to-r from-emerald-600 to-emerald-800 text-white rounded-2xl font-black text-xl hover:shadow-xl hover:shadow-emerald-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
              >
                <span>استخراج وسام الإنجاز</span>
                <CheckCircle2 className="w-6 h-6" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full flex flex-col items-center"
            >
              <div className="mb-6 p-4 bg-emerald-50 rounded-2xl inline-flex items-center gap-2 text-emerald-700 font-black">
                <CheckCircle2 className="w-5 h-5" />
                <span>تم تجهيز وسامك بنجاح!</span>
              </div>

              <div className="w-full overflow-hidden rounded-2xl shadow-2xl border-4 border-white mb-6 relative group">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto max-h-[65vh] md:max-h-[75vh] object-contain mx-auto shadow-2xl rounded-lg cursor-zoom-in"
                  style={{ maxWidth: '100%' }}
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors pointer-events-none" />
              </div>

              <div className="w-full max-w-2xl mb-8 p-4 bg-amber-50 text-amber-800 text-xs md:text-sm rounded-xl border border-amber-200 text-center font-bold leading-relaxed shadow-sm flex items-center gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  ⚠️ تنبيه هام: هذا الوسام رقمي وتذكاري صمم للمشاركة وإظهار التقدم الشخصي. وهو ليس شهادة رسمية معتمدة.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4 w-full">
                <button
                  onClick={downloadImage}
                  className="flex-1 flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-3xl font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95"
                >
                  <Download className="w-6 h-6" />
                  <span>تحميل الوسام</span>
                </button>

                <button
                  onClick={handleShareCertificate}
                  className="flex-1 flex items-center justify-center gap-3 py-5 bg-white border-2 border-emerald-500 text-emerald-600 rounded-3xl font-black text-xl hover:bg-emerald-50 transition-all active:scale-95"
                >
                  <Share2 className="w-6 h-6" />
                  <span>مشاركة</span>
                </button>

                <button
                  onClick={onClose}
                  className="sm:w-auto px-8 flex items-center justify-center py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  <span>الرجوع</span>
                </button>
              </div>

              <div className="mt-8 flex items-center gap-2 text-slate-400 font-bold text-sm">
                <Share2 className="w-4 h-4" />
                <span>شارك نجاحك مع أصدقائك عبر المتصفح</span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CertificateGenerator;
