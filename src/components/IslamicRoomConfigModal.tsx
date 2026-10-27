import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Search } from 'lucide-react';
import { islamicCategoriesData, islamicCategoriesList } from '../data/islamicCategories';

interface IslamicRoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onSelectCategories: (cats: string[]) => void;
  selectedLevels: (1 | 2 | 3)[];
  onSelectLevels: (lvls: (1 | 2 | 3)[]) => void;
  selectedTopics: string[];
  onSelectTopics: (topics: string[]) => void;
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
}) => {
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Collect all available topics from all currently selected categories
  const allAvailableTopics = useMemo(() => {
    const list: { categoryId: string; categoryTitle: string; name: string }[] = [];
    selectedCategories.forEach(catId => {
      const catData = islamicCategoriesData[catId];
      if (catData && catData.topics) {
        catData.topics.forEach(t => {
          list.push({
            categoryId: catId,
            categoryTitle: catData.title || catId,
            name: t.name,
          });
        });
      }
    });
    return list;
  }, [selectedCategories]);

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
  };

  const isAllTopicsSelected = selectedTopics.includes('all') || selectedTopics.length === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
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
                  اختيار متعدد للمجالات والمستويات والمواضيع لدمجها في التحدي
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
                          ? 'border-amber-500 bg-amber-50/60 shadow-xs scale-[1.01]'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/40 text-slate-600'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs">
                        <img src={cat.icon} alt={cat.title} className="w-full h-full object-contain" />
                      </div>
                      <span className={`text-xs font-black line-clamp-1 ${isSelected ? 'text-amber-900' : 'text-slate-700'}`}>
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

            {/* Step 2: Level Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <span>٢. اختر مستويات الصعوبة</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    تم اختيار ({selectedLevels.length})
                  </span>
                </label>
                {selectedLevels.length < 3 && (
                  <button
                    type="button"
                    onClick={handleSelectAllLevels}
                    className="text-[11px] font-black text-brand-emerald hover:underline cursor-pointer"
                  >
                    تحديد كافة المستويات
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[
                  { lvl: 1 as const, title: 'المستوى الأول', sub: '🌱 أساسي وميسر' },
                  { lvl: 2 as const, title: 'المستوى الثاني', sub: '⚡ متوسط ومتنوع' },
                  { lvl: 3 as const, title: 'المستوى الثالث', sub: '🔥 متقدم ومتعمق' },
                ].map((item) => {
                  const isSelected = selectedLevels.includes(item.lvl);
                  return (
                    <button
                      key={item.lvl}
                      type="button"
                      onClick={() => handleToggleLevel(item.lvl)}
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

            {/* Step 3: Topics Multi-Select */}
            {allAvailableTopics.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <span>٣. تحديد المواضيع (Multi-select Topics)</span>
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
                <button
                  type="button"
                  onClick={() => onSelectTopics(['all'])}
                  className={`w-full p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex items-center justify-between text-right mb-2 cursor-pointer ${
                    isAllTopicsSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                      : 'border-slate-100 hover:border-slate-200 bg-slate-50/60 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🌟</span>
                    <div>
                      <span className="text-xs sm:text-sm font-black block">
                        جميع موضوعات المجالات المختارة (عشوائي ومتنوع)
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        سحب أسئلة متنوعة من كافة موضوعات المجالات المحددة
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    isAllTopicsSelected ? 'bg-emerald-600 text-white shadow-xs' : 'border border-slate-300 bg-white'
                  }`}>
                    {isAllTopicsSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* Search bar for topics */}
                {allAvailableTopics.length > 6 && (
                  <div className="relative mb-2">
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

                {/* Multi-Select Chips for Topics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-slate-100 rounded-2xl bg-slate-50/50">
                  {filteredTopics.map((t) => {
                    const isSelected = !isAllTopicsSelected && selectedTopics.includes(t.name);
                    return (
                      <button
                        key={`${t.categoryId}-${t.name}`}
                        type="button"
                        onClick={() => handleToggleTopic(t.name)}
                        className={`p-2.5 rounded-xl border transition-all text-xs font-bold text-right flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                        }`}
                        title={t.name}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white text-amber-600' : 'border border-slate-300 bg-slate-50'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{t.name}</span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-bold ${
                          isSelected ? 'bg-amber-600 text-amber-100' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {t.categoryTitle.replace('الإسلامي', '').replace('الإسلامية', '').trim()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold text-slate-500 hidden sm:block">
              {selectedCategories.length} مجال • {selectedLevels.length} مستوى • {isAllTopicsSelected ? 'كل المواضيع' : `${selectedTopics.length} موضوع`}
            </div>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>تأكيد الإعدادات والمتابعة</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IslamicRoomConfigModal;
