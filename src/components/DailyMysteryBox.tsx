import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Users, BookOpen, Trophy, CheckCircle2, ChevronLeft, Gift, X
} from 'lucide-react';
import { Lottie } from 'lottie-react';
import dollarCoinsChestAnimation from '../assets/lottie/dollar-coins-chest.json';
import { useApp } from '../contexts/AppContext';

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

// Helper: Format seconds into MM:SS
const formatMinutesSeconds = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${toArabicIndic(String(m).padStart(2, '0'))}:${toArabicIndic(String(s).padStart(2, '0'))}`;
};

export interface DailyMysteryBoxProps {
  className?: string;
}

export const DailyMysteryBox: React.FC<DailyMysteryBoxProps> = ({ className = '' }) => {
  const app = useApp();
  const dailyGift = app?.dailyGift;

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Countdown timer until next day's challenge reset (midnight)
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diffMs = tomorrow.getTime() - now.getTime();
      if (diffMs <= 0) {
        setTimeLeftStr('٠٠:٠٠:٠٠');
        return;
      }
      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeLeftStr(
        `${toArabicIndic(String(hrs).padStart(2, '0'))}:${toArabicIndic(String(mins).padStart(2, '0'))}:${toArabicIndic(String(secs).padStart(2, '0'))}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const isRevealed = dailyGift?.isRevealed ?? false;
  const isCompleted = dailyGift?.isCompleted ?? false;
  const isClaimed = dailyGift?.isClaimed ?? false;
  const type = dailyGift?.type ?? 'reading_time';
  const title = dailyGift?.title ?? 'تحدي اليوم';
  const target = dailyGift?.target ?? 300;
  const currentProgress = dailyGift?.currentProgress ?? 0;
  const rewardPoints = dailyGift?.rewardPoints ?? 100;
  const progressPercent = Math.min(100, Math.round((currentProgress / target) * 100));

  // Refs for Lottie instances
  const cardLottieRef = useRef<any>(null);
  const modalLottieRef = useRef<any>(null);
  const hasPlayedRef = useRef(false);

  // Helper to attach goToAndStop / getDuration compatibility
  const enhanceLottieInstance = (instance: any) => {
    if (!instance) return;
    if (typeof instance.goToAndStop !== 'function') {
      instance.goToAndStop = (frame: number, isFrame = true) => {
        if (instance.animationItem?.goToAndStop) {
          instance.animationItem.goToAndStop(frame, isFrame);
        } else if (typeof instance.seek === 'function') {
          instance.seek(frame);
        }
      };
    }
    if (typeof instance.getDuration !== 'function') {
      instance.getDuration = (inFrames = true) => {
        if (instance.animationItem?.getDuration) {
          return instance.animationItem.getDuration(inFrames);
        }
        return inFrames ? (instance.animationItem?.totalFrames || 88) : 88 / 30;
      };
    }
  };

  const setCardLottieRef = useCallback(
    (instance: any) => {
      if (!instance) return;
      enhanceLottieInstance(instance);
      cardLottieRef.current = instance;
      if (isClaimed) {
        setTimeout(() => {
          if (typeof instance.goToAndStop === 'function') {
            const duration = typeof instance.getDuration === 'function' ? instance.getDuration(true) : 88;
            instance.goToAndStop(duration, true);
          }
        }, 0);
      }
    },
    [isClaimed]
  );

  const setModalLottieRef = useCallback(
    (instance: any) => {
      if (!instance) return;
      enhanceLottieInstance(instance);
      modalLottieRef.current = instance;
      if (isClaimed && !hasPlayedRef.current) {
        setTimeout(() => {
          if (typeof instance.goToAndStop === 'function') {
            const duration = typeof instance.getDuration === 'function' ? instance.getDuration(true) : 88;
            instance.goToAndStop(duration, true);
          }
        }, 0);
      }
    },
    [isClaimed]
  );

  // Persist opened state if already claimed
  useEffect(() => {
    if (isClaimed && !hasPlayedRef.current) {
      const applyStop = (ref: any) => {
        if (!ref) return;
        if (typeof ref.goToAndStop === 'function') {
          const duration = typeof ref.getDuration === 'function' ? ref.getDuration(true) : 88;
          ref.goToAndStop(duration, true);
        } else if (ref.animationItem?.goToAndStop) {
          ref.animationItem.goToAndStop(88, true);
        } else if (typeof ref.seek === 'function') {
          ref.seek(88);
        }
      };
      applyStop(cardLottieRef.current);
      applyStop(modalLottieRef.current);
    }
  }, [isClaimed]);

  const handleClaimReward = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    hasPlayedRef.current = true;
    if (modalLottieRef.current) {
      if (typeof modalLottieRef.current.play === 'function') {
        modalLottieRef.current.play();
      } else if (modalLottieRef.current.animationItem?.play) {
        modalLottieRef.current.animationItem.play();
      }
    }
    if (cardLottieRef.current) {
      if (typeof cardLottieRef.current.play === 'function') {
        cardLottieRef.current.play();
      } else if (cardLottieRef.current.animationItem?.play) {
        cardLottieRef.current.animationItem.play();
      }
    }
    app?.claimDailyGiftReward?.();
  };

  const handleGoToChallenge = () => {
    setIsModalOpen(false);
    if (type === 'reading_time') {
      if (app?.setView) app.setView('mushaf');
    } else {
      if (app?.setView) app.setView('group_join');
    }
  };

  const handleRevealAndStart = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    app?.revealDailyGift?.();
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. MINIMAL CARD IN MAIN DASHBOARD (البطاقة المبسطة)       */}
      {/* ======================================================== */}
      <div
        onClick={() => setIsModalOpen(true)}
        className={`glass-card bg-white dark:bg-obsidian-900/80 p-2.5 sm:p-3 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-amber-300 dark:hover:border-regalGold-500/40 hover:shadow-md transition-all duration-200 text-center relative overflow-hidden group select-none cursor-pointer h-full ${className}`}
        title="انقر لفتح نافذة الهدية اليومية"
      >
        {/* Header: Title & Status Badge */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 border border-amber-200/60 dark:border-regalGold-500/30 flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] sm:text-xs font-black text-slate-700 dark:text-regalGold-100 font-tajawal">
              الهدية اليومية
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-regalGold-300 bg-amber-50 dark:bg-regalGold-500/15 px-1.5 py-0.2 rounded-md">
            {isClaimed ? 'تم الاستلام' : isCompleted ? 'جاهز للاستلام' : 'تحدي اليوم'}
          </span>
        </div>

        {/* Middle: Lottie Chest Animation */}
        <div className="my-auto py-1 flex items-center justify-center">
          <div
            className={`rounded-full p-1 transition-all ${
              !isClaimed && isCompleted ? 'glow-gold animate-pulse' : ''
            }`}
          >
            <div className="w-13 h-13 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 mx-auto pointer-events-none">
              <Lottie
                lottieRef={setCardLottieRef}
                src={dollarCoinsChestAnimation}
                loop={false}
                autoplay={false}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Bottom: Minimal Call-to-Action Pill Button */}
        <div className="w-full py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 dark:bg-regalGold-500/15 dark:hover:bg-regalGold-500/25 border border-amber-200/60 dark:border-regalGold-500/30 text-amber-900 dark:text-regalGold-200 font-black text-[10px] sm:text-[11px] flex items-center justify-center gap-1 transition-all mt-auto group-hover:scale-[1.02]">
          <span>
            {isClaimed
              ? 'تفاصيل المكافأة'
              : isCompleted
              ? 'استلم هديتك الآن'
              : !isRevealed
              ? 'كشف التحدي'
              : 'متابعة التحدي'}
          </span>
          <ChevronLeft className="w-3 h-3 text-amber-600 dark:text-regalGold-400" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. GIFT MODAL (النافذة المنبثقة الشاملة)                    */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card bg-white dark:bg-obsidian-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-regalGold-500/30 shadow-2xl relative w-full max-w-sm sm:max-w-md text-center overflow-hidden flex flex-col justify-between gap-4"
              dir="rtl"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-regalGold-200 rounded-full hover:bg-slate-100 dark:hover:bg-obsidian-800 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Top: Title */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4 text-amber-500 dark:text-regalGold-400" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                  صندوق الهدية اليومية
                </h3>
              </div>

              {/* Modal Center: Animated Chest */}
              <div className="py-1">
                <div
                  className={`rounded-full p-2 w-28 h-28 sm:w-32 sm:h-32 mx-auto flex items-center justify-center ${
                    !isClaimed && isCompleted ? 'glow-gold animate-pulse' : ''
                  }`}
                >
                  <Lottie
                    lottieRef={setModalLottieRef}
                    src={dollarCoinsChestAnimation}
                    loop={false}
                    autoplay={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </div>
              </div>

              {/* Modal Details based on State */}
              {!isRevealed ? (
                /* حالة الإغلاق قبل الكشف */
                <div className="space-y-3">
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-regalGold-300 bg-amber-50 dark:bg-regalGold-500/15 px-3 py-1 rounded-full mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>مكافأة يومية مفاجئة</span>
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                      صندوق اليوم: اضغط لكشف التحدي
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-regalGold-300/70 font-medium mt-1">
                      أكمل التحدي اليومي البسيط واكسب نقاطاً إضافية في رصيدك
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRevealAndStart}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 text-obsidian-950 font-black text-xs sm:text-sm shadow-md glow-gold active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Gift className="w-4 h-4 fill-current" />
                    <span>افتح الصندوق واكشف التحدي</span>
                  </button>
                </div>
              ) : isClaimed ? (
                /* حالة الاكتمال والاستلام */
                <div className="space-y-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-holyEmerald-300 bg-emerald-50 dark:bg-holyEmerald-500/15 border border-emerald-200/60 dark:border-holyEmerald-500/30 px-3 py-1 rounded-full mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-holyEmerald-400" />
                      <span>+{toArabicIndic(rewardPoints)} نقطة مكتسبة</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                      تم إنجاز تحدي اليوم بنجاح
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-regalGold-300/70 font-medium mt-1">
                      بارك الله فيك وتقبل طاعتك، استمر في العطاء والتعلم
                    </p>
                  </div>

                  {/* Countdown to next chest */}
                  <div className="w-full p-2.5 rounded-2xl bg-slate-50 dark:bg-obsidian-950/80 border border-slate-200/60 dark:border-regalGold-500/20 text-center">
                    <span className="text-[10px] text-slate-400 dark:text-regalGold-300/70 block">
                      الصندوق القادم متاح خلال:
                    </span>
                    <span className="font-mono font-black text-sm sm:text-base text-slate-800 dark:text-regalGold-200 mt-0.5 block">
                      {timeLeftStr || '٠٠:٠٠:٠٠'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-700 dark:text-regalGold-200 font-bold text-xs transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              ) : isCompleted ? (
                /* حالة إكمال التحدي وجاهزية الاستلام */
                <div className="space-y-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800 dark:text-regalGold-200 bg-amber-50 dark:bg-regalGold-500/20 px-3 py-1 rounded-full mb-1 animate-bounce">
                      <Trophy className="w-3.5 h-3.5 text-regalGold-400" />
                      <span>اكتمل التحدي! ما شاء الله</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                      أنجزت مهمة اليوم بنجاح!
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-regalGold-300/70 font-medium mt-1">
                      انقر بالأسفل لفتح الصندوق واستلام مكافأتك
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleClaimReward}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 text-obsidian-950 font-black text-xs sm:text-sm shadow-md glow-gold active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 fill-current" />
                    <span>الحصول على الجائزة (+{toArabicIndic(rewardPoints)} نقطة)</span>
                  </motion.button>
                </div>
              ) : (
                /* حالة التحدي النشط (In-Progress) */
                <div className="space-y-3">
                  <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-regalGold-300 bg-amber-50 dark:bg-regalGold-500/15 px-3 py-1 rounded-full mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>المكافأة: +{toArabicIndic(rewardPoints)} نقطة</span>
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal mt-1">
                      {title}
                    </h4>
                  </div>

                  {/* Progress Bar & Counters */}
                  <div className="p-3 bg-slate-50 dark:bg-obsidian-950/80 rounded-2xl border border-slate-200/60 dark:border-regalGold-500/20 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 dark:text-regalGold-300/70">التقدم الحالي:</span>
                      <span className="font-mono text-emerald-600 dark:text-holyEmerald-300 font-black">
                        {type === 'reading_time'
                          ? `${formatMinutesSeconds(currentProgress)} / ${formatMinutesSeconds(target)}`
                          : `${toArabicIndic(currentProgress)} / ${toArabicIndic(target)}`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-obsidian-850 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-regalGold-400 to-holyEmerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-regalGold-300/60">
                        {toArabicIndic(progressPercent)}٪
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleGoToChallenge}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-emerald hover:bg-[#033628] dark:bg-holyEmerald-600 dark:hover:bg-holyEmerald-500 text-white dark:text-obsidian-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <span>{type === 'reading_time' ? 'متابعة القراءة في المصحف' : 'دخول التحدي الجماعي'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DailyMysteryBox;
