import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, Settings, Search, ChevronDown, Type, Menu, X } from 'lucide-react';
import { quranData } from '../services/QuranRepository';
import { QIRAAT } from './QiraatIndex';

interface QiraatReaderProps {
  qiraatId: string;
  initialSurahId?: number;
  onBack: () => void;
}

const QiraatReader: React.FC<QiraatReaderProps> = ({ qiraatId, initialSurahId = 1, onBack }) => {
  const [selectedSurah, setSelectedSurah] = useState(initialSurahId);
  const [fontSize, setFontSize] = useState(window.innerWidth < 768 ? 22 : 28);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSurahMenuOpen, setIsSurahMenuOpen] = useState(false);

  const qiraatName = useMemo(() => {
    return QIRAAT.find(q => q.id === qiraatId)?.name || 'قراءة غير معروفة';
  }, [qiraatId]);

  const surahData = useMemo(() => {
    return quranData.find(s => s.id === selectedSurah);
  }, [selectedSurah]);

  const filteredSurahs = useMemo(() => {
    return quranData.filter(s => s.name.includes(searchTerm) || s.id.toString() === searchTerm);
  }, [searchTerm]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter" dir="rtl">
      {/* Header */}
      <motion.header 
        // @ts-ignore
        initial={{ y: -50 }}
        // @ts-ignore
        animate={{ y: 0 }}
        className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 p-2 pr-4 rounded-xl hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100"
          >
            <ArrowRight className="w-6 h-6" />
            <span className="font-black text-sm hidden sm:inline">تغيير القارئ</span>
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block" />
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-800">{qiraatName}</h1>
            <p className="text-[10px] md:text-xs font-bold text-emerald-600">{surahData?.name || 'سورة'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2.5 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold text-xs md:text-sm flex items-center gap-2"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">إعدادات العرض</span>
          </button>
        </div>
      </motion.header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Surah Menu Drawer */}
        <AnimatePresence>
          {isSurahMenuOpen && (
            <>
              <motion.div 
                // @ts-ignore
                initial={{ opacity: 0 }}
                // @ts-ignore
                animate={{ opacity: 1 }}
                // @ts-ignore
                exit={{ opacity: 0 }}
                onClick={() => setIsSurahMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] lg:hidden"
              />
              <motion.div 
                // @ts-ignore
                initial={{ x: '100%' }}
                // @ts-ignore
                animate={{ x: 0 }}
                // @ts-ignore
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-[101] flex flex-col lg:hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white pt-10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                     </div>
                     <h3 className="text-xl font-black text-slate-800">فهرس السور</h3>
                  </div>
                  <button 
                    onClick={() => setIsSurahMenuOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث عن سورة..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-sm font-bold bg-white"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {filteredSurahs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSurah(s.id);
                        setIsSurahMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                        selectedSurah === s.id ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                          selectedSurah === s.id ? 'bg-white/20' : 'bg-slate-100'
                        }`}>
                          {s.id}
                        </span>
                        <span className="font-bold">{s.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Sidebar - Surah Selection (Desktop) */}
        <aside className="w-80 hidden lg:flex flex-col bg-white border-l border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن سورة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-sm font-bold bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredSurahs.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSurah(s.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  selectedSurah === s.id ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                    selectedSurah === s.id ? 'bg-white/20' : 'bg-slate-100'
                  }`}>
                    {s.id}
                  </span>
                  <span className="font-bold">{s.name}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${selectedSurah === s.id ? '-rotate-90' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
        </aside>

        {/* Main Reader Content */}
        <main className="flex-1 overflow-y-auto bg-white/40 custom-scrollbar p-6 pt-24 md:p-12 md:pt-16">
          {/* Back Button for Navigation */}
          <div className="max-w-4xl mx-auto mb-6 flex justify-start">
            <button
              onClick={onBack}
              className="flex items-center gap-2 py-3 px-6 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:shadow-lg transition-all font-black text-xs md:text-sm group"
            >
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" />
              <span>رجوع لقائمة القراءات</span>
            </button>
          </div>

          {/* Mobile Surah Selector - Prominent Button */}
          <div className="max-w-4xl mx-auto mb-10 lg:hidden">
            <button
              onClick={() => setIsSurahMenuOpen(true)}
              className="w-full py-5 px-6 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <span>فهرس السور ☰</span>
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
            <div className="text-center space-y-4 md:space-y-6">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-600/20">
                <BookOpen className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-800 font-quran underline decoration-emerald-200 underline-offset-8 px-4">
                {surahData?.name}
              </h2>
              <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-xs md:text-sm uppercase tracking-widest">
                <span>{surahData?.type === 'Meccan' ? 'مكية' : 'مدنية'}</span>
                <span>•</span>
                <span>{surahData?.verses.length} آية</span>
              </div>
            </div>

            <div className="glass bg-white p-6 md:p-12 rounded-3xl md:rounded-[3.5rem] border border-slate-100 shadow-premium relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-40 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-50 rounded-full -ml-16 -mb-16 opacity-40 blur-2xl" />

              <div className="relative z-10 space-y-8 md:space-y-10">
                {selectedSurah !== 1 && selectedSurah !== 9 && (
                  <div className="text-center text-2xl md:text-4xl font-quran text-slate-800 pb-6 md:pb-8 border-b border-slate-100">
                    بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
                  </div>
                )}

                <div 
                  className="quran-text text-slate-800 leading-[2.2] md:leading-[2.5] text-justify space-x-reverse"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {surahData?.verses.map((v, i) => (
                    <React.Fragment key={i}>
                      <span className="hover:text-emerald-600 transition-colors cursor-default">
                        {v.text}
                      </span>
                      <span className="inline-flex items-center justify-center w-7 h-7 md:w-10 md:h-10 rounded-full border border-emerald-100 bg-emerald-50/50 text-emerald-600 font-bold text-[10px] md:text-sm mx-1.5 md:mx-3 decoration-none translate-y-1">
                        {i + 1}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Settings Overlay */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              // @ts-ignore
              initial={{ opacity: 0 }}
              // @ts-ignore
              animate={{ opacity: 1 }}
              // @ts-ignore
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40"
            />
            <motion.div 
              // @ts-ignore
              initial={{ x: 300 }}
              // @ts-ignore
              animate={{ x: 0 }}
              // @ts-ignore
              exit={{ x: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 p-8 flex flex-col gap-10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">إعدادات القراءة</h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    حجم الخط
                  </label>
                  <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl">
                    <button 
                      onClick={() => setFontSize(prev => Math.max(prev - 4, 16))}
                      className="w-12 h-12 rounded-xl bg-white text-slate-600 shadow-sm flex items-center justify-center font-bold text-xl"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center font-black text-slate-800 tabular-nums">
                      {fontSize}
                    </div>
                    <button 
                      onClick={() => setFontSize(prev => Math.min(prev + 4, 60))}
                      className="w-12 h-12 rounded-xl bg-white text-slate-600 shadow-sm flex items-center justify-center font-bold text-xl"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] md:text-xs font-bold text-emerald-800 leading-relaxed mb-4">
                    سيتم عرض النص القرآني بقراءات مختلفة تدريجياً حسب توفر قواعد البيانات الخاصة بكل راوي.
                  </p>
                  <div className="h-1 w-full bg-emerald-200/50 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      // @ts-ignore
                      initial={{ width: 0 }}
                      // @ts-ignore
                      animate={{ width: '60%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all active:scale-95 text-center"
                >
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
};

export default QiraatReader;
