import React, { useMemo } from "react";
import { normalizeArabicText } from "../utils/arabic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Sparkles, BookOpen, Search, XCircle, ChevronDown, Check,
  ChevronLeft, ChevronRight, Settings, ZoomIn, ZoomOut, Maximize2, Hash, Moon, RotateCcw, X, ListFilter
} from "lucide-react";
import { View } from "../types/challenges";
import { quranData } from "../services/QuranRepository";
import { ALL_QURAN_SURAHS, JUZ_NAMES_AR, juzBoundaries, getJuzsForSurah } from "../services/JuzRepository";
import { getPageNumber, juzStartPages, surahStartPages } from "../services/PageRepository";
import { renderQuranText } from "../utils/quranUtils";
import QuranZoomViewer from "../components/QuranZoomViewer";
import AyahActionSheet from "../components/AyahActionSheet";

export interface MushafPageProps {
  isPageModeActive: boolean;
  setIsPageModeActive: (active: boolean) => void;
  selectedSurahId: any;
  setSelectedSurahId: (id: any) => void;
  selectedJuz: any;
  setSelectedJuz: (juz: any) => void;
  isSearchSubmitted: boolean;
  setIsSearchSubmitted: (submitted: boolean) => void;
  librarySettings: any;
  setIsSettingsOpen: (open: boolean) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  isMushafFeaturesModalOpen: boolean;
  setIsMushafFeaturesModalOpen: (open: boolean) => void;
  isSurahMenuOpen: boolean;
  setIsSurahMenuOpen: (open: boolean) => void;
  isJuzMenuOpen: boolean;
  setIsJuzMenuOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  mushafZoomScale: number;
  setMushafZoomScale: React.Dispatch<React.SetStateAction<number>>;
  pageTurnDirection?: "next" | "prev" | null;
  setPageTurnDirection: (dir: any) => void;
  enterMushafFullscreen: () => void;
  selectedAyah: any;
  setSelectedAyah: (ayah: any) => void;
  setView: (view: View) => void;
}

