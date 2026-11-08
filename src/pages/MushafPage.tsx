import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { normalizeArabicText } from "../utils/arabic";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Sparkles, BookOpen, Search, XCircle, ChevronDown, Check,
  ChevronLeft, ChevronRight, Settings, ZoomIn, ZoomOut, Maximize2, Minimize2, Hash, Moon, RotateCcw, X, ListFilter,
  Clock, Info
} from "lucide-react";
import { View } from "../types/challenges";
import { quranData } from "../services/QuranRepository";
import { juzStartPages, surahStartPages, pageBoundaries } from "../services/PageRepository";
import QuranZoomViewer from "../components/QuranZoomViewer";
import AyahActionSheet from "../components/AyahActionSheet";
import UserWirdModal from "../components/UserWirdModal";
import { useApp } from "../contexts/AppContext";
import { router } from "../services/router";

// أسماء الأجزاء الثلاثين باللغة العربية
const JUZ_NAMES_ARABIC = [
  'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون', 'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون'
];

// تحويل الأرقام إلى أرقام عربية مشرقية
const toArabicIndic = (num: number | string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((ch) => {
      const parsed = parseInt(ch, 10);
      return !isNaN(parsed) && arabicDigits[parsed] !== undefined ? arabicDigits[parsed] : ch;
    })
    .join('');
};

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
  mushafZoomScale?: number;
  setMushafZoomScale?: React.Dispatch<React.SetStateAction<number>>;
  pageTurnDirection?: "next" | "prev" | null;
  setPageTurnDirection?: (dir: any) => void;
  enterMushafFullscreen: () => void;
  selectedAyah?: any;
  setSelectedAyah?: (ayah: any) => void;
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
  const app = useApp();
  const mushafContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [areFsControlsVisible, setAreFsControlsVisible] = useState(false);
  const fsControlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isWirdModalOpen, setIsWirdModalOpen] = useState(false);

  // 1. استعادة حالة الآية المحددة بأمان (الربط التلقائي مع AppContext والدعم المحلي كـ Fallback)
  const [internalSelectedAyah, setInternalSelectedAyah] = useState<any>(null);
  const activeSelectedAyah = selectedAyah !== undefined ? selectedAyah : (app?.selectedAyah !== undefined ? app.selectedAyah : internalSelectedAyah);

  const safeSetSelectedAyah = useCallback((ayah: any) => {
    setInternalSelectedAyah(ayah);
    if (typeof setSelectedAyah === 'function') {
      try {
        setSelectedAyah(ayah);
      } catch (e) {
        console.warn('[MushafPage] Error calling setSelectedAyah prop:', e);
      }
    }
    if (typeof app?.setSelectedAyah === 'function') {
      try {
        app.setSelectedAyah(ayah);
      } catch (e) {
        console.warn('[MushafPage] Error calling app.setSelectedAyah:', e);
      }
    }
  }, [setSelectedAyah, app?.setSelectedAyah]);

  // حالة نافذة مميزات وخصائص المصحف الشريف
  const [internalFeaturesModalOpen, setInternalFeaturesModalOpen] = useState(false);
  const isFeaturesOpen = typeof isMushafFeaturesModalOpen === 'boolean' ? isMushafFeaturesModalOpen : internalFeaturesModalOpen;
  const setFeaturesOpen = (val: boolean) => {
    setInternalFeaturesModalOpen(val);
    if (typeof setIsMushafFeaturesModalOpen === 'function') {
      setIsMushafFeaturesModalOpen(val);
    }
  };

  // Body scroll lock when Mushaf features modal is open
  useEffect(() => {
    if (isFeaturesOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isFeaturesOpen]);

  // Smart Verification for Daily Mystery Gift: Active Reading Time Tracker
  useEffect(() => {
    const dailyGift = app?.dailyGift;
    if (!dailyGift?.isRevealed || dailyGift?.type !== 'reading_time' || dailyGift?.isCompleted) {
      return;
    }

    const intervalId = setInterval(() => {
      // Pause if tab is inactive or hidden
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        app?.incrementDailyGiftReadingTime?.(1);
      }
    }, 1000);

    // CRITICAL CLEANUP: Stop tracking immediately when user exits MushafPage (Unmount)
    return () => {
      clearInterval(intervalId);
    };
  }, [
    app?.dailyGift?.isRevealed,
    app?.dailyGift?.type,
    app?.dailyGift?.isCompleted,
    app?.incrementDailyGiftReadingTime
  ]);

  const resetFsControlsTimer = useCallback(() => {
    setAreFsControlsVisible(true);
    if (fsControlsTimerRef.current) {
      clearTimeout(fsControlsTimerRef.current);
    }
    fsControlsTimerRef.current = setTimeout(() => {
      setAreFsControlsVisible(false);
    }, 3500);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      resetFsControlsTimer();
    } else {
      setAreFsControlsVisible(true);
      if (fsControlsTimerRef.current) {
        clearTimeout(fsControlsTimerRef.current);
      }
    }
    return () => {
      if (fsControlsTimerRef.current) {
        clearTimeout(fsControlsTimerRef.current);
      }
    };
  }, [isFullscreen, resetFsControlsTimer]);
  const [internalZoomScale, setInternalZoomScale] = useState<number>(1);

  // حساب معلومات السورة والجزء ديناميكياً بناءً على رقم الصفحة الحالية
  const pageInfo = useMemo(() => {
    const pageNum = Math.max(1, Math.min(604, currentPage));

    let surahId = 1;
    for (let i = pageBoundaries.length - 1; i >= 0; i--) {
      if (pageNum >= pageBoundaries[i].page) {
        surahId = pageBoundaries[i].startSurah;
        break;
      }
    }
    const surahObj = quranData.find((s) => s.id === surahId);
    const surahName = surahObj ? surahObj.name : 'الفاتحة';

    let juzNumber = 1;
    for (let j = 30; j >= 1; j--) {
      if (pageNum >= (juzStartPages[j] || 1)) {
        juzNumber = j;
        break;
      }
    }
    const juzName = JUZ_NAMES_ARABIC[juzNumber - 1] || `${juzNumber}`;

    return {
      surahId,
      surahName,
      juzNumber,
      juzName,
      pageNum
    };
  }, [currentPage]);

  // التأكد من بدء وضع صفحات المصحف مباشرة عند الدخول
  useEffect(() => {
    if (!isPageModeActive) {
      setIsPageModeActive(true);
    }
  }, [isPageModeActive, setIsPageModeActive]);

  // إغلاق وضع المصحف والعودة إلى المكتبة
  const handleCloseMushaf = useCallback(() => {
    if (app?.exitMushafFullscreen) app.exitMushafFullscreen();
    setIsFullscreen(false);
    if (typeof setMushafZoomScale === 'function') {
      setMushafZoomScale(1);
    } else {
      setInternalZoomScale(1);
    }
    setIsPageModeActive(false);
    setSelectedSurahId(null);
    setSelectedJuz(null);
    setIsSearchSubmitted(false);
    safeSetSelectedAyah(null);
    if (setView) {
      setView('library');
    } else if (app?.setView) {
      app.setView('library');
    }
    router.replace('/library');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setIsPageModeActive, setSelectedSurahId, setSelectedJuz, setIsSearchSubmitted, safeSetSelectedAyah, setView, app, setMushafZoomScale]);

  // التحكم بوضع ملء الشاشة عبر Fullscreen API القياسية على حاوية المصحف الرئيسية
  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const targetElement = mushafContainerRef.current || document.getElementById('mushaf-reader-container');
        if (targetElement) {
          if (targetElement.requestFullscreen) {
            await targetElement.requestFullscreen();
          } else if ((targetElement as any).webkitRequestFullscreen) {
            await (targetElement as any).webkitRequestFullscreen();
          } else if ((targetElement as any).msRequestFullscreen) {
            await (targetElement as any).msRequestFullscreen();
          }
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('[Mushaf Fullscreen] Error toggling fullscreen:', err);
      enterMushafFullscreen?.();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const activeElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const isTargetFullscreen = Boolean(
        activeElement && (
          activeElement === mushafContainerRef.current ||
          activeElement.id === 'mushaf-reader-container' ||
          Boolean(mushafContainerRef.current?.contains(activeElement as Node))
        )
      );
      setIsFullscreen(isTargetFullscreen);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const safeZoomScale = typeof mushafZoomScale === 'number' && Number.isFinite(mushafZoomScale) && mushafZoomScale > 0
    ? mushafZoomScale
    : internalZoomScale;

  const isFullscreenActive = isFullscreen || Boolean(app?.isMushafFullscreen);
  const isZoomMode = isFullscreenActive || safeZoomScale > 1.05;

  const updateZoomScale = (action: number | ((prev: number) => number)) => {
    if (typeof setMushafZoomScale === 'function') {
      setMushafZoomScale(action);
    } else {
      setInternalZoomScale(action);
    }
  };

  // Safe Page Navigation Handlers for Wird & Mushaf Reading
  const handleNextPage = () => {
    if (currentPage < 604) {
      if (typeof setPageTurnDirection === 'function') {
        try {
          setPageTurnDirection('next');
        } catch {}
      }
      setCurrentPage((prev) => Math.min(604, prev + 1));
      safeSetSelectedAyah(null);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (typeof setPageTurnDirection === 'function') {
        try {
          setPageTurnDirection('prev');
        } catch {}
      }
      setCurrentPage((prev) => Math.max(1, prev - 1));
      safeSetSelectedAyah(null);
    }
  };

  // Preload neighboring pages for instant display without flickering
  useEffect(() => {
    const pages = [currentPage - 2, currentPage - 1, currentPage + 1, currentPage + 2].filter(
      (p) => p >= 1 && p <= 604
    );
    pages.forEach((p) => {
      const img = new Image();
      img.src = `/quran-pages/${p.toString().padStart(3, '0')}.png`;
    });
  }, [currentPage]);

  // Deep Link ?page=X capture to bypass index and open page directly
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam) {
        const pageNum = parseInt(pageParam, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
          setCurrentPage(pageNum);
          setIsPageModeActive(true);
        }
      }
    } catch {
      // ignore
    }
  }, [setCurrentPage, setIsPageModeActive]);

  // Synchronize external selection of Surah or Juz into unified Page Mode without isolated sub-views
  useEffect(() => {
    if (selectedSurahId) {
      const targetPage = surahStartPages[selectedSurahId] || 1;
      setCurrentPage(targetPage);
      setIsPageModeActive(true);
      setSelectedSurahId(null);
      try {
        window.history.replaceState({ page: targetPage, view: 'mushaf' }, '', `/mushaf?page=${targetPage}`);
      } catch {}
    }
  }, [selectedSurahId, setCurrentPage, setIsPageModeActive, setSelectedSurahId]);

  useEffect(() => {
    if (selectedJuz) {
      const targetPage = juzStartPages[selectedJuz] || 1;
      setCurrentPage(targetPage);
      setIsPageModeActive(true);
      setSelectedJuz(null);
      try {
        window.history.replaceState({ page: targetPage, view: 'mushaf' }, '', `/mushaf?page=${targetPage}`);
      } catch {}
    }
  }, [selectedJuz, setCurrentPage, setIsPageModeActive, setSelectedJuz]);

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`w-full transition-all duration-300 ${
        isZoomMode
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#121619] dark:bg-[#0B132B] p-0 m-0 overflow-hidden flex flex-col justify-between select-none'
          : 'min-h-screen max-w-full lg:max-w-[92rem] mx-auto px-2 sm:px-4 pt-1 pb-16 sm:pb-20 flex flex-col items-center gap-3 overflow-y-auto'
      }`}
    >
      {!selectedSurahId && !selectedJuz && !isSearchSubmitted ? (
        <>
          {/* 1. الشريط العلوي الجديد البسيط (Header) - يظهر في جميع الحالات (الوضع العادي ووضع التكبير) */}
          <header
            className={`w-full transition-all duration-300 z-50 select-none ${
              isZoomMode
                ? 'fixed top-2 sm:top-3 inset-x-2 sm:inset-x-auto sm:max-w-xl mx-auto px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-2xl bg-slate-900/90 dark:bg-obsidian-950/90 border border-white/20 dark:border-regalGold-500/30 text-white shadow-2xl'
                : (librarySettings.darkMode
                    ? 'sticky top-0 max-w-3xl mx-auto px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-xl border border-slate-800 bg-slate-900/95 text-slate-100 shadow-md pt-[max(0.5rem,env(safe-area-inset-top))]'
                    : 'sticky top-0 max-w-3xl mx-auto px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-xl border border-slate-200/90 bg-white/95 text-slate-800 shadow-sm pt-[max(0.5rem,env(safe-area-inset-top))]'
                  )
            }`}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              {/* اليمين: عرض "اسم السورة - الجزء" الحالي بوضوح مع أيقونة مميزات المصحف */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsSurahMenuOpen(!isSurahMenuOpen);
                    setIsJuzMenuOpen(false);
                  }}
                  className="flex items-center gap-1 font-quran text-base sm:text-lg md:text-xl font-bold text-brand-gold dark:text-regalGold-400 hover:opacity-80 transition-opacity truncate cursor-pointer"
                  title="اختر سورة"
                >
                  <span>سورة {pageInfo.surahName}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>

                <span className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-bold shrink-0">-</span>

                <button
                  type="button"
                  onClick={() => {
                    setIsJuzMenuOpen(!isJuzMenuOpen);
                    setIsSurahMenuOpen(false);
                  }}
                  className="flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors truncate cursor-pointer"
                  title="اختر جزءاً"
                >
                  <span>الجزء {pageInfo.juzName}</span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                </button>

                {/* أيقونة مميزات وخصائص المصحف الشريف */}
                <button
                  type="button"
                  onClick={() => setFeaturesOpen(true)}
                  className="p-1 sm:p-1.5 rounded-xl text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/10 active:scale-90 transition-all cursor-pointer shrink-0 flex items-center justify-center border border-amber-500/20"
                  title="مميزات وخصائص المصحف الشريف"
                  aria-label="مميزات وخصائص المصحف الشريف"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              {/* اليسار: زر إغلاق (X) للعودة إلى المكتبة أو الصفحة الرئيسية app.setView('library') */}
              <button
                type="button"
                onClick={handleCloseMushaf}
                className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isZoomMode
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300'
                    : (librarySettings.darkMode
                        ? 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-500/30 text-rose-300'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600'
                      )
                }`}
                title="العودة إلى المكتبة"
                aria-label="العودة إلى المكتبة"
              >
                <span className="hidden sm:inline text-xs font-bold">المكتبة</span>
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          </header>

          {/* Surah Dropdown Popup Menu */}
          <AnimatePresence>
            {isSurahMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`w-full max-w-3xl mx-auto backdrop-blur-xl p-4 rounded-3xl border shadow-lg z-50 ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'}`}
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm text-brand-emerald dark:text-emerald-400">اختر السورة (114 سورة):</h3>
                  <button
                    type="button"
                    onClick={() => setIsSurahMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
                  {quranData.map((surah: any) => (
                    <button
                      key={surah.id}
                      onClick={(e) => {
                        e.preventDefault();
                        const targetPage = surahStartPages[surah.id] || 1;
                        setCurrentPage(targetPage);
                        setIsPageModeActive(true);
                        setIsSurahMenuOpen(false);
                        setIsJuzMenuOpen(false);
                        setSelectedSurahId(null);
                        setSelectedJuz(null);
                        setIsSearchSubmitted(false);
                        safeSetSelectedAyah(null);
                        try {
                          window.history.replaceState({ page: targetPage, view: 'mushaf' }, '', `/mushaf?page=${targetPage}`);
                        } catch {}
                      }}
                      className={`p-2 rounded-xl transition-all text-xs font-bold text-right flex items-center justify-between cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
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
                className={`w-full max-w-3xl mx-auto backdrop-blur-xl p-4 rounded-3xl border shadow-lg z-50 ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-200 text-slate-900'}`}
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-black text-sm text-brand-emerald dark:text-emerald-400">اختر الجزء (1-30):</h3>
                  <button
                    type="button"
                    onClick={() => setIsJuzMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={(e) => {
                        e.preventDefault();
                        const targetPage = juzStartPages[i + 1] || 1;
                        setCurrentPage(targetPage);
                        setIsPageModeActive(true);
                        setIsJuzMenuOpen(false);
                        setIsSurahMenuOpen(false);
                        setSelectedJuz(null);
                        setSelectedSurahId(null);
                        setIsSearchSubmitted(false);
                        safeSetSelectedAyah(null);
                        try {
                          window.history.replaceState({ page: targetPage, view: 'mushaf' }, '', `/mushaf?page=${targetPage}`);
                        } catch {}
                      }}
                      className={`aspect-square rounded-xl transition-all font-black text-xs flex flex-col items-center justify-center cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
                    >
                      <span className="text-[8px] opacity-50">جزء</span>
                      <span>{i + 1}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 2. حاوية صفحة المصحف ومكون التكبير */}
          <div
            ref={mushafContainerRef}
            id="mushaf-reader-container"
            className={`w-full flex-1 flex flex-col items-center justify-center transition-all ${
              isZoomMode
                ? 'relative w-full h-full p-0 m-0 overflow-hidden'
                : 'max-w-3xl mx-auto p-0 sm:p-2 border-0 md:border-2 md:border-brand-gold/30 md:rounded-[2.5rem] md:shadow-2xl overflow-hidden relative'
            }`}
            style={
              isZoomMode
                ? { backgroundColor: librarySettings.darkMode ? '#121619' : '#fcfaf5' }
                : {
                    backgroundColor: librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
                    color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                    backgroundImage: librarySettings.darkMode
                      ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.95) 75%)'
                      : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, transparent 75%)',
                  }
            }
          >
            <div className={`w-full flex flex-col items-center p-0 relative z-10 ${
              isZoomMode ? 'h-full justify-center' : 'min-h-[50vh] sm:min-h-[70vh]'
            }`}>
              <QuranZoomViewer
                pageNumber={currentPage}
                darkMode={librarySettings.darkMode}
                isFullscreen={isZoomMode}
                externalScale={safeZoomScale}
                onExternalScaleChange={updateZoomScale}
                onPageTurn={(dir) => {
                  if (dir === 'next') {
                    handleNextPage();
                  } else {
                    handlePrevPage();
                  }
                }}
                onTap={() => {
                  if (activeSelectedAyah) {
                    safeSetSelectedAyah(null);
                  }
                }}
                pageTurnDirection={pageTurnDirection || undefined}
                selectedAyah={activeSelectedAyah}
                onSelectAyah={(s, a) => safeSetSelectedAyah({ surah: s, ayah: a })}
              />
            </div>
          </div>

          {/* 3. الشريط السفلي الموحد (Bottom Controls) - المكان الوحيد للتنقل والتكبير والتصغير */}
          <footer
            className={`w-full transition-all duration-300 z-50 select-none ${
              isZoomMode
                ? 'fixed bottom-2 sm:bottom-4 inset-x-2 sm:inset-x-auto sm:max-w-xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-2xl bg-slate-900/90 dark:bg-obsidian-950/90 border border-white/20 dark:border-regalGold-500/30 text-white shadow-2xl'
                : (librarySettings.darkMode
                    ? 'sticky bottom-2 max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-xl border border-slate-800 bg-slate-900/95 text-slate-100 shadow-md pb-[max(0.5rem,env(safe-area-inset-bottom))]'
                    : 'sticky bottom-2 max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl backdrop-blur-xl border border-slate-200/90 bg-white/95 text-slate-800 shadow-md pb-[max(0.5rem,env(safe-area-inset-bottom))]'
                  )
            }`}
          >
            <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              {/* مجموعة التنقل: السابق - رقم الصفحة - التالي */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* زر السابق */}
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 shadow-2xs ${
                    isZoomMode
                      ? 'bg-white/10 hover:bg-emerald-600 border-white/20 text-white'
                      : (librarySettings.darkMode
                          ? 'bg-slate-800 hover:bg-emerald-600 border-slate-700 text-slate-200 hover:text-white'
                          : 'bg-slate-100 hover:bg-emerald-600 border-slate-200 text-slate-700 hover:text-white'
                        )
                  }`}
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>السابق</span>
                </button>

                {/* رقم الصفحة (مثال: 4 من 604) */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border shadow-inner ${
                  isZoomMode
                    ? 'bg-black/40 border-white/20 text-white'
                    : (librarySettings.darkMode
                        ? 'bg-slate-950/60 border-slate-700 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                      )
                }`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={currentPage}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      if (val === '') return;
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num >= 1 && num <= 604) {
                        setCurrentPage(num);
                        safeSetSelectedAyah(null);
                      }
                    }}
                    className={`w-9 sm:w-11 text-center text-xs sm:text-sm font-black bg-transparent focus:outline-none ${
                      isZoomMode
                        ? 'text-brand-gold font-mono'
                        : (librarySettings.darkMode ? 'text-emerald-400 font-mono' : 'text-brand-emerald font-mono')
                    }`}
                    aria-label="رقم الصفحة الحالية"
                  />
                  <span className="text-[11px] sm:text-xs font-bold opacity-70 whitespace-nowrap">
                    من 604
                  </span>
                </div>

                {/* زر التالي */}
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= 604}
                  className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer active:scale-95 shadow-2xs ${
                    isZoomMode
                      ? 'bg-white/10 hover:bg-emerald-600 border-white/20 text-white'
                      : (librarySettings.darkMode
                          ? 'bg-slate-800 hover:bg-emerald-600 border-slate-700 text-slate-200 hover:text-white'
                          : 'bg-slate-100 hover:bg-emerald-600 border-slate-200 text-slate-700 hover:text-white'
                        )
                  }`}
                  title="الصفحة التالية"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* مجموعة أزرار التكبير والتصغير (Zoom In / Out) */}
              <div className={`flex items-center gap-1 p-0.5 sm:p-1 rounded-xl border shadow-2xs shrink-0 ${
                isZoomMode
                  ? 'bg-black/40 border-white/20 text-white'
                  : (librarySettings.darkMode
                      ? 'bg-slate-800/90 border-slate-700/80 text-slate-200'
                      : 'bg-slate-100/90 border-slate-200/80 text-slate-700'
                    )
              }`}>
                {/* زر تكبير */}
                <button
                  type="button"
                  onClick={() => updateZoomScale(prev => Math.min(2.5, Number((prev + 0.15).toFixed(2))))}
                  disabled={safeZoomScale >= 2.5}
                  className="p-1.5 rounded-lg hover:bg-emerald-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                  title="تكبير الصفحة"
                  aria-label="تكبير الصفحة"
                >
                  <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* نسبة التكبير وزر إعادة الضبط */}
                <button
                  type="button"
                  onClick={() => updateZoomScale(1)}
                  className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-black transition-colors cursor-pointer ${
                    Math.abs(safeZoomScale - 1) < 0.05
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 opacity-80'
                  }`}
                  title="إعادة ضبط الحجم إلى 100%"
                >
                  {Math.round(safeZoomScale * 100)}%
                </button>

                {/* زر تصغير */}
                <button
                  type="button"
                  onClick={() => updateZoomScale(prev => Math.max(0.7, Number((prev - 0.15).toFixed(2))))}
                  disabled={safeZoomScale <= 0.7}
                  className="p-1.5 rounded-lg hover:bg-emerald-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                  title="تصغير الصفحة"
                  aria-label="تصغير الصفحة"
                >
                  <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </footer>
        </>
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
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const targetPage = result.page || surahStartPages[result.surahId] || 1;
                                    setCurrentPage(targetPage);
                                    setIsPageModeActive(true);
                                    setIsSearchSubmitted(false);
                                    setSelectedSurahId(null);
                                    setSelectedJuz(null);
                                    safeSetSelectedAyah({ surah: result.surahId, ayah: result.id });
                                    try {
                                      window.history.replaceState({ page: targetPage, view: 'mushaf' }, '', `/mushaf?page=${targetPage}`);
                                    } catch {}
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
                                  onFocus={(e) => e.target.select()}
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
                                  onFocus={(e) => e.target.select()}
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

                    {/* نافذة تحديد الورد القرآني المخصص */}
                    <UserWirdModal
                      isOpen={isWirdModalOpen}
                      onClose={() => setIsWirdModalOpen(false)}
                      currentPageNumber={currentPage}
                      onNavigateToPage={(pageNum) => {
                        setCurrentPage(pageNum);
                        setIsPageModeActive(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />

                    {/* نافذة مميزات وخصائص المصحف الشريف العالمية */}
                    <AnimatePresence>
                      {isFeaturesOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
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
                                onClick={() => setFeaturesOpen(false)}
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
                                onClick={() => setFeaturesOpen(false)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                إغلاق
                              </button>
                              <button
                                onClick={() => setFeaturesOpen(false)}
                                className="px-6 py-2.5 rounded-xl bg-brand-emerald text-white font-black text-xs hover:bg-brand-emerald/90 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                              >
                                <BookOpen className="w-4 h-4 text-brand-gold" />
                                <span>متابعة القراءة</span>
                              </button>
                            </div>
                                  </motion.div>
                                </div>
                              )}
                            
                    </AnimatePresence>
                  </motion.div>
  );
};

export default MushafPage;
