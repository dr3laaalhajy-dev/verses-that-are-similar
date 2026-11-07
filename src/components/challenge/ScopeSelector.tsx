import React, { useMemo } from 'react';
import { Hash, BookOpen, Search, Check } from 'lucide-react';
import { ALL_QURAN_SURAHS, JUZ_NAMES_AR } from '../../services/JuzRepository';

export interface ScopeSelectorProps {
  scopeMode: 'juz' | 'surah';
  setScopeMode: (mode: 'juz' | 'surah') => void;
  selectedJuzs: number[];
  setSelectedJuzs: React.Dispatch<React.SetStateAction<number[]>> | ((juzs: number[] | ((prev: number[]) => number[])) => void);
  selectedSurahs: string[];
  setSelectedSurahs: React.Dispatch<React.SetStateAction<string[]>> | ((surahs: string[] | ((prev: string[]) => string[])) => void);
  surahSearch: string;
  setSurahSearch: (search: string) => void;
  title?: string;
  description?: string;
  className?: string;
}

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  scopeMode,
  setScopeMode,
  selectedJuzs,
  setSelectedJuzs,
  selectedSurahs,
  setSelectedSurahs,
  surahSearch,
  setSurahSearch,
  title = 'نطاق الأسئلة (الأجزاء أو سور معينة)',
  description = 'حدد أجزاء أو سور معينة لحصر التحدي داخلها، وتفعيل مكافأة الحُفّاظ للآيات المتشابهة',
  className = ''
}) => {
  const filteredSurahsList = useMemo(() => {
    if (!surahSearch.trim()) return ALL_QURAN_SURAHS;
    const q = surahSearch.trim();
    const cleanQ = q.replace(/^سورة\s+/, '').replace(/[أإآ]/g, 'ا');
    const num = parseInt(q, 10);
    return ALL_QURAN_SURAHS.filter(s => {
      if (!isNaN(num) && s.id === num) return true;
      const cleanName = s.name.replace(/^سورة\s+/, '').replace(/[أإآ]/g, 'ا');
      return cleanName.includes(cleanQ);
    });
  }, [surahSearch]);

  return (
    <div className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-brand-emerald/20 shadow-xs space-y-3.5 text-right ${className}`}>
      {/* Header & Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
            {title}
          </label>
          {description && (
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto border border-slate-200/60 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setScopeMode('juz')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              scopeMode === 'juz'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-brand-gold" />
            <span>حسب الأجزاء</span>
          </button>
          <button
            type="button"
            onClick={() => setScopeMode('surah')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              scopeMode === 'surah'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
            <span>سور معينة</span>
          </button>
        </div>
      </div>

      {/* Scope Mode Content */}
      {scopeMode === 'juz' ? (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-400">
              اختر جزءاً أو عدة أجزاء لتخصيص التحدي:
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedJuzs.length === 30) {
                  setSelectedJuzs([]);
                } else {
                  setSelectedJuzs(Array.from({ length: 30 }, (_, i) => i + 1));
                }
              }}
              className="text-xs font-black text-brand-gold hover:text-amber-700 transition-colors cursor-pointer"
            >
              {selectedJuzs.length === 30 ? 'إلغاء التحديد' : 'تحديد كامل القرآن (30 جزءاً)'}
            </button>
          </div>

          {/* Quick selection status */}
          <div className="mb-3 flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
            <span>
              {selectedJuzs.length === 0
                ? '📖 يتم التحدي في: كامل القرآن الكريم'
                : selectedJuzs.length === 30
                  ? '📖 يتم التحدي في: كامل القرآن (جميع الأجزاء)'
                  : `📖 تم تحديد ${selectedJuzs.length} ${selectedJuzs.length === 1 ? 'جزء' : 'أجزاء'}: (${selectedJuzs.join(', ')})`}
            </span>
            {selectedJuzs.length > 0 && selectedJuzs.length < 30 && (
              <button
                type="button"
                onClick={() => setSelectedJuzs([])}
                className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline cursor-pointer"
              >
                إعادة لكامل المصحف
              </button>
            )}
          </div>

          {/* 30 Juz Grid */}
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
              const isSelected = selectedJuzs.includes(juzNum);
              return (
                <button
                  key={juzNum}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedJuzs(selectedJuzs.filter(j => j !== juzNum));
                    } else {
                      setSelectedJuzs([...selectedJuzs, juzNum].sort((a, b) => a - b));
                    }
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all border cursor-pointer ${
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
                value={surahSearch}
                onChange={(e) => setSurahSearch(e.target.value)}
                placeholder="ابحث عن سورة (مثال: الكهف، البقرة، 18)..."
                className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold outline-none focus:border-brand-gold focus:bg-white dark:focus:bg-slate-800 transition-all text-right"
              />
              {surahSearch && (
                <button
                  type="button"
                  onClick={() => setSurahSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {selectedSurahs.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSurahs([])}
                className="text-xs font-black text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 transition-all shrink-0 cursor-pointer"
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
                setSelectedSurahs(amma);
              }}
              className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all cursor-pointer"
            >
              جزء عمّ (قصار السور)
            </button>
            <button
              type="button"
              onClick={() => {
                const longSurahs = ['البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف'];
                setSelectedSurahs(longSurahs);
              }}
              className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all cursor-pointer"
            >
              السبع الطوال
            </button>
          </div>

          {/* Selected Status */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
            <span className="truncate">
              {selectedSurahs.length === 0
                ? '📖 لم تحدد سوراً بعد (سيتم التحدي في كامل القرآن الكريم)'
                : `📖 تم تحديد ${selectedSurahs.length} ${selectedSurahs.length === 1 ? 'سورة' : 'سور'}: ${selectedSurahs.slice(0, 3).map(s => `سورة ${s}`).join('، ')}${selectedSurahs.length > 3 ? ` و+${selectedSurahs.length - 3}` : ''}`}
            </span>
            {selectedSurahs.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSurahs([])}
                className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline shrink-0 mr-2 cursor-pointer"
              >
                إلغاء التحديد
              </button>
            )}
          </div>

          {/* Surahs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
            {filteredSurahsList.map((surah) => {
              const isSelected = selectedSurahs.includes(surah.name);
              return (
                <button
                  key={surah.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSurahs(selectedSurahs.filter(s => s !== surah.name));
                    } else {
                      setSelectedSurahs([...selectedSurahs, surah.name]);
                    }
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border text-right flex items-center justify-between gap-1.5 cursor-pointer ${
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
  );
};

export const JuzSurahSelector = ScopeSelector;
export default ScopeSelector;

