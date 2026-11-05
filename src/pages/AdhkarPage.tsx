import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Settings, RotateCcw, XCircle, Sun, Moon,
  Compass, Home, Plane, BookOpen, CheckCircle, ArrowRight,
  Shield, Heart, CloudRain, Utensils, ChevronLeft, Search
} from 'lucide-react';
import { adhkarData, resolveAdhkarCategoryId } from '../services/AdhkarRepository';

export interface AdhkarPageProps {
  adhkarSearchQuery: string;
  setAdhkarSearchQuery: (query: string) => void;
  selectedAdhkarCategoryId: string | null;
  setSelectedAdhkarCategoryId: (id: string | null) => void;
  adhkarProgress: Record<string, number>;
  setAdhkarProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setIsSettingsOpen: (isOpen: boolean) => void;
  handleBackToHome: () => void;
}

// Classification Tabs for Adhkar
interface AdhkarTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADHKAR_TABS: AdhkarTab[] = [
  { id: 'all', label: 'جميع الأذكار', icon: Sparkles },
  { id: 'daily', label: 'أذكار اليوم', icon: Sun },
  { id: 'prayer', label: 'الصلاة والمساجد', icon: Compass },
  { id: 'protection', label: 'التحصين والأدعية', icon: Shield },
  { id: 'home', label: 'المنزل واليوميات', icon: Home },
  { id: 'travel', label: 'السفر والتنقل', icon: Plane },
  { id: 'occasions', label: 'المناسبات والأحوال', icon: Moon }
];

// Helper to match category to active tab
function categoryMatchesTab(cat?: { id?: string; title?: string } | null, tabId = 'all'): boolean {
  if (tabId === 'all') return true;
  if (!cat) return false;
  const t = (cat.title || '').toLowerCase();
  const id = (cat.id || '').toLowerCase();

  switch (tabId) {
    case 'daily':
      return (
        id === 'morning' || id === 'evening' || id === 'hisn_2' || id === 'hisn_3' || id === 'hisn_27' ||
        t.includes('صباح') || t.includes('مساء') || t.includes('نوم') || t.includes('استيقاظ') || t.includes('اليوم')
      );
    case 'prayer':
      return (
        t.includes('صلاة') || t.includes('مسجد') || t.includes('آذان') || t.includes('اذان') ||
        t.includes('تشهد') || t.includes('ركوع') || t.includes('سجود') || t.includes('وتر') ||
        t.includes('استخارة') || t.includes('سلام') || t.includes('استفتاح') || id === 'hisn_27'
      );
    case 'protection':
      return (
        t.includes('كرب') || t.includes('هم') || t.includes('حزن') || t.includes('شيطان') ||
        t.includes('وسوس') || t.includes('يعصم') || t.includes('يعوذ') || t.includes('دين') ||
        t.includes('خوف') || t.includes('مبتلى') || t.includes('غضب') || t.includes('فزع') ||
        t.includes('عدو') || t.includes('كيد') || t.includes('شرك') || t.includes('طيرة')
      );
    case 'home':
      return (
        t.includes('منزل') || t.includes('خلاء') || t.includes('وضوء') || t.includes('ثوب') ||
        t.includes('طعام') || t.includes('مجلس') || t.includes('عطاس') || t.includes('زوج') ||
        t.includes('أكل') || t.includes('ضيف')
      );
    case 'travel':
      return (
        t.includes('سفر') || t.includes('ركوب') || t.includes('سوق') || t.includes('قرية') ||
        t.includes('بلدة') || t.includes('مسافر') || t.includes('مركوب') || t.includes('رجوع')
      );
    case 'occasions':
      return (
        t.includes('مطر') || t.includes('ريح') || t.includes('رعد') || t.includes('هلال') ||
        t.includes('صائم') || t.includes('إفطار') || t.includes('مريض') || t.includes('عيادة') ||
        t.includes('مصيبة') || t.includes('ميت') || t.includes('قبر') || t.includes('جنازة') ||
        t.includes('حج') || t.includes('عمرة') || t.includes('عرف') || t.includes('صفا') ||
        t.includes('مولود') || t.includes('استسقاء') || t.includes('ذبح') || t.includes('توبة')
      );
    default:
      return true;
  }
}

// Category visual metadata helper
interface CategoryMeta {
  iconBg: string;
  iconNode: React.ReactNode;
}

