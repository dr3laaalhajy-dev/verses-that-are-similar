import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Copy, Share2, Sparkles, Check, BookOpen, X, RefreshCw } from 'lucide-react';
import { quranData } from '../services/QuranRepository';
import { normalizeQuranTashkeel } from '../utils/quranUtils';
import { normalizeArabicText } from '../utils/arabic';

interface AyahData {
  text: string;
  surah: string;
  number: number;
  surahNumber?: number;
  tafsir: string;
}

// Clean and normalize Surah title so it renders seamlessly in UI fonts without font fallback
export const cleanSurahTitle = (surahStr: string, surahNumber?: number): string => {
  if (!surahStr) return '';
  // If surahNumber is known, get exact clean name from local quranData
  if (surahNumber && surahNumber >= 1 && surahNumber <= 114) {
    const found = quranData.find((s: any) => s.id === surahNumber);
    if (found) return `سورة ${found.name}`;
  }
  // Otherwise normalize and look up by simplified name
  const normalized = normalizeQuranTashkeel(surahStr);
  const simplified = normalizeArabicText(normalized).replace(/^سوره\s+/, '').trim();
  const found = quranData.find((s: any) => normalizeArabicText(s.name).trim() === simplified);
  if (found) return `سورة ${found.name}`;

  // Fallback: replace Quranic sukoon and ensure clean title
  return normalized.replace(/^سُورَةُ\s+/, 'سورة ');
};

// Helper to get local date string YYYY-MM-DD
const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Deterministic hash to map a date string consistently to a Quran ayah (1..6236)
const getDailyAyahNumber = (dateStr: string) => {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) & 0x7fffffff;
  }
  return (hash % 6236) + 1;
};

