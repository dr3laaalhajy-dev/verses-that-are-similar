import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Clock, Users, BookOpen, Trophy, CheckCircle2, ChevronLeft, Gift, Zap
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

// 3D Treasure Chest Graphic
const TreasureChest3D: React.FC<{ isOpen?: boolean; isClaimed?: boolean; sizeClassName?: string }> = ({
  isOpen = false,
  isClaimed = false,
  sizeClassName = 'w-14 h-14 sm:w-16 sm:h-16'
}) => {
  return (
    <div className={`relative ${sizeClassName} flex items-center justify-center shrink-0`}>
      {/* Radiant Background Aura */}
      <div
        className={`absolute inset-0 rounded-full blur-lg transition-all duration-700 ${
          isOpen || isClaimed
            ? 'bg-gradient-to-r from-amber-400/30 via-regalGold-400/40 to-holyEmerald-400/30 scale-125 animate-pulse'
            : 'bg-regalGold-500/20 scale-100 group-hover:scale-110'
        }`}
      />

      {/* Dynamic Animated Sparkles */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <Sparkles className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-300 drop-shadow-md animate-bounce" />
        <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 text-regalGold-300 drop-shadow-sm" />
      </motion.div>

      {/* 3D Chest SVG */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full relative z-10 transition-transform duration-500 drop-shadow-[0_8px_16px_rgba(212,175,55,0.3)] ${
          isOpen ? 'scale-105' : 'group-hover:scale-105'
        }`}
      >
        <defs>
          <linearGradient id="chestGoldBento" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#B38F26" />
            <stop offset="100%" stopColor="#785B12" />
          </linearGradient>

          <linearGradient id="chestBodyBento" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <linearGradient id="gemEmeraldBento" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          <linearGradient id="glowRaysBento" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(253, 230, 138, 0)" />
            <stop offset="100%" stopColor="rgba(253, 230, 138, 0.7)" />
          </linearGradient>
        </defs>

        {/* Radiating Light Beams when opened */}
        {isOpen && (
          <g className="animate-pulse">
            <polygon points="50,40 20,5 35,0" fill="url(#glowRaysBento)" opacity="0.6" />
            <polygon points="50,40 45,-5 55,-5" fill="url(#glowRaysBento)" opacity="0.8" />
            <polygon points="50,40 65,0 80,5" fill="url(#glowRaysBento)" opacity="0.6" />
          </g>
        )}

        {/* Chest Base / Body */}
        <path
          d="M 18,48 L 82,48 L 76,82 C 76,85 73,88 70,88 L 30,88 C 27,88 24,85 24,82 Z"
          fill="url(#chestBodyBento)"
          stroke="url(#chestGoldBento)"
          strokeWidth="3.5"
        />

        {/* Metal Reinforcement Straps */}
        <path d="M 32,48 L 34,88" stroke="url(#chestGoldBento)" strokeWidth="3" />
        <path d="M 68,48 L 66,88" stroke="url(#chestGoldBento)" strokeWidth="3" />

        {/* Gold Corner Rivets */}
        <circle cx="26" cy="52" r="1.8" fill="#FDE68A" />
        <circle cx="74" cy="52" r="1.8" fill="#FDE68A" />
        <circle cx="31" cy="84" r="1.8" fill="#FDE68A" />
        <circle cx="69" cy="84" r="1.8" fill="#FDE68A" />

        {/* Treasure Chest Lid (Open or Closed) */}
        {isOpen || isClaimed ? (
          // OPEN LID
          <g>
            <ellipse cx="50" cy="48" rx="26" ry="7" fill="#FBBF24" />
            <circle cx="44" cy="45" r="4.5" fill="#FDE68A" stroke="#B38F26" strokeWidth="1" />
            <circle cx="56" cy="46" r="4" fill="#F59E0B" stroke="#B38F26" strokeWidth="1" />
            <circle cx="50" cy="43" r="5" fill="#FDE68A" stroke="#B38F26" strokeWidth="1" />

            <path
              d="M 16,38 C 16,38 18,16 50,16 C 82,16 84,38 84,38 L 78,42 C 78,42 74,24 50,24 C 26,24 22,42 22,42 Z"
              fill="url(#chestBodyBento)"
              stroke="url(#chestGoldBento)"
              strokeWidth="3.5"
            />
          </g>
        ) : (
          // CLOSED LID
          <g>
            <path
              d="M 16,48 C 16,48 18,24 50,24 C 82,24 84,48 84,48 Z"
              fill="url(#chestBodyBento)"
              stroke="url(#chestGoldBento)"
              strokeWidth="3.5"
            />
            <path d="M 32,26 C 32,36 32,48 32,48" stroke="url(#chestGoldBento)" strokeWidth="3" />
            <path d="M 68,26 C 68,36 68,48 68,48" stroke="url(#chestGoldBento)" strokeWidth="3" />

            <rect x="44" y="44" width="12" height="12" rx="2.5" fill="url(#chestGoldBento)" />
            <circle cx="50" cy="50" r="3" fill="url(#gemEmeraldBento)" />
            <path d="M 47,44 L 47,41 C 47,39 48,37 50,37 C 52,37 53,39 53,41 L 53,44" fill="none" stroke="url(#chestGoldBento)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
};

export interface DailyMysteryBoxProps {
  className?: string;
}

export const DailyMysteryBox: React.FC<DailyMysteryBoxProps> = ({ className = '' }) => {
  const app = useApp();
  const dailyGift = app?.dailyGift;

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

  if (!dailyGift) {
    return null;
  }

  const { isRevealed, isCompleted, isClaimed, type, title, target, currentProgress, rewardPoints } = dailyGift;
  const progressPercent = Math.min(100, Math.round((currentProgress / target) * 100));

  const lottieRef = useRef<any>(null);
  const hasPlayedRef = useRef(false);

  // Set up ref and enhance with goToAndStop / getDuration compatibility
  const setLottieRef = useCallback(
    (instance: any) => {
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
      lottieRef.current = instance;

      // Persist opened state if already claimed on initial load
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

  // Persist opened state when isClaimed is true from a previous session
  useEffect(() => {
    if (isClaimed && !hasPlayedRef.current && lottieRef.current) {
      if (typeof lottieRef.current.goToAndStop === 'function') {
        const duration =
          typeof lottieRef.current.getDuration === 'function' ? lottieRef.current.getDuration(true) : 88;
        lottieRef.current.goToAndStop(duration, true);
      } else if (lottieRef.current.animationItem?.goToAndStop) {
        lottieRef.current.animationItem.goToAndStop(88, true);
      } else if (typeof lottieRef.current.seek === 'function') {
        lottieRef.current.seek(88);
      }
    }
  }, [isClaimed]);

  const handleClaimReward = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    hasPlayedRef.current = true;
    if (lottieRef.current) {
      if (typeof lottieRef.current.play === 'function') {
        lottieRef.current.play();
      } else if (lottieRef.current.animationItem?.play) {
        lottieRef.current.animationItem.play();
      }
    }
    app.claimDailyGiftReward();
  };

  const handleGoToChallenge = () => {
    if (type === 'reading_time') {
      if (app?.setView) app.setView('mushaf');
    } else {
      if (app?.setView) app.setView('group_join');
    }
  };

  return (
    <div
      className={`glass-card bg-white dark:bg-obsidian-900/80 p-2.5 sm:p-3 rounded-2xl flex flex-col justify-between border border-slate-150 dark:border-regalGold-500/20 shadow-xs hover:border-amber-300 dark:hover:border-regalGold-500/40 hover:shadow-md transition-all duration-200 text-center relative overflow-hidden group select-none ${className}`}
    >
      <AnimatePresence mode="wait">
        {/* ======================================================== */}
        {/* 1. LOCKED STATE (الحالة المغلقة: تخطيط عمودي Stack)        */}
        {/* ======================================================== */}
        {!isRevealed ? (
          <motion.div
            key="bento_locked"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={app.revealDailyGift}
            className="flex flex-col items-center justify-between h-full gap-1.5 sm:gap-2 cursor-pointer"
          >
            {/* Top: Lottie Chest with Glow & Pulse */}
            <div className="pt-0.5">
              <div className="glow-gold rounded-full p-1 animate-pulse transition-transform group-hover:scale-105 duration-300">
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 mx-auto pointer-events-none">
                  <Lottie
                    src={dollarCoinsChestAnimation}
                    loop={false}
                    autoplay={false}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Middle: Text */}
            <div className="px-1 text-center">
              <div className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-regalGold-300 bg-amber-50 dark:bg-regalGold-500/15 px-2 py-0.5 rounded-full mb-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>مكافأة يومية</span>
              </div>
              <h4 className="text-xs sm:text-[13px] font-black text-slate-800 dark:text-regalGold-100 font-tajawal leading-snug line-clamp-2">
                صندوق اليوم: اضغط لكشف التحدي
              </h4>
            </div>

            {/* Bottom: Action Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                app.revealDailyGift();
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-obsidian-950 font-black text-[10px] sm:text-[11px] shadow-sm shadow-regalGold-500/20 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer mt-auto"
            >
              <Gift className="w-3 h-3 fill-current" />
              <span>افتح الصندوق</span>
            </button>
          </motion.div>
        ) : !isCompleted && !isClaimed ? (
          /* ======================================================== */
          /* 2. IN-PROGRESS STATE (الحالة النشطة: التحدي والتقدم)       */
          /* ======================================================== */
          <motion.div
            key="bento_in_progress"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col justify-between h-full gap-1.5 sm:gap-2 text-right"
          >
            {/* Top: Header with Icon & Reward Badge */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-regalGold-500/15 text-amber-600 dark:text-regalGold-400 flex items-center justify-center shrink-0">
                  {type === 'reading_time' ? (
                    <BookOpen className="w-3 h-3 text-regalGold-400" />
                  ) : (
                    <Users className="w-3 h-3 text-regalGold-400" />
                  )}
                </div>
                <span className="text-[10px] font-black text-amber-700 dark:text-regalGold-300">
                  تحدي اليوم
                </span>
              </div>
              <span className="text-[9px] font-bold text-amber-800 dark:text-regalGold-300 bg-amber-50 dark:bg-regalGold-500/15 px-1.5 py-0.2 rounded-md font-mono">
                +{toArabicIndic(rewardPoints)}
              </span>
            </div>

            {/* Middle: Title & Progress Bar */}
            <div className="my-auto py-0.5">
              <h4 className="text-xs sm:text-[13px] font-black text-slate-800 dark:text-regalGold-100 font-tajawal leading-tight line-clamp-2">
                {title}
              </h4>

              {/* Progress Bar & Numbers */}
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-regalGold-200">
                  <span className="font-mono text-emerald-600 dark:text-holyEmerald-300">
                    {type === 'reading_time'
                      ? `${formatMinutesSeconds(currentProgress)} / ${formatMinutesSeconds(target)}`
                      : `${toArabicIndic(currentProgress)} / ${toArabicIndic(target)}`}
                  </span>
                  <span className="font-mono">{toArabicIndic(progressPercent)}٪</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-obsidian-950/80 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-regalGold-400 to-holyEmerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom: Direct Action Button */}
            <button
              type="button"
              onClick={handleGoToChallenge}
              className="w-full py-1.5 px-2.5 rounded-xl bg-brand-emerald hover:bg-[#033628] dark:bg-holyEmerald-600 dark:hover:bg-holyEmerald-500 text-white dark:text-obsidian-950 font-black text-[10px] sm:text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer mt-auto"
            >
              <span>{type === 'reading_time' ? 'متابعة القراءة' : 'دخول التحدي'}</span>
              <ChevronLeft className="w-3 h-3" />
            </button>
          </motion.div>
        ) : (
          /* ======================================================== */
          /* 3. COMPLETED & CLAIMED STATES (الصندوق ومكافأة اليوم)     */
          /* ======================================================== */
          <motion.div
            key="bento_reward"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-between h-full gap-1.5 sm:gap-2"
          >
            {/* Top: Animated Lottie Chest */}
            <div className="pt-0.5">
              <div
                className={`rounded-full p-1 transition-all ${
                  !isClaimed ? 'glow-gold animate-pulse' : ''
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0 mx-auto pointer-events-none">
                  <Lottie
                    lottieRef={setLottieRef}
                    src={dollarCoinsChestAnimation}
                    loop={false}
                    autoplay={false}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Middle & Bottom: Switch between Completed and Claimed */}
            {!isClaimed ? (
              <>
                {/* Middle: Completed Text */}
                <div className="px-1 text-center">
                  <div className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-amber-800 dark:text-regalGold-200 bg-amber-50 dark:bg-regalGold-500/20 px-2 py-0.5 rounded-full mb-1 animate-bounce">
                    <Trophy className="w-3 h-3 text-regalGold-400" />
                    <span>اكتمل التحدي!</span>
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-black text-slate-800 dark:text-regalGold-100 font-tajawal leading-snug">
                    ما شاء الله! أنجزت المهمة
                  </h4>
                </div>

                {/* Bottom: Claim Button */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleClaimReward}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 text-obsidian-950 font-black text-[10px] sm:text-[11px] shadow-sm glow-gold active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer mt-auto"
                >
                  <Trophy className="w-3 h-3 fill-current" />
                  <span>الحصول على الجائزة (+{toArabicIndic(rewardPoints)})</span>
                </motion.button>
              </>
            ) : (
              <>
                {/* Middle: Claimed Message */}
                <div className="px-1 text-center">
                  <div className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-emerald-800 dark:text-holyEmerald-300 bg-emerald-50 dark:bg-holyEmerald-500/15 border border-emerald-200/60 dark:border-holyEmerald-500/30 px-2 py-0.5 rounded-full mb-1">
                    <CheckCircle2 className="w-3 h-3 text-holyEmerald-400" />
                    <span>+{toArabicIndic(rewardPoints)} نقطة</span>
                  </div>
                  <h4 className="text-xs sm:text-[13px] font-black text-slate-800 dark:text-regalGold-100 font-tajawal leading-snug">
                    تم إنجاز تحدي اليوم
                  </h4>
                  <p className="text-[9px] text-slate-400 dark:text-regalGold-300/60 font-medium mt-0.5">
                    بارك الله فيك وتقبل طاعتك
                  </p>
                </div>

                {/* Bottom: Countdown */}
                <div className="w-full px-2 py-1 rounded-xl bg-slate-50 dark:bg-obsidian-950/80 border border-slate-200/60 dark:border-regalGold-500/20 text-center mt-auto">
                  <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-regalGold-300/70 block">
                    الصندوق القادم خلال:
                  </span>
                  <span className="font-mono font-bold text-[10px] sm:text-[11px] text-slate-800 dark:text-regalGold-200">
                    {timeLeftStr || '٠٠:٠٠:٠٠'}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DailyMysteryBox;