function getCategoryMeta(cat?: { id?: string; title?: string; icon?: string } | null): CategoryMeta {
  if (!cat) {
    return {
      iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      iconNode: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }
  const id = (cat.id || '').toLowerCase();
  const t = (cat.title || '').toLowerCase();

  // 1. Primary Categories (distinct contextual icon wrappers, unified card background)
  if (id === 'morning' || t.includes('الصباح')) {
    return {
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      iconNode: <Sun className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (id === 'evening' || t.includes('المساء')) {
    return {
      iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
      iconNode: <Moon className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (id === 'hisn_27' || (t.includes('بعد السلام') && t.includes('صلاة'))) {
    return {
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
      iconNode: <Compass className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (id === 'hisn_2' || t.includes('نوم')) {
    return {
      iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
      iconNode: <Moon className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  // 2. Regular Categories with contextual icons and wrappers
  if (t.includes('صلاة') || t.includes('مسجد') || t.includes('آذان') || t.includes('تشهد')) {
    return {
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
      iconNode: <Compass className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('شيطان') || t.includes('كرب') || t.includes('هم') || t.includes('حزن') || t.includes('يعصم')) {
    return {
      iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
      iconNode: <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('سفر') || t.includes('ركوب')) {
    return {
      iconBg: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400',
      iconNode: <Plane className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('منزل') || t.includes('خلاء') || t.includes('ثوب')) {
    return {
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
      iconNode: <Home className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('طعام') || t.includes('إفطار') || t.includes('أكل')) {
    return {
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
      iconNode: <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('مطر') || t.includes('ريح') || t.includes('رعد')) {
    return {
      iconBg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
      iconNode: <CloudRain className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  if (t.includes('سلام') || t.includes('أحبك') || t.includes('معروف')) {
    return {
      iconBg: 'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400',
      iconNode: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />
    };
  }

  // Default clean card style
  return {
    iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    iconNode: <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
  };
}

export const AdhkarPage: React.FC<AdhkarPageProps> = ({
  adhkarSearchQuery,
  setAdhkarSearchQuery,
  selectedAdhkarCategoryId,
  setSelectedAdhkarCategoryId,
  adhkarProgress,
  setAdhkarProgress,
  setIsSettingsOpen,
  handleBackToHome
}) => {
  const [activeTab, setActiveTab] = useState<string>('all');

  // Direct parameter & deep-link synchronization on mount only
  // Empty dependency array prevents infinite re-render loops and UI flickering
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    let matchedType: string | null = null;

    if (pathname.startsWith('/library/adhkar/')) {
      const sub = pathname.replace('/library/adhkar/', '').split('/')[0].split('?')[0].trim();
      if (sub) matchedType = sub;
    } else if (pathname.startsWith('/adhkar/')) {
      const sub = pathname.replace('/adhkar/', '').split('/')[0].split('?')[0].trim();
      if (sub) matchedType = sub;
    }
    if (!matchedType) {
      matchedType = params.get('type') || params.get('category') || params.get('id');
    }

    if (matchedType) {
      const resolvedId = resolveAdhkarCategoryId(matchedType);
      if (resolvedId) {
        setSelectedAdhkarCategoryId(resolvedId);
      }
    }
  }, []); // Run strictly on mount to avoid infinite loop when state updates

  const activeCategory = selectedAdhkarCategoryId 
    ? (adhkarData[selectedAdhkarCategoryId] || adhkarData[resolveAdhkarCategoryId(selectedAdhkarCategoryId)] || adhkarData['morning'])
    : null;

  // Filtered categories based on Search Query and Active Tab (no duplicate morning/evening or combined cards)
  const displayedCategories = useMemo(() => {
    const rawCategories = Object.values(adhkarData).filter(
      cat =>
        cat.id !== 'hisn_1' &&
        !cat.id.startsWith('hisn_1_') &&
        !cat.id.includes('_morning') &&
        !cat.id.includes('_evening') &&
        cat.title !== 'أذكار الصباح والمساء'
    );

    const q = adhkarSearchQuery.trim().toLowerCase();

    return rawCategories
      .filter(cat => {
        // If user is searching, match across category title
        const matchesQuery = !q || cat.title.toLowerCase().includes(q);
        // Match active tab
        const matchesTabFilter = q ? true : categoryMatchesTab(cat, activeTab);
        return matchesQuery && matchesTabFilter;
      })
      .sort((a, b) => {
        // Always place morning & evening first in 'all' and 'daily' tabs
        const aPriority = a.id === 'morning' ? 2 : a.id === 'evening' ? 1 : a.id === 'hisn_27' ? 0.5 : 0;
        const bPriority = b.id === 'morning' ? 2 : b.id === 'evening' ? 1 : b.id === 'hisn_27' ? 0.5 : 0;
        return bPriority - aPriority;
      });
  }, [adhkarSearchQuery, activeTab]);

  return (
    <motion.div
      key="adhkar"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8 transition-all duration-500 pb-24 px-3 sm:px-4"
    >
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-3.5 text-right w-full sm:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 flex items-center justify-center text-amber-300 shadow-md shrink-0">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-emerald-900 dark:text-regalGold-100">أذكار المسلم</h2>
            <p className="text-gray-400 dark:text-gray-400 font-bold text-xs sm:text-sm mt-0.5">حصن المسلم اليومي ومأثورات الأدعية</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-white dark:bg-obsidian-900 border border-gray-100 dark:border-slate-800 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all shadow-2xs cursor-pointer"
            title="الإعدادات"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedAdhkarCategoryId(null);
              handleBackToHome();
            }}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-obsidian-900 border border-gray-100 dark:border-slate-800 text-gray-600 dark:text-gray-200 font-bold text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span>الرئيسية</span>
          </button>
        </div>
      </div>

      {!activeCategory ? (
        /* =================== القائمة الرئيسية للتصنيفات =================== */
        <div className="space-y-4">
          {/* 2. Modern Search Bar */}
          <div className="max-w-2xl mx-auto w-full relative group">
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-emerald-600/50 group-focus-within:text-emerald-700 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={adhkarSearchQuery}
              onChange={(e) => setAdhkarSearchQuery(e.target.value)}
              placeholder="ابحث في أبواب الأذكار والأدعية... (مثال: الصباح، النوم، المسجد، السفر)"
              className="w-full h-13 sm:h-14 bg-white dark:bg-obsidian-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl pr-12 pl-10 text-sm sm:text-base font-bold text-gray-800 dark:text-slate-100 placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-2xs"
            />
            {adhkarSearchQuery && (
              <button
                type="button"
                onClick={() => setAdhkarSearchQuery('')}
                className="absolute inset-y-0 left-3.5 flex items-center text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 3. Horizontal Scrollable Tabs Bar */}
          <div className="w-full overflow-x-auto scrollbar-none py-1 px-0.5 flex items-center gap-2 scroll-smooth">
            {ADHKAR_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm shadow-emerald-700/20'
                      : 'bg-white dark:bg-obsidian-900 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 shadow-2xs'
                  }`}
                >
                  <TabIcon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* 4. 2-Column Wide Cards Grid (Max 2 columns, spacious & premium) */}
          {displayedCategories.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-obsidian-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-8 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">لم يتم العثور على أذكار مطابقة</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                يرجى التأكد من كتابة الكلمات بشكل صحيح أو اختيار تبويب تصنيف آخر
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedCategories.map((cat) => {
                const meta = getCategoryMeta(cat);
                return (
                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    key={cat.id}
                    onClick={() => {
                      setSelectedAdhkarCategoryId(cat.id);
                      setAdhkarSearchQuery('');
                      if (typeof window !== 'undefined' && window.history) {
                        window.history.pushState({ view: 'adhkar', category: cat.id }, '', `/adhkar/${cat.id}`);
                      }
                    }}
                    className="w-full p-3.5 sm:p-4 rounded-2xl border border-gray-150/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 hover:border-emerald-300 dark:hover:border-emerald-600/50 shadow-2xs hover:shadow-xs relative overflow-hidden text-right flex items-center justify-between gap-2.5 transition-all duration-200 cursor-pointer group"
                  >
                    {/* Subtle Geometric Islamic Corner Watermark (opacity 3%) */}
                    <div className="absolute -left-2 -bottom-2 w-16 h-16 bg-[url('/islamic_pattern.png')] dark:bg-[url('/islamic_pattern_dark.png')] bg-contain bg-no-repeat opacity-[0.03] pointer-events-none" />

                    {/* Right Side: Circular/Rounded Icon Wrapper + Title */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 z-10 flex-1">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 group-hover:scale-105 ${meta.iconBg}`}>
                        {meta.iconNode}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-100 truncate leading-snug">
                        {cat.title}
                      </h3>
                    </div>

                    {/* Left Side: Clean Arrow Container (Transparent, Centered, No Shadow/Square Box) */}
                    <div className="flex items-center justify-center bg-transparent text-gray-400 dark:text-gray-500 shrink-0 z-10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* =================== واجهة الأذكار المخصصة والتفاصيل =================== */
        <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Header & Back Action */}
          <div className="flex items-center justify-between bg-white dark:bg-obsidian-900 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
                {getCategoryMeta(activeCategory).iconNode}
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-regalGold-100">
                  {activeCategory.title}
                </h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  إجمالي الأذكار: {activeCategory.items?.length || 0}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedAdhkarCategoryId(null);
                if (typeof window !== 'undefined' && window.history) {
                  window.history.pushState({ view: 'adhkar' }, '', '/adhkar');
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>كافة الأذكار</span>
            </button>
          </div>

          {/* Cards List for active Dhikr */}
          <div className="grid gap-4">
            {(activeCategory.items || []).map((dhikr) => {
              const currentRemaining = adhkarProgress[dhikr.id] ?? dhikr.count;
              const isCompleted = currentRemaining === 0;

              return (
                <motion.div
                  key={dhikr.id}
                  layout
                  className={`p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border relative overflow-hidden transition-all duration-300 cursor-pointer ${
                    isCompleted
                      ? 'bg-gray-50/70 dark:bg-slate-900/40 border-gray-200/50 opacity-65 grayscale-20'
                      : 'bg-white dark:bg-obsidian-900 border-gray-100 dark:border-slate-800 hover:shadow-md hover:border-emerald-200 active:scale-[0.99] shadow-2xs'
                  }`}
                  onClick={() => {
                    if (isCompleted) return;
                    setAdhkarProgress(prev => ({ ...prev, [dhikr.id]: Math.max(0, currentRemaining - 1) }));
                    if (typeof window !== 'undefined' && window.navigator.vibrate) {
                      window.navigator.vibrate(40);
                    }
                  }}
                >
                  {/* Subtle Geometric Background Watermark */}
                  <div className="absolute -left-4 -bottom-4 w-32 h-32 bg-[url('/islamic_pattern.png')] dark:bg-[url('/islamic_pattern_dark.png')] bg-contain bg-no-repeat opacity-[0.04] pointer-events-none" />

                  {/* Progress Line */}
                  <div className="absolute bottom-0 right-0 left-0 h-1 bg-gray-100 dark:bg-slate-800">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(currentRemaining / dhikr.count) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 md:gap-8 relative z-10">
                    <div className="flex-1 space-y-3.5">
                      <p className="quran-text text-gray-800 dark:text-regalGold-100 leading-[1.75] md:leading-relaxed text-lg md:text-2xl">
                        {dhikr.text}
                      </p>

                      {(dhikr.description || dhikr.reference) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {dhikr.description && (
                            <p className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                              {dhikr.description}
                            </p>
                          )}
                          {dhikr.reference && (
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                              {dhikr.reference}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Counter Button */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <motion.div
                        key={currentRemaining}
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center shadow-xs transition-all duration-300 ${
                          isCompleted
                            ? 'bg-emerald-500 text-white shadow-emerald-300/40 rotate-6 scale-105'
                            : 'bg-emerald-50 text-emerald-800 dark:bg-slate-800 dark:text-slate-100 border border-emerald-100 dark:border-slate-700'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-8 h-8 text-white" />
                        ) : (
                          <>
                            <span className="text-xl sm:text-2xl font-black tabular-nums font-mono">{currentRemaining}</span>
                            <span className="text-[9px] font-bold opacity-60">تكرار</span>
                          </>
                        )}
                      </motion.div>
                      <span className={`text-[10px] font-bold ${isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {isCompleted ? 'تم الإنجاز ✓' : 'انقر للعد'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bottom Back Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedAdhkarCategoryId(null);
              if (typeof window !== 'undefined' && window.history) {
                window.history.pushState({ view: 'adhkar' }, '', '/adhkar');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full py-4 bg-white dark:bg-obsidian-900 hover:bg-gray-50 text-gray-700 dark:text-gray-200 font-bold rounded-2xl border border-gray-100 dark:border-slate-800 transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-emerald-600" />
            <span>الرجوع إلى قائمة الأذكار</span>
          </button>
        </div>
      )}

      {/* Global Reset Button */}
      <div className="text-center pt-6 pb-4">
        <button
          type="button"
          onClick={() => setAdhkarProgress({})}
          className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-400 hover:text-emerald-700 hover:border-emerald-300 dark:hover:text-emerald-400 transition-all active:scale-95 cursor-pointer bg-white dark:bg-obsidian-900 shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-180 transition-transform duration-500 text-emerald-600" />
          <span>إعادة تصفير جميع عدادات اليوم</span>
        </button>
      </div>
    </motion.div>
  );
};

export default AdhkarPage;
