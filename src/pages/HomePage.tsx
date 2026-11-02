import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2, Play, Trophy, Star, CheckCircle2, Moon, Flame, Zap, ArrowLeft,
  Volume2, VolumeX, BookOpen, Share2, Check, Sparkles
} from 'lucide-react';
import { View } from '../types/challenges';
import Dashboard from '../components/Dashboard';
import { DailyChallengeEmblem, VideoLibraryIcon } from '../components/IslamicChallengeEmblems';
import { GooglePlayButton } from '../components/GooglePlayTesterModal';
import { useApp } from '../contexts/AppContext';
import { quranData } from '../services/QuranRepository';
import { pageBoundaries, juzStartPages } from '../services/PageRepository';

export interface HomePageProps {
  activeRunningRoom: any;
  handleResumeActiveRoom: (room: any) => void;
  playerName: string | null;
  isElite: boolean;
  isNameDecorated: boolean;
  currentStyle: any;
  motivationalQuote: string | null;
  streak: number;
  cups: number;
  totalPoints: number;
  completedChallengeIds: Set<any>;
  setIsOccasionsModalOpen: (open: boolean) => void;
  nearestOccasion: any;
  lastPlayedDate: string | null;
  dailyCompleted: boolean;
  setView: (view: View) => void;
  streakInfo: any;
  handleStartDaily: () => void;
  systemSettings: {
    hideIslamicVideos?: boolean;
    [key: string]: any;
  };
  isNativeApp: boolean;
  testerStatus: any;
  setShowGooglePlayModal: (show: boolean) => void;
}

// Convert numbers to Arabic-Indic digits
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

