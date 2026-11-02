import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Settings, RotateCcw, ChevronLeft } from 'lucide-react';
import { HADITHS, Hadith } from '../services/HadithRepository';

export interface HadithPageProps {
  setSelectedHadith: (hadith: Hadith) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  handleBackToHome: () => void;
}

export const HadithPage: React.FC<HadithPageProps> = ({
  setSelectedHadith,
  setIsSettingsOpen,
  handleBackToHome
}) => {
  return (
    <motion.div
      key="hadith"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500 pb-36 sm:pb-48"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
            <Quote className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-teal-900 font-quran">الأربعون النووية</h2>
            <p className="text-slate-400 font-bold text-sm mt-1">من جوامع كلم النبي ﷺ</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {HADITHS.map((hadith) => (
          <motion.button
            key={hadith.id}
            whileHover={{ scale: 1.02, y: -5 }}
            onClick={() => setSelectedHadith(hadith)}
            className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border border-white/50 text-right flex flex-col gap-3 md:gap-4 hover:shadow-2xl transition-all group relative overflow-hidden items-start"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500/10 group-hover:bg-teal-500 transition-colors" />
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 font-black group-hover:bg-teal-600 group-hover:text-white transition-colors text-sm md:text-base">
              {hadith.id}
            </div>
            <div className="flex-1 w-full text-right">
              <div className="text-base md:text-xl font-black text-slate-800 font-quran line-clamp-2">{hadith.title}</div>
              <p className="text-slate-500 font-medium text-[10px] md:text-sm mt-2 line-clamp-2 leading-relaxed md:leading-loose">
                {hadith.hadith.split('\n').filter(l => l.trim()).slice(1, 4).join(' ')}...
              </p>
            </div>
            <div className="w-full h-px bg-slate-50 my-1 md:my-2" />
            <div className="flex items-center justify-between w-full">
              <span className="text-[8px] md:text-[10px] font-black text-teal-600 uppercase tracking-widest">عرض الحديث وشرحه</span>
              <ChevronLeft className="w-4 h-4 text-teal-400 group-hover:translate-x-[-4px] transition-transform" />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default HadithPage;
