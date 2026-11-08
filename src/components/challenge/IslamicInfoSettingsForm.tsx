import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Check,
  Search,
  AlertCircle,
  Hash,
  Layers,
  BookOpen,
  Settings,
  X,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';
import { islamicCategoriesData, islamicCategoriesList } from '../../data/islamicCategories';
import { quizQuestions } from '../../data/quizQuestionsData';
import {
  getIslamicTopicAvailableCount,
  CATEGORY_NAME_TO_ID,
  normalizeCategoryId
} from '../../utils/islamicChallengeHelper';

export { CATEGORY_NAME_TO_ID, normalizeCategoryId };

/**
 * الإعدادات الفرعية الخاصة بكل مجال إسلامي على حدة
 */
export interface CategorySubSettings {
  levels: (1 | 2 | 3)[];
  questionsCount: number;
  isAllTopics: boolean;
  selectedTopics: string[];
  topicCounts: Record<string, number>;
}

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
  onSave?: (finalSettings?: IslamicInfoSettings) => void;
  onCancel?: () => void;
  showActionButtons?: boolean;
  saveButtonText?: string;
  title?: string;
}

/**
 * دالة مساعدة لحساب إجمالي الأسئلة المتاحة في مجال معين بناءً على مستويات الصعوبة
 */
export function getCategoryAvailableCount(
  categoryId: string,
  levels: (1 | 2 | 3)[] = [1, 2, 3]
): number {
  const catId = normalizeCategoryId(categoryId);
  if (catId === 'seerah') {
    return quizQuestions.filter(q => q.category === 'seerah').length;
  }
  if (catId === 'general') {
    return quizQuestions.filter(q => (q.category || 'general') === 'general').length;
  }
  if (islamicCategoriesData[catId]) {
    let total = 0;
    islamicCategoriesData[catId].topics.forEach(t => {
      levels.forEach(lvl => {
        total += (t.levels[lvl] || []).length;
      });
    });
    return total;
  }
  return 0;
}

/**
 * -------------------------------------------------------------
 * 1. المكون الفرعي: النافذة المنبثقة لإعدادات مجال محدد (Sub-Modal)
 * -------------------------------------------------------------
 */
interface CategorySettingsModalProps {
  catId: string;
  initialConfig: CategorySubSettings;
  onSave: (updatedConfig: CategorySubSettings) => void;
  onClose: () => void;
}

