import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, Settings, Search, ChevronDown, Type, X } from 'lucide-react';
import { quranData } from '../services/QuranRepository';
import { QIRAAT } from './QiraatIndex';

interface QiraatReaderProps {
  qiraatId: string;
  initialSurahId?: number;
  onBack: () => void;
}

const QiraatReader: React.FC<QiraatReaderProps> = ({ qiraatId, initialSurahId = 1, onBack }) => {
  const [selectedSurah, setSelectedSurah] = useState(initialSurahId);
  const [fontSize, setFontSize] = useState(40);
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
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0"
      >
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 p-1.5 md:p-2 md:pr-4 rounded-xl hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100"
          >
            <ArrowRight className="w-6 h-6" />
            <span className="font-black text-sm hidden sm:inline">تغيير القارئ</span>
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block" />
          <div>
            <h1 className="text-base md:text-xl font-black text-slate-800">{qiraatName}</h1>
            <p className="text-[10px] md:text-xs font-bold text-emerald-600">{surahData?.name || 'سورة'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 md:p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold text-xs md:text-sm flex items-center gap-2"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">إعدادات العرض</span>
          </button>
        </div>
      </motion.header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Index (Desktop) */}
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
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${selectedSurah === s.id ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${selectedSurah === s.id ? 'bg-white/20' : 'bg-slate-100'
                    }`}>
                    {s.id}
                  </span>
                  <span className="font-bold">{s.name}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-white/40 custom-scrollbar p-4 pt-20 md:p-12 md:pt-16">
          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
            <div className="text-center space-y-6">
              <h2 className="text-4xl md:text-6xl font-black text-slate-800 font-quran">{surahData?.name}</h2>
              <div className="h-1 w-24 bg-emerald-500 mx-auto rounded-full" />
            </div>

            <div className="glass bg-white p-8 md:p-16 rounded-[2rem] md:rounded-[3.5rem] border border-slate-100 shadow-premium relative text-right" dir="rtl">
              <div 
                className="quran-text font-quran leading-[1.8] text-slate-800"
                style={{ fontSize: `${fontSize}px` }}
              >
                {surahData?.verses.map((v: any) => (
                  <span key={v.id} className="inline-block mb-8">
                    {v.text}
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 font-bold text-sm mx-3 align-middle">
                      {v.id}
                    </span>
                  </span>
                ))}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 p-8 flex flex-col gap-10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">إعدادات العرض</h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <label className="text-sm font-black text-slate-600">حجم الخط</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setFontSize(prev => Math.max(18, prev - 2))} className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all">-</button>
                  <span className="flex-1 text-center font-black text-xl text-slate-800">{fontSize}px</span>
                  <button onClick={() => setFontSize(prev => Math.min(80, prev + 2))} className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-all">+</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QiraatReader;