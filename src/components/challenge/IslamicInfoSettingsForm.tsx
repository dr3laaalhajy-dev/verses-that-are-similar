import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Search, AlertCircle, Hash, Layers, BookOpen, SlidersHorizontal, CheckSquare, Square } from 'lucide-react';
import { islamicCategoriesData, islamicCategoriesList } from '../../data/islamicCategories';
import {
  getIslamicTopicAvailableCount,
  getTotalIslamicAvailableCount,
  CATEGORY_NAME_TO_ID,
  normalizeCategoryId
} from '../../utils/islamicChallengeHelper';

export { CATEGORY_NAME_TO_ID, normalizeCategoryId };

export interface IslamicInfoSettings {
  categories: string[];
  levels: (1 | 2 | 3)[];
  topics: string[];
  topicCounts: Record<string, number>;
  questionsCount: number;
}

export interface IslamicInfoSettingsFormProps {
  settings: IslamicInfoSettings;
  onChange: (newSettings: IslamicInfoSettings) => void;
  onSave?: () => void;
  onCancel?: () => void;
  showActionButtons?: boolean;
  saveButtonText?: string;
  title?: string;
}

export const IslamicInfoSettingsForm: React.FC<IslamicInfoSettingsFormProps> = ({
  settings,
  onChange,
  onSave,
  onCancel,
  showActionButtons = true,
  saveButtonText = 'حفظ الإعدادات وتأكيد التفعيل',
  title
}) => {
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // 1. Normalize current categories
  const selectedCategories = useMemo(() => {
    if (!settings.categories || settings.categories.length === 0) {
      return ['akida'];
    }
    const normalized = settings.categories.map(normalizeCategoryId);
    const valid = normalized.filter(id => islamicCategoriesList.some(c => c.id === id));
    return valid.length > 0 ? valid : ['akida'];
  }, [settings.categories]);

  // 2. Normalize levels
  const selectedLevels: (1 | 2 | 3)[] = useMemo(() => {
    if (!settings.levels || settings.levels.length === 0) {
      return [1, 2, 3];
    }
    return settings.levels.map(Number) as (1 | 2 | 3)[];
  }, [settings.levels]);

  // 3. Normalize topics
  const selectedTopics = useMemo(() => {
    if (!settings.topics || settings.topics.length === 0) {
      return ['all'];
    }
    return settings.topics;
  }, [settings.topics]);

  const topicCounts = useMemo(() => {
    return settings.topicCounts || { all: settings.questionsCount || 5 };
  }, [settings.topicCounts, settings.questionsCount]);

  const isAllTopicsSelected = selectedTopics.includes('all') || selectedTopics.length === 0;

  // 4. Collect all available topics from selected categories
  const allAvailableTopics = useMemo(() => {
    const list: { categoryId: string; categoryTitle: string; name: string; availableCount: number }[] = [];
    selectedCategories.forEach(catId => {
      if (catId === 'general' || catId === 'seerah') {
        const catMeta = islamicCategoriesList.find(c => c.id === catId);
        const title = catMeta ? catMeta.title : (catId === 'general' ? 'أسئلة عامة' : 'السيرة النبوية');
        const avail = getIslamicTopicAvailableCount(catId, catId, selectedLevels);
        list.push({
          categoryId: catId,
          categoryTitle: title,
          name: catId,
          availableCount: avail
        });
      } else {
        const catData = islamicCategoriesData[catId];
        if (catData && catData.topics) {
          catData.topics.forEach(t => {
            const avail = getIslamicTopicAvailableCount(t.name, catId, selectedLevels);
            list.push({
              categoryId: catId,
              categoryTitle: catData.title || catId,
              name: t.name,
              availableCount: avail
            });
          });
        }
      }
    });
    return list;
  }, [selectedCategories, selectedLevels]);

  // 5. Total available questions across all topics
  const totalAllAvailable = useMemo(() => {
    return allAvailableTopics.reduce((acc, t) => acc + t.availableCount, 0);
  }, [allAvailableTopics]);

  // 6. Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!topicSearchQuery.trim()) return allAvailableTopics;
    const query = topicSearchQuery.trim().toLowerCase();
    return allAvailableTopics.filter(t =>
      t.name.toLowerCase().includes(query) || t.categoryTitle.toLowerCase().includes(query)
    );
  }, [allAvailableTopics, topicSearchQuery]);

  // 7. Calculate current configured total questions
  const totalIslamicQuestions = useMemo(() => {
    if (isAllTopicsSelected) {
      return topicCounts['all'] !== undefined ? topicCounts['all'] : (settings.questionsCount || 5);
    }
    return selectedTopics.reduce((acc, tName) => acc + (topicCounts[tName] || 0), 0);
  }, [isAllTopicsSelected, topicCounts, selectedTopics, settings.questionsCount]);

  // 8. Check validation errors
  const hasValidationError = useMemo(() => {
    if (isAllTopicsSelected) {
      const requested = topicCounts['all'] !== undefined ? topicCounts['all'] : (settings.questionsCount || 5);
      return requested > totalAllAvailable || requested <= 0;
    }
    for (const tName of selectedTopics) {
      const topicInfo = allAvailableTopics.find(t => t.name === tName);
      const avail = topicInfo ? topicInfo.availableCount : 0;
      const requested = topicCounts[tName] || 0;
      if (requested > avail || requested <= 0) {
        return true;
      }
    }
    return false;
  }, [isAllTopicsSelected, topicCounts, settings.questionsCount, totalAllAvailable, selectedTopics, allAvailableTopics]);

  // Helper to trigger parent onChange
  const updateSettings = (partial: Partial<IslamicInfoSettings>) => {
    const updatedCategories = partial.categories !== undefined ? partial.categories : selectedCategories;
    const updatedLevels = partial.levels !== undefined ? partial.levels : selectedLevels;
    const updatedTopics = partial.topics !== undefined ? partial.topics : selectedTopics;
    const updatedCounts = partial.topicCounts !== undefined ? partial.topicCounts : topicCounts;

    const newIsAll = updatedTopics.includes('all') || updatedTopics.length === 0;
    const newTotal = newIsAll
      ? (updatedCounts['all'] !== undefined ? updatedCounts['all'] : 5)
      : updatedTopics.reduce((acc, t) => acc + (updatedCounts[t] || 0), 0);

    onChange({
      categories: updatedCategories,
      levels: updatedLevels,
      topics: updatedTopics,
      topicCounts: updatedCounts,
      questionsCount: newTotal
    });
  };

  // Category handlers
  const handleToggleCategory = (catId: string) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length <= 1) return; // Keep at least one
      const updated = selectedCategories.filter(id => id !== catId);
      
      // Clean up topics from removed category
      let nextTopics = selectedTopics;
      if (!isAllTopicsSelected) {
        const remainingValidTopics = allAvailableTopics
          .filter(t => updated.includes(t.categoryId))
          .map(t => t.name);
        nextTopics = selectedTopics.filter(t => remainingValidTopics.includes(t));
        if (nextTopics.length === 0) nextTopics = ['all'];
      }

      updateSettings({ categories: updated, topics: nextTopics });
    } else {
      updateSettings({ categories: [...selectedCategories, catId] });
    }
  };

  const handleSelectAllCategories = () => {
    const allIds = islamicCategoriesList.map(c => c.id);
    updateSettings({ categories: allIds });
  };

  // Level handlers
  const handleToggleLevel = (lvl: 1 | 2 | 3) => {
    if (selectedLevels.includes(lvl)) {
      if (selectedLevels.length <= 1) return;
      updateSettings({ levels: selectedLevels.filter(l => l !== lvl) });
    } else {
      updateSettings({ levels: [...selectedLevels, lvl].sort((a, b) => a - b) as (1 | 2 | 3)[] });
    }
  };

  const handleSelectAllLevels = () => {
    updateSettings({ levels: [1, 2, 3] });
  };

  // Topic handlers
  const handleToggleTopic = (topicName: string) => {
    if (topicName === 'all') {
      updateSettings({
        topics: ['all'],
        topicCounts: { ...topicCounts, all: topicCounts['all'] || settings.questionsCount || 5 }
      });
      return;
    }

    let updated: string[];
    const newCounts = { ...topicCounts };

    if (selectedTopics.includes('all')) {
      updated = [topicName];
    } else if (selectedTopics.includes(topicName)) {
      updated = selectedTopics.filter(t => t !== topicName);
      if (updated.length === 0) {
        updated = ['all'];
      }
    } else {
      updated = [...selectedTopics, topicName];
    }

    if (!newCounts[topicName]) {
      newCounts[topicName] = 3;
    }

    updateSettings({ topics: updated, topicCounts: newCounts });
  };

  const handleUpdateTopicCount = (topicName: string, count: number) => {
    const newCounts = {
      ...topicCounts,
      [topicName]: Math.max(0, count)
    };
    updateSettings({ topicCounts: newCounts });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header (optional) */}
      {title && (
        <div className="flex items-center gap-3 pb-3 border-b border-slate-150">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-bold">حدد المجالات الإسلامية ومستويات الصعوبة والمواضيع المطلوبة</p>
          </div>
        </div>
      )}

      {/* 1. الأقسام والمجالات الإسلامية (Categories) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>١. المجالات والأقسام الإسلامية</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              تم اختيار ({selectedCategories.length})
            </span>
          </label>
          <button
            type="button"
            onClick={handleSelectAllCategories}
            className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
          >
            تحديد جميع المجالات
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {islamicCategoriesList.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleToggleCategory(cat.id)}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1.5 relative cursor-pointer select-none ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/90 shadow-sm scale-[1.01]'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1.5 shadow-xs bg-white/80 border border-slate-100">
                  <img src={cat.icon} alt={cat.title} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 w-full">
                  <span className={`text-xs font-black block truncate ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                    {cat.title}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 block truncate">
                    {cat.type === 'custom' ? `${cat.topicsCount} موضوعاً` : (cat.id === 'seerah' ? '60 سؤالاً' : '100 سؤال')}
                  </span>
                </div>
                {/* Check indicator */}
                <div className={`absolute top-2 right-2 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                  isSelected ? 'bg-amber-500 text-white shadow-xs' : 'border border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. مستويات الصعوبة (Difficulty Levels) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>٢. مستويات الصعوبة (يمكن دمج عدة مستويات)</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              تم اختيار ({selectedLevels.length})
            </span>
          </label>
          <button
            type="button"
            onClick={handleSelectAllLevels}
            className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
          >
            تحديد كافة المستويات
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { level: 1 as const, title: 'المستوى الأول', sub: 'ميسر لترسيخ الأساسيات', icon: '🌱' },
            { level: 2 as const, title: 'المستوى الثاني', sub: 'متوسط لتوسيع الفهم', icon: '⚡' },
            { level: 3 as const, title: 'المستوى الثالث', sub: 'متقدم للباحثين عن التميز', icon: '🔥' }
          ].map((item) => {
            const isSelected = selectedLevels.includes(item.level);
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => handleToggleLevel(item.level)}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between text-right gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 shadow-xs'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-black block text-slate-800 truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 block truncate">
                      {item.sub}
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-amber-500 text-white shadow-xs' : 'border border-slate-300 bg-white'
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. المواضيع وتوزيع عدد الأسئلة (Topics & Questions Allocation) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span>٣. تخصيص المواضيع وعدد الأسئلة</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              {isAllTopicsSelected ? 'كافة المواضيع' : `${selectedTopics.length} موضوع`}
            </span>
          </label>
          {!isAllTopicsSelected && (
            <button
              type="button"
              onClick={() => handleToggleTopic('all')}
              className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
            >
              اختيار كافة المواضيع
            </button>
          )}
        </div>

        {/* Option A: All topics with total questions counter */}
        <div className={`p-4 rounded-2xl border-2 transition-all text-right ${
          isAllTopicsSelected
            ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 shadow-xs'
            : 'border-slate-100 bg-slate-50/50 text-slate-700'
        }`}>
          <div
            onClick={() => handleToggleTopic('all')}
            className="flex items-center justify-between cursor-pointer mb-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🌟</span>
              <div>
                <span className="text-xs sm:text-sm font-black block">
                  جميع موضوعات المجالات المختارة (عشوائي ومتنوع)
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  سحب أسئلة متنوعة من كافة موضوعات المجالات المحددة (المتاح: {totalAllAvailable})
                </span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
              isAllTopicsSelected ? 'bg-emerald-600 text-white shadow-xs' : 'border border-slate-300 bg-white'
            }`}>
              {isAllTopicsSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {isAllTopicsSelected && (
            <div className="pt-3 border-t border-emerald-200/60 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <label className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-600" />
                  <span>عدد الأسئلة الإجمالي للمعلومات الإسلامية:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalAllAvailable}
                    value={topicCounts['all'] !== undefined ? topicCounts['all'] : 5}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                      handleUpdateTopicCount('all', isNaN(val) ? 0 : val);
                    }}
                    className={`w-24 px-3 py-1.5 rounded-xl border-2 font-black text-sm text-center bg-white ${
                      (topicCounts['all'] || 5) > totalAllAvailable
                        ? 'border-red-400 text-red-600 focus:border-red-500'
                        : 'border-emerald-300 text-emerald-800 focus:border-emerald-500'
                    } focus:outline-none shadow-xs`}
                  />
                  <span className="text-xs font-bold text-emerald-800">سؤال</span>
                </div>
              </div>

              {/* Quick count buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-bold text-emerald-700 ml-1">أعداد سريعة:</span>
                {[3, 5, 10, 15, 20, 25, 30].map(cnt => {
                  if (cnt > totalAllAvailable) return null;
                  const isCurrent = (topicCounts['all'] !== undefined ? topicCounts['all'] : 5) === cnt;
                  return (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleUpdateTopicCount('all', cnt)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {cnt}
                    </button>
                  );
                })}
              </div>

              {(topicCounts['all'] || 5) > totalAllAvailable && (
                <div className="text-[11px] font-bold text-red-500 flex items-center gap-1 justify-end pt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>عذراً، أقصى عدد أسئلة متاح هو {totalAllAvailable}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Option B: Specific topics selection */}
        {allAvailableTopics.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700">
                أو اختر مواضيع فرعية بعينها:
              </span>
              {allAvailableTopics.length > 4 && (
                <div className="relative w-48 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ابحث في المواضيع..."
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-150 rounded-2xl bg-slate-50/50">
              {filteredTopics.map((t) => {
                const isSelected = !isAllTopicsSelected && selectedTopics.includes(t.name);
                const currentCount = topicCounts[t.name] !== undefined ? topicCounts[t.name] : 3;
                const isExceeded = currentCount > t.availableCount;

                return (
                  <div
                    key={`${t.categoryId}-${t.name}`}
                    className={`p-3 rounded-2xl border transition-all text-right space-y-2 ${
                      isSelected
                        ? 'bg-amber-50/90 border-amber-300 shadow-xs'
                        : 'bg-white border-slate-150 hover:border-amber-200'
                    }`}
                  >
                    <div
                      onClick={() => handleToggleTopic(t.name)}
                      className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-amber-500 text-white' : 'border border-slate-300 bg-slate-50'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-black text-xs md:text-sm text-slate-800 truncate">
                          {t.name === 'seerah' ? 'السيرة النبوية الشريفة' : t.name === 'general' ? 'معارف وثقافة إسلامية عامة' : t.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                          المتاح: {t.availableCount}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                          {t.categoryTitle.replace('الإسلامي', '').replace('الإسلامية', '').trim()}
                        </span>
                      </div>
                    </div>

                    {/* Dedicated question count when checked */}
                    {isSelected && (
                      <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-black text-amber-900 flex items-center gap-1">
                          <Hash className="w-3 h-3 text-amber-600" />
                          <span>عدد الأسئلة لهذا الموضوع:</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={t.availableCount}
                            value={currentCount}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              handleUpdateTopicCount(t.name, isNaN(val) ? 0 : val);
                            }}
                            className={`w-20 px-2.5 py-1 rounded-xl border-2 font-black text-xs text-center bg-white ${
                              isExceeded
                                ? 'border-red-400 text-red-600 focus:border-red-500'
                                : 'border-amber-300 text-amber-900 focus:border-amber-500'
                            } focus:outline-none shadow-xs`}
                          />
                          <span className="text-xs font-bold text-amber-800">سؤال</span>
                        </div>

                        {isExceeded && (
                          <div className="w-full text-[11px] font-bold text-red-500 flex items-center gap-1 justify-end">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>عذراً، أقصى عدد متاح هو {t.availableCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-amber-950">إجمالي أسئلة المعلومات الإسلامية:</span>
        <span className="text-sm font-black text-amber-800">
          {totalIslamicQuestions} أسئلة مختارة
        </span>
      </div>

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="pt-2 flex items-center gap-3">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={hasValidationError || totalIslamicQuestions <= 0}
              className={`flex-1 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                hasValidationError || totalIslamicQuestions <= 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer active:scale-98'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{hasValidationError ? 'يرجى تصحيح الأعداد المتجاوزة' : saveButtonText}</span>
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="py-3.5 px-6 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IslamicInfoSettingsForm;