export const MushafPage: React.FC<MushafPageProps> = ({
  isPageModeActive,
  setIsPageModeActive,
  selectedSurahId,
  setSelectedSurahId,
  selectedJuz,
  setSelectedJuz,
  isSearchSubmitted,
  setIsSearchSubmitted,
  librarySettings,
  setIsSettingsOpen,
  currentPage,
  setCurrentPage,
  isMushafFeaturesModalOpen,
  setIsMushafFeaturesModalOpen,
  isSurahMenuOpen,
  setIsSurahMenuOpen,
  isJuzMenuOpen,
  setIsJuzMenuOpen,
  searchQuery,
  setSearchQuery,
  mushafZoomScale,
  setMushafZoomScale,
  pageTurnDirection,
  setPageTurnDirection,
  enterMushafFullscreen,
  selectedAyah,
  setSelectedAyah,
  setView
}) => {
  const searchResults = useMemo(() => {
    const trimmed = (searchQuery || "").trim();
    if (!trimmed) return [];

    const normalizedQuery = normalizeArabicText(trimmed);
    if (!normalizedQuery) return [];

    const results: any[] = [];
    quranData.forEach(surah => {
      surah.verses.forEach((verse: any) => {
        const normalizedVerse = normalizeArabicText(verse.text);
        if (normalizedVerse.includes(normalizedQuery)) {
          results.push({ ...verse, surahName: surah.name, surahId: surah.id });
        }
      });
    });
    return results.sort((a, b) => a.text.length - b.text.length).slice(0, 100);
  }, [searchQuery]);

  return (
                  <motion.div
                    key="mushaf"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`w-full min-h-screen ${isPageModeActive ? 'max-w-full lg:max-w-[92rem] px-0' : 'md:max-w-5xl lg:max-w-6xl px-2 sm:px-4 md:px-6'} mx-auto space-y-4 pt-1 pb-44 sm:pb-56 md:pt-2 transition-all duration-500 overflow-y-auto`}
                  >
                    {!selectedSurahId && !selectedJuz && !isSearchSubmitted ? (
                      <div className="space-y-6 px-2 md:px-0">
                        {!isPageModeActive ? (
                          /* ========================================================
                             شاشة الترحيب والتعريف بمزايا المصحف الشريف وتفاصيل الآيات
                             ======================================================== */
                          <div className="space-y-5 max-w-4xl mx-auto px-2 md:px-0 py-1">
                            {/* شريط ملاحة علوي بسيط: العودة للمكتبة + شارة المصحف */}
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => {
                                  setView('library');
                                  setIsPageModeActive(false);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`px-4 py-2 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs md:text-sm shadow-xs cursor-pointer ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-emerald-400'
                                    : 'bg-white/80 border-slate-200 text-slate-600 hover:text-brand-emerald'
                                }`}
                              >
                                <ArrowRight className="w-4 h-4 text-brand-emerald" />
                                <span>العودة إلى المكتبة</span>
                              </button>

                              <span className="text-xs font-black px-3.5 py-1 rounded-full bg-emerald-500/10 text-brand-emerald border border-emerald-500/20 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                                <span>مصحف المدينة النبوية • أوفلاين 100%</span>
                              </span>
                            </div>

                            {/* رأس الصفحة: الأيقونة والعنوان والوصف (بدون خلفية بيضاء) */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right pt-1">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-brand-emerald to-teal-800 text-brand-gold flex items-center justify-center shrink-0 shadow-md border-2 border-brand-gold/30">
                                <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-brand-gold" />
                              </div>
                              <div className="flex-1">
                                <h2 className="text-2xl md:text-3xl font-black text-brand-emerald flex items-center justify-center sm:justify-start gap-2">
                                  <span>المصحف الشريف</span>
                                  <Sparkles className="w-5 h-5 text-brand-gold" />
                                </h2>
                                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                  نسخة رقمية تفاعلية فائقة الجودة بالرسم العثماني المعتمد لمصحف المدينة النبوية، تعمل محلياً بالكامل بدون إنترنت.
                                </p>
                              </div>
                            </div>

                            {/* أزرار العمل في الأعلى: فتح المصحف الشريف + زر الميزات */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1 w-full">
                              {/* زر فتح المصحف الشريف في الأعلى مباشرة */}
                              <button
                                onClick={() => {
                                  setIsPageModeActive(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="w-full sm:flex-1 px-5 md:px-8 py-3.5 md:py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm md:text-base shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2.5 border border-emerald-400/30 cursor-pointer group"
                              >
                                <BookOpen className="w-5 h-5 text-brand-gold group-hover:rotate-6 transition-transform" />
                                <span>فتح المصحف الشريف</span>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                                  {currentPage > 1 ? `متابعة (صفحة ${currentPage})` : 'سورة الفاتحة'}
                                </span>
                              </button>

                              {/* زر إظهار المميزات والخصائص في نافذة منبثقة */}
                              <button
                                onClick={() => setIsMushafFeaturesModalOpen(true)}
                                className={`w-full sm:w-auto px-5 py-3.5 md:py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-black text-xs md:text-sm shadow-xs cursor-pointer active:scale-95 ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-emerald-400'
                                    : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-brand-emerald hover:border-emerald-300'
                                }`}
                                title="عرض مميزات وخصائص المصحف"
                              >
                                <Sparkles className="w-4 h-4 text-brand-gold" />
                                <span>مميزات وخصائص المصحف</span>
                              </button>

                              {currentPage > 1 && (
                                <button
                                  onClick={() => {
                                    setCurrentPage(1);
                                    setIsPageModeActive(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`px-4 py-3.5 md:py-4 rounded-2xl border font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                    librarySettings.darkMode
                                      ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                                      : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title="البدء من الفاتحة صفحة 1"
                                >
                                  <RotateCcw className="w-4 h-4 text-slate-400" />
                                  <span>البدء من الفاتحة (ص 1)</span>
                                </button>
                              )}
                            </div>

                            {/* مربع الإرشاد البارز: لإظهار تفاصيل الآية، اضغط عليها (بدون خلفية بيضاء صلبة) */}
                            <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-colors space-y-4 ${
                              librarySettings.darkMode
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                                : 'bg-emerald-50/70 border-emerald-500/25 text-slate-800'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-emerald text-brand-gold flex items-center justify-center shrink-0 shadow-md">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="text-lg md:text-xl font-black text-brand-emerald">
                                    لإظهار تفاصيل الآية، اضغط عليها
                                  </h3>
                                  <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                                    أثناء تصفحك للمصحف، انقر مباشرة على أي آية وستظهر لك نافذة تفاعلية شاملة تقدم:
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* تفصيل 1: التفسير الميسر */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-emerald-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-xl">
                                    📖
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">التفسير الميسر أوفلاين</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      قراءة التفسير المعتمد للآية كاملاً وفهم معانيها مباشرة دون الحاجة لأي اتصال بالإنترنت.
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 2: كشف المتشابهات */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-amber-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-xl">
                                    🔍
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">كشف المتشابهات القرآنية</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      كشف فوري ودقيق للآيات المتشابهة لفظاً وموضعاً في كافة سور القرآن الكريم لضبط وتثبيت الحفظ.
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 3: الاستماع للتلاوة */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-blue-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-xl">
                                    🔊
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">الاستماع للتلاوة العطرة</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      استماع فوري للآية بصوت نخبة من كبار القراء (الحصري، المنشاوي، مشاري العفاسي، عبد الباسط).
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 4: نسخ ومشاركة الآية */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-purple-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 text-xl">
                                    📋
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">نسخ ومشاركة الآية</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      نسخ نص الآية الكريمة بالرسم العثماني المعتمد موثقة باسم السورة ورقم الآية للمشاركة السريعة.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* نافذة منبثقة لمميزات وخصائص المصحف الشريف */}
                            <AnimatePresence>
                              {isMushafFeaturesModalOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 shadow-2xl border ${
                                      librarySettings.darkMode
                                        ? 'bg-slate-900 border-slate-800 text-slate-100'
                                        : 'bg-white border-slate-200 text-slate-900'
                                    }`}
                                  >
                                    {/* رأس النافذة */}
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-emerald text-brand-gold flex items-center justify-center shadow-md">
                                          <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <h3 className="text-lg md:text-xl font-black text-brand-emerald">
                                            مميزات وخصائص المصحف الشريف
                                          </h3>
                                          <p className="text-xs font-bold text-slate-400">
                                            مصحف المدينة النبوية الشريف بالرسم العثماني • أوفلاين 100%
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => setIsMushafFeaturesModalOpen(false)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="إغلاق"
                                      >
                                        <X className="w-5 h-5" />
                                      </button>
                                    </div>

                                    {/* شبكة المميزات */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🖼️</span>
                                          <span>رسم عثماني أصيل فائق النقاء</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          صفحات مصحف المدينة النبوية المعتمدة عالية الدقة بدون أي حواف أو إطارات مشتتة.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🔎</span>
                                          <span>تكبير وتحريك ثنائي الأبعاد</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          حرية كاملة لتكبير الصفحات (2D Zoom & Pan) وقراءة الآيات بأي حجم مريح لعينيك.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">📑</span>
                                          <span>فهرس السور والأجزاء</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          تصفح سريع لكافة الـ 114 سورة والـ 30 جزءاً مع الانتقال المباشر لأي صفحة وبحث نصي ذكي.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">📴</span>
                                          <span>يعمل 100% بدون إنترنت</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          جميع صفحات المصحف وإحداثيات الآيات والتفاسير والمتشابهات مدمجة محلياً دون الحاجة لشبكة.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🌙</span>
                                          <span>الوضع الليلي والنهاري</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          خلفيات مخطوطات دافئة في النهار، مع وضع داكن مهدئ ومريح للقراءة في الليل.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🖥️</span>
                                          <span>قراءة غامرة بملء الشاشة</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          إمكانية تفعيل وضع ملء الشاشة لإخفاء كل ما حول الصفحة للتفرغ التام للتدبر والتلاوة.
                                        </p>
                                      </div>
                                    </div>

                                    {/* أزرار أسفل النافذة */}
                                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                      <button
                                        onClick={() => setIsMushafFeaturesModalOpen(false)}
                                        className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      >
                                        إغلاق
                                      </button>
                                      <button
                                        onClick={() => {
                                          setIsMushafFeaturesModalOpen(false);
                                          setIsPageModeActive(true);
                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="px-6 py-2.5 rounded-xl bg-brand-emerald text-white font-black text-xs hover:bg-brand-emerald/90 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                                      >
                                        <BookOpen className="w-4 h-4 text-brand-gold" />
                                        <span>فتح المصحف الآن</span>
                                      </button>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          /* ========================================================
                             وضع القراءة النشط: يظهر فقط شريط الفلاتر والبحث والمصحف
                             ======================================================== */
                          <>
                            {/* Header Title & Search Bar with Buttons Side-by-Side */}
                            <div className={`flex flex-col gap-4 p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm transition-colors ${librarySettings.darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/70 border-white/80 text-slate-900'
                              }`}>
                              <div className="flex items-center justify-between gap-4">
                                <h2 className={`text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3 ${librarySettings.darkMode ? 'text-emerald-400' : 'text-brand-emerald'
                                  }`}>
                                  <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-brand-gold" />
                                  {`المصحف الشريف - الصفحة ${currentPage}`}
                                </h2>

                                <button
                                  onClick={() => {
                                    setIsPageModeActive(false);
                                    setIsSurahMenuOpen(false);
                                    setIsJuzMenuOpen(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                    }`}
                                  title="دليل ومزايا المصحف"
                                >
                                  <ArrowRight className="w-4 h-4 text-brand-emerald" />
                                  <span>دليل المصحف</span>
                                </button>
                              </div>

                              {/* Row 1: Search Form + Settings + Fullscreen */}
                              <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 w-full">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    if (searchQuery.trim()) {
                                      setIsSearchSubmitted(true);
                                    }
                                  }}
                                  className="flex items-center gap-2 w-full sm:flex-1 min-w-0"
                                >
                                  <div className="relative flex-1 min-w-0">
                                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="ابحث عن آية أو كلمة..."
                                      value={searchQuery}
                                      onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (e.target.value === '') setIsSearchSubmitted(false);
                                      }}
                                      className={`w-full pr-9 sm:pr-10 pl-3 sm:pl-4 py-2 sm:py-2.5 md:py-3.5 rounded-2xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 transition-all font-bold text-xs sm:text-sm md:text-base ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900'
                                        }`}
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    className="px-3.5 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3.5 bg-brand-emerald text-white rounded-2xl font-black hover:bg-brand-emerald/90 transition-all shadow-md active:scale-95 whitespace-nowrap text-xs sm:text-sm md:text-base shrink-0 cursor-pointer"
                                  >
                                    بحث
                                  </button>
                                </form>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                                  {/* Settings button */}
                                  <button
                                    onClick={() => setIsSettingsOpen(true)}
                                    className={`flex-1 sm:flex-none px-3 sm:px-3.5 md:px-4 py-2 sm:py-2.5 md:py-3.5 rounded-2xl border transition-all shadow-sm flex items-center justify-center gap-1.5 font-bold text-xs md:text-sm whitespace-nowrap cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                      }`}
                                    title="إعدادات المصحف"
                                  >
                                    <Settings className="w-4 h-4 text-brand-emerald" />
                                    <span>الإعدادات</span>
                                  </button>

                                  {/* Fullscreen button */}
                                  <button
                                    type="button"
                                    onClick={enterMushafFullscreen}
                                    className={`flex-1 sm:flex-none px-3 sm:px-3.5 md:px-4 py-2 sm:py-2.5 md:py-3.5 rounded-2xl border transition-all shadow-sm flex items-center justify-center gap-1.5 font-bold text-xs md:text-sm whitespace-nowrap cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                      }`}
                                    title="ملء الشاشة"
                                  >
                                    <Maximize2 className="w-4 h-4 text-brand-gold" />
                                    <span>ملء الشاشة</span>
                                  </button>
                                </div>
                              </div>

                              {/* Row 2: Surah & Juz Buttons directly Underneath Search & Settings */}
                              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 w-full pt-1">
                                <button
                                  onClick={() => {
                                    setIsSurahMenuOpen(!isSurahMenuOpen);
                                    setIsJuzMenuOpen(false);
                                  }}
                                  className={`w-full sm:flex-1 py-2.5 md:py-3 rounded-2xl border transition-all font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs whitespace-nowrap cursor-pointer ${isSurahMenuOpen ? 'bg-brand-emerald text-white border-brand-emerald' : (librarySettings.darkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-emerald-600 hover:text-white' : 'bg-white text-slate-700 border-slate-200 hover:bg-brand-emerald/5 hover:text-brand-emerald')
                                    }`}
                                  title="تصفح بالسور"
                                >
                                  <BookOpen className="w-4 h-4 text-brand-gold" />
                                  <span>تصفح بالسور (114 سورة)</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setIsJuzMenuOpen(!isJuzMenuOpen);
                                    setIsSurahMenuOpen(false);
                                  }}
                                  className={`w-full sm:flex-1 py-2.5 md:py-3 rounded-2xl border transition-all font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs whitespace-nowrap cursor-pointer ${isJuzMenuOpen ? 'bg-brand-emerald text-white border-brand-emerald' : (librarySettings.darkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-emerald-600 hover:text-white' : 'bg-white text-slate-700 border-slate-200 hover:bg-brand-emerald/5 hover:text-brand-emerald')
                                    }`}
                                  title="تصفح بالأجزاء"
                                >
                                  <ListFilter className="w-4 h-4 text-brand-gold" />
                                  <span>تصفح بالأجزاء (30 جزء)</span>
                                </button>
                              </div>
                            </div>

                            {/* Surah Dropdown Popup Menu */}
                            <AnimatePresence>
                              {isSurahMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`backdrop-blur-xl p-4 rounded-3xl border shadow-lg ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/90 border-white/80'}`}
                                >
                                  <h3 className={`font-black text-sm mb-3 ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>اختر السورة (114 سورة):</h3>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
                                    {quranData.map((surah: any) => (
                                      <button
                                        key={surah.id}
                                        onClick={() => {
                                          setCurrentPage(surahStartPages[surah.id] || 1);
                                          setIsSurahMenuOpen(false);
                                          setIsPageModeActive(true);
                                        }}
                                        className={`p-2 rounded-xl transition-all text-xs font-bold text-right flex items-center justify-between ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
                                      >
                                        <span className="truncate">{surah.id}. {surah.name}</span>
                                        <span className="text-[9px] opacity-70">ص {surahStartPages[surah.id] || 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Juz Dropdown Popup Menu */}
                            <AnimatePresence>
                              {isJuzMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`backdrop-blur-xl p-4 rounded-3xl border shadow-lg ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/90 border-white/80'}`}
                                >
                                  <h3 className={`font-black text-sm mb-3 ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>اختر الجزء (1-30):</h3>
                                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                    {Array.from({ length: 30 }).map((_, i) => (
                                      <button
                                        key={i + 1}
                                        onClick={() => {
                                          setSelectedJuz(i + 1);
                                          setIsJuzMenuOpen(false);
                                          setCurrentPage(juzStartPages[i + 1] || 1);
                                          setIsPageModeActive(true);
                                        }}
                                        className={`aspect-square rounded-xl transition-all font-black text-xs flex flex-col items-center justify-center ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
                                      >
                                        <span className="text-[8px] opacity-50">جزء</span>
                                        <span>{i + 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Page Container: Premium Islamic Manuscript Background Frame */}
                            <div className="w-full flex flex-col items-center gap-4">
                              <div
                                className="w-full p-0 sm:p-1 md:p-2 border-0 md:border-2 md:border-brand-gold/30 md:rounded-[2.5rem] md:shadow-2xl transition-all relative group overflow-visible md:overflow-hidden"
                                style={{
                                  backgroundColor: librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
                                  color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                                  backgroundImage: librarySettings.darkMode
                                    ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.95) 75%)'
                                    : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, transparent 75%)',
                                }}
                              >
                                {/* Decorative Inner Gold Border Line for Desktop */}
                                <div className="hidden md:block absolute inset-2 rounded-[2rem] border border-brand-gold/20 pointer-events-none" />

                                {/* Full-Width Mobile & Desktop Image with 2D Pan, Pinch-Zoom & Page Flip */}
                                <div className="w-full flex flex-col items-center p-0 relative z-10 min-h-[50vh] sm:min-h-[70vh]">
                                  <QuranZoomViewer
                                    pageNumber={currentPage}
                                    darkMode={librarySettings.darkMode}
                                    isFullscreen={false}
                                    externalScale={mushafZoomScale}
                                    onExternalScaleChange={setMushafZoomScale}
                                    onPageTurn={(dir) => {
                                      setPageTurnDirection(dir);
                                      if (dir === 'next') {
                                        setCurrentPage(prev => Math.min(604, prev + 1));
                                      } else {
                                        setCurrentPage(prev => Math.max(1, prev - 1));
                                      }
                                    }}
                                    onTap={() => setSelectedAyah(null)}
                                    pageTurnDirection={pageTurnDirection}
                                    selectedAyah={selectedAyah}
                                    onSelectAyah={(s, a) => setSelectedAyah({ surah: s, ayah: a })}
                                  />
                                </div>
                              </div>

                              {/* Controls Area Completely OUTSIDE & BELOW Image Frame Container */}
                              <div className={`flex flex-col items-center gap-2 py-2 px-2 sm:py-2.5 sm:px-3 w-full max-w-2xl backdrop-blur-xl border rounded-2xl shadow-md mt-2 transition-colors ${librarySettings.darkMode
                                  ? 'bg-slate-900/95 border-slate-800 text-slate-100'
                                  : 'bg-white/85 border-slate-200/90 text-slate-800'
                                }`}>
                                {/* Single Row: Page Navigation + Zoom Controls Side-by-Side */}
                                <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 sm:gap-3 w-full">
                                  {/* Page Navigation Group */}
                                  <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-xs shrink-0 ${librarySettings.darkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200/80'
                                    }`}>
                                    <button
                                      onClick={() => {
                                        setPageTurnDirection('prev');
                                        setCurrentPage(prev => Math.max(1, prev - 1));
                                      }}
                                      disabled={currentPage === 1}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="الصفحة السابقة"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1 px-1">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={currentPage}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/[^0-9]/g, '');
                                          if (val === '') return;
                                          const num = parseInt(val);
                                          if (num >= 1 && num <= 604) {
                                            setCurrentPage(num);
                                          }
                                        }}
                                        className={`w-10 sm:w-12 border rounded text-center text-xs sm:text-sm font-black focus:outline-none focus:ring-1 focus:ring-brand-emerald/30 shadow-2xs py-0.5 ${librarySettings.darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-brand-emerald'
                                          }`}
                                      />
                                      <span className={`text-[10px] sm:text-xs font-bold shrink-0 ${librarySettings.darkMode ? 'text-slate-400' : 'text-slate-500'}`}>من 604</span>
                                    </div>

                                    <button
                                      onClick={() => {
                                        setPageTurnDirection('next');
                                        setCurrentPage(prev => Math.min(604, prev + 1));
                                      }}
                                      disabled={currentPage === 604}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="الصفحة التالية"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Separator Divider */}
                                  <div className={`w-px h-6 shrink-0 ${librarySettings.darkMode ? 'bg-slate-700' : 'bg-slate-300/80'}`} />

                                  {/* Zoom Controls Group */}
                                  <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-xs shrink-0 ${librarySettings.darkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200/80'
                                    }`}>
                                    <button
                                      onClick={() => setMushafZoomScale(prev => Math.min(1.8, Number((prev + 0.1).toFixed(1))))}
                                      disabled={mushafZoomScale >= 1.8}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="تكبير الصفحة"
                                    >
                                      <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>

                                    <button
                                      onClick={() => setMushafZoomScale(1)}
                                      className={`px-2 py-1 rounded border text-[10px] sm:text-xs font-black transition-colors shadow-2xs shrink-0 ${mushafZoomScale === 1
                                          ? (librarySettings.darkMode ? 'bg-emerald-900/60 border-emerald-500 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-brand-emerald font-black')
                                          : (librarySettings.darkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-300 text-slate-800 hover:text-brand-emerald')
                                        }`}
                                      title="إعادة تعيين 100%"
                                    >
                                      {Math.round(mushafZoomScale * 100)}%
                                    </button>

                                    <button
                                      onClick={() => setMushafZoomScale(prev => Math.max(0.7, Number((prev - 0.1).toFixed(1))))}
                                      disabled={mushafZoomScale <= 0.7}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="تصغير الصفحة"
                                    >
                                      <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Row 2: Index Return Button */}
                                <button
                                  onClick={() => {
                                    setIsPageModeActive(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white transition-all font-bold text-xs shadow-sm border active:scale-95 cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 hover:bg-emerald-600 border-slate-700' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-emerald-500/60'
                                    }`}
                                  title="العودة لدليل وفهرس المصحف"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-brand-gold" />
                                  <span>العودة لدليل وفهرس المصحف</span>
                                </button>
                              </div>

                              {/* Generous Bottom Spacer */}
                              <div className="h-28 sm:h-36 w-full shrink-0" />
                            </div>
                          </>
                        )}
                      </div>
                    ) : isSearchSubmitted && searchQuery.trim().length > 0 ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold">
                              <Search className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-xl md:text-3xl font-black text-brand-emerald">نتائج البحث</h2>
                              <p className="text-slate-400 font-bold text-sm">تم العثور على {searchResults.length} نتيجة لـ "{searchQuery}"</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setIsSearchSubmitted(false);
                            }}
                            className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            إلغاء البحث
                          </button>
                        </div>

                        <div className="glass p-8 md:p-12 rounded-[3rem] border border-white/50 shadow-2xl space-y-10">
                          {searchResults.length === 0 ? (
                            <div className="text-center py-20">
                              <p className="text-slate-400 font-bold text-xl italic">لا توجد نتائج تطابق بحثك..</p>
                            </div>
                          ) : (
                            <div className="space-y-10 divide-y divide-slate-100">
                              {searchResults.map((result, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (librarySettings.readingMode === 'page') {
                                      setCurrentPage(result.page);
                                      setIsPageModeActive(true);
                                      setIsSearchSubmitted(false);
                                    } else {
                                      setSelectedSurahId(result.surahId);
                                      setIsSearchSubmitted(false);
                                    }
                                  }}
                                  className="w-full text-right pt-10 first:pt-0 group focus:outline-none"
                                >
                                  <div className="flex items-center gap-4 mb-6">
                                    <span className="w-10 h-10 rounded-xl bg-brand-emerald/5 flex items-center justify-center text-brand-emerald font-black text-xs group-hover:bg-brand-emerald group-hover:text-white transition-all">
                                      {result.surahId}
                                    </span>
                                    <span className="text-lg font-black text-slate-700">سورة {result.surahName} - آية {result.id}</span>
                                  </div>
                                  <p className="text-xl md:text-3xl quran-text text-slate-800 leading-relaxed text-center group-hover:text-brand-emerald transition-colors">
                                    {result.text}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedJuz ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold">
                              <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-xl md:text-3xl font-black text-brand-emerald">الجزء {selectedJuz}</h2>
                              <p className="text-slate-400 font-bold text-sm">عرض آيات الجزء المختار</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setIsSettingsOpen(true)}
                              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm"
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setSelectedJuz(null)}
                              className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              إغلاق الجزء
                            </button>
                          </div>
                        </div>

                        <div className="w-full flex flex-col items-center gap-10 p-4 md:p-8 bg-white/40 rounded-[2.5rem] overflow-hidden min-h-[60vh]">
                          <motion.img
                            key={currentPage}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={`/quran-pages/${currentPage.toString().padStart(3, '0')}.png`}
                            alt={`صفحة ${currentPage}`}
                            className="w-full h-auto max-h-[200vh] object-contain shadow-premium rounded-2xl border border-white/60"
                          />

                          {/* Pagination controls for Juz Mode */}
                          <div className="flex flex-col items-center gap-6">
                            <div className="flex items-center justify-center gap-6 glass p-2 px-6 rounded-full shadow-lg border border-white/60 mx-auto w-fit">
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>

                              <div className="flex items-center gap-2 relative group">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentPage}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === '') return;
                                    const num = parseInt(val);
                                    if (num >= 1 && num <= 604) {
                                      setCurrentPage(num);
                                    }
                                  }}
                                  className="w-16 bg-transparent border-none text-center text-2xl font-black text-brand-emerald focus:outline-none appearance-none"
                                />
                                <span className="text-[10px] font-bold text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">صفحة</span>
                              </div>

                              <button
                                onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                disabled={currentPage === 604}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronLeft className="w-6 h-6" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedJuz(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                                librarySettings.darkMode
                                  ? 'bg-slate-800 text-slate-100 hover:bg-emerald-600 border border-slate-700'
                                  : 'bg-brand-emerald text-white hover:bg-emerald-700 shadow-emerald-800/20'
                              }`}
                            >
                              <RotateCcw className="w-4 h-4 text-brand-gold" />
                              <span>العودة لفهرس السور والأجزاء</span>
                            </button>
                          </div>
                          <div className="h-28 sm:h-36 w-full shrink-0" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between sticky top-4 z-50 glass p-6 rounded-[2.5rem] border border-white/80 shadow-2xl">
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold text-xl md:text-2xl font-black shadow-lg">
                              {selectedSurahId}
                            </div>
                            <div>
                              <h2 className="text-2xl md:text-3xl font-black text-brand-emerald leading-none">
                                سورة {quranData.find(s => s.id === selectedSurahId)?.name}
                              </h2>
                              <p className="text-slate-400 font-bold text-xs md:text-sm mt-1">
                                {quranData.find(s => s.id === selectedSurahId)?.type.toLowerCase() === 'meccan' ? 'سورة مكية' : 'سورة مدنية'} • {quranData.find(s => s.id === selectedSurahId)?.verses.length} آية
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedSurahId(null)}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-brand-emerald hover:bg-white transition-all shadow-sm"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        <div className="glass p-8 md:p-12 rounded-[3.5rem] md:rounded-[4rem] border border-white/50 shadow-2xl space-y-12 bg-white/40 backdrop-blur-3xl min-h-[60vh]">
                          {selectedSurahId !== 1 && selectedSurahId !== 9 && (
                            <div className="text-center py-8">
                              <p className="text-3xl md:text-4xl quran-text text-brand-emerald font-bold mb-4 opacity-80">
                                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                              </p>
                              <div className="w-24 h-1 bg-brand-gold/20 mx-auto rounded-full" />
                            </div>
                          )}

                          <div className="w-full flex justify-center p-4 md:p-8 bg-white/40 rounded-[2.5rem] overflow-hidden">
                            <motion.img
                              key={currentPage}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              src={`/quran-pages/${currentPage.toString().padStart(3, '0')}.png`}
                              alt={`صفحة ${currentPage}`}
                              className="w-full h-auto max-h-[200vh] object-contain shadow-premium rounded-2xl border border-white/60"
                            />
                          </div>

                          {/* Pagination controls for Surah mode */}
                          <div className="flex flex-col items-center gap-6">
                            <div className="flex items-center justify-center gap-6 glass p-2 px-6 rounded-full shadow-lg border border-white/60 mx-auto w-fit">
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>

                              <div className="flex items-center gap-2 relative group">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentPage}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === '') return;
                                    const num = parseInt(val);
                                    if (num >= 1 && num <= 604) {
                                      setCurrentPage(num);
                                    }
                                  }}
                                  className="w-16 bg-transparent border-none text-center text-2xl font-black text-brand-emerald focus:outline-none appearance-none"
                                />
                                <span className="text-[10px] font-bold text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">صفحة</span>
                              </div>

                              <button
                                onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                disabled={currentPage === 604}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronLeft className="w-6 h-6" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedSurahId(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                                librarySettings.darkMode
                                  ? 'bg-slate-800 text-slate-100 hover:bg-emerald-600 border border-slate-700'
                                  : 'bg-brand-emerald text-white hover:bg-emerald-700 shadow-emerald-800/20'
                              }`}
                            >
                              <RotateCcw className="w-4 h-4 text-brand-gold" />
                              <span>العودة لفهرس السور والأجزاء</span>
                            </button>
                          </div>
                          <div className="h-28 sm:h-36 w-full shrink-0" />
                        </div>
                      </div>
                    )}
                  </motion.div>
  );
};

export default MushafPage;
