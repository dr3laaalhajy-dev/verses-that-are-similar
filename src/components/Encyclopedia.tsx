import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, ExternalLink, Globe, Sparkles, ChevronLeft, ChevronRight, Layers, FileText, CheckCircle2 } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { quranData } from '../services/QuranRepository';

interface EncyclopediaProps {
  onBack: () => void;
  darkMode?: boolean;
}

const SECTION_OPTIONS = [
  { id: 'similar', label: 'المتشابهات القرآنية', icon: Layers },
  { id: 'tafsir', label: 'التفاسير المعتمدة', icon: BookOpen },
  { id: 'meanings', label: 'معاني الكلمات', icon: FileText },
  { id: 'e3rab', label: 'إعراب الآيات', icon: Sparkles },
  { id: 'qiraat', label: 'القراءات القرآنية', icon: Globe },
  { id: 'asbab', label: 'أسباب النزول', icon: CheckCircle2 },
];

const Encyclopedia: React.FC<EncyclopediaProps> = ({ onBack, darkMode = false }) => {
  const isNative = Capacitor.isNativePlatform();

  const [selectedSurahId, setSelectedSurahId] = useState<number>(2); // Default to Al-Baqarah
  const [selectedAyahNumber, setSelectedAyahNumber] = useState<number>(255); // Default to Ayat al-Kursi
  const [activeType, setActiveType] = useState<string>('similar');
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);

  const currentSurah = quranData.find(s => s.id === selectedSurahId) || quranData[0];
  const maxAyahs = currentSurah?.verses?.length || 286;

  const handleSurahChange = (newSurahId: number) => {
    setSelectedSurahId(newSurahId);
    setSelectedAyahNumber(1);
    setIsLoadingIframe(true);
  };

  const handleAyahChange = (newAyah: number) => {
    const clamped = Math.max(1, Math.min(maxAyahs, newAyah));
    setSelectedAyahNumber(clamped);
    setIsLoadingIframe(true);
  };

  const handleOpenExternal = async () => {
    const url = `https://quranpedia.net/surah/${selectedSurahId}?ayah_id=${selectedAyahNumber}`;
    try {
      if (isNative) {
        await Browser.open({
          url,
          presentationStyle: 'fullscreen',
          toolbarColor: darkMode ? '#0f172a' : '#064e3b',
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Embed URL using Quranpedia's official iframe-enabled API endpoint
  const embedUrl = `https://api.quranpedia.net/embed?surah=${selectedSurahId}&ayah=${selectedAyahNumber}&type=${activeType}&theme=${darkMode ? 'dark' : 'light'}&primary=064e3b`;

  return (
    <div className={`flex flex-col min-h-screen overflow-y-auto font-inter pb-36 sm:pb-48 transition-colors ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`} dir="rtl">
      {/* Top Navigation Bar */}
      <motion.header 
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`flex items-center justify-between px-3 sm:px-6 py-3.5 border-b shadow-sm z-30 shrink-0 transition-colors ${
          darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className={`group flex items-center gap-1.5 p-1.5 md:p-2 pr-2.5 md:pr-3.5 rounded-xl transition-all border cursor-pointer ${
              darkMode 
                ? 'hover:bg-slate-800 text-slate-200 hover:text-emerald-400 border-transparent hover:border-slate-700'
                : 'hover:bg-emerald-50 text-slate-600 hover:text-brand-emerald border-transparent hover:border-emerald-100'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
            <span className="font-black text-xs md:text-sm">العودة</span>
          </button>
          <div className={`h-6 md:h-8 w-px mx-1 hidden sm:block ${
            darkMode ? 'bg-slate-800' : 'bg-slate-200'
          }`} />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-emerald/10 text-brand-emerald dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className={`text-xs sm:text-base md:text-lg font-black leading-tight ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>موسوعة المتشابهات وعلوم القرآن</h1>
              <p className="text-[9px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                مدمجة مباشرة داخل التطبيق عبر QuranPedia
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenExternal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer ${
            darkMode
              ? 'bg-slate-800 text-slate-200 hover:text-emerald-400 border-slate-700 hover:border-emerald-600'
              : 'bg-white text-slate-700 hover:text-brand-emerald border-slate-200 hover:border-emerald-200 shadow-2xs'
          }`}
          title="فتح في نافذة متصفح مستقلة"
        >
          <ExternalLink className="w-3.5 h-3.5 text-brand-gold" />
          <span className="hidden sm:inline">نافذة خارجية</span>
        </button>
      </motion.header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* Interactive Controls Card: Surah, Ayah & Section Picker */}
        <div className={`p-3.5 sm:p-5 rounded-2xl md:rounded-3xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          {/* Row 1: Surah & Ayah Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-center">
            {/* Surah Selector */}
            <div className="sm:col-span-6 flex flex-col gap-1">
              <label className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400">اختر السورة (114 سورة):</label>
              <select
                value={selectedSurahId}
                onChange={(e) => handleSurahChange(Number(e.target.value))}
                className={`w-full p-2.5 rounded-xl font-bold text-xs sm:text-sm border outline-none transition-all cursor-pointer ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-100 focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-brand-emerald focus:bg-white'
                }`}
              >
                {quranData.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. سورة {s.name} ({s.verses.length} آية)
                  </option>
                ))}
              </select>
            </div>

            {/* Ayah Selector with Next / Prev Stepper */}
            <div className="sm:col-span-6 flex flex-col gap-1">
              <label className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400">
                رقم الآية (من 1 إلى {maxAyahs}):
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAyahChange(selectedAyahNumber - 1)}
                  disabled={selectedAyahNumber <= 1}
                  className={`p-2 rounded-xl border text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="الآية السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min={1}
                  max={maxAyahs}
                  value={selectedAyahNumber}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) handleAyahChange(val);
                  }}
                  className={`flex-1 p-2 rounded-xl text-center font-black text-sm sm:text-base border outline-none transition-all ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-emerald-400 focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-200 text-brand-emerald focus:border-brand-emerald focus:bg-white'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleAyahChange(selectedAyahNumber + 1)}
                  disabled={selectedAyahNumber >= maxAyahs}
                  className={`p-2 rounded-xl border text-xs font-black disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                  title="الآية التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Section Tabs (المتشابهات، التفسير، المعاني، إلخ) */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[10px] font-black text-slate-400 block mb-2">نوع المحتوى المطلوب:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {SECTION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = activeType === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setActiveType(opt.id);
                      setIsLoadingIframe(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                      isSelected
                        ? (darkMode 
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40' 
                            : 'bg-brand-emerald text-white shadow-md shadow-emerald-900/15')
                        : (darkMode
                            ? 'bg-slate-800/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700'
                            : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/60')
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* The Embedded Iframe Container */}
        <div className={`relative w-full rounded-2xl md:rounded-3xl border overflow-hidden shadow-lg transition-colors min-h-[480px] sm:min-h-[620px] md:min-h-[750px] ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          {/* Loading Indicator */}
          {isLoadingIframe && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 animate-pulse">
                جاري تحميل محتوى الموسوعة...
              </p>
            </div>
          )}

          {/* IFrame embedding QuranPedia Official Embed API */}
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={`موسوعة المتشابهات - سورة ${currentSurah.name} آية ${selectedAyahNumber}`}
            className="w-full h-[480px] sm:h-[620px] md:h-[750px] border-none"
            onLoad={() => setIsLoadingIframe(false)}
            allow="fullscreen"
          />
        </div>
      </main>
    </div>
  );
};

export default Encyclopedia;
