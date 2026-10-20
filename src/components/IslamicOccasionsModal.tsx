import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Moon, Sunrise, Calendar, Sparkles, Heart, CheckCircle2,
  Share2, Check, BookOpen, Clock, ChevronLeft, ArrowRight
} from 'lucide-react';
import { IslamicOccasion, HijriDateInfo } from '../services/IslamicOccasionsService';

interface IslamicOccasionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  occasions: IslamicOccasion[];
  hijriDate: HijriDateInfo;
  initialSelectedId?: string;
}

export default function IslamicOccasionsModal({
  isOpen,
  onClose,
  occasions,
  hijriDate,
  initialSelectedId
}: IslamicOccasionsModalProps) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    return initialSelectedId || (occasions[0]?.id || '');
  });
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentOccasion = occasions.find(o => o.id === selectedId) || occasions[0];

  const handleShare = () => {
    if (!currentOccasion) return;
    const text = `🌙 مواسم الطاعات | ${currentOccasion.title}\n📅 الموعد: ${currentOccasion.timingBadge} (${currentOccasion.hijriDateText})\n\n قال رسول الله ﷺ:\n${currentOccasion.hadith}\n[${currentOccasion.hadithSource}]\n\n✨ فضلها: ${currentOccasion.virtue}\n\nتطبيق المتشابهات القرآنية`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const renderIcon = (type: string, className = "w-5 h-5") => {
    switch (type) {
      case 'sunrise':
        return <Sunrise className={className} />;
      case 'heart':
        return <Heart className={className} />;
      case 'calendar':
        return <Calendar className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      default:
        return <Moon className={className} />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
        {/* Backdrop click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          onClick={onClose}
        />

        {/* Modal / BottomSheet Window */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-2xl bg-gradient-to-b from-slate-50 to-white rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-amber-200/60 max-h-[92vh] sm:max-h-[85vh] flex flex-col z-10 overflow-hidden text-right"
          dir="rtl"
        >
          {/* Top Decorative Islamic Banner */}
          <div className="relative bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-5 sm:p-6 shrink-0 shadow-sm overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-teal-400/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <Moon className="w-6 h-6 fill-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black tracking-wide text-white flex items-center gap-2">
                    مواسم الطاعات وسُنن الأيام
                    <span className="text-[10px] bg-amber-400/25 text-amber-200 border border-amber-300/30 px-2 py-0.5 rounded-full font-bold">
                      نافلة
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    اليوم: {hijriDate.dayName} {hijriDate.formatted}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Horizontal Occasions Selector (المناسبات القادمة بالترتيب) */}
          <div className="bg-emerald-50/60 border-b border-emerald-100 p-3 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2.5 min-w-max px-1">
              <span className="text-[11px] font-black text-emerald-900 shrink-0 ml-1">
                الترتيب الزمني:
              </span>
              {occasions.map((occ, idx) => {
                const isSelected = occ.id === currentOccasion?.id;
                const isNearest = idx === 0;

                return (
                  <button
                    key={occ.id}
                    onClick={() => setSelectedId(occ.id)}
                    className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-md shadow-emerald-700/25 scale-102'
                        : 'bg-white text-slate-700 hover:bg-emerald-100/60 border-emerald-200/60'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isSelected
                        ? 'bg-amber-300 animate-pulse'
                        : isNearest
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                    }`} />
                    <span>{occ.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected
                        ? 'bg-white/20 text-amber-200'
                        : 'bg-emerald-100/80 text-emerald-800'
                    }`}>
                      {occ.timingBadge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Body / Active Occasion Details */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {currentOccasion ? (
              <div className="space-y-4">
                {/* Occasion Hero Header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/80 via-emerald-50/60 to-white border border-amber-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                      {renderIcon(currentOccasion.iconType, 'w-6 h-6 text-amber-300')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          {currentOccasion.categoryLabel}
                        </span>
                        <span className="text-[11px] font-black text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                          {currentOccasion.timingBadge}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                        {currentOccasion.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {currentOccasion.hijriDateText} • {currentOccasion.gregorianDateText}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleShare}
                    className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer group shrink-0"
                    title="مشاركة الحديث وفضل المناسبة"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
                        <span>مشاركة ونشر الأجر</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Hadith Section (بطاقة الحديث النبوي الشريف) */}
                <div className="relative p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 to-yellow-50/40 border-2 border-amber-300/60 shadow-sm overflow-hidden">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-200/20 rounded-full blur-xl pointer-events-none" />

                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200/60">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-700" />
                      الحديث النبوي الشريف
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-lg">
                      {currentOccasion.hadithSource}
                    </span>
                  </div>

                  <p className="quran-text text-base sm:text-lg font-bold text-slate-800 leading-loose text-center py-2 px-1">
                    {currentOccasion.hadith}
                  </p>

                  {currentOccasion.hadithExplanation && (
                    <div className="mt-3 pt-3 border-t border-amber-200/50 text-xs text-amber-900/80 font-medium leading-relaxed">
                      <strong className="font-bold text-amber-950">الفائدة: </strong>
                      {currentOccasion.hadithExplanation}
                    </div>
                  )}
                </div>

                {/* Virtue Section (فضائل المناسبة) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
                  <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    فضل هذه المناسبة وثوابها
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {currentOccasion.virtue}
                  </p>
                </div>

                {/* Recommended Acts / Sunan (أعمال وسُنن مستحبة) */}
                {currentOccasion.recommendedActs.length > 0 && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 shadow-xs space-y-2.5">
                    <h5 className="text-xs font-black text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      كيف تغتنم هذا اليوم؟ (سُنن وأعمال مستحبة)
                    </h5>
                    <ul className="space-y-1.5">
                      {currentOccasion.recommendedActs.map((act, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">
              «مَن دَلَّ على خيرٍ فله مثلُ أجرِ فاعله» (صحيح مسلم)
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md shadow-emerald-700/20 cursor-pointer"
            >
              تم
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
