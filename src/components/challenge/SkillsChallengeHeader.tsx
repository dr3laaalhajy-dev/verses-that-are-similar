import React from 'react';
import { Mic, BookOpen, CheckCircle, Trophy, X } from 'lucide-react';
import { renderQuranText } from '../../utils/quranUtils';

interface SkillsChallengeHeaderProps {
  index?: number;
  total?: number;
  mode?: 'audio' | 'complete' | 'surah' | string;
  title?: string;
  verseText?: string;
  totalPoints?: number;
  onSkip?: () => void;
  isComplete?: boolean;
  level?: string;
  isDaily?: boolean;
  onFinishDaily?: () => void;
}

export const SkillsChallengeHeader: React.FC<SkillsChallengeHeaderProps> = ({
  index,
  total,
  mode,
  title,
  verseText,
  totalPoints: pts,
  onSkip,
  isComplete,
  level,
  isDaily,
  onFinishDaily,
}) => (
  <div className="flex justify-between items-start gap-2 mb-2 md:mb-4 relative z-10 w-full" dir="rtl">
    <div className="flex items-center gap-2 md:gap-3 min-w-0 pt-0.5">
      <div className="w-7 h-7 md:w-11 md:h-11 bg-brand-gold/10 rounded-lg md:rounded-xl flex items-center justify-center text-brand-gold shrink-0">
        {mode === 'audio' ? (
          <Mic className="w-3.5 h-3.5 md:w-5 md:h-5" />
        ) : mode === 'surah' ? (
          <BookOpen className="w-3.5 h-3.5 md:w-5 md:h-5" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 md:w-5 md:h-5" />
        )}
      </div>
      <div className="text-right min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-black text-brand-emerald block leading-tight ${
              mode === 'complete' ? 'text-xs md:text-lg' : 'text-[9px] md:text-xs mb-0.5'
            }`}
          >
            {title ? title : mode === 'audio' ? 'تحدي التلاوة' : mode === 'surah' ? 'تحدي السور' : 'تحدي الإكمال'}
          </span>
          {level && (
            <span
              className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border ${
                level === 'hard' || level === 'صعب'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : level === 'easy' || level === 'سهل'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {level === 'hard' || level === 'صعب'
                ? 'صعب 🔥 (20ث)'
                : level === 'easy' || level === 'سهل'
                ? 'سهل 🌱 (10ث)'
                : 'متوسط ⚡ (15ث)'}
            </span>
          )}
        </div>
        {mode !== 'complete' && !title && (
          <h2 className="text-xs md:text-base font-bold text-slate-700 quran-text truncate max-w-[140px] sm:max-w-xs md:max-w-md">
            {verseText ? renderQuranText(verseText.substring(0, 25) + (verseText.length > 25 ? '...' : '')) : 'جاري التحميل...'}
          </h2>
        )}
      </div>
    </div>

    <div className="flex flex-col items-end shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 bg-white/70 backdrop-blur-md px-2.5 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-white shadow-xs">
        {index !== undefined && total !== undefined && (
          <span className="text-xs md:text-base font-black text-brand-emerald tabular-nums">
            {index + 1} <span className="text-[10px] md:text-xs font-bold text-slate-400">/ {total}</span>
          </span>
        )}
        <div className="w-px h-3.5 md:h-4 bg-slate-200" />
        <span className="text-xs md:text-base font-black text-brand-gold tabular-nums">{pts || 0} نقطة</span>
      </div>
      {isDaily && isComplete && onFinishDaily && (
        <button
          onClick={onFinishDaily}
          className="bg-linear-to-r from-amber-400 via-brand-gold to-amber-500 hover:brightness-105 text-brand-emerald font-black transition-all flex items-center gap-1.5 text-xs md:text-sm px-3.5 py-1.5 rounded-xl shadow-md active:scale-95 cursor-pointer animate-pulse border border-white/60"
        >
          <Trophy className="w-4 h-4 text-brand-emerald" />
          <span>إنهاء التحدي اليومي</span>
        </button>
      )}
      {onSkip && !isComplete && (
        <button
          onClick={onSkip}
          className="text-red-500 hover:text-red-600 font-bold transition-all flex items-center gap-1.5 text-[11px] md:text-sm mt-1 md:mt-2 px-1.5 md:px-3 py-0.5 md:py-1 rounded-lg hover:bg-red-50 active:scale-95 cursor-pointer"
          title="تخطي السؤال"
        >
          <X className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
          <span>تخطي السؤال</span>
        </button>
      )}
    </div>
  </div>
);

export default SkillsChallengeHeader;
