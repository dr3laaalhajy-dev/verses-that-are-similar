import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Trophy, BookOpen } from 'lucide-react';
import { VerseCard } from './VerseCard';

export interface AudioChallengeUIProps {
  targetVerses: any[];
  matchedIds: Set<string>;
  isListening: boolean;
  onToggleListening: () => void;
  keyword: string;
  keywordWordCount: number;
  wordStates: Record<string, Record<number, 'correct' | 'skipped'>>;
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
  isRoom?: boolean;
  isHost?: boolean;
  isLastQuestion?: boolean;
  onEndRoom?: () => void;
  isEndingRoom?: boolean;
}

export const AudioChallengeUI: React.FC<AudioChallengeUIProps> = ({
  targetVerses,
  matchedIds,
  isListening,
  onToggleListening,
  keyword,
  keywordWordCount,
  wordStates,
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
  isRoom,
  isHost,
  isLastQuestion,
  onEndRoom,
  isEndingRoom
}) => {
  return (
    <div className="flex flex-col items-center gap-3 md:gap-5 w-full">
      <div className="relative group">
        <div className={`absolute inset-0 bg-brand-emerald/20 blur-xl rounded-full transition-all duration-700 group-hover:scale-110 ${isListening ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleListening}
          className={`relative flex items-center gap-2 md:gap-3 px-4 py-2 md:px-6 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-md ${isListening
            ? 'bg-red-500 text-white shadow-red-200 scale-105'
            : 'bg-brand-emerald text-white shadow-brand-emerald/20 hover:shadow-brand-emerald/40'
            }`}
        >
          {isListening ? (
            <>
              <div className="flex gap-1 justify-center items-center">
                {[1, 2, 3].map(i => (
                  <motion.div key={i} animate={{ height: [6, 14, 6] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }} className="w-0.5 bg-white rounded-full" />
                ))}
              </div>
              <span>إيقاف التلاوة</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
              <span>ابدأ التلاوة الكريمة</span>
            </>
          )}
        </motion.button>
      </div>

      {onSkip && (
        <button onClick={onSkip} className="text-slate-400 font-bold hover:text-red-500 transition-colors flex items-center gap-1 text-[11px] md:text-xs">
          <X className="w-3 h-3 md:w-3.5 md:h-3.5" /> تخطي هذا الموضع
        </button>
      )}

      {/* Success Message - Positioned below control buttons */}
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
            <p className="mb-4 text-slate-600 text-xs md:text-sm font-medium">أتقنت جميع المتشابهات في هذا الموضع ببراعة بارك الله فيك.</p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              {challengeMode !== 'daily' && onViewTafsir && (
                <button
                  onClick={() => {
                    const firstVerse = targetVerses[0];
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
                isHost ? (
                  <button
                    type="button"
                    onClick={onEndRoom}
                    disabled={isEndingRoom}
                    className="px-5 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-xs md:text-sm hover:bg-brand-emerald/90 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-amber-300" />
                    <span>{isEndingRoom ? 'جاري الإنهاء...' : 'إنهاء الغرفة'}</span>
                  </button>
                ) : (
                  <div className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-bold text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>في انتظار القائد لإنهاء التحدي</span>
                  </div>
                )
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

      <div className="grid grid-cols-2 md:grid-cols-2 gap-1.5 md:gap-4 w-full pb-4 md:pb-8 mt-1 md:mt-2">
        {targetVerses.map((verse: any, idx: number) => (
          <VerseCard
            key={verse.id}
            verse={verse}
            keyword={keyword}
            isMatched={matchedIds.has(verse.id)}
            index={idx}
            keywordWordCount={keywordWordCount}
            wordStates={wordStates[verse.id] || {}}
          />
        ))}
      </div>
    </div>
  );
};

export default AudioChallengeUI;
