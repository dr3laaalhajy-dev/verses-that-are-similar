import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Clock, AlertTriangle, ShieldCheck, Zap, ArrowLeft, Sparkles } from 'lucide-react';
import { StreakInfo } from '../utils/streakManager';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakInfo: StreakInfo;
  onStartChallenge: () => void;
}

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  streakInfo,
  onStartChallenge,
}) => {
  if (!isOpen) return null;

  const { streak, status, isGracePeriod, timeLeftFormatted } = streakInfo;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center border border-slate-100"
          dir="rtl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Flame Showcase Icon */}
          <div className="relative mx-auto my-3 w-28 h-28 flex items-center justify-center">
            {status === 'active' ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/30 to-amber-400/40 rounded-full blur-xl animate-pulse" />
                <motion.div
                  animate={{ scale: [1, 1.08, 1], rotate: [-2, 2, -2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-xl shadow-orange-500/40 relative z-10 border border-amber-200/50"
                >
                  <Flame className="w-14 h-14 fill-current drop-shadow-md" />
                </motion.div>
              </>
            ) : status === 'warning' ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-rose-400/20 rounded-full blur-lg animate-pulse" />
                <motion.div
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-slate-700 via-amber-700 to-amber-600 flex items-center justify-center text-amber-200 shadow-xl relative z-10 border border-amber-400/40"
                >
                  <Flame className="w-14 h-14 fill-amber-200/40 text-amber-300 drop-shadow-sm" />
                  <div className="absolute -top-1 -right-1 w-7 h-7 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                    <Clock className="w-4 h-4" />
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                <Flame className="w-12 h-12 stroke-[1.5]" />
              </div>
            )}
          </div>

          {/* Title & Streak Number */}
          <div className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-4xl md:text-5xl font-black text-slate-900 tabular-nums">
                {streak}
              </span>
              <span className="text-lg md:text-xl font-bold text-slate-600">
                {streak === 1 ? 'يوم' : streak === 2 ? 'يومان' : streak > 10 ? 'يوماً' : 'أيام'} متتالية
              </span>
            </div>

            {/* Status Badge */}
            {status === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200/70 rounded-full text-xs font-black">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>الشعلة مشتعلة ومتقدة بنجاح</span>
              </span>
            )}

            {status === 'warning' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-black animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>الشعلة طافية مؤقتاً (مهلة الإنقاذ!)</span>
              </span>
            )}

            {status === 'zero' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                <span>سلسلة غير نشطة • ابدأ الآن</span>
              </span>
            )}
          </div>

          {/* Countdown & Rule Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-right mb-5 space-y-2.5">
            {status === 'active' && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs font-bold text-slate-500">ينتهي اليوم خلال:</span>
                <span className="text-base font-black text-orange-600 tabular-nums">
                  {timeLeftFormatted}
                </span>
              </div>
            )}

            {status === 'warning' && (
              <div className="flex items-center justify-between pb-2 border-b border-amber-200 bg-amber-50/60 -mx-4 -mt-4 p-3 rounded-t-2xl">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>الوقت المتبقي لإنقاذ الشعلة:</span>
                </span>
                <span className="text-base font-black text-amber-700 tabular-nums">
                  {timeLeftFormatted}
                </span>
              </div>
            )}

            <div className="text-xs text-slate-600 font-medium leading-relaxed space-y-1.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>نظام الاستمرار اليومي:</strong> تدوم الشعلة لمدة <strong>24 ساعة</strong> بعد كل تحدٍ مكتمل.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>مهلة الإنقاذ (12 ساعة):</strong> إذا تأخرت أكثر من 24 ساعة، تنطفئ الشعلة مؤقتاً وتمنح مهلة 12 ساعة إضافية. إذا أنجزت التحدي خلالها تعود الشعلة للاشتعال فوراً ولا تفقد تقدمك!
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => {
                onClose();
                onStartChallenge();
              }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-700/20 active:scale-98 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>
                {isGracePeriod
                  ? 'أنقذ الشعلة الآن عبر التحدي اليومي'
                  : 'الانتقال إلى التحدي اليومي'}
              </span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-slate-500 hover:text-slate-700 font-bold text-xs transition-colors"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
