import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Search, AlertCircle, Hash } from 'lucide-react';
import { islamicCategoriesData, islamicCategoriesList } from '../data/islamicCategories';
import { getIslamicTopicAvailableCount } from '../utils/islamicChallengeHelper';

interface IslamicRoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onSelectCategories: (cats: string[]) => void;
  selectedLevels: (1 | 2 | 3)[];
  onSelectLevels: (lvls: (1 | 2 | 3)[]) => void;
  selectedTopics: string[];
  onSelectTopics: (topics: string[]) => void;
  topicQuestionCounts: Record<string, number>;
  onUpdateTopicCount: (topic: string, count: number) => void;
}

const IslamicRoomConfigModal: React.FC<IslamicRoomConfigModalProps> = ({
  isOpen,
  onClose,
  selectedCategories = ['akida'],
  onSelectCategories,
  selectedLevels = [1],
  onSelectLevels,
  selectedTopics = ['all'],
  onSelectTopics,
  topicQuestionCounts = {},
  onUpdateTopicCount,
}) => {
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Collect all available topics from all currently selected categories
  const allAvailableTopics = useMemo(() => {
    const list: { categoryId: string; categoryTitle: string; name: string; availableCount: number }[] = [];
    selectedCategories.forEach(catId => {
      if (catId === 'general' || catId === 'seerah') {
        const title = catId === 'general' ? 'أسئلة عامة' : 'السيرة النبوية';
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

  // Total available across all topics
  const totalAllAvailable = useMemo(() => {
    return allAvailableTopics.reduce((acc, t) => acc + t.availableCount, 0);
  }, [allAvailableTopics]);

  // Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!topicSearchQuery.trim()) return allAvailableTopics;
    const query = topicSearchQuery.trim().toLowerCase();
    return allAvailableTopics.filter(t => 
      t.name.toLowerCase().includes(query) || t.categoryTitle.toLowerCase().includes(query)
    );
  }, [allAvailableTopics, topicSearchQuery]);

  if (!isOpen) return null;

  // Toggle Category
  const handleToggleCategory = (catId: string) => {
    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length <= 1) return; // Keep at least one
      const updated = selectedCategories.filter(id => id !== catId);
      onSelectCategories(updated);
      
      // Clean up topics from removed category
      if (!selectedTopics.includes('all')) {
        const remainingValidTopics = allAvailableTopics
          .filter(t => updated.includes(t.categoryId))
          .map(t => t.name);
        const filteredSelected = selectedTopics.filter(t => remainingValidTopics.includes(t));
        onSelectTopics(filteredSelected.length > 0 ? filteredSelected : ['all']);
      }
    } else {
      onSelectCategories([...selectedCategories, catId]);
    }
  };

  // Select all categories
  const handleSelectAllCategories = () => {
    const allIds = islamicCategoriesList.map(c => c.id);
    onSelectCategories(allIds);
  };

  // Toggle Level
  const handleToggleLevel = (lvl: 1 | 2 | 3) => {
    if (selectedLevels.includes(lvl)) {
      if (selectedLevels.length <= 1) return; // Keep at least one
      onSelectLevels(selectedLevels.filter(l => l !== lvl));
    } else {
      onSelectLevels([...selectedLevels, lvl].sort((a, b) => a - b));
    }
  };

  // Select all levels
  const handleSelectAllLevels = () => {
    onSelectLevels([1, 2, 3]);
  };

  // Toggle Topic
  const handleToggleTopic = (topicName: string) => {
    if (topicName === 'all') {
      onSelectTopics(['all']);
      return;
    }

    let updated: string[];
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
    onSelectTopics(updated);

    // Default count if not set yet
    if (!topicQuestionCounts[topicName]) {
      onUpdateTopicCount(topicName, 3);
    }
  };

  const isAllTopicsSelected = selectedTopics.includes('all') || selectedTopics.length === 0;

  // Calculate sum of questions for Islamic quiz
  const totalIslamicQuestions = isAllTopicsSelected 
    ? (topicQuestionCounts['all'] || 5)
    : selectedTopics.reduce((acc, tName) => acc + (topicQuestionCounts[tName] || 0), 0);

  // Check if any topic exceeds available questions
  let hasIslamicValidationError = false;
  if (isAllTopicsSelected) {
    const requested = topicQuestionCounts['all'] || 5;
    if (requested > totalAllAvailable || requested <= 0) {
      hasIslamicValidationError = true;
    }
  } else {
    for (const tName of selectedTopics) {
      const topicInfo = allAvailableTopics.find(t => t.name === tName);
      const avail = topicInfo ? topicInfo.availableCount : 0;
      const requested = topicQuestionCounts[tName] || 0;
      if (requested > avail || requested <= 0) {
        hasIslamicValidationError = true;
        break;
      }
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  تخصيص تحدي المعلومات الإسلامية
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  حدد المواضيع وعدد الأسئلة لكل موضوع بشكل مستقل
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-right">

            {/* Step 1: Category Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span>١. اختر المجالات والأقسام</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    تم اختيار ({selectedCategories.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="text-[11px] font-black text-brand-emerald hover:underline cursor-pointer"
                >
                  تحديد جميع المجالات
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {islamicCategoriesList.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1.5 relative cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/80 shadow-xs'
                          : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-0.5 shadow-xs overflow-hidden">
                        <img src={cat.icon} alt={cat.title} className="w-7 h-7 object-contain" />
                      </div>
                      <span className={`text-xs font-black line-clamp-1 ${isSelected ? 'text-amber-800' : 'text-slate-700'}`}>
                        {cat.title}
                      </span>
                      {/* Checkbox indicator */}
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

            {/* Step 2: Levels Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span>٢. مستويات الصعوبة (دمج عدة مستويات)</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    تم اختيار ({selectedLevels.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllLevels}
                  className="text-[11px] font-black text-brand-emerald hover:underline cursor-pointer"
                >
                  تحديد كافة المستويات
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { level: 1 as const, title: 'المستوى الأول', sub: 'مبتدئ / أساسي' },
                  { level: 2 as const, title: 'المستوى الثاني', sub: 'متوسط' },
                  { level: 3 as const, title: 'المستوى الثالث', sub: 'متقدم' }
                ].map((item) => {
                  const isSelected = selectedLevels.includes(item.level);
                  return (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => handleToggleLevel(item.level)}
                      className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 relative cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-xs scale-[1.01]'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black">{item.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                        {item.sub}
                      </span>
                      {/* Checkbox indicator */}
                      <div className={`absolute top-2 right-2 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? 'bg-white text-amber-600 shadow-xs' : 'border border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Topics Multi-Select with Dedicated Question Counts */}
            {allAvailableTopics.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <span>٣. تحديد المواضيع وعدد الأسئلة لكل موضوع</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                      {isAllTopicsSelected ? 'كافة المواضيع' : `${selectedTopics.length} موضوع`}
                    </span>
                  </label>
                  {!isAllTopicsSelected && (
                    <button
                      type="button"
                      onClick={() => onSelectTopics(['all'])}
                      className="text-[11px] font-black text-brand-emerald hover:underline cursor-pointer"
                    >
                      اختيار كافة المواضيع
                    </button>
                  )}
                </div>

                {/* Option to select All Topics */}
                <div className={`p-3 rounded-2xl border-2 transition-all text-right ${
                  isAllTopicsSelected
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 shadow-xs'
                    : 'border-slate-100 bg-slate-50/60 text-slate-700'
                }`}>
                  <div
                    onClick={() => onSelectTopics(['all'])}
                    className="flex items-center justify-between cursor-pointer mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🌟</span>
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
                    <div className="pt-2 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-black text-emerald-800 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        <span>عدد الأسئلة الإجمالي للمعلومات الإسلامية:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={totalAllAvailable}
                          value={topicQuestionCounts['all'] !== undefined ? topicQuestionCounts['all'] : 5}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                            onUpdateTopicCount('all', isNaN(val) ? 0 : val);
                          }}
                          className={`w-24 px-3 py-1.5 rounded-xl border-2 font-black text-sm text-center bg-white ${
                            (topicQuestionCounts['all'] || 5) > totalAllAvailable
                              ? 'border-red-400 text-red-600 focus:border-red-500'
                              : 'border-emerald-300 text-emerald-800 focus:border-emerald-500'
                          } focus:outline-none`}
                        />
                        <span className="text-xs font-bold text-emerald-700">سؤال</span>
                      </div>
                      {(topicQuestionCounts['all'] || 5) > totalAllAvailable && (
                        <div className="text-[11px] font-bold text-red-500 flex items-center gap-1 w-full justify-end">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>عذراً، أقصى عدد متاح هو {totalAllAvailable}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Search bar for topics */}
                {allAvailableTopics.length > 5 && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ابحث في المواضيع..."
                      value={topicSearchQuery}
                      onChange={(e) => setTopicSearchQuery(e.target.value)}
                      className="w-full pr-9 pl-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {/* Multi-Select List for Topics with Individual Inputs */}
                <div className="space-y-2 max-h-56 overflow-y-auto p-2 border border-slate-100 rounded-2xl bg-slate-50/50">
                  {filteredTopics.map((t) => {
                    const isSelected = !isAllTopicsSelected && selectedTopics.includes(t.name);
                    const currentCount = topicQuestionCounts[t.name] !== undefined ? topicQuestionCounts[t.name] : 3;
                    const isExceeded = currentCount > t.availableCount;

                    return (
                      <div
                        key={`${t.categoryId}-${t.name}`}
                        className={`p-3 rounded-2xl border transition-all text-right space-y-2 ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-amber-200'
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
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                              {t.categoryTitle.replace('الإسلامي', '').replace('الإسلامية', '').trim()}
                            </span>
                          </div>
                        </div>

                        {/* Dedicated Question Count Input when selected */}
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
                                  onUpdateTopicCount(t.name, isNaN(val) ? 0 : val);
                                }}
                                className={`w-20 px-2.5 py-1 rounded-xl border-2 font-black text-xs text-center bg-white ${
                                  isExceeded
                                    ? 'border-red-400 text-red-600 focus:border-red-500'
                                    : 'border-amber-300 text-amber-900 focus:border-amber-500'
                                } focus:outline-none shadow-inner`}
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

          {/* Footer with Reactive Total Summary */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-right">
              <span className="text-[11px] font-black text-slate-500 block">إجمالي أسئلة المعلومات الإسلامية</span>
              <span className="text-sm font-black text-amber-700">
                {totalIslamicQuestions} أسئلة مختارة
              </span>
            </div>

            <button
              onClick={onClose}
              disabled={hasIslamicValidationError || totalIslamicQuestions <= 0}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                hasIslamicValidationError || totalIslamicQuestions <= 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 cursor-pointer'
              }`}
            >
              <span>{hasIslamicValidationError ? 'يرجى تصحيح الأعداد المتجاوزة' : 'تأكيد الإعدادات والمتابعة'}</span>
              {!hasIslamicValidationError && <Check className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IslamicRoomConfigModal;