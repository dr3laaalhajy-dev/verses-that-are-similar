import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Trophy, BookOpen } from 'lucide-react';
import { renderQuranText } from '../../utils/quranUtils';
import { normalizeArabicText, normalizeSurahName } from '../../utils/arabic';
import { quranData } from '../../services/QuranRepository';

export interface SurahFeedbackData {
  isFullyCorrect: boolean;
  correctSurahs: string[];
}

export interface SurahChallengeUIProps {
  verseText: string;
  inputs: string[];
  onInputChange: (index: number, value: string) => void;
  onSubmit: (e?: any) => void;
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
  surahFeedbackData?: SurahFeedbackData | null;
  isRoom?: boolean;
  isHost?: boolean;
  isLastQuestion?: boolean;
  onEndRoom?: () => void;
  isEndingRoom?: boolean;
}

export const SurahChallengeUI: React.FC<SurahChallengeUIProps> = ({
  verseText,
  inputs,
  onInputChange,
  onSubmit,
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
  surahFeedbackData,
  isRoom,
  isHost,
  isLastQuestion,
  onEndRoom,
  isEndingRoom
}) => (
  <div className="flex flex-col items-center gap-2 md:gap-4 w-full max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto">
    <div className="glass p-3.5 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl w-full text-center border-white/80 shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-brand-gold/30 to-transparent" />
      <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-brand-emerald leading-loose quran-text mb-3.5 md:mb-7 px-2 md:px-4 drop-shadow-xs">
        {renderQuranText(verseText)}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-2.5 md:gap-3 max-w-xs md:max-w-md mx-auto relative z-10 w-full">
        {inputs.map((input: string, idx: number) => {
          let inputStyle = "bg-white border-slate-100 focus:border-brand-gold";
          let isMatch = false;
          if (feedback && surahFeedbackData) {
            isMatch = surahFeedbackData.correctSurahs.some((c: string) => normalizeSurahName(c) === normalizeSurahName(input));
            inputStyle = isMatch
              ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-300"
              : "bg-red-50 border-red-500 text-red-800 ring-2 ring-red-300";
          }
          return (
            <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="relative">
              <input
                type="text"
                list="surah-names-list"
                value={input}
                disabled={feedback}
                onChange={(e) => onInputChange(idx, e.target.value)}
                placeholder={inputs.length > 1 ? `اسم السورة ${idx + 1}` : "ما اسم السورة؟"}
                className={`w-full p-3.5 md:p-4 rounded-xl md:rounded-2xl border-2 ${inputStyle} outline-none text-lg sm:text-xl md:text-xl font-bold text-center quran-text shadow-xs transition-all focus:shadow-sm`}
                autoFocus={idx === 0}
              />
              {feedback && surahFeedbackData && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  {isMatch ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 animate-bounce" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
        <datalist id="surah-names-list">
          {quranData.map((s: any) => (
            <option key={s.id} value={`سورة ${s.name}`} />
          ))}
          {quranData.map((s: any) => (
            <option key={`plain-${s.id}`} value={s.name} />
          ))}
        </datalist>

        {feedback && surahFeedbackData && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full p-3.5 rounded-xl md:rounded-2xl text-right shadow-sm border ${
              surahFeedbackData.isFullyCorrect
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {surahFeedbackData.isFullyCorrect ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-black text-xs sm:text-sm block">
                  {surahFeedbackData.isFullyCorrect ? 'إجابة صحيحة بارك الله فيك 🌟' : 'إجابة غير صحيحة ❌'}
                </span>
                <div className="text-xs sm:text-sm mt-1">
                  <span className="font-bold">الإجابة الصحيحة {surahFeedbackData.correctSurahs.length > 1 ? 'هي السور:' : 'هي سورة:'} </span>
                  <span className="font-black text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block mt-0.5">
                    {surahFeedbackData.correctSurahs.join('، ')}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={feedback}
          className="w-full py-3.5 md:py-3.5 bg-brand-gold text-brand-emerald rounded-xl md:rounded-2xl font-black text-base sm:text-lg md:text-lg shadow-md shadow-brand-gold/20 hover:shadow-brand-gold/40 transition-all flex items-center justify-center gap-2 mt-1 md:mt-2"
        >
          {feedback ? <div className="w-5 h-5 border-2 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin" /> : <span>تحقق من الإجابة</span>}
        </motion.button>
      </form>
    </div>

    {/* Success Message - Positioned below answer check */}
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-4 md:p-6 glass border-brand-emerald/10 text-brand-emerald rounded-2xl md:rounded-3xl text-center shadow-lg relative overflow-hidden mt-4 w-full"
        >
          <div className="absolute top-0 right-0 w-36 h-36 bg-brand-emerald/5 rounded-full -mr-18 -mt-18 blur-2xl" />
          <Trophy className="w-10 h-10 md:w-12 md:h-12 mb-2 text-brand-gold mx-auto drop-shadow-xs" />
          <h3 className="text-xl md:text-2xl font-black mb-1.5 text-brand-emerald">فتح الله عليك!</h3>
          <p className="mb-4 text-slate-600 text-xs md:text-sm font-medium leading-relaxed">أحسنت القول، إجابتك صحيحة وموفقة.</p>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            {challengeMode !== 'daily' && onViewTafsir && (
              <button
                onClick={() => {
                  const firstVerse = currentChallenge?.verses?.[0];
                  if (firstVerse) {
                    onViewTafsir(firstVerse.surah_number, firstVerse.verse_number, firstVerse.text);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs md:text-sm hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>عرض التفسير</span>
              </button>
            )}

            {challengeMode === 'daily' ? (
              <button
                onClick={() => {
                  if (saveScore && KEYWORD) saveScore(KEYWORD, score);
                  const todayStr = new Date().toISOString().split('T')[0];
                  localStorage.setItem('quran_daily_completed', todayStr);
                  if (setDailyCompleted) setDailyCompleted(true);
                  if (updateStatsAfterWin) updateStatsAfterWin();
                }}
                className="px-5 py-2.5 bg-brand-gold text-brand-emerald rounded-xl font-bold text-xs md:text-sm hover:bg-white transition-all shadow-md"
              >
                إنهاء التحدي اليومي
              </button>
            ) : isRoom && isLastQuestion ? (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl font-black text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>اكتملت جميع الأسئلة! جاري إظهار النتائج تلقائياً... 🏁</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (handlePromptNextChallenge) handlePromptNextChallenge();
                  if (updateStatsAfterWin) updateStatsAfterWin();
                }}
                className="px-5 py-2.5 bg-white text-brand-emerald rounded-xl font-bold text-xs md:text-sm hover:bg-brand-gold transition-all shadow-md"
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

export default SurahChallengeUI;