export const HomePage: React.FC<HomePageProps> = ({
  activeRunningRoom,
  handleResumeActiveRoom,
  playerName,
  isElite,
  isNameDecorated,
  currentStyle,
  motivationalQuote,
  streak,
  cups,
  totalPoints,
  completedChallengeIds,
  setIsOccasionsModalOpen,
  nearestOccasion,
  lastPlayedDate,
  dailyCompleted,
  setView,
  streakInfo,
  handleStartDaily,
  systemSettings,
  isNativeApp,
  testerStatus,
  setShowGooglePlayModal
}) => {
  const app = useApp();

  // Audio Playback for Ayah of the Day
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAyahPlaying, setIsAyahPlaying] = useState(false);
  const [isAyahCopied, setIsAyahCopied] = useState(false);

  // Quick Tasbih Counter State
  const [tasbihCount, setTasbihCount] = useState<number>(33);

  const defaultAyahText = "وَنُنَزِّلُ مِنَ الْقُرْآنِ مَا هُوَ شِفَاءٌ وَرَحْمَةٌ لِّلْمُؤْمِنِينَ";
  const activeAyahText = motivationalQuote || defaultAyahText;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTogglePlayAyah = () => {
    if (isAyahPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsAyahPlaying(false);
    } else {
      try {
        if (!audioRef.current) {
          // Recitation of Al-Isra Ayah 82 (Mishary Alafasy)
          audioRef.current = new Audio('https://everyayah.com/data/Alafasy_128kbps/017082.mp3');
          audioRef.current.onended = () => setIsAyahPlaying(false);
          audioRef.current.onerror = () => setIsAyahPlaying(false);
        }
        audioRef.current.play().then(() => {
          setIsAyahPlaying(true);
        }).catch(() => {
          setIsAyahPlaying(false);
        });
      } catch {
        setIsAyahPlaying(false);
      }
    }
  };

  const handleOpenAyahTafsir = () => {
    if (app.handleOpenTafsir) {
      app.handleOpenTafsir(17, 82, activeAyahText);
    }
  };

  const handleShareCurrentAyah = async () => {
    const textToShare = `﴿ ${activeAyahText} ﴾\nسُورَةُ الإِسْرَاءِ • الآيَةُ ٨٢\nتطبيق متين لعلوم القرآن الكريم`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'آية اليوم وتدبر',
          text: textToShare
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(textToShare);
      setIsAyahCopied(true);
      setTimeout(() => setIsAyahCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Khatmah Tracker Data
  const currentPage = app.currentPage || 1;
  const khatmahPercentage = Math.min(100, Math.max(1, Math.round((currentPage / 604) * 100)));

  const currentBoundary = useMemo(() => {
    return pageBoundaries.find((b) => b.page === currentPage) || pageBoundaries[0];
  }, [currentPage]);

  const currentSurah = useMemo(() => {
    return quranData.find((s) => s.id === currentBoundary.startSurah) || quranData[0];
  }, [currentBoundary]);

  const currentJuz = useMemo(() => {
    const found = Object.entries(juzStartPages)
      .reverse()
      .find(([_, startP]) => currentPage >= startP);
    return found ? found[0] : '1';
  }, [currentPage]);

  const currentHizb = useMemo(() => {
    const juzNum = parseInt(currentJuz, 10) || 1;
    const startOfJuz = juzStartPages[juzNum] || 1;
    return (juzNum - 1) * 2 + (currentPage - startOfJuz >= 10 ? 2 : 1);
  }, [currentJuz, currentPage]);

  // Tasbih increment with haptic feedback
  const handleTasbihTap = () => {
    setTasbihCount((prev) => (prev >= 100 ? 1 : prev + 1));
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-6 md:gap-8 max-w-6xl mx-auto py-6 md:py-10 px-3 sm:px-4 overflow-visible pb-36 sm:pb-48"
    >
      {/* Active Running Room Banner */}
      {activeRunningRoom && (
        <motion.div
          initial={{ opacity: 0, y: -15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="p-4 md:p-5 rounded-3xl bg-linear-to-r from-orange-500 via-amber-500 to-orange-600 text-white shadow-xl shadow-orange-500/25 border-2 border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-right"
        >
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <Gamepad2 className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] md:text-xs bg-white/25 px-2.5 py-0.5 rounded-full font-black text-white inline-block">
                  {activeRunningRoom.status === 'WAITING' ? 'غرفتك قيد الانتظار 👑' : 'تحدي جاري الآن ⚡'}
                </span>
                <span className="text-[10px] md:text-xs opacity-90 font-bold">
                  {activeRunningRoom.status === 'WAITING'
                    ? 'أنت منشئ الغرفة'
                    : (activeRunningRoom.transitionMode === 'ASYNC' ? 'سباق فردي سريع' : 'متزامن')}
                </span>
              </div>
              <h3 className="text-sm md:text-base font-black text-white mt-1">
                {activeRunningRoom.name || 'غرفة التحدي الجماعي'}
              </h3>
              <p className="text-[11px] text-orange-100 font-bold">
                {activeRunningRoom.status === 'WAITING'
                  ? 'أنشأت هذه الغرفة وما زالت بانتظار المتسابقين، يمكنك إدارتها وبدء التحدي!'
                  : 'لديك تحدي قيد التشغيل لم يكتمل بعد!'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleResumeActiveRoom(activeRunningRoom)}
            className="w-full sm:w-auto px-6 py-3 bg-white text-orange-700 hover:bg-orange-50 active:scale-95 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{activeRunningRoom.status === 'WAITING' ? 'دخول قاعة الانتظار (المضيف) 👑' : 'إكمال التحدي / العودة للغرفة'}</span>
          </button>
        </motion.div>
      )}

      {/* 1. Premium Welcome Header Section (Preserved Original Centered Header + Streak Pill + Ayah Actions) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center text-center space-y-4 mb-2"
      >
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-regalGold-100 dark:via-regalGold-300 dark:to-regalGold-200 tracking-tight">
            السلام عليكم يا{' '}
            <span
              className={`underline decoration-brand-gold/30 decoration-4 underline-offset-8 transition-all ${
                isElite && isNameDecorated && currentStyle
                  ? `text-transparent bg-clip-text bg-gradient-to-r ${currentStyle.textColor}`
                  : 'text-brand-emerald dark:text-holyEmerald-400'
              }`}
            >
              {playerName || 'يا ضيفنا الكريم'}
            </span>
          </h1>

          {/* New Feature 1: Streak Pill integrated beside greeting */}
          <button
            type="button"
            onClick={() => app.setShowStreakModal?.(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-regalGold-300 text-xs sm:text-sm font-black shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="انقر لعرض تفاصيل شعلة الحفظ والالتزام اليومي"
          >
            <span className="text-sm">🔥</span>
            <span>{streak > 0 ? `${toArabicIndic(streak)} أيام ممتدة` : 'ابدأ سلسلتك 🔥'}</span>
          </button>
        </div>

        {/* Motivational Quote / Hadith */}
        {motivationalQuote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="max-w-3xl mx-auto px-4 py-2 text-center"
          >
            <h3
              className="font-uthmani text-lg md:text-2xl lg:text-3xl text-emerald-950 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-regalGold-200 dark:via-regalGold-400 dark:to-regalGold-200 font-bold leading-relaxed"
              dir="rtl"
            >
              "{motivationalQuote}"
            </h3>

            {/* New Feature 1: Action Buttons under Ayah (Play, Tafsir, Share) */}
            <div className="flex items-center justify-center gap-2 pt-2.5 mt-1 flex-wrap">
              <button
                type="button"
                onClick={handleTogglePlayAyah}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all text-xs font-bold shadow-xs active:scale-95 cursor-pointer ${
                  isAyahPlaying
                    ? 'bg-holyEmerald-500/30 border-holyEmerald-400 text-holyEmerald-200'
                    : 'bg-white dark:bg-obsidian-850 hover:bg-slate-50 dark:hover:bg-obsidian-800 border-slate-200 dark:border-regalGold-500/25 text-slate-700 dark:text-regalGold-200'
                }`}
              >
                {isAyahPlaying ? (
                  <VolumeX className="w-3.5 h-3.5 text-holyEmerald-300" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-holyEmerald-400" />
                )}
                <span>{isAyahPlaying ? 'إيقاف التلاوة' : 'استماع للآية'}</span>
                <span className="flex items-center gap-0.5 h-3 mr-0.5">
                  <span className={`w-0.5 h-1.5 bg-holyEmerald-500 dark:bg-holyEmerald-400 rounded-full ${isAyahPlaying ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className={`w-0.5 h-3 bg-holyEmerald-500 dark:bg-holyEmerald-400 rounded-full ${isAyahPlaying ? 'animate-pulse' : 'opacity-40'}`} />
                  <span className={`w-0.5 h-2 bg-holyEmerald-500 dark:bg-holyEmerald-400 rounded-full ${isAyahPlaying ? 'animate-pulse' : 'opacity-40'}`} />
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenAyahTafsir}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-obsidian-850 hover:bg-slate-50 dark:hover:bg-obsidian-800 border border-slate-200 dark:border-regalGold-500/25 text-slate-700 dark:text-regalGold-200 active:scale-95 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs"
                title="عرض التفسير الميسر للآية الكريمة"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-regalGold-400" />
                <span>التفسير</span>
              </button>

              <button
                type="button"
                onClick={handleShareCurrentAyah}
                className="w-8 h-8 rounded-xl bg-white dark:bg-obsidian-850 hover:bg-slate-50 dark:hover:bg-obsidian-800 border border-slate-200 dark:border-regalGold-500/25 text-slate-700 dark:text-regalGold-200 flex items-center justify-center active:scale-95 transition-colors cursor-pointer shadow-xs"
                aria-label="مشاركة"
                title="مشاركة الآية الكريمة"
              >
                {isAyahCopied ? (
                  <Check className="w-3.5 h-3.5 text-holyEmerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </motion.div>
        )}

        <div className="h-1 w-20 bg-brand-gold/30 dark:bg-regalGold-500/40 rounded-full mx-auto mt-2" />
      </motion.div>

      {/* New Feature 3: Daily Khatmah Tracker Card (بطاقة الورد اليومي) */}
      <section className="w-full rounded-3xl glass-card bg-white dark:bg-obsidian-900/80 border border-slate-150 dark:border-regalGold-500/20 p-4 sm:p-5 shadow-xs text-right relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 border border-emerald-200/60 dark:border-holyEmerald-500/30 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                خَتْمَةُ الوِرْدِ اليَوْمِي
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-regalGold-300/70 font-medium">
                مُتَابَعَةُ القِرَاءَةِ مِنْ حَيْثُ وَقَفْت
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-holyEmerald-500/15 border border-emerald-200/60 dark:border-holyEmerald-500/30 text-emerald-800 dark:text-holyEmerald-300 text-[11px] font-black">
            {toArabicIndic(khatmahPercentage)}٪ مكتمل
          </span>
        </div>

        {/* Active Bookmark Details */}
        <div className="my-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-obsidian-850/90 border border-slate-150 dark:border-regalGold-500/20 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                سُورَةُ {currentSurah.name}
              </span>
              <span className="text-xs font-black text-emerald-700 dark:text-holyEmerald-400">
                الآيَة {toArabicIndic(currentBoundary.startVerse || 1)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-regalGold-300/70 font-semibold mt-0.5">
              الجزء {toArabicIndic(currentJuz)} • الحزب {toArabicIndic(currentHizb)} • الصفحة {toArabicIndic(currentPage)}
            </p>
          </div>

          {/* Circular Mini Progress Graphic */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-obsidian-750"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
              />
              <path
                className="text-emerald-500 dark:text-holyEmerald-400"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${khatmahPercentage}, 100`}
                strokeLinecap="round"
                strokeWidth="3.2"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-slate-800 dark:text-regalGold-200 font-mono">
              {toArabicIndic(khatmahPercentage)}٪
            </span>
          </div>
        </div>

        {/* Primary Action: Resume Recitation */}
        <button
          type="button"
          onClick={() => setView('mushaf')}
          className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-brand-emerald hover:bg-[#033628] dark:bg-gradient-to-r dark:from-holyEmerald-600 dark:via-holyEmerald-500 dark:to-holyEmerald-600 text-white dark:text-obsidian-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4 fill-current" />
          <span>مُتَابَعَةُ القِرَاءَةِ الآن</span>
        </button>
      </section>

      {/* Preserved Original Hub: Prayer Times (with Qibla badge) & 2x2 Stats Grid Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch px-1">
        {/* Prayer Times Box (Compact & Balanced with Qibla Badge) */}
        <div className="lg:col-span-6 flex flex-col">
          <Dashboard streakCount={streak} />
        </div>

        {/* 2x2 Stats Grid (مربعين فوق ومربعين تحت - Exactly preserved!) */}
        <div className="lg:col-span-6 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 h-full">
            {/* 1. إجمالي الكؤوس */}
            <div className="glass-card bg-white dark:bg-obsidian-900/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-amber-300 dark:hover:border-regalGold-500/40 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-regalGold-300/70 uppercase tracking-wider">
                  إجمالي الكؤوس
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-amber-500 dark:text-regalGold-400" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-regalGold-100 tabular-nums leading-tight block">
                  {toArabicIndic(cups)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-bold block mt-0.5">
                  الأوسمة والبطولات
                </span>
              </div>
            </div>

            {/* 2. نقاط المهارة */}
            <div className="glass-card bg-white dark:bg-obsidian-900/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-emerald-300 dark:hover:border-holyEmerald-500/40 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-regalGold-300/70 uppercase tracking-wider">
                  نقاط المهارة
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-emerald-600 dark:text-holyEmerald-400 fill-emerald-600 dark:fill-holyEmerald-400" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-regalGold-100 tabular-nums leading-tight block">
                  {toArabicIndic(totalPoints)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-bold block mt-0.5">
                  رصيد الخبرة
                </span>
              </div>
            </div>

            {/* 3. التقدم الكلي */}
            <div className="glass-card bg-white dark:bg-obsidian-900/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-teal-300 dark:hover:border-holyEmerald-500/40 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-regalGold-300/70 uppercase tracking-wider">
                  التقدم الكلي
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 dark:bg-holyEmerald-500/15 text-teal-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-holyEmerald-400" />
                </div>
              </div>
              <div className="mt-3 text-right">
                <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-regalGold-100 tabular-nums leading-tight block">
                  {toArabicIndic(completedChallengeIds.size)}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-bold block mt-0.5">
                  تحدياً مكتملاً
                </span>
              </div>
            </div>

            {/* 4. مواسم الطاعات وسنن الأيام */}
            <button
              type="button"
              onClick={() => setIsOccasionsModalOpen(true)}
              className="glass-card bg-white dark:bg-obsidian-900/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-amber-300 dark:hover:border-regalGold-500/40 hover:shadow-md transition-all duration-200 text-right group cursor-pointer"
              title="انقر لاستعراض أقرب مواسم الطاعات وسُنن الأيام والأحاديث الواردة فيها"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-regalGold-300/70 uppercase tracking-wider">
                  مواسم الطاعات
                </span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 flex items-center justify-center shrink-0">
                  <Moon className="w-4 h-4 text-amber-500 dark:text-regalGold-400 fill-amber-500 dark:fill-regalGold-400" />
                </div>
              </div>
              <div className="mt-2 text-right">
                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 leading-tight block truncate group-hover:text-amber-700 dark:group-hover:text-regalGold-300 transition-colors">
                  {nearestOccasion?.title}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] bg-amber-50 dark:bg-regalGold-500/15 text-amber-800 dark:text-regalGold-300 border border-amber-200/60 dark:border-regalGold-500/30 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                    {nearestOccasion?.timingBadge}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-bold truncate">
                    {nearestOccasion?.hijriDateText}
                  </span>
                </div>
                <span className="text-[10px] text-amber-600 dark:text-regalGold-400 font-bold block mt-1 group-hover:underline">
                  استعراض السُنن والأحاديث 🌙
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* New Feature 4: Stats Ribbon (Horizontal Glass Strip) */}
      <div
        onClick={() => {
          app.setShowScores(true);
        }}
        className="glass-card w-full rounded-2xl bg-white dark:bg-obsidian-900/80 border border-slate-150 dark:border-regalGold-500/20 p-3 sm:p-3.5 flex items-center justify-around text-center shadow-xs hover:border-amber-300 dark:hover:border-regalGold-500/40 transition-all cursor-pointer group select-none"
        title="انقر لفتح لوحة المتصدرين وقائمة الشرف"
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Trophy className="w-4 h-4 text-amber-500 dark:text-regalGold-400" />
          </div>
          <div className="text-right">
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal tabular-nums block leading-tight">
              {toArabicIndic(cups)}
            </span>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-regalGold-300/70">كؤوس وبطولات</span>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-200 dark:bg-regalGold-500/20" />

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Star className="w-4 h-4 text-emerald-600 dark:text-holyEmerald-400 fill-emerald-600 dark:fill-holyEmerald-400" />
          </div>
          <div className="text-right">
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal tabular-nums block leading-tight">
              {toArabicIndic(totalPoints)}
            </span>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-regalGold-300/70">نقطة مهارة</span>
          </div>
        </div>

        <div className="w-px h-7 bg-slate-200 dark:bg-regalGold-500/20" />

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-holyEmerald-400" />
          </div>
          <div className="text-right">
            <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-holyEmerald-300 font-tajawal tabular-nums block leading-tight">
              #٤
            </span>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-regalGold-300/70">في المتصدرين</span>
          </div>
        </div>
      </div>

      {/* New Feature 5: Quick Dhikr & Tasbih Section (الأذكار والتسبيح السريع) */}
      <section className="w-full rounded-3xl glass-card bg-white dark:bg-obsidian-900/80 border border-slate-150 dark:border-regalGold-500/20 p-4 sm:p-5 shadow-xs text-right">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
              الأَذْكَارُ وَالتَّسْبِيحُ السَّرِيع
            </h3>
          </div>
          <span className="text-[11px] font-black text-emerald-800 dark:text-regalGold-300 bg-emerald-50 dark:bg-regalGold-500/15 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-regalGold-500/30">
            وِرد الصباح والمساء
          </span>
        </div>

        {/* Interactive Quick Tasbih Counter Widget */}
        <div className="rounded-2xl bg-slate-50 dark:bg-obsidian-850/90 border border-slate-150 dark:border-regalGold-500/20 p-3.5 flex items-center justify-between gap-3 shadow-inner">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 dark:text-regalGold-300/70 font-semibold">الذِّكْرُ الحَالِي:</span>
            <p className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
              سُبْحَانَ اللَّهِ وَبِحَمْدِهِ
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-holyEmerald-400 font-medium">
              مئة مرة تحط بها الخطايا وإن كانت مثل زبد البحر
            </p>
          </div>

          {/* Interactive Tap Button with Dynamic Increment */}
          <button
            type="button"
            onClick={handleTasbihTap}
            className="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-obsidian-800 dark:to-obsidian-900 border-2 border-emerald-300 dark:border-holyEmerald-500/40 hover:border-emerald-500 dark:hover:border-holyEmerald-400 active:scale-90 text-slate-800 dark:text-regalGold-100 transition-transform shadow-sm select-none cursor-pointer glow-emerald shrink-0"
            title="انقر للتسبيح"
          >
            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-holyEmerald-300 font-tajawal tabular-nums">
              {toArabicIndic(tasbihCount)}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-mono -mt-0.5">
              / ١٠٠
            </span>
          </button>
        </div>

        {/* Quick Adhkar Route Cards: Morning & Evening */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <button
            type="button"
            onClick={() => {
              if (app.setSelectedAdhkarCategoryId) {
                app.setSelectedAdhkarCategoryId('hisn_1');
              }
              setView('adhkar');
            }}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-obsidian-850/80 hover:bg-emerald-50/50 dark:hover:bg-obsidian-800 border border-slate-200/80 dark:border-regalGold-500/20 hover:border-emerald-300 dark:hover:border-regalGold-500/40 text-right active:scale-[0.98] transition-all cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
              ☀️
            </span>
            <div>
              <span className="block text-xs sm:text-sm font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                أَذْكَارُ الصَّبَاح
              </span>
              <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-medium">
                ٢٤ ذكراً مأثوراً
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (app.setSelectedAdhkarCategoryId) {
                app.setSelectedAdhkarCategoryId('hisn_1');
              }
              setView('adhkar');
            }}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-obsidian-850/80 hover:bg-emerald-50/50 dark:hover:bg-obsidian-800 border border-slate-200/80 dark:border-regalGold-500/20 hover:border-emerald-300 dark:hover:border-regalGold-500/40 text-right active:scale-[0.98] transition-all cursor-pointer group"
          >
            <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 border border-emerald-200 dark:border-holyEmerald-500/30 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center text-sm shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
              🌙
            </span>
            <div>
              <span className="block text-xs sm:text-sm font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                أَذْكَارُ المَسَاء
              </span>
              <span className="text-[10px] text-slate-400 dark:text-regalGold-300/60 font-medium">
                حفظ وتحصين
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Subtitle / Last Played Date info (Preserved) */}
      <div className="flex items-center justify-between px-3 -mt-2 text-xs text-slate-400 dark:text-regalGold-300/60 font-medium">
        <span>
          آخر نشاط:{' '}
          <strong className="text-slate-600 dark:text-regalGold-200 font-bold">
            {lastPlayedDate
              ? lastPlayedDate === new Date().toISOString().split('T')[0]
                ? 'اليوم'
                : lastPlayedDate
              : 'لم يبدأ بعد'}
          </strong>
        </span>
        <span className="text-[11px] text-emerald-700/80 dark:text-holyEmerald-400 font-bold hidden sm:inline">
          انقر على شعلة الزاوية لمعرفة نظام الـ 24 ساعة ومهلة الإنقاذ 🔥
        </span>
      </div>

      {/* Daily Challenge Card on Home (Preserved) */}
      <div className="px-1">
        {dailyCompleted ? (
          <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-obsidian-900/80 border border-slate-150 dark:border-regalGold-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-600 dark:text-holyEmerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-slate-800 dark:text-regalGold-100 text-sm sm:text-base">تم إنجاز التحدي اليومي بنجاح!</h4>
                  <span className="text-[10px] bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-800 dark:text-holyEmerald-300 border border-emerald-200/60 dark:border-holyEmerald-500/30 font-bold px-2 py-0.5 rounded-full">مكتمل</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-regalGold-300/70 font-bold mt-0.5">شعلتك مشتعلة بأمان حتى الغد. استمر في تعاهد كتاب الله.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView('challenges')}
              className="px-4 py-2 bg-slate-50 dark:bg-obsidian-850 hover:bg-emerald-50 dark:hover:bg-obsidian-800 text-emerald-800 dark:text-regalGold-200 border border-slate-200 dark:border-regalGold-500/20 hover:border-emerald-300 dark:hover:border-regalGold-500/40 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 shrink-0 cursor-pointer"
            >
              استكشف التحديات الأخرى
            </button>
          </div>
        ) : streakInfo?.status === 'warning' ? (
          <div className="glass-card p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-amber-500/10 dark:from-amber-500/20 dark:via-rose-500/10 dark:to-amber-500/20 border-2 border-amber-400 dark:border-regalGold-500 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Flame className="w-5 h-5 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                    مهلة إنقاذ الشعلة: متبقي {streakInfo?.timeLeftFormatted}
                  </span>
                </div>
                <h4 className="font-black text-amber-950 dark:text-regalGold-100 text-sm sm:text-base mt-1">
                  شعلتك انطفأت مؤقتاً! أنقذ سلسلتك الآن
                </h4>
                <p className="text-xs text-amber-900/80 dark:text-regalGold-300/80 font-bold mt-0.5">
                  أكمل التحدي اليومي قبل انتهاء المهلة لتعود الشعلة للاشتعال فوراً ولا تفقد تقدمك!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartDaily}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-200" />
              <span>أنقذ الشعلة الآن 🔥</span>
            </button>
          </div>
        ) : (
          <div className="glass-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-obsidian-900/80 border border-slate-150 dark:border-regalGold-500/20 hover:border-emerald-400 dark:hover:border-regalGold-500/40 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 text-right group">
            <div className="flex items-center gap-3.5">
              <DailyChallengeEmblem className="w-11 h-11 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-slate-800 dark:text-regalGold-100 text-base group-hover:text-brand-emerald dark:group-hover:text-regalGold-300 transition-colors">
                    التحدي اليومي: إكمال الآية
                  </h4>
                  <span className="text-[10px] bg-emerald-50 dark:bg-holyEmerald-500/15 text-emerald-800 dark:text-holyEmerald-300 border border-emerald-200/60 dark:border-holyEmerald-500/30 font-black px-2 py-0.5 rounded-full">
                    تحدي اليوم
                  </span>
                </div>
                <p className="text-xs text-slate-400 dark:text-regalGold-300/70 font-bold leading-relaxed">
                  أكمل الآية الكريمة، وحافظ على اشتعال شعلتك اليومية واكسب نقاط المهارة القرآنية
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleStartDaily}
              className="w-full sm:w-auto px-5 py-2.5 bg-brand-emerald dark:bg-holyEmerald-600 dark:hover:bg-holyEmerald-700 hover:bg-[#033628] text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>ابدأ التحدي اليومي</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Islamic Videos Quick Entry on Home (Preserved) */}
      {!systemSettings.hideIslamicVideos && (
        <div className="px-1 mt-1">
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setView('islamic_videos')}
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0D6E52] via-[#0A5640] to-[#043325] text-white shadow-md hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#D4AF37]/30 text-right"
          >
            {/* Geometric Pattern Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30zM30 6.863L53.137 30 30 53.137 6.863 30zM30 15l15 15-15 15-15-15z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundSize: '40px 40px'
              }}
            />

            <div className="flex items-center gap-3.5 relative z-10 w-full sm:w-auto">
              <VideoLibraryIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
              <div className="text-right">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-white text-base">
                    المكتبة المرئية الإسلامية
                  </h4>
                  <span className="text-[10px] bg-[#D4AF37] text-[#0A5640] font-black px-2 py-0.5 rounded-full shadow-xs">
                    جديد
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 font-semibold leading-relaxed">
                  روائع المقاطع الدعوية، شروحات الحديث، الفقه، والتفسير لكبار العلماء
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 relative z-10 self-end sm:self-center shrink-0">
              <span className="px-4 py-2 bg-white/15 hover:bg-white/25 text-[#FCEEB5] border border-white/20 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 backdrop-blur-md">
                <span>استعراض المرئيات</span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Google Play Tester Button at the bottom (Preserved) */}
      {!isNativeApp && (
        <div className="px-1 mt-4 flex items-center justify-center">
          <GooglePlayButton
            status={testerStatus}
            onClick={() => setShowGooglePlayModal(true)}
          />
        </div>
      )}
    </motion.div>
  );
};

export default HomePage;
