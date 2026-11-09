import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, CheckCircle, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { renderQuranText } from '../../utils/quranUtils';
import { superNormalizeArabic } from '../../utils/challengeHelpers';

export interface CompleteChallengeUIProps {
  verseText: string;
  options: any[];
  selectedOption: any;
  onOptionSelect: (option: any) => void;
  onConfirm: () => void;
  feedback: boolean;
  onSkip?: () => void;
  isComplete?: boolean;
  challengeMode?: string;
  saveScore?: (keyword: string, score: number) => void;
  KEYWORD?: string;
  score?: number;
  setDailyCompleted?: (completed: boolean) => void;
  updateStatsAfterWin?: () => void;
  handlePromptNextChallenge?: () => void;
  onViewTafsir?: (surahNumber: any, verseNumber: any, text: string) => void;
  currentChallenge?: any;
  onFinishDaily?: () => void;
  correctText?: string;
  eliminatedIndices?: number[];
  isRoom?: boolean;
  isHost?: boolean;
  isLastQuestion?: boolean;
  onEndRoom?: () => void;
  isEndingRoom?: boolean;
}

export const CompleteChallengeUI: React.FC<CompleteChallengeUIProps> = ({
  verseText,
  options,
  selectedOption,
  onOptionSelect,
  onConfirm,
  feedback,
  onSkip,
  isComplete,
  challengeMode,
  saveScore,
  KEYWORD,
  score = 0,
  setDailyCompleted,
  updateStatsAfterWin,
  handlePromptNextChallenge,
  onViewTafsir,
  currentChallenge,
  onFinishDaily,
  correctText,
  eliminatedIndices,
  isRoom,
  isHost,
  isLastQuestion,
  onEndRoom,
  isEndingRoom
}) => {
  const handleFinishDailyAction = () => {
    if (saveScore && KEYWORD) saveScore(KEYWORD, score);
    const todayStr = new Date().toISOString().split('T')[0];
    localStorage.setItem('quran_daily_completed', todayStr);
    if (setDailyCompleted) setDailyCompleted(true);
    if (updateStatsAfterWin) updateStatsAfterWin();
    if (onFinishDaily) onFinishDaily();
  };

  return (
    <div className="flex flex-col items-center gap-2 md:gap-4 w-full max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto">
      {/* زر إنهاء التحدي اليومي في الأعلى عند إتمام التحدي بنجاح */}
      <AnimatePresence>
        {isComplete && challengeMode === 'daily' && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full mb-2"
          >
            <button
              onClick={handleFinishDailyAction}
              className="w-full py-3.5 md:py-4 px-6 bg-linear-to-r from-amber-400 via-brand-gold to-amber-500 text-brand-emerald rounded-2xl md:rounded-3xl font-black text-base md:text-lg hover:brightness-105 transition-all shadow-xl active:scale-98 flex items-center justify-center gap-2.5 border-2 border-white cursor-pointer"
            >
              <Trophy className="w-5 h-5 md:w-6 md:h-6 text-brand-emerald animate-bounce" />
              <span>إنهاء التحدي اليومي</span>
              <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-brand-emerald" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass gamified-card bg-white/95 backdrop-blur-sm shadow-2xl p-4 md:p-8 lg:p-10 rounded-3xl w-full text-center border border-white/80 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-brand-emerald/30 to-transparent" />
        <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-brand-emerald leading-loose quran-text mb-3.5 md:mb-7 px-2 md:px-4">
          {renderQuranText(verseText)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4 w-full">
          {options.map((opt: any, idx: number) => {
            const isEliminated = Array.isArray(eliminatedIndices) && eliminatedIndices.includes(idx);
            if (isEliminated) {
              return (
                <div
                  key={opt?.id || idx}
                  className="opacity-0 pointer-events-none p-3.5 md:p-4 rounded-xl border border-transparent select-none"
                />
              );
            }

            const rawSelectedText = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.text : selectedOption) : null;
            const isSelected = selectedOption === opt || (rawSelectedText !== null && rawSelectedText === opt.text);
            const isOptionCorrect = !!opt.isCorrect || (correctText && superNormalizeArabic(opt.text) === superNormalizeArabic(correctText));

            let btnClass = 'gamified-option-btn bg-white border-slate-100 text-slate-700 hover:border-brand-gold/30 hover:bg-brand-gold/5';
            if (feedback) {
              if (isOptionCorrect) {
                btnClass = 'bg-emerald-600 border-emerald-600 text-white shadow-lg ring-2 ring-emerald-300 font-black scale-[1.02]';
              } else if (isSelected && !isOptionCorrect) {
                btnClass = 'bg-red-500 border-red-500 text-white shadow-md line-through';
              } else {
                btnClass = 'bg-slate-100 border-slate-200 text-slate-400 opacity-40';
              }
            } else if (isSelected) {
              btnClass = 'bg-brand-gold border-brand-gold text-brand-emerald shadow-md scale-[1.01]';
            }

            return (
              <button
                key={idx}
                disabled={feedback}
                onClick={() => onOptionSelect(opt)}
                className={`p-3.5 sm:p-4 md:py-5 md:px-6 rounded-xl md:rounded-2xl border-2 transition-all text-lg sm:text-xl md:text-xl lg:text-2xl font-bold quran-text active:scale-98 relative shadow-xs min-h-[62px] sm:min-h-[68px] md:min-h-[75px] flex items-center justify-center text-center gap-2 ${btnClass}`}
              >
                {feedback && isOptionCorrect && (
                  <CheckCircle className="w-5 h-5 text-white shrink-0 animate-bounce" />
                )}
                {feedback && isSelected && !isOptionCorrect && (
                  <XCircle className="w-5 h-5 text-white shrink-0" />
                )}
                <span>{renderQuranText(opt.text)}</span>
              </button>
            );
          })}
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full p-3.5 rounded-xl md:rounded-2xl text-right shadow-sm border mt-3.5 ${
              (selectedOption && (selectedOption.isCorrect || (correctText && superNormalizeArabic(typeof selectedOption === 'object' ? selectedOption.text : selectedOption) === superNormalizeArabic(correctText))))
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {(selectedOption && (selectedOption.isCorrect || (correctText && superNormalizeArabic(typeof selectedOption === 'object' ? selectedOption.text : selectedOption) === superNormalizeArabic(correctText)))) ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-black text-xs sm:text-sm block">
                  {selectedOption && (selectedOption.isCorrect || (correctText && superNormalizeArabic(typeof selectedOption === 'object' ? selectedOption.text : selectedOption) === superNormalizeArabic(correctText)))
                    ? 'إجابة صحيحة! أحسنت 🌟'
                    : 'إجابة غير صحيحة ❌'}
                </span>
                <div className="text-xs sm:text-sm font-bold opacity-95 mt-1">
                  <span>الإجابة الصحيحة (تكملة الآية): </span>
                  <strong className="quran-text font-black text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-md inline-block mt-0.5">
                    {correctText || options.find((o: any) => o.isCorrect)?.text || ''}
                  </strong>
                  {currentChallenge?.verses?.[0]?.surah && (
                    <span className="block text-[11px] text-emerald-700/80 font-normal mt-1">
                      (سورة {currentChallenge.verses[0].surah}{currentChallenge.verses[0].juz ? ` • الجزء ${currentChallenge.verses[0].juz}` : ''})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {selectedOption && !feedback && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onConfirm}
            className="w-full mt-3.5 md:mt-6 py-3 md:py-3.5 bg-brand-emerald text-white rounded-xl md:rounded-2xl font-black text-base sm:text-lg md:text-lg shadow-md shadow-brand-emerald/20 hover:shadow-brand-emerald/40 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
            <span>تأكيد الإجابة</span>
          </motion.button>
        )}
      </div>

      {/* Success Message - Positioned below confirm/skip */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="p-5 md:p-8 glass border-brand-emerald/10 text-brand-emerald rounded-2xl md:rounded-3xl text-center shadow-xl relative overflow-hidden mt-6 w-full"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-emerald/5 rounded-full -mr-24 -mt-24 blur-3xl" />
            <Trophy className="w-12 h-12 md:w-16 md:h-16 mb-3 text-brand-gold mx-auto drop-shadow-md" />
            <h3 className="text-2xl md:text-3xl font-black mb-2 text-brand-emerald">فتح الله عليك!</h3>
            <p className="mb-6 text-slate-600 text-sm md:text-base font-medium leading-relaxed">أحسنت التوقع، إجابة صحيحة بارك الله فيك.</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {challengeMode !== 'daily' && onViewTafsir && (
                <button
                  onClick={() => {
                    const firstVerse = currentChallenge?.verses?.[0];
                    if (firstVerse) {
                      onViewTafsir(firstVerse.surah_number, firstVerse.verse_number, firstVerse.text);
                    }
                  }}
                  className="px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm md:text-base hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>عرض التفسير</span>
                </button>
              )}

              {challengeMode === 'daily' ? (
                <button
                  onClick={handleFinishDailyAction}
                  className="px-6 py-3 bg-brand-gold text-brand-emerald rounded-xl font-black text-sm md:text-base hover:bg-white transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trophy className="w-5 h-5 text-brand-emerald" />
                  <span>إنهاء التحدي اليومي</span>
                </button>
              ) : isRoom && isLastQuestion ? (
                <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl font-black text-xs md:text-sm flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>اكتملت جميع الأسئلة! جاري إظهار النتائج تلقائياً... 🏁</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (handlePromptNextChallenge) handlePromptNextChallenge();
                    if (updateStatsAfterWin) updateStatsAfterWin();
                  }}
                  className="px-6 py-3 bg-white text-brand-emerald rounded-xl font-bold text-sm md:text-base hover:bg-brand-gold transition-all shadow-lg"
                >
                  التحدي التالي
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompleteChallengeUI;
