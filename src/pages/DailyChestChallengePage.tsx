import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ArrowRight,
  Trophy,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Home,
  Gift
} from 'lucide-react';
import { Lottie } from 'lottie-react';
import dollarCoinsChestAnimation from '../assets/lottie/dollar-coins-chest.json';
import { useApp } from '../contexts/AppContext';
import {
  getDailyChallengeConfigForDate,
  getQuestionsPoolForCategory
} from '../utils/dailyChestChallenge';
import { Question } from '../data/quizQuestionsData';

// Helper: Convert to Arabic-Indic digits
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

const OPTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

export const DailyChestChallengePage: React.FC = () => {
  const app = useApp();
  const dailyGift = app?.dailyGift;

  // Resolve config for today
  const todayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const config = useMemo(() => {
    return getDailyChallengeConfigForDate(todayKey);
  }, [todayKey]);

  const category = dailyGift?.category || config.category;
  const categoryTitle = dailyGift?.categoryTitle || config.categoryTitle;
  const challengeTitle = dailyGift?.title || config.title;
  const target = dailyGift?.target || config.target;
  const rewardPoints = dailyGift?.rewardPoints || config.rewardPoints;
  const maxLives = dailyGift?.maxLives || config.maxLives || 3;

  // Question pool (shuffled)
  const [pool, setPool] = useState<Question[]>(() => {
    return getQuestionsPoolForCategory(category);
  });

  // Gameplay State: correctAnswers & lives
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [lives, setLives] = useState<number>(maxLives);
  const [questionIndex, setQuestionIndex] = useState<number>(0);

  // Active question interaction state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');

  // Hearts animation trigger
  const [heartLostIndex, setHeartLostIndex] = useState<number | null>(null);

  // Current active question
  const currentQuestion = useMemo(() => {
    if (pool.length === 0) return null;
    return pool[questionIndex % pool.length];
  }, [pool, questionIndex]);

  // Restart challenge
  const handleRestart = useCallback(() => {
    const freshPool = getQuestionsPoolForCategory(category);
    setPool(freshPool);
    setCorrectAnswers(0);
    setLives(maxLives);
    setQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setGameStatus('playing');
    setHeartLostIndex(null);
  }, [category, maxLives]);

  // Option select handler
  const handleSelectOption = (option: string) => {
    if (isAnswerChecked || gameStatus !== 'playing' || !currentQuestion) return;

    setSelectedOption(option);
    setIsAnswerChecked(true);

    const isCorrect = option === currentQuestion.answer;

    if (isCorrect) {
      const nextCorrect = correctAnswers + 1;
      setCorrectAnswers(nextCorrect);

      if (nextCorrect >= target) {
        setTimeout(() => {
          setGameStatus('won');
          app?.completeDailyChestChallenge?.();
        }, 1100);
      } else {
        setTimeout(() => {
          setQuestionIndex((prev) => prev + 1);
          setSelectedOption(null);
          setIsAnswerChecked(false);
        }, 1100);
      }
    } else {
      const nextLives = lives - 1;
      setHeartLostIndex(lives - 1);
      setLives(nextLives);

      if (nextLives <= 0) {
        setTimeout(() => {
          setGameStatus('lost');
        }, 1300);
      } else {
        setTimeout(() => {
          setQuestionIndex((prev) => prev + 1);
          setSelectedOption(null);
          setIsAnswerChecked(false);
          setHeartLostIndex(null);
        }, 1300);
      }
    }
  };

  const handleReturnHome = () => {
    if (app?.setView) {
      app.setView('home');
    }
  };

  const handleClaimRewardAndExit = () => {
    app?.claimDailyGiftReward?.();
    if (app?.setView) {
      app.setView('home');
    }
  };

  const progressPercentage = Math.min(100, Math.round((correctAnswers / target) * 100));

  return (
    <div
      className="min-h-screen bg-radial from-slate-50 via-amber-50/30 to-emerald-50/20 dark:from-slate-950 dark:via-obsidian-950 dark:to-zinc-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between py-3 px-3 sm:px-6 relative overflow-hidden select-none"
      dir="rtl"
    >
      {/* Background Islamic Geometric Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.04] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER: Navigation, Title & Lives                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3 pt-1 pb-3 relative z-10">
        <button
          type="button"
          onClick={handleReturnHome}
          className="p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-emerald dark:hover:text-emerald-400 hover:border-brand-emerald/40 transition-all shadow-xs flex items-center gap-1.5 text-xs font-black cursor-pointer"
          title="العودة للرئيسية"
        >
          <ArrowRight className="w-4 h-4" />
          <span className="hidden sm:inline">الرئيسية</span>
        </button>

        {/* Center: Challenge Badge */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300/60 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>تحدي الصندوق اليومي</span>
          </span>
          <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">
            {categoryTitle}
          </h2>
        </div>

        {/* Right: Lives Hearts Counter */}
        <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
          {Array.from({ length: maxLives }).map((_, idx) => {
            const isAlive = idx < lives;
            const isJustLost = idx === heartLostIndex;

            return (
              <motion.div
                key={idx}
                animate={
                  isJustLost
                    ? { scale: [1, 1.4, 0.8, 1], rotate: [0, -15, 15, 0] }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.4 }}
              >
                <Heart
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                    isAlive
                      ? 'fill-rose-500 text-rose-500 drop-shadow-[0_1px_3px_rgba(244,63,94,0.4)]'
                      : 'text-slate-300 dark:text-zinc-700 fill-slate-200/40 dark:fill-zinc-800/40 opacity-50'
                  }`}
                />
              </motion.div>
            );
          })}
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. PROGRESS BAR & TARGET                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl mx-auto mb-3 space-y-1 relative z-10">
        <div className="flex items-center justify-between text-xs font-black">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>الهدف المطلوب:</span>
            <span className="text-brand-emerald dark:text-emerald-400 font-black">
              {toArabicIndic(correctAnswers)} من {toArabicIndic(target)} إجابات صحيحة
            </span>
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">
            {toArabicIndic(progressPercentage)}٪
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden shadow-inner">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-500 shadow-sm"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MAIN GAMEPLAY AREA                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center relative z-10 my-auto">
        <AnimatePresence mode="wait">
          {gameStatus === 'playing' && currentQuestion && (
            <motion.div
              key={questionIndex}
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Question Card */}
              <div className="bg-white/95 dark:bg-slate-900/95 border-2 border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-lg shadow-emerald-950/5 relative text-center">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>سؤال {toArabicIndic(questionIndex + 1)}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    متبقي للفوز: {toArabicIndic(Math.max(0, target - correctAnswers))}
                  </span>
                </div>

                <h3 className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 leading-relaxed font-tajawal">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentQuestion.answer;

                  let btnStyle =
                    'bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-emerald hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20';
                  let letterStyle =
                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';

                  if (isAnswerChecked) {
                    if (isCorrect) {
                      btnStyle =
                        'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/20 font-black';
                      letterStyle = 'bg-emerald-600 text-white';
                    } else if (isSelected) {
                      btnStyle =
                        'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20 font-black animate-shake';
                      letterStyle = 'bg-rose-600 text-white';
                    } else {
                      btnStyle = 'opacity-40 border-slate-200 dark:border-slate-800';
                    }
                  }

                  return (
                    <motion.button
                      key={optIdx}
                      type="button"
                      whileTap={{ scale: isAnswerChecked ? 1 : 0.98 }}
                      onClick={() => handleSelectOption(option)}
                      disabled={isAnswerChecked}
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 font-bold text-xs sm:text-sm text-right transition-all flex items-center justify-between gap-3 shadow-xs cursor-pointer ${btnStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 transition-colors ${letterStyle}`}
                        >
                          {OPTION_LETTERS[optIdx] || optIdx + 1}
                        </span>
                        <span className="leading-snug">{option}</span>
                      </div>

                      {isAnswerChecked && isCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                      )}
                      {isAnswerChecked && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-white shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* 4. VICTORY SCREEN (نجاح التحدي وفتح الصندوق)                  */}
          {/* ───────────────────────────────────────────────────────────── */}
          {gameStatus === 'won' && (
            <motion.div
              key="won"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 dark:bg-slate-900/95 border-2 border-emerald-400 dark:border-emerald-600 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto relative">
                <Lottie
                  src={dollarCoinsChestAnimation}
                  loop={false}
                  autoplay={true}
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-black mb-2 animate-bounce">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>اكتمل التحدي بنجاح! ما شاء الله</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-tajawal">
                  مبارك! فتحت صندوق الهدية اليومية
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold mt-1">
                  أجبت على {toArabicIndic(target)} أسئلة بنجاح في {categoryTitle}
                </p>
                <div className="mt-3 inline-block px-4 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-black text-sm">
                  مكافأتك: +{toArabicIndic(rewardPoints)} نقطة 🌟
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClaimRewardAndExit}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Gift className="w-4 h-4" />
                  <span>استلام المكافأة والعودة للرئيسية</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* 5. GAME OVER SCREEN (انتهاء الأرواح)                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          {gameStatus === 'lost' && (
            <motion.div
              key="lost"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 dark:bg-slate-900/95 border-2 border-rose-300 dark:border-rose-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl relative overflow-hidden"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-500">
                <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400 stroke-[1.5]" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 font-tajawal">
                  لقد استنفدت محاولاتك!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-bold mt-1">
                  حققت {toArabicIndic(correctAnswers)} من {toArabicIndic(target)} إجابات صحيحة قبل نفاد القلوب.
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-1">
                  لا تقلق، يمكنك إعادة المحاولة فوراً وفتح الصندوق!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>حاول مرة أخرى 🔄</span>
                </button>

                <button
                  type="button"
                  onClick={handleReturnHome}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>العودة للرئيسية</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. BOTTOM FOOTER                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <footer className="w-full max-w-2xl mx-auto pt-3 pb-1 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 relative z-10">
        <span>{challengeTitle}</span>
      </footer>
    </div>
  );
};

export default DailyChestChallengePage;

