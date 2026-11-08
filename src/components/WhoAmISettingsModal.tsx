import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export interface WhoAmISettingsPayload {
  isSelected: boolean;
  questionsCount: number;
  categories: string[];
  categoryCounts: Record<string, number>;
}

export interface WhoAmISettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedCategories?: string[];
  questionCount?: number;
  availableCategories?: { id?: string; name: string; count?: number; icon?: string }[];
  onSave: (payload: WhoAmISettingsPayload) => void;
  onCancel?: () => void;
  title?: string;
  isEmbedded?: boolean;
}

const DEFAULT_CATEGORIES = [
  'الصحابة',
  'أنبياء ورسل',
  'العلماء',
  'غزوات ومعارك',
  'أمهات المؤمنين',
  'شخصيات إسلامية'
];

export const WhoAmISettingsModal: React.FC<WhoAmISettingsModalProps> = ({
  isOpen,
  onClose,
  selectedCategories: initialCategories = ['الصحابة'],
  questionCount: initialCount = 10,
  availableCategories,
  onSave,
  onCancel,
  title = 'إعدادات تحدي من أنا؟',
  isEmbedded = false
}) => {
  // 1. الفئات المحددة (selectedCategories)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    return initialCategories && initialCategories.length > 0 ? initialCategories : ['الصحابة'];
  });

  // 2. عدد الأسئلة المختار (questionsCount)
  const [selectedCount, setSelectedCount] = useState<number>(initialCount || 10);

  // 3. عدد الأسئلة المتوفرة ديناميكياً وحالة التحميل
  const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState<boolean>(false);

  // تحديث القيم عند تغير الـ props
  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setSelectedCategories(initialCategories);
    }
  }, [initialCategories]);

  useEffect(() => {
    if (initialCount) {
      setSelectedCount(initialCount);
    }
  }, [initialCount]);

  // قفل تمرير الخلفية إذا تم استخدام المكون كنافذة مستقلة
  useEffect(() => {
    if (isOpen && !isEmbedded) {
      document.body.classList.add('overflow-hidden');
    } else if (!isEmbedded) {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      if (!isEmbedded) {
        document.body.classList.remove('overflow-hidden');
      }
    };
  }, [isOpen, isEmbedded]);

  // 1. حساب الأسئلة المتوفرة ديناميكياً (Dynamic Count Fetching)
  // يعمل كلما تغيرت مصفوفة selectedCategories
  useEffect(() => {
    let isMounted = true;

    const fetchAvailableCount = async () => {
      if (!selectedCategories || selectedCategories.length === 0) {
        if (isMounted) setAvailableQuestionsCount(0);
        return;
      }

      setIsLoadingCount(true);
      try {
        // تجهيز الفئات مع معالجة التعريف والتنكير لمطابقة قاعدة البيانات بدقة
        const normalizedCats = Array.from(
          new Set(
            selectedCategories.flatMap((c) => {
              const trimmed = c.trim();
              if (trimmed === 'صحابة' || trimmed === 'الصحابة') return ['الصحابة', 'صحابة'];
              if (trimmed === 'أنبياء ورسل' || trimmed === 'الأنبياء' || trimmed === 'أنبياء')
                return ['أنبياء ورسل', 'الأنبياء', 'أنبياء'];
              if (trimmed === 'غزوات ومعارك' || trimmed === 'الغزوات' || trimmed === 'غزوات')
                return ['غزوات ومعارك', 'الغزوات', 'غزوات'];
              if (trimmed === 'علماء' || trimmed === 'العلماء') return ['العلماء', 'علماء'];
              if (trimmed === 'أمهات المؤمنين') return ['أمهات المؤمنين'];
              if (trimmed === 'شخصيات إسلامية') return ['شخصيات إسلامية'];
              return [trimmed, trimmed.startsWith('ال') ? trimmed.slice(2) : `ال${trimmed}`];
            })
          )
        );

        // استعلام قاعدة البيانات (جدول أسئلة تحدي من أنا: who_am_i_questions)
        const { count, error } = await supabase
          .from('who_am_i_questions')
          .select('*', { count: 'exact', head: true })
          .in('category', normalizedCats);

        if (!error && typeof count === 'number') {
          if (isMounted) setAvailableQuestionsCount(count);
        } else {
          // استعلام بديل عبر API لو حدث أي طارئ في اتصال Supabase المباشر
          const res = await fetch('/api/who-am-i?action=categories');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.categories)) {
              const total = data.categories
                .filter((cat: any) => normalizedCats.includes(cat.name))
                .reduce((sum: number, cat: any) => sum + (cat.count || 0), 0);
              if (isMounted) setAvailableQuestionsCount(total);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching WhoAmI questions count:', err);
      } finally {
        if (isMounted) setIsLoadingCount(false);
      }
    };

    fetchAvailableCount();

    return () => {
      isMounted = false;
    };
  }, [selectedCategories]);

  // التحقق والقيود: إذا كان العدد المتاح أقل من العدد المختار، يتم تقليص العدد المختار
  useEffect(() => {
    if (availableQuestionsCount > 0 && selectedCount > availableQuestionsCount) {
      const validOption = [20, 15, 10, 5].find((cnt) => cnt <= availableQuestionsCount);
      setSelectedCount(validOption || availableQuestionsCount);
    }
  }, [availableQuestionsCount, selectedCount]);

  // تبديل اختيار فئة
  const handleToggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // حفظ الإعدادات وتمرير الـ Payload
  const handleSave = () => {
    const counts: Record<string, number> = {};
    if (selectedCategories.length > 0) {
      const baseCount = Math.floor(selectedCount / selectedCategories.length);
      let remainder = selectedCount % selectedCategories.length;
      selectedCategories.forEach((cat) => {
        counts[cat] = Math.max(1, baseCount + (remainder > 0 ? 1 : 0));
        if (remainder > 0) remainder--;
      });
    }

    onSave({
      isSelected: true,
      questionsCount: selectedCount,
      categories: selectedCategories,
      categoryCounts: counts
    });
  };

  const handleCancelClick = () => {
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  const categoriesToRender =
    availableCategories && availableCategories.length > 0
      ? availableCategories.map((c) => c.name)
      : DEFAULT_CATEGORIES;

  // المحتوى الداخلي للنموذج
  const formContent = (
    <>
      {/* 1. رأس النافذة */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="text-right">
            <h3 className="text-base sm:text-lg font-black text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-bold">اختر الفئات وحدد عدد الأسئلة</p>
          </div>
        </div>
        {(onClose || onCancel) && (
          <button
            type="button"
            onClick={handleCancelClick}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. قسم اختيار الفئات */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-700">اختر الفئات المطلوبة للتحدي:</label>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            تم تحديد ({selectedCategories.length})
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categoriesToRender.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleToggleCategory(cat)}
                className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-black shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50'
                }`}
              >
                <span className="text-xs">{cat}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. قسم تحديد عدد الأسئلة (Question Count UI) */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs font-black text-slate-700">
          <div className="flex items-center gap-2">
            <span>حدد عدد الأسئلة:</span>
            <span className="text-[11px] font-bold text-slate-400">
              (المتوفر في الفئات المحددة:{' '}
              <span className="text-indigo-600 font-black">
                {isLoadingCount ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                    <span>جاري الحساب...</span>
                  </span>
                ) : (
                  `${availableQuestionsCount} سؤال`
                )}
              </span>
              )
            </span>
          </div>
          <span className="text-indigo-600 font-black text-xs">{selectedCount} أسئلة</span>
        </div>

        <div className="flex items-center gap-2">
          {[5, 10, 15, 20].map((cnt) => {
            const isDisabled = !isLoadingCount && availableQuestionsCount < cnt;
            const isSelected = selectedCount === cnt && !isDisabled;

            return (
              <button
                key={cnt}
                type="button"
                disabled={isDisabled}
                onClick={() => setSelectedCount(cnt)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDisabled
                    ? 'bg-slate-100/70 text-slate-300 cursor-not-allowed border border-dashed border-slate-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95'
                }`}
                title={isDisabled ? `غير متاح (العدد المتوفر ${availableQuestionsCount} فقط)` : undefined}
              >
                {cnt}
              </button>
            );
          })}
        </div>

        {!isLoadingCount && availableQuestionsCount === 0 && (
          <p className="text-[11px] font-bold text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200 text-center">
            ⚠️ لا توجد أسئلة متوفرة حالياً في الفئات المحددة. يرجى اختيار فئة أخرى.
          </p>
        )}
      </div>

      {/* 4. أزرار الحفظ والإلغاء */}
      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isLoadingCount && availableQuestionsCount === 0}
          className={`flex-1 py-3 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
            !isLoadingCount && availableQuestionsCount === 0
              ? 'bg-slate-300 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer active:scale-[0.98]'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>حفظ الإعدادات وتفعيل المهارة</span>
        </button>
        <button
          type="button"
          onClick={handleCancelClick}
          className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm cursor-pointer transition-all active:scale-[0.98]"
        >
          إلغاء
        </button>
      </div>
    </>
  );

  // إذا تم استدعاؤه داخل نافذة مدمجة أصلاً (مثل GroupCreatePage)
  if (isEmbedded) {
    return <div className="space-y-4 text-right" dir="rtl">{formContent}</div>;
  }

  // إذا تم استدعاؤه كنافذة مستقلة بـ Portal
  if (isOpen === false) return null;

  return typeof document !== 'undefined'
    ? createPortal(
        <AnimatePresence>
          {(isOpen === undefined || isOpen) && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
              dir="rtl"
              onClick={handleCancelClick}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 text-right space-y-5"
              >
                {formContent}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;
};

export default WhoAmISettingsModal;
