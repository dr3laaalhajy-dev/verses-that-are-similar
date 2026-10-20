import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Layers, BookOpen } from 'lucide-react';
import { islamicCategoriesData, islamicCategoriesList } from '../data/islamicCategories';

interface IslamicRoomConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedLevel: 1 | 2 | 3;
  onSelectLevel: (lvl: 1 | 2 | 3) => void;
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
}

const IslamicRoomConfigModal: React.FC<IslamicRoomConfigModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onSelectCategory,
  selectedLevel,
  onSelectLevel,
  selectedTopic,
  onSelectTopic,
}) => {
  if (!isOpen) return null;

  const currentCategoryData = islamicCategoriesData[selectedCategory];
  const isCustomCategory = !!currentCategoryData;

  const topicsList = currentCategoryData ? currentCategoryData.topics : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h3 className="text-base sm:text-lg font-black text-slate-800">تخصيص تحدي المعلومات الإسلامية</h3>
                <p className="text-[11px] font-bold text-slate-400">حدد القسم والمستوى والموضوع للغرفة الجماعية</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-right">
            {/* Step 1: Category Selection */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2.5">
                ١. اختر المجال / القسم:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {islamicCategoriesList.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(cat.id);
                        onSelectTopic('all');
                      }}
                      className={`p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1.5 relative ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/50 shadow-xs scale-[1.02]'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-xs">
                        <img src={cat.icon} alt={cat.title} className="w-full h-full object-contain" />
                      </div>
                      <span className={`text-xs font-black line-clamp-1 ${isSelected ? 'text-amber-800' : 'text-slate-700'}`}>
                        {cat.title}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Level Selection */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2.5">
                ٢. اختر مستوى الصعوبة:
              </label>
              {isCustomCategory ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {[
                    { lvl: 1 as const, title: 'المستوى الأول', sub: '🌱 أساسي وميسر' },
                    { lvl: 2 as const, title: 'المستوى الثاني', sub: '⚡ متوسط ومتنوع' },
                    { lvl: 3 as const, title: 'المستوى الثالث', sub: '🔥 متقدم ومتعمق' },
                  ].map((item) => {
                    const isSelected = selectedLevel === item.lvl;
                    return (
                      <button
                        key={item.lvl}
                        type="button"
                        onClick={() => onSelectLevel(item.lvl)}
                        className={`p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-black">{item.title}</span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                          {item.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : selectedCategory === 'general' ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    { lvl: 1 as const, title: 'مستوى سهل', sub: '🌱 معلومات أساسية' },
                    { lvl: 2 as const, title: 'مستوى متقدم', sub: '🔥 تفاصيل دقيقة' },
                  ].map((item) => {
                    const isSelected = selectedLevel === item.lvl;
                    return (
                      <button
                        key={item.lvl}
                        type="button"
                        onClick={() => onSelectLevel(item.lvl)}
                        className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-1 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-white shadow-xs'
                            : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-black">{item.title}</span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                          {item.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs font-bold text-center">
                  السيرة النبوية تشمل كافة المحطات والغزوات الكريمة 🕌
                </div>
              )}
            </div>

            {/* Step 3: Topic Selection */}
            {isCustomCategory && (
              <div>
                <label className="block text-xs font-black text-slate-500 mb-2.5">
                  ٣. تحديد الموضوع (Topic):
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => onSelectTopic('all')}
                    className={`w-full p-2.5 sm:p-3 rounded-2xl border-2 transition-all flex items-center justify-between text-right ${
                      selectedTopic === 'all'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🌟</span>
                      <div>
                        <span className="text-xs sm:text-sm font-black block">جميع موضوعات القسم (عشوائي ومتنوع)</span>
                        <span className="text-[10px] font-bold text-slate-400">أسئلة مختارة من كافة موضوعات القسم</span>
                      </div>
                    </div>
                    {selectedTopic === 'all' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/50">
                    {topicsList.map((t) => {
                      const isSelected = selectedTopic === t.name;
                      return (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => onSelectTopic(t.name)}
                          className={`p-2 rounded-xl border transition-all text-xs font-bold truncate text-right flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs font-black'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300'
                          }`}
                          title={t.name}
                        >
                          <span className="truncate">{t.name}</span>
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>تأكيد الإعدادات ومتابعة إنشاء الغرفة</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IslamicRoomConfigModal;
