import React from 'react';
import { motion } from 'framer-motion';
import { Hash, BookOpen, Search, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { View } from '../types/challenges';
import { JUZ_NAMES_AR, ALL_QURAN_SURAHS } from '../services/JuzRepository';

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
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                2. نطاق الأسئلة (الأجزاء أو سور معينة)
              </label>

              {/* Mode toggle tabs */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto border border-slate-200/60 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSkillsScopeMode('juz')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    skillsScopeMode === 'juz'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-brand-gold" />
                  <span>حسب الأجزاء</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSkillsScopeMode('surah')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    skillsScopeMode === 'surah'
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
                  <span>سور معينة</span>
                </button>
              </div>
            </div>

            {skillsScopeMode === 'juz' ? (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-400">
                    اختر جزءاً أو عدة أجزاء لتخصيص التحدي:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSkillJuzs.length === 30) {
                        setSelectedSkillJuzs([]);
                      } else {
                        setSelectedSkillJuzs(Array.from({ length: 30 }, (_, i) => i + 1));
                      }
                    }}
                    className="text-xs font-black text-brand-gold hover:text-amber-700 transition-colors"
                  >
                    {selectedSkillJuzs.length === 30 ? 'إلغاء التحديد' : 'تحديد كامل القرآن (30 جزءاً)'}
                  </button>
                </div>

                {/* Quick selection status */}
                <div className="mb-3 flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>
                    {selectedSkillJuzs.length === 0
                      ? '📖 يتم التحدي في: كامل القرآن الكريم'
                      : selectedSkillJuzs.length === 30
                        ? '📖 يتم التحدي في: كامل القرآن (جميع الأجزاء)'
                        : `📖 تم تحديد ${selectedSkillJuzs.length} ${selectedSkillJuzs.length === 1 ? 'جزء' : 'أجزاء'}: (${selectedSkillJuzs.join(', ')})`}
                  </span>
                  {selectedSkillJuzs.length > 0 && selectedSkillJuzs.length < 30 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSkillJuzs([])}
                      className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline"
                    >
                      إعادة لكامل المصحف
                    </button>
                  )}
                </div>

                {/* 30 Juz Grid */}
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
                    const isSelected = selectedSkillJuzs.includes(juzNum);
                    return (
                      <button
                        key={juzNum}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSkillJuzs(selectedSkillJuzs.filter(j => j !== juzNum));
                          } else {
                            setSelectedSkillJuzs([...selectedSkillJuzs, juzNum].sort((a, b) => a - b));
                          }
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                          isSelected
                            ? 'bg-brand-gold text-white border-brand-gold shadow-xs scale-105'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-gold/50'
                        }`}
                        title={`الجزء ${JUZ_NAMES_AR[juzNum] || juzNum}`}
                      >
                        <span>{juzNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Search & Actions */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={skillSurahSearch}
                      onChange={(e) => setSkillSurahSearch(e.target.value)}
                      placeholder="ابحث عن سورة (مثال: الكهف، البقرة، 18)..."
                      className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold outline-none focus:border-brand-gold focus:bg-white dark:focus:bg-slate-800 transition-all text-right"
                    />
                    {skillSurahSearch && (
                      <button
                        type="button"
                        onClick={() => setSkillSurahSearch('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        مسح
                      </button>
                    )}
                  </div>

                  {selectedSkillSurahs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSkillSurahs([])}
                      className="text-xs font-black text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 transition-all shrink-0"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-slate-400">اختيارات سريعة:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const amma = ALL_QURAN_SURAHS.filter(s => s.id >= 78).map(s => s.name);
                      setSelectedSkillSurahs(amma);
                    }}
                    className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all"
                  >
                    جزء عمّ (قصار السور)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const longSurahs = ['البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف'];
                      setSelectedSkillSurahs(longSurahs);
                    }}
                    className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all"
                  >
                    السبع الطوال
                  </button>
                </div>

                {/* Selected Status */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span className="truncate">
                    {selectedSkillSurahs.length === 0
                      ? '📖 لم تحدد سوراً بعد (سيتم التحدي في كامل القرآن الكريم)'
                      : `📖 تم تحديد ${selectedSkillSurahs.length} ${selectedSkillSurahs.length === 1 ? 'سورة' : 'سور'}: ${selectedSkillSurahs.slice(0, 3).map(s => `سورة ${s}`).join('، ')}${selectedSkillSurahs.length > 3 ? ` و+${selectedSkillSurahs.length - 3}` : ''}`}
                  </span>
                  {selectedSkillSurahs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSkillSurahs([])}
                      className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline shrink-0 mr-2"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>

                {/* Surahs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
                  {filteredSurahsList.map((surah) => {
                    const isSelected = selectedSkillSurahs.includes(surah.name);
                    return (
                      <button
                        key={surah.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSkillSurahs(selectedSkillSurahs.filter(s => s !== surah.name));
                          } else {
                            setSelectedSkillSurahs([...selectedSkillSurahs, surah.name]);
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border text-right flex items-center justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-brand-gold text-white border-brand-gold shadow-xs scale-[1.02]'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-gold/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-black shrink-0 ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}>
                            {surah.id}
                          </span>
                          <span className="truncate">سورة {surah.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredSurahsList.length === 0 && (
                    <div className="col-span-full py-6 text-center text-xs font-bold text-slate-400">
                      لم يتم العثور على سورة مطابقة
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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