const CategorySettingsModal: React.FC<CategorySettingsModalProps> = ({
  catId,
  initialConfig,
  onSave,
  onClose
}) => {
  const catMeta = islamicCategoriesList.find(c => c.id === catId);
  const catData = islamicCategoriesData[catId];
  const title = catMeta ? catMeta.title : catId;

  // الحالات المؤقتة (Draft State) الخاصة بالمجال
  const [draftLevels, setDraftLevels] = useState<(1 | 2 | 3)[]>(
    initialConfig.levels?.length ? initialConfig.levels : [1, 2, 3]
  );
  const [draftCount, setDraftCount] = useState<number>(initialConfig.questionsCount || 5);
  const [draftIsAllTopics, setDraftIsAllTopics] = useState<boolean>(initialConfig.isAllTopics ?? true);
  const [draftSelectedTopics, setDraftSelectedTopics] = useState<string[]>(
    initialConfig.selectedTopics || []
  );
  const [draftTopicCounts, setDraftTopicCounts] = useState<Record<string, number>>(
    initialConfig.topicCounts || {}
  );
  const [searchQuery, setSearchQuery] = useState('');

  // قفل تمرير الصفحة أثناء فتح النافذة
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  // حساب إجمالي المتاح في هذا المجال وفق المستويات المحددة
  const categoryAvailableCount = useMemo(() => {
    return getCategoryAvailableCount(catId, draftLevels);
  }, [catId, draftLevels]);

  // قائمة مواضيع هذا المجال فقط (إن وجدت)
  const categoryTopics = useMemo(() => {
    if (catId === 'seerah' || catId === 'general' || !catData || !catData.topics) {
      return [];
    }
    return catData.topics.map(t => {
      let tCount = 0;
      draftLevels.forEach(lvl => {
        tCount += (t.levels[lvl] || []).length;
      });
      return {
        name: t.name,
        availableCount: tCount
      };
    });
  }, [catId, catData, draftLevels]);

  // تصفية المواضيع بالبحث
  const filteredCategoryTopics = useMemo(() => {
    if (!searchQuery.trim()) return categoryTopics;
    const q = searchQuery.trim().toLowerCase();
    return categoryTopics.filter(t => t.name.toLowerCase().includes(q));
  }, [categoryTopics, searchQuery]);

  // ضبط العدد عند تغير الحد الأقصى المتاح
  useEffect(() => {
    if (categoryAvailableCount > 0 && draftCount > categoryAvailableCount) {
      setDraftCount(categoryAvailableCount);
    } else if (categoryAvailableCount > 0 && draftCount < 1) {
      setDraftCount(1);
    }
  }, [categoryAvailableCount]);

  // معالجة تغيير مستويات الصعوبة لهذا المجال
  const handleToggleLevel = (lvl: 1 | 2 | 3) => {
    if (draftLevels.includes(lvl)) {
      if (draftLevels.length <= 1) return; // الإبقاء على مستوى واحد على الأقل
      setDraftLevels(draftLevels.filter(l => l !== lvl));
    } else {
      setDraftLevels([...draftLevels, lvl].sort((a, b) => a - b) as (1 | 2 | 3)[]);
    }
  };

  const handleSelectAllLevels = () => {
    setDraftLevels([1, 2, 3]);
  };

  // معالجة تغيير عدد أسئلة المجال (إدخال حر)
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      setDraftCount('' as any);
      return;
    }
    const num = parseInt(rawVal, 10);
    if (isNaN(num)) {
      setDraftCount('' as any);
      return;
    }
    if (categoryAvailableCount > 0 && num > categoryAvailableCount) {
      setDraftCount(categoryAvailableCount);
    } else {
      setDraftCount(num);
    }
  };

  // معالجة تبديل موضوع فرعي
  const handleToggleTopic = (topicName: string) => {
    let updatedTopics: string[];
    const nextCounts = { ...draftTopicCounts };

    if (draftSelectedTopics.includes(topicName)) {
      updatedTopics = draftSelectedTopics.filter(t => t !== topicName);
      delete nextCounts[topicName];
    } else {
      updatedTopics = [...draftSelectedTopics, topicName];
      const topicInfo = categoryTopics.find(t => t.name === topicName);
      const avail = topicInfo?.availableCount || 3;
      nextCounts[topicName] = Math.min(avail, nextCounts[topicName] || 3);
    }

    setDraftSelectedTopics(updatedTopics);
    setDraftTopicCounts(nextCounts);

    // تحديث إجمالي عدد الأسئلة ليعكس مجموع المواضيع المحددة
    const newSum = updatedTopics.reduce((acc, t) => acc + (Number(nextCounts[t]) || 0), 0);
    if (newSum > 0) {
      setDraftCount(newSum);
    }
  };

  // معالجة تغيير عدد أسئلة موضوع فرعي
  const handleTopicCountChange = (topicName: string, valStr: string, maxVal: number) => {
    if (valStr === '') {
      setDraftTopicCounts({
        ...draftTopicCounts,
        [topicName]: '' as any
      });
      return;
    }
    const raw = parseInt(valStr, 10);
    const validVal = isNaN(raw) ? 1 : Math.max(1, Math.min(raw, maxVal));
    const nextCounts = {
      ...draftTopicCounts,
      [topicName]: validVal
    };
    setDraftTopicCounts(nextCounts);

    // تحديث إجمالي أسئلة المجال ليعكس مجموع المواضيع
    const newSum = draftSelectedTopics.reduce((acc, t) => acc + (Number(nextCounts[t]) || 0), 0);
    setDraftCount(Math.max(1, newSum));
  };

  // حفظ الإعدادات الفرعية للمجال
  const handleSaveSubSettings = () => {
    let finalCount = Math.max(1, draftCount);
    let finalTopics = draftSelectedTopics;

    if (!draftIsAllTopics && categoryTopics.length > 0) {
      if (finalTopics.length === 0) {
        // إذا لم يختر موضوعاً، نرجع لكافة الموضوعات
        setDraftIsAllTopics(true);
      } else {
        const sumOfTopics = finalTopics.reduce((acc, t) => acc + (draftTopicCounts[t] || 0), 0);
        finalCount = Math.max(1, sumOfTopics);
      }
    }

    onSave({
      levels: draftLevels,
      questionsCount: finalCount,
      isAllTopics: draftIsAllTopics,
      selectedTopics: draftIsAllTopics ? [] : finalTopics,
      topicCounts: draftTopicCounts
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 text-right space-y-5"
        dir="rtl"
      >
        {/* الترويسة العلوية للنافذة الفرعية */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center p-1.5 border border-amber-200/60 shadow-2xs">
              {catMeta?.icon ? (
                <img src={catMeta.icon} alt={title} className="w-full h-full object-contain" />
              ) : (
                <Sparkles className="w-5 h-5 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800">إعدادات {title}</h3>
              <p className="text-xs text-slate-400 font-bold">خصص المستويات والمواضيع وعدد الأسئلة لهذا المجال</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. تحديد مستويات الصعوبة الخاصة بهذا المجال فقط */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>١. مستويات الصعوبة لهذا المجال</span>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                ({draftLevels.length} مستويات)
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

          <div className="grid grid-cols-3 gap-2">
            {[
              { level: 1 as const, title: 'المستوى ١', sub: 'ميسر', icon: '🌱' },
              { level: 2 as const, title: 'المستوى ٢', sub: 'متوسط', icon: '⚡' },
              { level: 3 as const, title: 'المستوى ٣', sub: 'متقدم', icon: '🔥' }
            ].map(item => {
              const isSelected = draftLevels.includes(item.level);
              return (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => handleToggleLevel(item.level)}
                  className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer select-none ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs font-black'
                      : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-xs font-black block">{item.title}</span>
                  <span className="text-[10px] font-bold text-slate-400 block">{item.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. إدخال عدد الأسئلة المطلوبة من هذا المجال (إدخال حر) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-slate-700">
            <span className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-500" />
              <span>٢. عدد الأسئلة المطلوبة من {title}:</span>
            </span>
            <span className="text-amber-600 font-mono font-black">{draftCount} أسئلة</span>
          </div>

          <div className="relative">
            <input
              type="number"
              min={1}
              max={categoryAvailableCount > 0 ? categoryAvailableCount : 1}
              value={draftCount}
              onChange={handleCountChange}
              onFocus={(e) => {
                e.target.select();
                if (e.target.value === '0') {
                  setDraftCount('' as any);
                }
              }}
              onBlur={(e) => {
                if (e.target.value === '' || Number(e.target.value) < 1) {
                  setDraftCount(1);
                }
              }}
              disabled={categoryAvailableCount === 0}
              className="w-full p-3 bg-slate-50 border border-gray-300 rounded-lg text-center text-lg font-black font-mono text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="أدخل عدد الأسئلة"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
            <span>الحد الأدنى: 1 سؤال</span>
            <span>
              الحد الأقصى المتاح في هذا المجال:{' '}
              <strong className="text-amber-600 font-black">
                {categoryAvailableCount} سؤال
              </strong>
            </span>
          </div>

          {categoryAvailableCount === 0 && (
            <p className="text-[11px] font-bold text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200 text-center">
              ⚠️ لا توجد أسئلة متوفرة حالياً في المستويات المحددة لهذا المجال.
            </p>
          )}
        </div>

        {/* 3. قائمة المواضيع الفرعية الخاصة بهذا المجال فقط */}
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span>٣. مواضيع {title}</span>
          </label>

          {/* خيار كافة مواضيع هذا المجال */}
          <div
            onClick={() => {
              setDraftIsAllTopics(true);
              setDraftSelectedTopics([]);
            }}
            className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer select-none ${
              draftIsAllTopics
                ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 shadow-2xs'
                : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌟</span>
              <div>
                <span className="text-xs sm:text-sm font-black block">
                  كافة موضوعات هذا المجال (عشوائي ومتنوع)
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  سحب الأسئلة من جميع موضوعات {title} المتاحة
                </span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                draftIsAllTopics ? 'bg-emerald-600 text-white shadow-2xs' : 'border border-slate-300 bg-white'
              }`}
            >
              {draftIsAllTopics && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          {/* قائمة المواضيع الفرعية المخصصة (إذا كانت متوفرة في هذا المجال) */}
          {categoryTopics.length > 0 && (
            <div className="space-y-2">
              <div
                onClick={() => {
                  setDraftIsAllTopics(false);
                  if (draftSelectedTopics.length === 0 && categoryTopics.length > 0) {
                    setDraftSelectedTopics([categoryTopics[0].name]);
                    setDraftTopicCounts({ [categoryTopics[0].name]: draftCount });
                  }
                }}
                className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer select-none ${
                  !draftIsAllTopics
                    ? 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-2xs'
                    : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <span className="text-xs sm:text-sm font-black block">
                      تحديد موضوعات معينة من {title}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      اختر موضوعات فرعية بعينها وحدد عدد أسئلة كل موضوع
                    </span>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    !draftIsAllTopics ? 'bg-amber-500 text-white shadow-2xs' : 'border border-slate-300 bg-white'
                  }`}
                >
                  {!draftIsAllTopics && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              {/* المواضيع الفرعية المحددة */}
              {!draftIsAllTopics && (
                <div className="space-y-2 pt-1">
                  {categoryTopics.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="ابحث في مواضيع هذا المجال..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div className="space-y-2 max-h-52 overflow-y-auto p-2 border border-slate-150 rounded-2xl bg-slate-50/50">
                    {filteredCategoryTopics.map(t => {
                      const isSelected = draftSelectedTopics.includes(t.name);
                      const currentCount = draftTopicCounts[t.name] || 3;

                      return (
                        <div
                          key={t.name}
                          className={`p-2.5 rounded-2xl border transition-all space-y-2 ${
                            isSelected
                              ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                              : 'bg-white border-slate-150 hover:border-amber-200'
                          }`}
                        >
                          <div
                            onClick={() => handleToggleTopic(t.name)}
                            className="flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-amber-500 text-white' : 'border border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="font-black text-xs text-slate-800 truncate">
                                {t.name}
                              </span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 shrink-0">
                              المتاح: {t.availableCount}
                            </span>
                          </div>

                          {isSelected && (
                            <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-amber-900">
                                عدد أسئلة هذا الموضوع:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={t.availableCount}
                                  value={currentCount}
                                  onChange={e => handleTopicCountChange(t.name, e.target.value, t.availableCount)}
                                  onFocus={(e) => {
                                    e.target.select();
                                    if (e.target.value === '0') {
                                      handleTopicCountChange(t.name, '', t.availableCount);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value === '' || Number(e.target.value) < 1) {
                                      handleTopicCountChange(t.name, '1', t.availableCount);
                                    }
                                  }}
                                  className="w-16 px-2 py-1 rounded-xl border border-amber-300 font-black text-xs text-center bg-white text-amber-900 focus:outline-none focus:border-amber-500 shadow-2xs font-mono"
                                />
                                <span className="text-xs font-bold text-amber-800">سؤال</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {categoryTopics.length === 0 && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-bold leading-relaxed">
              ℹ️ هذا القسم يضم أسئلة عامة ومباشرة، ويتم سحب الأسئلة تلقائياً بحسب العدد والمستويات المحددة.
            </div>
          )}
        </div>

        {/* 4. أزرار حفظ إعدادات المجال أو الإلغاء */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveSubSettings}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>حفظ إعدادات {title}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer transition-all"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

/**
 * -------------------------------------------------------------
 * 2. المكون الرئيسي: إعدادات المعلومات الإسلامية مع الهيكلية المتداخلة
 * -------------------------------------------------------------
 */
export const IslamicInfoSettingsForm: React.FC<IslamicInfoSettingsFormProps> = ({
  settings,
  onChange,
  onSave,
  onCancel,
  showActionButtons = true,
  saveButtonText = 'حفظ الإعدادات وتأكيد التفعيل',
  title
}) => {
  // تهيئة الأقسام المحددة
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (!settings.categories || settings.categories.length === 0) {
      return ['akida'];
    }
    const normalized = settings.categories.map(normalizeCategoryId);
    const valid = normalized.filter(id => islamicCategoriesList.some(c => c.id === id));
    return valid.length > 0 ? valid : ['akida'];
  });

  // خريطة الإعدادات الفرعية لكل مجال
  const [categorySettingsMap, setCategorySettingsMap] = useState<Record<string, CategorySubSettings>>(() => {
    const map: Record<string, CategorySubSettings> = {};
    const globalLevels = (settings.levels?.length ? settings.levels.map(Number) : [1, 2, 3]) as (1 | 2 | 3)[];
    const isGlobalAll = !settings.topics || settings.topics.includes('all') || settings.topics.length === 0;
    const initialCats = selectedCategories.length > 0 ? selectedCategories : ['akida'];
    const perCat = Math.max(1, Math.floor((settings.questionsCount || 5) / Math.max(1, initialCats.length)));

    initialCats.forEach(catId => {
      if (catId === 'seerah' || catId === 'general') {
        const isSpecific = !isGlobalAll && settings.topics?.includes(catId);
        const cnt = settings.topicCounts?.[catId] || (isSpecific ? 5 : perCat);
        map[catId] = {
          levels: globalLevels,
          questionsCount: Math.max(1, cnt),
          isAllTopics: true,
          selectedTopics: [],
          topicCounts: {}
        };
      } else if (islamicCategoriesData[catId]) {
        const catTopics = islamicCategoriesData[catId].topics.map(t => t.name);
        const matchingTopics = !isGlobalAll
          ? (settings.topics || []).filter(t => catTopics.includes(t))
          : [];

        if (matchingTopics.length > 0) {
          const tCounts: Record<string, number> = {};
          let catTotal = 0;
          matchingTopics.forEach(tName => {
            const c = settings.topicCounts?.[tName] || 3;
            tCounts[tName] = c;
            catTotal += c;
          });
          map[catId] = {
            levels: globalLevels,
            questionsCount: Math.max(1, catTotal),
            isAllTopics: false,
            selectedTopics: matchingTopics,
            topicCounts: tCounts
          };
        } else {
          map[catId] = {
            levels: globalLevels,
            questionsCount: Math.max(1, perCat),
            isAllTopics: true,
            selectedTopics: [],
            topicCounts: {}
          };
        }
      } else {
        map[catId] = {
          levels: globalLevels,
          questionsCount: Math.max(1, perCat),
          isAllTopics: true,
          selectedTopics: [],
          topicCounts: {}
        };
      }
    });

    return map;
  });

  // المجال المفتوح حالياً في النافذة المنبثقة الفرعية
  const [activeCategoryModal, setActiveCategoryModal] = useState<string | null>(null);

  /**
   * دالة تجميع الإعدادات من كافة المجالات الفرعية وحساب الـ Payload النهائي
   */
  const buildMergedSettings = (
    currentCategories: string[] = selectedCategories,
    currentMap: Record<string, CategorySubSettings> = categorySettingsMap
  ): IslamicInfoSettings => {
    const activeCats = currentCategories.length > 0 ? currentCategories : ['akida'];

    // 1. تجميع كافة المستويات المستخدمة
    const allLevelsSet = new Set<1 | 2 | 3>();
    activeCats.forEach(catId => {
      const cfg = currentMap[catId];
      const lvls = cfg?.levels?.length ? cfg.levels : ([1, 2, 3] as (1 | 2 | 3)[]);
      lvls.forEach(l => allLevelsSet.add(l));
    });
    const mergedLevels = Array.from(allLevelsSet).sort((a, b) => a - b) as (1 | 2 | 3)[];

    // 2. تجميع المواضيع وتوزيع الأعداد
    const mergedTopicCounts: Record<string, number> = {};
    const mergedTopicsList: string[] = [];

    const allCategoriesAreAllTopics = activeCats.every(catId => {
      const cfg = currentMap[catId];
      return !cfg || cfg.isAllTopics || cfg.selectedTopics.length === 0;
    });

    let totalQuestions = 0;

    activeCats.forEach(catId => {
      const cfg = currentMap[catId];
      const catCount = cfg?.questionsCount ? Math.max(1, cfg.questionsCount) : 5;
      totalQuestions += catCount;

      if (cfg && !cfg.isAllTopics && cfg.selectedTopics.length > 0) {
        cfg.selectedTopics.forEach(tName => {
          if (!mergedTopicsList.includes(tName)) {
            mergedTopicsList.push(tName);
          }
          mergedTopicCounts[tName] = cfg.topicCounts[tName] || Math.max(1, Math.floor(catCount / cfg.selectedTopics.length));
        });
      } else {
        if (!allCategoriesAreAllTopics) {
          if (catId === 'seerah' || catId === 'general') {
            if (!mergedTopicsList.includes(catId)) {
              mergedTopicsList.push(catId);
            }
            mergedTopicCounts[catId] = catCount;
          } else if (islamicCategoriesData[catId]) {
            const catTopics = islamicCategoriesData[catId].topics.map(t => t.name);
            catTopics.forEach(tName => {
              if (!mergedTopicsList.includes(tName)) {
                mergedTopicsList.push(tName);
              }
            });
            const perTopic = Math.max(1, Math.floor(catCount / Math.max(1, catTopics.length)));
            catTopics.forEach((tName, idx) => {
              mergedTopicCounts[tName] = (idx === 0) ? (catCount - perTopic * (catTopics.length - 1)) : perTopic;
            });
          }
        }
      }
    });

    if (allCategoriesAreAllTopics) {
      mergedTopicsList.push('all');
      mergedTopicCounts['all'] = totalQuestions;
    }

    if (!mergedTopicCounts['all']) {
      mergedTopicCounts['all'] = totalQuestions;
    }

    return {
      categories: activeCats,
      levels: mergedLevels.length > 0 ? mergedLevels : [1, 2, 3],
      topics: mergedTopicsList.length > 0 ? mergedTopicsList : ['all'],
      topicCounts: mergedTopicCounts,
      questionsCount: totalQuestions
    };
  };

  // إجمالي أسئلة المعلومات الإسلامية المختارة
  const totalIslamicQuestions = useMemo(() => {
    return selectedCategories.reduce((acc, catId) => {
      const cfg = categorySettingsMap[catId];
      return acc + (cfg?.questionsCount || 5);
    }, 0);
  }, [selectedCategories, categorySettingsMap]);

  // تبديل اختيار مجال
  const handleToggleCategory = (catId: string) => {
    let nextCategories: string[];
    const nextMap = { ...categorySettingsMap };

    if (selectedCategories.includes(catId)) {
      if (selectedCategories.length <= 1) return; // الحفاظ على مجال واحد على الأقل
      nextCategories = selectedCategories.filter(id => id !== catId);
    } else {
      nextCategories = [...selectedCategories, catId];
      if (!nextMap[catId]) {
        nextMap[catId] = {
          levels: [1, 2, 3],
          questionsCount: 5,
          isAllTopics: true,
          selectedTopics: [],
          topicCounts: {}
        };
      }
    }

    setSelectedCategories(nextCategories);
    setCategorySettingsMap(nextMap);

    const merged = buildMergedSettings(nextCategories, nextMap);
    onChange(merged);
  };

  // تحديد جميع المجالات دفعة واحدة
  const handleSelectAllCategories = () => {
    const allIds = islamicCategoriesList.map(c => c.id);
    const nextMap = { ...categorySettingsMap };

    allIds.forEach(id => {
      if (!nextMap[id]) {
        nextMap[id] = {
          levels: [1, 2, 3],
          questionsCount: 5,
          isAllTopics: true,
          selectedTopics: [],
          topicCounts: {}
        };
      }
    });

    setSelectedCategories(allIds);
    setCategorySettingsMap(nextMap);

    const merged = buildMergedSettings(allIds, nextMap);
    onChange(merged);
  };

  // فتح نافذة إعدادات مجال معين
  const handleOpenCategorySettings = (catId: string) => {
    setActiveCategoryModal(catId);
  };

  // حفظ الإعدادات الفرعية بعد تعديلها في النافذة المنبثقة
  const handleSaveSubModal = (catId: string, updatedSubSettings: CategorySubSettings) => {
    const nextMap = {
      ...categorySettingsMap,
      [catId]: updatedSubSettings
    };
    setCategorySettingsMap(nextMap);
    setActiveCategoryModal(null);

    const merged = buildMergedSettings(selectedCategories, nextMap);
    onChange(merged);
  };

  // الحفظ النهائي وتأكيد التفعيل
  const handleFinalSave = () => {
    const finalPayload = buildMergedSettings();
    onChange(finalPayload);
    if (onSave) {
      onSave(finalPayload);
    }
  };

  return (
    <div className="space-y-5 text-right" dir="rtl">
      {/* الترويسة الرئيسية (إن وجدت) */}
      {title && (
        <div className="flex items-center gap-3 pb-3 border-b border-slate-150">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-bold">
              حدد المجالات المطلوبة وقم بتخصيص إعدادات ومستويات كل مجال عبر زر الإعدادات الخاص به
            </p>
          </div>
        </div>
      )}

      {/* قسم المجالات والأقسام الإسلامية مع زر إعدادات لكل مجال */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>المجالات والأقسام الإسلامية</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              تم اختيار ({selectedCategories.length}) مجالات
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {islamicCategoriesList.map(cat => {
            const isSelected = selectedCategories.includes(cat.id);
            const catConfig = categorySettingsMap[cat.id];
            const catQuestionsCount = catConfig?.questionsCount || 5;
            const catLevels = catConfig?.levels || [1, 2, 3];

            return (
              <div
                key={cat.id}
                onClick={() => handleToggleCategory(cat.id)}
                className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between text-right gap-2.5 relative cursor-pointer select-none ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/80 shadow-xs scale-[1.01]'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1.5 shadow-2xs bg-white border border-slate-100 shrink-0">
                      <img src={cat.icon} alt={cat.title} className="w-full h-full object-contain" />
                    </div>
                    {/* مؤشر الاختيار */}
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                        isSelected ? 'bg-amber-500 text-white shadow-2xs' : 'border border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <span className={`text-xs font-black block truncate ${isSelected ? 'text-amber-950' : 'text-slate-800'}`}>
                    {cat.title}
                  </span>

                  {isSelected ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-black text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                        {catQuestionsCount} أسئلة
                      </span>
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded-full">
                        {catLevels.length === 3 ? 'كافة المستويات' : `${catLevels.length} مستويات`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 block truncate mt-1">
                      {cat.type === 'custom' ? `${cat.topicsCount} موضوعاً` : (cat.id === 'seerah' ? '60 سؤالاً' : '100 سؤال')}
                    </span>
                  )}
                </div>

                {/* زر الإعدادات الخاص بهذا المجال (Sub-Modal Button) */}
                {isSelected && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenCategorySettings(cat.id);
                    }}
                    className="w-full py-1.5 px-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer mt-1"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>إعدادات المجال ⚙️</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ملخص إجمالي الأسئلة والأقسام المحددة */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-300/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>إجمالي أسئلة المعلومات الإسلامية:</span>
          </span>
          <span className="text-base sm:text-lg font-black text-amber-900 font-mono">
            {totalIslamicQuestions} أسئلة
          </span>
        </div>

        {/* شرائح المجالات المختارة مع إمكانية النقر عليها لتعديل إعداداتها */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedCategories.map(catId => {
            const catMeta = islamicCategoriesList.find(c => c.id === catId);
            const cfg = categorySettingsMap[catId];
            const count = cfg?.questionsCount || 5;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => handleOpenCategorySettings(catId)}
                className="text-[11px] font-bold bg-white text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all active:scale-95"
                title="انقر لتعديل إعدادات هذا المجال"
              >
                <span>{catMeta?.title || catId}:</span>
                <strong className="text-amber-700 font-black">{count}</strong>
                <span className="text-slate-400 text-[10px]">⚙️</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* أزرار الحفظ والإلغاء الرئيسية */}
      {showActionButtons && (
        <div className="pt-2 flex items-center gap-3">
          {onSave && (
            <button
              type="button"
              onClick={handleFinalSave}
              disabled={totalIslamicQuestions <= 0}
              className={`flex-1 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md ${
                totalIslamicQuestions <= 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 cursor-pointer active:scale-98'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{saveButtonText}</span>
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

      {/* النافذة المنبثقة الفرعية (Sub-Modal) الخاصة بالمجال المفتوح */}
      <AnimatePresence>
        {activeCategoryModal && (
          <CategorySettingsModal
            catId={activeCategoryModal}
            initialConfig={
              categorySettingsMap[activeCategoryModal] || {
                levels: [1, 2, 3],
                questionsCount: 5,
                isAllTopics: true,
                selectedTopics: [],
                topicCounts: {}
              }
            }
            onSave={updated => handleSaveSubModal(activeCategoryModal, updated)}
            onClose={() => setActiveCategoryModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default IslamicInfoSettingsForm;
