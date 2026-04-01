import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Copy, Share2, Sparkles, Check, BookOpen, X } from 'lucide-react';

interface AyahData {
  text: string;
  surah: string;
  number: number;
  tafsir: string;
}

const DailyAyah: React.FC = () => {
  const [currentAyah, setCurrentAyah] = useState<AyahData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isTafsirModalOpen, setIsTafsirModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyAyah = async () => {
      try {
        const randomNumber = Math.floor(Math.random() * 6236) + 1;
        // جلب النسخة العثمانية + التفسير الميسر ( Muyassar) لضمان الدقة
        const response = await fetch(`https://api.alquran.cloud/v1/ayah/${randomNumber}/editions/quran-uthmani,ar.muyassar`);
        const json = await response.json();

        if (json.code === 200 && json.data && json.data.length === 2) {
          setCurrentAyah({
            text: json.data[0].text, // نص الآية بالعثماني
            surah: json.data[0].surah.name, // الاسم يضم "سُورَةُ" جاهزاً
            number: json.data[0].numberInSurah,
            tafsir: json.data[1].text // نص التفسير الميسر
          });
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching ayah:", error);
        setLoading(false);
      }
    };
    fetchDailyAyah();
  }, []);

  const handleCopy = () => {
    if (!currentAyah) return;
    const shareText = `"${currentAyah.text}"\n${currentAyah.surah} - آية ${currentAyah.number}\n\nتطبيق المتشابهات القرآنية`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!currentAyah) return;
    const shareText = `"${currentAyah.text}"\n${currentAyah.surah} - آية ${currentAyah.number}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'آية اليوم',
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  if (loading) return null;
  if (!currentAyah) return null;

  return (
    <>
      <div className="fixed top-6 left-6 z-[100] pointer-events-none">
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              className="pointer-events-auto relative group max-w-[95vw] md:max-w-4xl"
            >
              <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full scale-105" />

              <div className="relative glass p-3 md:p-5 rounded-2xl md:rounded-[2rem] border-emerald-100/50 shadow-2xl flex flex-col md:flex-row items-center gap-2 md:gap-8 bg-white/95 backdrop-blur-xl islamic-watermark-small transition-all duration-500">

                {/* Mobile Section: Label & Close Icon */}
                <div className="flex items-center justify-between w-full md:w-auto md:border-r border-slate-100 md:pr-6 md:shrink-0 pb-2 md:pb-0 border-b md:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100/50 text-emerald-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner">
                      <Quote className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">آية اليوم</span>
                      <Sparkles className="w-2 h-2 text-brand-gold animate-pulse mt-0.5" />
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="md:hidden p-1.5 text-slate-500 hover:text-red-500 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content: The Ayah Text */}
                <div className="flex-1 min-w-0 py-1 md:py-0 w-full md:w-auto text-center md:text-right">
                  <h2
                    className="!text-xl md:!text-2xl lg:!text-3xl text-slate-800 leading-normal text-center !font-quran font-normal !tracking-normal"
                    dir="rtl"
                    style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                  >
                    {currentAyah.text}
                  </h2>
                  <div className="mt-0.5 flex items-center justify-center md:justify-start gap-1.5">
                    <span className="!text-[7px] md:!text-[8px] lg:!text-[9px] font-medium text-slate-700 bg-emerald-50 px-2 py-0.5 rounded-full" dir="rtl">
                      {currentAyah.surah} • {currentAyah.number}
                    </span>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex items-center justify-center gap-1.5 md:gap-2 md:border-l border-slate-100 md:pl-6 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0">
                  <button
                    onClick={() => setIsTafsirModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2.5 bg-emerald-50 text-emerald-700 rounded-lg md:rounded-xl font-black text-[10px] md:text-xs hover:bg-emerald-100 transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>التفسير</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 md:p-2.5 bg-white border border-slate-100 text-slate-400 rounded-lg md:rounded-xl hover:bg-emerald-50 transition-all"
                    title="نسخ"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-1.5 md:p-2.5 bg-emerald-600 text-white rounded-lg md:rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                    title="مشاركة"
                  >
                    <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>

                  <div className="hidden md:block w-px h-6 bg-slate-100 mx-1" />

                  <button
                    onClick={() => setIsOpen(false)}
                    className="hidden md:block px-2 py-2 text-[10px] md:text-[10px] font-black text-slate-400 hover:text-red-500 rounded-lg transition-all"
                  >
                    إخفاء
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="minimized"
              initial={{ opacity: 0, scale: 0.5, x: -50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: -50 }}
              onClick={() => setIsOpen(true)}
              className="pointer-events-auto w-10 h-10 md:w-12 md:h-12 bg-emerald-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all group relative"
            >
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
              <div className="absolute top-1/2 left-full -translate-y-1/2 ml-3 bg-slate-800 text-white text-[9px] md:text-[10px] font-black px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                آية اليوم
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Tafsir Modal */}
      <AnimatePresence>
        {isTafsirModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-10 max-w-2xl w-full shadow-2xl relative overflow-hidden text-center islamic-watermark border border-emerald-100"
            >
              <div className="relative z-10">
                <button
                  onClick={() => setIsTafsirModalOpen(false)}
                  className="absolute top-0 left-0 p-2 md:p-3 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-6 h-6 md:w-8 md:h-8" />
                </button>

                <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-8 text-emerald-600">
                  <BookOpen className="w-6 h-6 md:w-8 md:h-8" />
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-4">تفسير السعدي</h2>
                <div className="h-1 w-16 md:w-20 bg-emerald-100 rounded-full mx-auto mb-6 md:mb-8" />

                <div className="max-h-[50vh] md:max-h-[60vh] overflow-y-auto px-2 md:px-4 custom-scrollbar">
                  {/* قسم الآية العلوية */}
                  <div className="text-center mb-6">
                    <p
                      className="!text-2xl md:!text-3xl text-slate-800 leading-relaxed !font-quran font-normal !tracking-normal"
                      dir="rtl"
                      style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                    >
                      {currentAyah.text}
                    </p>
                    <p className="text-sm font-bold text-emerald-600 mt-4" dir="rtl">
                      [{currentAyah.surah} • {currentAyah.number}]
                    </p>
                  </div>

                  {/* قسم التفسير السفلي - التفسير الميسر */}
                  <div className="mt-6 p-5 bg-slate-50 rounded-xl border-r-4 border-emerald-500 text-right">
                    <p className="text-xs font-bold text-slate-500 mb-2">التفسير (الميسر):</p>
                    <p
                      className="text-lg md:text-xl text-slate-700 leading-relaxed !font-quran font-normal !tracking-normal"
                      dir="rtl"
                      style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                    >
                      {currentAyah.tafsir}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsTafsirModalOpen(false)}
                  className="mt-6 md:mt-10 w-full py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-md md:text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                >
                  حسناً، فهمت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DailyAyah;
