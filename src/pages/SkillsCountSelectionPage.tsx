import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { View } from '../types/challenges';
import { ScopeSelector } from '../components/challenge/ScopeSelector';

export interface SkillsCountSelectionPageProps {
  skillsType: any;
  selectedSkillCount: number;
  setSelectedSkillCount: (count: number) => void;
  skillsScopeMode: 'juz' | 'surah';
  setSkillsScopeMode: (mode: 'juz' | 'surah') => void;
  selectedSkillJuzs: number[];
  setSelectedSkillJuzs: React.Dispatch<React.SetStateAction<number[]>>;
  skillSurahSearch: string;
  setSkillSurahSearch: (search: string) => void;
  selectedSkillSurahs: string[];
  setSelectedSkillSurahs: React.Dispatch<React.SetStateAction<string[]>>;
  filteredSurahsList: any[];
  handleStartSkillsSession: (count: number, juzs?: number[], surahs?: string[]) => void;
  setView: (view: View) => void;
}

export const SkillsCountSelectionPage: React.FC<SkillsCountSelectionPageProps> = ({
  skillsType,
  selectedSkillCount,
  setSelectedSkillCount,
  skillsScopeMode,
  setSkillsScopeMode,
  selectedSkillJuzs,
  setSelectedSkillJuzs,
  skillSurahSearch,
  setSkillSurahSearch,
  selectedSkillSurahs,
  setSelectedSkillSurahs,
  filteredSurahsList,
  handleStartSkillsSession,
  setView
}) => {
  if (skillsType === 'complete') {
    return (
      <motion.div
        key="skills_complete_selection"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="max-w-2xl mx-auto py-6 md:py-8 px-4"
      >
        <div className="glass bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border-2 border-brand-gold/30 shadow-xl space-y-6">
          {/* Header */}
          <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 rounded-full border border-amber-200 dark:border-amber-800/60">
              تحدي إكمال الآية
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
              إعدادات التحدي وتحديد الأجزاء
            </h2>
            <p className="text-slate-400 font-bold text-xs md:text-sm mt-1">
              حدد عدد الأسئلة والأجزاء التي تود التحدي في آياتها
            </p>
          </div>

          {/* 1. عدد الأسئلة */}
          <div>
            <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-wider text-right">
              1. عدد الأسئلة
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSelectedSkillCount(num)}
                  className={`py-3.5 px-2 rounded-2xl border-2 font-black text-center transition-all ${
                    selectedSkillCount === num
                      ? 'border-brand-gold bg-brand-gold text-white shadow-lg shadow-brand-gold/20 scale-[1.02]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-xl block">{num}</span>
                  <span className="text-[10px] opacity-80">أسئلة</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. نطاق التحدي (الأجزاء أو السور) */}
          <ScopeSelector
            scopeMode={skillsScopeMode}
            setScopeMode={setSkillsScopeMode}
            selectedJuzs={selectedSkillJuzs}
            setSelectedJuzs={setSelectedSkillJuzs}
            selectedSurahs={selectedSkillSurahs}
            setSelectedSurahs={setSelectedSkillSurahs}
            surahSearch={skillSurahSearch}
            setSurahSearch={setSkillSurahSearch}
            title="2. نطاق الأسئلة (الأجزاء أو سور معينة)"
            description="اختر أجزاء أو سور معينة لحصر أسئلة التحدي داخلها"
          />

          {/* Actions */}
          <div className="pt-2 space-y-3">
            <button
              type="button"
              onClick={() => {
                if (skillsScopeMode === 'juz') {
                  handleStartSkillsSession(selectedSkillCount, selectedSkillJuzs, undefined);
                } else {
                  handleStartSkillsSession(selectedSkillCount, undefined, selectedSkillSurahs);
                }
              }}
              className="w-full py-4 bg-brand-gold hover:bg-amber-600 text-white rounded-2xl font-black text-base shadow-xl shadow-brand-gold/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>
                ابدأ تحدي إكمال الآية ({selectedSkillCount} أسئلة)
                {skillsScopeMode === 'surah' && selectedSkillSurahs.length > 0 
                  ? ` • ${selectedSkillSurahs.length} سور` 
                  : skillsScopeMode === 'juz' && selectedSkillJuzs.length > 0 && selectedSkillJuzs.length < 30 
                    ? ` • ${selectedSkillJuzs.length} أجزاء` 
                    : ' • كامل القرآن'}
              </span>
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setView('skills_menu')}
              className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs md:text-sm flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للأوضاع</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="skills_count_selection"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-xl mx-auto py-6 md:py-8 px-4 text-center"
    >
      <h2 className="text-xl md:text-2xl font-black text-brand-emerald mb-1">اختر عدد الأسئلة</h2>
      <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">كم عدد الأسئلة التي تود التحدي فيها؟</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[5, 10, 15, 20].map((count) => (
          <button
            key={count}
            onClick={() => handleStartSkillsSession(count)}
            className="glass bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border-2 border-slate-150 dark:border-slate-700 hover:border-brand-emerald/30 dark:hover:border-emerald-500/50 hover:shadow-lg transition-all group active:scale-95"
          >
            <span className="text-3xl md:text-4xl font-black text-brand-emerald dark:text-emerald-400 block mb-1">{count}</span>
            <span className="text-slate-500 dark:text-slate-300 font-bold text-xs md:text-sm">سؤال</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setView('skills_menu')}
        className="mt-6 text-slate-400 font-bold hover:text-brand-emerald transition-colors flex items-center gap-1.5 mx-auto text-xs md:text-sm"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للأوضاع
      </button>
    </motion.div>
  );
};

export default SkillsCountSelectionPage;