const DailyAyah: React.FC = () => {
  const [currentAyah, setCurrentAyah] = useState<AyahData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const todayKey = getTodayKey();
      return localStorage.getItem('quran_daily_ayah_hidden_date') !== todayKey;
    } catch {
      return true;
    }
  });
  const [isTafsirModalOpen, setIsTafsirModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAyah = async (ayahNumber: number, saveToStorage = true) => {
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayahNumber}/editions/quran-uthmani,ar.muyassar`);
      const json = await response.json();

      if (json.code === 200 && json.data && json.data.length === 2) {
        const surahNum = json.data[0].surah?.number;
        const cleanSurah = cleanSurahTitle(json.data[0].surah.name, surahNum);
        const ayahObj: AyahData = {
          text: normalizeQuranTashkeel(json.data[0].text),
          surah: cleanSurah,
          number: json.data[0].numberInSurah,
          surahNumber: surahNum,
          tafsir: json.data[1].text
        };
        setCurrentAyah(ayahObj);
        if (saveToStorage) {
          localStorage.setItem('quran_daily_ayah_date', getTodayKey());
          localStorage.setItem('quran_daily_ayah_data', JSON.stringify(ayahObj));
        }
        return true;
      }
    } catch (error) {
      console.error("Error fetching daily ayah from network:", error);
    }

    // Offline / fallback using local quranData
    try {
      let count = 0;
      for (const surah of quranData) {
        if (count + surah.verses.length >= ayahNumber) {
          const verseIdx = ayahNumber - count - 1;
          const verse = surah.verses[verseIdx] || surah.verses[0];
          const fallbackAyah: AyahData = {
            text: normalizeQuranTashkeel(verse.text),
            surah: `سورة ${surah.name}`,
            number: verse.id,
            surahNumber: surah.id,
            tafsir: 'تفسير الآية متاح عبر المصحف الشريف.'
          };
          setCurrentAyah(fallbackAyah);
          if (saveToStorage) {
            localStorage.setItem('quran_daily_ayah_date', getTodayKey());
            localStorage.setItem('quran_daily_ayah_data', JSON.stringify(fallbackAyah));
          }
          return true;
        }
        count += surah.verses.length;
      }
    } catch (e) {
      console.error("Local fallback error:", e);
    }
    return false;
  };

  useEffect(() => {
    const loadDailyAyah = async () => {
      const todayKey = getTodayKey();
      try {
        const cachedDate = localStorage.getItem('quran_daily_ayah_date');
        const cachedData = localStorage.getItem('quran_daily_ayah_data');

        if (cachedDate === todayKey && cachedData) {
          const parsed = JSON.parse(cachedData);
          parsed.text = normalizeQuranTashkeel(parsed.text);
          parsed.surah = cleanSurahTitle(parsed.surah, parsed.surahNumber);
          setCurrentAyah(parsed);
          setLoading(false);
          return;
        }

        const ayahNumber = getDailyAyahNumber(todayKey);
        await fetchAyah(ayahNumber, true);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadDailyAyah();
  }, []);

  const handleNextAyah = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const newAyahNum = Math.floor(Math.random() * 6236) + 1;
    await fetchAyah(newAyahNum, true);
    setIsRefreshing(false);
  };

  const handleHide = () => {
    setIsOpen(false);
    try {
      localStorage.setItem('quran_daily_ayah_hidden_date', getTodayKey());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = () => {
    if (!currentAyah) return;
    const surahTitle = cleanSurahTitle(currentAyah.surah, currentAyah.surahNumber);
    const shareText = `"${currentAyah.text}"\n${surahTitle} - آية ${currentAyah.number}\n\nتطبيق متين`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!currentAyah) return;
    const surahTitle = cleanSurahTitle(currentAyah.surah, currentAyah.surahNumber);
    const shareText = `"${currentAyah.text}"\n${surahTitle} - آية ${currentAyah.number}`;
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
      <div className="sticky top-[52px] sm:top-[60px] md:top-[56px] z-40 w-full max-w-5xl mx-auto px-3 sm:px-6 py-2 pointer-events-none">
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              className="pointer-events-auto relative group w-full"
            >
              <div className="relative glass p-3.5 md:p-3.5 md:px-7 rounded-[2rem] md:rounded-full border border-slate-200/80 shadow-xl flex flex-col md:flex-row items-center gap-3 md:gap-6 bg-white/95 backdrop-blur-2xl transition-all duration-500">

                {/* Mobile Section: Label & Close Icon */}
                <div className="flex items-center justify-between w-full md:w-auto md:border-r border-slate-100 md:pr-6 md:shrink-0 pb-2 md:pb-0 border-b md:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 md:w-9 md:h-9 bg-emerald-50 text-emerald-700 rounded-lg md:rounded-xl flex items-center justify-center shadow-inner">
                      <Quote className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-emerald-800">آية اليوم</span>
                    </div>
                  </div>

                  <button
                    onClick={handleHide}
                    className="md:hidden p-1.5 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-slate-100"
                    title="إخفاء لهذا اليوم"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Content: The Ayah Text */}
                <div className="flex-1 min-w-0 py-1 md:py-0 w-full md:w-auto text-center md:text-right">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={currentAyah.text}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="!text-lg md:!text-xl lg:!text-2xl text-slate-800 leading-relaxed text-center !font-quran font-normal !tracking-normal"
                      dir="rtl"
                      style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                    >
                      {currentAyah.text}
                    </motion.h2>
                  </AnimatePresence>
                  <div className="mt-1 flex items-center justify-center md:justify-start gap-1.5">
                    <span className="!text-[10px] md:!text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200/60 px-2.5 py-0.5 rounded-full" dir="rtl">
                      {cleanSurahTitle(currentAyah.surah, currentAyah.surahNumber)} • آية {currentAyah.number}
                    </span>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 md:border-l border-slate-100 md:pl-6 shrink-0 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 flex-wrap">
                  <button
                    onClick={() => setIsTafsirModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 md:py-2 bg-emerald-50 text-emerald-700 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all shadow-sm"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>التفسير</span>
                  </button>

                  <button
                    onClick={handleNextAyah}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 md:py-2 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 disabled:opacity-60"
                    title="إظهار آية أخرى"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>آية أخرى</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="p-1.5 md:p-2 bg-white border border-slate-200/70 text-slate-600 rounded-xl hover:bg-emerald-50 transition-all shadow-sm"
                    title="نسخ"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-1.5 md:p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all"
                    title="مشاركة"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <div className="hidden md:block w-px h-5 bg-slate-200 mx-1" />

                  <button
                    onClick={handleHide}
                    className="hidden md:block px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-red-500 rounded-lg transition-all"
                    title="إخفاء لهذا اليوم"
                  >
                    إخفاء
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex justify-start pointer-events-auto">
              <motion.button
                key="minimized"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700/95 text-white rounded-xl shadow-xl shadow-emerald-950/20 hover:bg-emerald-800 active:scale-95 transition-all text-xs font-bold group border border-white/20"
                title="عرض آية اليوم"
              >
                <Quote className="w-3.5 h-3.5 text-emerald-200" />
                <span>آية اليوم</span>
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Tafsir Modal */}
      <AnimatePresence>
        {isTafsirModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-10 max-w-2xl w-full shadow-2xl relative overflow-hidden text-center islamic-watermark border border-emerald-100 max-h-[90vh] overflow-y-auto"
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
                      [{cleanSurahTitle(currentAyah.surah, currentAyah.surahNumber)} • {currentAyah.number}]
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
