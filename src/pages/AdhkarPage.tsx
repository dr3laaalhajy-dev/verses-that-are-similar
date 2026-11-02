import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Settings, RotateCcw, Hash, XCircle, Sun, Moon,
  Compass, Home, Plane, BookOpen, CheckCircle, ArrowRight
} from 'lucide-react';
import { adhkarData } from '../services/AdhkarRepository';

export interface AdhkarPageProps {
  adhkarSearchQuery: string;
  setAdhkarSearchQuery: (query: string) => void;
  selectedAdhkarCategoryId: string | null;
  setSelectedAdhkarCategoryId: (id: string | null) => void;
  adhkarProgress: Record<string, number>;
  setAdhkarProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setIsSettingsOpen: (isOpen: boolean) => void;
  handleBackToHome: () => void;
}

export const AdhkarPage: React.FC<AdhkarPageProps> = ({
  adhkarSearchQuery,
  setAdhkarSearchQuery,
  selectedAdhkarCategoryId,
  setSelectedAdhkarCategoryId,
  adhkarProgress,
  setAdhkarProgress,
  setIsSettingsOpen,
  handleBackToHome
}) => {
  return (
    <motion.div
      key="adhkar"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500 pb-36 sm:pb-48"
    >
      {/* Adhkar Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold shadow-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-brand-emerald">أذكار المسلم</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">حصن المسلم اليومي المستحب</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={handleBackToHome}
            className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            الرئيسية
          </button>
        </div>
      </div>

      {/* Adhkar Search Bar - Only visible in the main categories list */}
      {!selectedAdhkarCategoryId && (
        <div className="max-w-2xl mx-auto w-full relative group animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-brand-emerald/40 group-focus-within:text-brand-emerald transition-colors">
            <Hash className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={adhkarSearchQuery}
            onChange={(e) => setAdhkarSearchQuery(e.target.value)}
            placeholder="ابحث عن أقسام الأذكار... (مثل: الصباح، النوم، المسجد)"
            className="w-full h-16 bg-white border-2 border-slate-100 rounded-3xl pr-14 pl-6 text-lg font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-emerald/50 focus:ring-4 focus:ring-brand-emerald/5 transition-all shadow-sm"
          />
          {adhkarSearchQuery && (
            <button
              onClick={() => setAdhkarSearchQuery('')}
              className="absolute inset-y-0 left-5 flex items-center text-slate-300 hover:text-red-500 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      <div className="w-full">
        {!selectedAdhkarCategoryId ? (
          /* القائمة الرئيسية المفلترة */
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
            {Object.values(adhkarData)
              .filter(cat => cat.title.toLowerCase().includes(adhkarSearchQuery.toLowerCase()))
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedAdhkarCategoryId(cat.id);
                    setAdhkarSearchQuery(''); // Clear search on selection
                  }}
                  className={`flex flex-col items-center gap-2 md:gap-3 px-1.5 py-4 md:p-6 rounded-xl md:rounded-[2rem] border transition-all duration-300 ${selectedAdhkarCategoryId === cat.id
                    ? 'bg-brand-emerald text-white border-brand-emerald shadow-lg -translate-y-1'
                    : 'bg-white text-slate-400 border-white/50 hover:border-brand-emerald/30 hover:text-brand-emerald shadow-sm'}`}
                >
                  <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${selectedAdhkarCategoryId === cat.id ? 'bg-white/20' : 'bg-slate-50'}`}>
                    {cat.icon === 'Sun' && <Sun className="w-5 h-5 md:w-6 md:h-6" />}
                    {cat.icon === 'Moon' && <Moon className="w-5 h-5 md:w-6 md:h-6" />}
                    {cat.icon === 'Mosque' && <Compass className="w-5 h-5 md:w-6 md:h-6" />}
                    {cat.icon === 'Home' && <Home className="w-5 h-5 md:w-6 md:h-6" />}
                    {cat.icon === 'Plane' && <Plane className="w-5 h-5 md:w-6 md:h-6" />}
                    {!['Sun', 'Moon', 'Mosque', 'Home', 'Plane'].includes(cat.icon) && <BookOpen className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                  <span className="font-black text-[10px] md:text-sm rtl leading-tight text-center">{cat.title}</span>
                </button>
              ))}
          </div>
        ) : (
          /* واجهة الأذكار المخصصة */
          <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* رأس الواجهة (العنوان) */}
            <div className="text-center mb-4">
              <h2 className="text-3xl font-black text-brand-emerald">
                {adhkarData[selectedAdhkarCategoryId].title}
              </h2>
            </div>

            <div className="grid gap-4">
              {adhkarData[selectedAdhkarCategoryId].items.map((dhikr) => (
                <motion.div
                  key={dhikr.id}
                  layout
                  className={`glass p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/50 relative overflow-hidden transition-all duration-500 cursor-pointer ${adhkarProgress[dhikr.id] === 0 ? 'opacity-60 grayscale' : 'hover:shadow-2xl active:scale-[0.98]'}`}
                  onClick={() => {
                    if (adhkarProgress[dhikr.id] === 0) return;
                    const currentCount = adhkarProgress[dhikr.id] ?? dhikr.count;
                    setAdhkarProgress(prev => ({ ...prev, [dhikr.id]: Math.max(0, currentCount - 1) }));
                    if (window.navigator.vibrate) window.navigator.vibrate(50);
                  }}
                >
                  {/* Progress Bar Background */}
                  <motion.div
                    className="absolute bottom-0 right-0 h-1 bg-brand-gold/20"
                    initial={{ width: '100%' }}
                    animate={{ width: `${((adhkarProgress[dhikr.id] ?? dhikr.count) / dhikr.count) * 100}%` }}
                  />

                  <div className="flex items-start justify-between gap-4 md:gap-8 relative z-10">
                    <div className="flex-1 space-y-4">
                      <p className="quran-text text-slate-800 leading-[1.6] md:leading-relaxed text-lg md:text-3xl">
                        {dhikr.text}
                      </p>
                      {(dhikr.description || dhikr.reference) && (
                        <div className="flex flex-wrap items-center gap-3">
                          {dhikr.description && (
                            <p className="px-3 py-1 rounded-full bg-brand-emerald/5 text-[10px] md:text-xs font-bold text-brand-emerald italic">
                              {dhikr.description}
                            </p>
                          )}
                          {dhikr.reference && (
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md">
                              {dhikr.reference}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        key={adhkarProgress[dhikr.id] ?? dhikr.count}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.8rem] flex flex-col items-center justify-center shadow-xl transition-all duration-500 ${adhkarProgress[dhikr.id] === 0 ? 'bg-green-500 text-white shadow-green-200 rotate-12 scale-110' : 'bg-white text-slate-800'}`}
                      >
                        {adhkarProgress[dhikr.id] === 0 ? (
                          <CheckCircle className="w-8 h-8" />
                        ) : (
                          <>
                            <span className="text-xl md:text-2xl font-black tabular-nums">{adhkarProgress[dhikr.id] ?? dhikr.count}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">تكرار</span>
                          </>
                        )}
                      </motion.div>
                      <div className={`text-[9px] font-black transition-all ${adhkarProgress[dhikr.id] === 0 ? 'text-green-600' : 'text-slate-400 opacity-50'}`}>
                        {adhkarProgress[dhikr.id] === 0 ? 'تم' : 'للعد'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* زر الرجوع السفلي (للعودة للقائمة) */}
            <button
              onClick={() => {
                setSelectedAdhkarCategoryId(null);
                // Scroll to top of the card
                document.querySelector('.adhkar-container')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="mt-8 w-full py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-3xl transition-all flex items-center justify-center gap-2 group"
            >
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              <span>الرجوع لواجهة الأدعية</span>
            </button>
          </div>
        )}
      </div>

      <div className="text-center pt-12 pb-8">
        <button
          onClick={() => setAdhkarProgress({})}
          className="group flex items-center gap-3 mx-auto px-8 py-3 rounded-full border border-slate-200 text-xs font-black text-slate-400 hover:text-brand-emerald hover:border-brand-emerald/30 transition-all active:scale-95"
        >
          <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
          إعادة تصفير جميع العدادات والمتابعة
        </button>
      </div>
    </motion.div>
  );
};

export default AdhkarPage;

