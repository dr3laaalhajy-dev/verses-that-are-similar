import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Clock, Users, BookOpen, Trophy, CheckCircle2, ChevronLeft, Gift, Zap
} from 'lucide-react';
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
const TreasureChest3D: React.FC<{ isOpen?: boolean; isClaimed?: boolean }> = ({ isOpen = false, isClaimed = false }) => {
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
      {/* Radiant Background Aura */}
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${
          isOpen || isClaimed
            ? 'bg-gradient-to-r from-amber-400/40 via-regalGold-400/50 to-holyEmerald-400/40 scale-125 animate-pulse'
            : 'bg-regalGold-500/25 scale-100 group-hover:scale-110'
        }`}
      />

      {/* Dynamic Animated Sparkles */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-300 drop-shadow-md animate-bounce" />
        <Sparkles className="absolute -bottom-1 -left-1 w-3.5 h-3.5 text-regalGold-300 drop-shadow-sm" />
      </motion.div>

      {/* 3D Chest SVG */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full relative z-10 transition-transform duration-500 drop-shadow-[0_10px_20px_rgba(212,175,55,0.35)] ${
          isOpen ? 'scale-105' : 'group-hover:scale-105'
        }`}
      >
        <defs>
          <linearGradient id="chestGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#B38F26" />
            <stop offset="100%" stopColor="#785B12" />
          </linearGradient>

          <linearGradient id="chestBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <linearGradient id="gemEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          <linearGradient id="glowRays" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(253, 230, 138, 0)" />
            <stop offset="100%" stopColor="rgba(253, 230, 138, 0.7)" />
          </linearGradient>
        </defs>

        {/* Radiating Light Beams when opened */}
        {isOpen && (
          <g className="animate-pulse">
            <polygon points="50,40 20,5 35,0" fill="url(#glowRays)" opacity="0.6" />
            <polygon points="50,40 45,-5 55,-5" fill="url(#glowRays)" opacity="0.8" />
            <polygon points="50,40 65,0 80,5" fill="url(#glowRays)" opacity="0.6" />
          </g>
        )}

        {/* Chest Base / Body */}
        <path
          d="M 18,48 L 82,48 L 76,82 C 76,85 73,88 70,88 L 30,88 C 27,88 24,85 24,82 Z"
          fill="url(#chestBody)"
          stroke="url(#chestGold)"
          strokeWidth="3.5"
        />

        {/* Metal Reinforcement Straps */}
        <path d="M 32,48 L 34,88" stroke="url(#chestGold)" strokeWidth="3" />
        <path d="M 68,48 L 66,88" stroke="url(#chestGold)" strokeWidth="3" />

        {/* Gold Corner Rivets */}
        <circle cx="26" cy="52" r="1.8" fill="#FDE68A" />
        <circle cx="74" cy="52" r="1.8" fill="#FDE68A" />
        <circle cx="31" cy="84" r="1.8" fill="#FDE68A" />
        <circle cx="69" cy="84" r="1.8" fill="#FDE68A" />

        {/* Treasure Chest Lid (Open or Closed) */}
        {isOpen || isClaimed ? (
          // OPEN LID
          <g>
            {/* Treasure Overflow (Golden coins & emerald jewel inside) */}
            <ellipse cx="50" cy="48" rx="26" ry="7" fill="#FBBF24" />
            <circle cx="44" cy="45" r="4.5" fill="#FDE68A" stroke="#B38F26" strokeWidth="1" />
            <circle cx="56" cy="46" r="4" fill="#F59E0B" stroke="#B38F26" strokeWidth="1" />
            <circle cx="50" cy="43" r="5" fill="#FDE68A" stroke="#B38F26" strokeWidth="1" />

            {/* Opened Lid tilted upwards */}
            <path
              d="M 16,38 C 16,38 18,16 50,16 C 82,16 84,38 84,38 L 78,42 C 78,42 74,24 50,24 C 26,24 22,42 22,42 Z"
              fill="url(#chestBody)"
              stroke="url(#chestGold)"
              strokeWidth="3.5"
            />
          </g>
        ) : (
          // CLOSED LID
          <g>
            <path
              d="M 16,48 C 16,48 18,24 50,24 C 82,24 84,48 84,48 Z"
              fill="url(#chestBody)"
              stroke="url(#chestGold)"
              strokeWidth="3.5"
            />
            {/* Lid Straps */}
            <path d="M 32,26 C 32,36 32,48 32,48" stroke="url(#chestGold)" strokeWidth="3" />
            <path d="M 68,26 C 68,36 68,48 68,48" stroke="url(#chestGold)" strokeWidth="3" />

            {/* Glowing Golden Lock & Central Gem */}
            <rect x="44" y="44" width="12" height="12" rx="2.5" fill="url(#chestGold)" />
            <circle cx="50" cy="50" r="3" fill="url(#gemEmerald)" />
            <path d="M 47,44 L 47,41 C 47,39 48,37 50,37 C 52,37 53,39 53,41 L 53,44" fill="none" stroke="url(#chestGold)" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const DailyMysteryBox: React.FC = () => {
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

  const { isRevealed, isCompleted, isClaimed, type, title, description, target, currentProgress, rewardPoints } = dailyGift;

  const progressPercent = Math.min(100, Math.round((currentProgress / target) * 100));

  // Handle action click to direct user to the appropriate section
  const handleGoToChallenge = () => {
    if (type === 'reading_time') {
      if (app?.setView) {
        app.setView('mushaf');
      }
    } else {
      if (app?.setView) {
        app.setView('group_join');
      }
    }
  };

  return (
    <section className="w-full rounded-3xl glass-card bg-white dark:bg-obsidian-900/80 border border-slate-200/80 dark:border-regalGold-500/30 p-4 sm:p-5 md:p-6 shadow-xl relative overflow-hidden backdrop-blur-xl transition-all duration-300">
      {/* Background Decorative Islamic Accents */}
      <div className="absolute -top-16 -left-16 w-44 h-44 bg-regalGold-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-holyEmerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* ======================================================== */}
        {/* 1. LOCKED STATE (الحالة المغلقة: اضغط لكشف التحدي المفاجئ) */}
        {/* ======================================================== */}
        {!isRevealed ? (
          <motion.div
            key="locked"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            onClick={app.revealDailyGift}
            className="group flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-right cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="animate-pulse glow-gold rounded-full p-1 transition-transform group-hover:scale-105 duration-300">
                <TreasureChest3D isOpen={false} />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-regalGold-500/15 border border-amber-200/60 dark:border-regalGold-500/30 text-amber-800 dark:text-regalGold-300 text-xs font-black mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-regalGold-400 animate-spin-slow" />
                  <span>صندوق الهدية اليومية</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                  صندوق اليوم: اضغط لكشف التحدي المفاجئ
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-medium mt-1">
                  تحدٍ مبارك متجدد يومياً، أنجزه لتكسب مكافآت ونقاط مهارة إضافية.
                </p>
              </div>
            </div>

            {/* Click to Reveal CTA */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                app.revealDailyGift();
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-obsidian-950 font-black text-xs sm:text-sm shadow-lg shadow-regalGold-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Gift className="w-4 h-4 fill-current" />
              <span>افتح الصندوق الآن</span>
            </button>
          </motion.div>
        ) : isClaimed ? (
          /* ======================================================== */
          /* 4. CLAIMED STATE (تم استلام المكافأة - انتظار الغد)         */
          /* ======================================================== */
          <motion.div
            key="claimed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <TreasureChest3D isOpen={true} isClaimed={true} />

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-holyEmerald-500/20 border border-emerald-200/60 dark:border-holyEmerald-500/40 text-emerald-800 dark:text-holyEmerald-300 text-xs font-black mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-holyEmerald-400" />
                  <span>تم إنجاز تحدي اليوم واستلام المكافأة (+{toArabicIndic(rewardPoints)} نقطة)</span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                  بارك الله فيك وتقبل طاعتك!
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-medium mt-1">
                  ترقّب صندوق الغد مع تحدٍ ومكافأة مباركة جديدة بإذن الله.
                </p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-center sm:items-end gap-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-obsidian-950/80 border border-slate-200/80 dark:border-regalGold-500/25 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 dark:text-regalGold-300/70">
                الصندوق القادم خلال:
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-slate-800 dark:text-regalGold-200 tracking-wider">
                {timeLeftStr || '٠٠:٠٠:٠٠'}
              </span>
            </div>
          </motion.div>
        ) : isCompleted ? (
          /* ======================================================== */
          /* 3. COMPLETED STATE (حالة الاكتمال: استلم المكافأة الآن)    */
          /* ======================================================== */
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-right"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="glow-gold rounded-full p-1 animate-pulse">
                <TreasureChest3D isOpen={true} />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-regalGold-500/20 border border-amber-200/60 dark:border-regalGold-500/40 text-amber-800 dark:text-regalGold-200 text-xs font-black mb-1.5 animate-bounce">
                  <Trophy className="w-3.5 h-3.5 text-regalGold-400" />
                  <span>اكتمل التحدي بنجاح!</span>
                </div>

                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-800 dark:text-regalGold-100 font-tajawal">
                  ما شاء الله! أنجزت مهمة اليوم
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 font-medium mt-1">
                  مكافأتك المستحقة جاهزة: <span className="font-bold text-emerald-600 dark:text-holyEmerald-300">+{toArabicIndic(rewardPoints)} نقطة مهارة</span>
                </p>
              </div>
            </div>

            {/* Claim Reward Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={app.claimDailyGiftReward}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-regalGold-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-obsidian-950 font-black text-sm md:text-base shadow-xl shadow-regalGold-500/30 flex items-center justify-center gap-2.5 shrink-0 cursor-pointer glow-gold"
            >
              <Trophy className="w-5 h-5 text-obsidian-950 fill-current" />
              <span>استلم المكافأة الآن</span>
              <span className="px-2 py-0.5 rounded-full bg-obsidian-950/20 text-obsidian-950 text-xs font-mono">
                +{toArabicIndic(rewardPoints)}
              </span>
            </motion.button>
          </motion.div>
        ) : (
          /* ======================================================== */
          /* 2. IN-PROGRESS STATE (الحالة النشطة: عرض المهمة والتقدم)   */
          /* ======================================================== */
          <motion.div
            key="in_progress"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-4"
          >
            {/* Header: Title, Icon & Reward */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 dark:bg-regalGold-500/15 border border-amber-200/60 dark:border-regalGold-500/30 text-amber-700 dark:text-regalGold-300 flex items-center justify-center shrink-0 shadow-xs">
                  {type === 'reading_time' ? (
                    <BookOpen className="w-5 h-5 text-regalGold-400" />
                  ) : (
                    <Users className="w-5 h-5 text-regalGold-400" />
                  )}
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                    <span className="text-xs font-black text-amber-700 dark:text-regalGold-300">
                      تحدي اليوم النشط
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-regalGold-100 font-tajawal mt-0.5">
                    {title}
                  </h3>
                </div>
              </div>

              {/* Reward Badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-regalGold-500/15 border border-amber-200/60 dark:border-regalGold-500/30 text-amber-800 dark:text-regalGold-300 text-xs font-black shrink-0">
                <Zap className="w-3.5 h-3.5 text-regalGold-400 fill-current" />
                <span>+{toArabicIndic(rewardPoints)} نقطة</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-300 text-right font-medium">
              {description}
            </p>

            {/* Live Progress Bar & Counter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-regalGold-200">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-regalGold-400 animate-spin-slow" />
                  {type === 'reading_time' ? (
                    <span>
                      لقد قرأت{' '}
                      <span className="font-mono text-emerald-600 dark:text-holyEmerald-300 font-black">
                        {formatMinutesSeconds(currentProgress)}
                      </span>{' '}
                      من أصل{' '}
                      <span className="font-mono">
                        {formatMinutesSeconds(target)}
                      </span>{' '}
                      دقائق
                    </span>
                  ) : (
                    <span>
                      أكملت{' '}
                      <span className="font-mono text-emerald-600 dark:text-holyEmerald-300 font-black">
                        {toArabicIndic(currentProgress)}
                      </span>{' '}
                      من أصل{' '}
                      <span className="font-mono">
                        {toArabicIndic(target)}
                      </span>{' '}
                      مباراة جماعية
                    </span>
                  )}
                </span>

                <span className="font-mono font-black text-emerald-700 dark:text-holyEmerald-300">
                  {toArabicIndic(progressPercent)}٪
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-obsidian-950/80 border border-slate-200/60 dark:border-regalGold-500/20 overflow-hidden p-0.5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-regalGold-400 to-holyEmerald-400 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                </motion.div>
              </div>
            </div>

            {/* Quick Action Button: Direct navigation to the challenge */}
            <div className="pt-1 flex items-center justify-end">
              <button
                type="button"
                onClick={handleGoToChallenge}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-brand-emerald hover:bg-[#033628] dark:bg-holyEmerald-600 dark:hover:bg-holyEmerald-500 text-white dark:text-obsidian-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {type === 'reading_time' ? (
                  <>
                    <BookOpen className="w-4 h-4 fill-current" />
                    <span>انتقل للمصحف الآن لمتابعة القراءة</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>دخول غرف التنافس لخوض التحدي</span>
                  </>
                )}
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default DailyMysteryBox;
