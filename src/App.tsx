import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Sparkles, Trophy, RotateCcw, X, Mic, MicOff, Search, BookOpen, CheckCircle, CheckCircle2,
  ChevronRight, ChevronLeft, LayoutGrid, Heart, History, Compass, Home, Plane,
  ListFilter, Sun, Moon, Calendar, Settings, Copy, Check, Lightbulb, ChevronDown, User, Users, Quote,
  ArrowRight, ArrowLeft, Zap, Lock, AlertCircle, Hash, XCircle, Eye, List, Loader2, Flame
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import { quranData } from './services/QuranRepository';

interface Verse {
  id: string;
  text: string;
  surah: string;
  number: string | number;
}
import { HADITHS, Hadith } from './services/HadithRepository';
import { juzBoundaries } from './services/JuzRepository';
import { getPageNumber, juzStartPages, surahStartPages } from './services/PageRepository';
import { adhkarData, Dhikr } from './services/AdhkarRepository';
import { normalizeArabicText, getSimilarity, convertArabicNumbersToEnglish } from './utils/arabic';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import Confetti from 'react-confetti';
import ConfirmModal from './components/ConfirmModal';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import SkillsMenu from './components/SkillsMenu';
import BookReader from './components/BookReader';
import Encyclopedia from './components/Encyclopedia';
import IslamicQuiz from './components/IslamicQuiz';
import DailyAyah from './components/DailyAyah';
import { renderQuranText } from './utils/quranUtils';

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

type View = 'home' | 'difficulty' | 'challenge' | 'mushaf' | 'adhkar' | 'hadith' | 'admin' | 'list' | 'group_menu' | 'group_waiting' | 'group_game' | 'speed_challenge' | 'skills_menu' | 'speed_menu' | 'group_create' | 'group_join' | 'book' | 'encyclopedia' | 'skills_count_selection' | 'skills_results' | 'islamic_quiz';
type Difficulty = 'easy' | 'medium' | 'hard';

const toast = {
  success: (msg: string) => console.log(`SUCCESS: ${msg}`),
  error: (msg: string) => console.log(`ERROR: ${msg}`)
};

// Helper function to find the best subsequence match of targetWords in transcriptWords
// Returns the maximum number of matched words and the maximum consecutive matched words
function getBestSubsequenceMatch(transcriptWords: string[], targetWords: string[]): { matches: number, consecutiveMatches: number } {
  if (targetWords.length === 0) return { matches: 0, consecutiveMatches: 0 };

  let maxMatches = 0;
  let maxConsecutive = 0;

  for (let i = 0; i < transcriptWords.length; i++) {
    let matches = 0;
    let consecutive = 0;
    let currentConsecutive = 0;
    let tIdx = i;

    for (let vIdx = 0; vIdx < targetWords.length; vIdx++) {
      let found = false;
      // Look ahead up to 3 words in the transcript to allow for small speech recognition insertions
      for (let lookahead = 0; lookahead < 3; lookahead++) {
        if (tIdx + lookahead < transcriptWords.length && transcriptWords[tIdx + lookahead] === targetWords[vIdx]) {
          matches++;
          if (lookahead === 0) {
            currentConsecutive++;
          } else {
            if (currentConsecutive > consecutive) consecutive = currentConsecutive;
            currentConsecutive = 1;
          }
          tIdx += lookahead + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        if (currentConsecutive > consecutive) consecutive = currentConsecutive;
        currentConsecutive = 0;
      }
    }
    if (currentConsecutive > consecutive) consecutive = currentConsecutive;

    if (matches > maxMatches) {
      maxMatches = matches;
      maxConsecutive = consecutive;
    } else if (matches === maxMatches && consecutive > maxConsecutive) {
      maxConsecutive = consecutive;
    }
  }

  return { matches: maxMatches, consecutiveMatches: maxConsecutive };
}


interface VerseCardProps {
  verse: Verse;
  keyword: string;
  isMatched: boolean;
  index: number;
  keywordWordCount: number;
  wordStates: Record<number, 'correct' | 'skipped'>;
}

const SkillsChallengeHeader = ({ index, total, mode, verseText, totalPoints: pts }: any) => (
  <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-8 mb-4 md:mb-12 relative z-10">
    <div className="flex flex-row items-center gap-2 md:gap-6 w-full md:w-auto">
      <div className="w-8 h-8 md:w-16 md:h-16 bg-brand-gold/10 rounded-lg md:rounded-2xl flex items-center justify-center text-brand-gold shadow-inner border border-brand-gold/5 flex-shrink-0">
        {mode === 'audio' ? <Mic className="w-4 h-4 md:w-8 md:h-8" /> : mode === 'surah' ? <BookOpen className="w-4 h-4 md:w-8 md:h-8" /> : <CheckCircle className="w-4 h-4 md:w-8 md:h-8" />}
      </div>
      <div className="text-right flex-1">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-emerald/10 text-brand-emerald text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">
          <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Sparkles className="w-2.5 h-2.5 text-brand-gold" />
          </motion.div>
          <span>{mode === 'audio' ? 'تحدي التلاوة' : mode === 'surah' ? 'تحدي السور' : 'تحدي الإكمال'}</span>
        </span>
        <h2 className="text-xs md:text-3xl font-black text-slate-800 leading-tight quran-text">
          {verseText ? <>{verseText.substring(0, 20)}{verseText.length > 20 ? '...' : ''}</> : 'جاري التحميل...'}
        </h2>
      </div>
    </div>

    <div className="flex items-center gap-2 md:gap-8 bg-white/50 backdrop-blur-md p-1.5 md:p-4 rounded-xl md:rounded-3xl border border-white shadow-sm w-full md:w-auto justify-between md:justify-start">
      {index !== undefined && total !== undefined && (
        <div className="flex flex-col">
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">التقدم</span>
          <span className="text-sm md:text-xl font-black text-brand-emerald tabular-nums">سؤال {index + 1} <span className="text-[10px] md:text-sm font-bold text-slate-300">من {total}</span></span>
        </div>
      )}
      <div className="w-px h-8 md:h-10 bg-slate-200/50" />
      <div className="flex flex-col items-end">
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">النقاط</span>
        <span className="text-xs md:text-2xl font-black text-brand-gold tabular-nums">{pts || 0}</span>
      </div>
    </div>
  </div>
);

const AudioChallengeUI = ({ targetVerses, matchedIds, isListening, onToggleListening, keyword, keywordWordCount, wordStates, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir }: any) => {
  return (
    <div className="flex flex-col items-center gap-6 md:gap-12 w-full">
      <div className="relative group">
        <div className={`absolute inset-0 bg-brand-emerald/20 blur-3xl rounded-full transition-all duration-700 group-hover:scale-110 ${isListening ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleListening}
          className={`relative flex items-center gap-2 md:gap-6 px-4 py-2 md:px-12 md:py-7 rounded-lg md:rounded-[2.5rem] font-black text-xs md:text-xl transition-all shadow-2xl ${isListening
            ? 'bg-red-500 text-white shadow-red-200 scale-105'
            : 'bg-brand-emerald text-white shadow-brand-emerald/20 hover:shadow-brand-emerald/40'
            }`}
        >
          {isListening ? (
            <>
              <div className="flex gap-1 justify-center items-center">
                {[1, 2, 3].map(i => (
                  <motion.div key={i} animate={{ height: [8, 18, 8] }} transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }} className="w-0.5 md:w-1 bg-white rounded-full" />
                ))}
              </div>
              <span>إيقاف التلاوة</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 md:w-7 md:h-7 group-hover:rotate-12 transition-transform" />
              <span>ابدأ التلاوة الكريمة</span>
            </>
          )}
        </motion.button>
      </div>

      {onSkip && (
        <button onClick={onSkip} className="text-slate-400 font-bold hover:text-red-500 transition-colors flex items-center gap-1.5 text-xs md:text-base">
          <X className="w-3.5 h-3.5 md:w-4 md:h-4" /> تخطي هذا الموضع
        </button>
      )}

      {/* Success Message - Positioned below control buttons */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="p-6 md:p-10 glass border-brand-emerald/10 text-brand-emerald rounded-2xl md:rounded-[3rem] text-center shadow-[0_30px_60px_-15px_rgba(6,78,59,0.1)] relative overflow-hidden mt-8 md:mt-10"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <Trophy className="w-20 h-20 mb-6 text-brand-gold mx-auto drop-shadow-lg" />
            <h3 className="text-4xl font-black mb-4 text-brand-emerald">فتح الله عليك!</h3>
            <p className="mb-10 text-slate-600 text-xl font-medium">أتقنت جميع المتشابهات في هذا الموضع ببراعة بارك الله فيك.</p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  const firstVerse = targetVerses[0];
                  if (firstVerse) {
                    onViewTafsir(firstVerse.surah_number, firstVerse.verse_number, firstVerse.text);
                  }
                }}
                className="px-8 py-5 bg-emerald-50 text-emerald-700 rounded-3xl font-black text-lg hover:bg-emerald-100 transition-all border-2 border-emerald-100 flex items-center justify-center gap-2"
              >
                <BookOpen className="w-6 h-6" />
                <span>عرض التفسير</span>
              </button>

              {challengeMode === 'daily' ? (
                <button
                  onClick={() => {
                    saveScore(KEYWORD, score);
                    const todayStr = new Date().toISOString().split('T')[0];
                    localStorage.setItem('quran_daily_completed', todayStr);
                    setDailyCompleted(true);
                    updateStatsAfterWin();
                  }}
                  className="px-10 py-5 bg-brand-gold text-brand-emerald rounded-3xl font-black text-lg hover:bg-white transition-all shadow-xl"
                >
                  إنهاء التحدي اليومي
                </button>
              ) : (
                <button
                  onClick={() => {
                    handlePromptNextChallenge();
                    updateStatsAfterWin();
                  }}
                  className="px-10 py-5 bg-white text-brand-emerald rounded-3xl font-black text-lg hover:bg-brand-gold transition-all shadow-xl"
                >
                  التحدي التالي
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-2 gap-1.5 md:gap-8 w-full pb-6 md:pb-20 mt-2 md:mt-8">
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

const SurahChallengeUI = ({ verseText, inputs, onInputChange, onSubmit, feedback, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir, currentChallenge }: any) => (
  <div className="flex flex-col items-center gap-2 md:gap-10 w-full max-w-2xl mx-auto">
    <div className="glass p-3 md:p-12 rounded-xl md:rounded-[4rem] w-full text-center border-white/80 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-brand-gold/30 to-transparent" />
      <div className="text-xl md:text-5xl font-black text-brand-emerald leading-relaxed quran-text mb-4 md:mb-12 drop-shadow-sm">
        {renderQuranText(verseText)}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col gap-3 md:gap-5 max-w-md mx-auto relative z-10">
        {inputs.map((input: string, idx: number) => (
          <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(idx, e.target.value)}
              placeholder={inputs.length > 1 ? `اسم السورة ${idx + 1}` : "ما اسم السورة؟"}
              className="w-full p-2 md:p-6 rounded-lg md:rounded-3xl bg-white border-2 border-slate-100 focus:border-brand-gold outline-none text-sm md:text-2xl font-black text-center quran-text shadow-sm transition-all focus:shadow-xl focus:scale-[1.02]"
              autoFocus={idx === 0}
            />
          </motion.div>
        ))}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={feedback}
          className="w-full py-3 md:py-6 bg-brand-gold text-brand-emerald rounded-xl md:rounded-3xl font-black text-base md:text-2xl shadow-xl shadow-brand-gold/20 hover:shadow-brand-gold/40 transition-all flex items-center justify-center gap-2 mt-2 md:mt-4"
        >
          {feedback ? <div className="w-5 h-5 md:w-7 md:h-7 border-4 border-brand-emerald/30 border-t-brand-emerald rounded-full animate-spin" /> : <span>تحقق من الإجابة</span>}
        </motion.button>
      </form>
    </div>
    {onSkip && (
      <button onClick={onSkip} className="text-slate-400 font-bold hover:text-red-500 transition-colors flex items-center gap-1.5 text-xs md:text-base">
        <X className="w-3.5 h-3.5 md:w-4 md:h-4" /> تخطي السؤال
      </button>
    )}

    {/* Success Message - Positioned below answer check */}
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-6 md:p-10 glass border-brand-emerald/10 text-brand-emerald rounded-2xl md:rounded-[3rem] text-center shadow-[0_30px_60px_-15px_rgba(6,78,59,0.1)] relative overflow-hidden mt-8 w-full"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <Trophy className="w-16 h-16 mb-4 text-brand-gold mx-auto drop-shadow-lg" />
          <h3 className="text-2xl md:text-4xl font-black mb-3 text-brand-emerald">فتح الله عليك!</h3>
          <p className="mb-8 text-slate-600 text-lg font-medium leading-relaxed">أحسنت القول، إجابتك صحيحة وموفقة.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                const firstVerse = currentChallenge?.verses?.[0];
                if (firstVerse) {
                  onViewTafsir(firstVerse.surah_number, firstVerse.verse_number, firstVerse.text);
                }
              }}
              className="px-8 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-lg hover:bg-emerald-100 transition-all border-2 border-emerald-100 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-6 h-6" />
              <span>عرض التفسير</span>
            </button>

            {challengeMode === 'daily' ? (
              <button
                onClick={() => {
                  saveScore(KEYWORD, score);
                  const todayStr = new Date().toISOString().split('T')[0];
                  localStorage.setItem('quran_daily_completed', todayStr);
                  setDailyCompleted(true);
                  updateStatsAfterWin();
                }}
                className="px-8 py-4 bg-brand-gold text-brand-emerald rounded-2xl font-black text-lg hover:bg-white transition-all shadow-xl"
              >
                إنهاء التحدي اليومي
              </button>
            ) : (
              <button
                onClick={() => {
                  handlePromptNextChallenge();
                  updateStatsAfterWin();
                }}
                className="px-8 py-4 bg-white text-brand-emerald rounded-2xl font-black text-lg hover:bg-brand-gold transition-all shadow-xl"
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

const CompleteChallengeUI = ({ verseText, options, selectedOption, onOptionSelect, onConfirm, feedback, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir, currentChallenge }: any) => (
  <div className="flex flex-col items-center gap-3 md:gap-10 w-full max-w-3xl mx-auto">
    <div className="glass p-3 md:p-12 rounded-xl md:rounded-[4rem] w-full text-center border-white/80 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1.5 bg-linear-to-r from-transparent via-brand-emerald/30 to-transparent" />
      <div className="text-xl md:text-5xl font-black text-brand-emerald leading-relaxed quran-text mb-6 md:mb-12">
        {renderQuranText(verseText)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {options.map((opt: any, idx: number) => {
          const isSelected = selectedOption === opt;
          return (
            <button
              key={idx}
              disabled={feedback}
              onClick={() => onOptionSelect(opt)}
              className={`p-3 md:p-6 rounded-xl md:rounded-3xl border-2 transition-all text-sm md:text-2xl font-black quran-text active:scale-95 relative shadow-sm ${isSelected
                ? 'bg-brand-gold border-brand-gold text-brand-emerald shadow-xl scale-[1.02]'
                : 'bg-white border-slate-100 text-slate-700 hover:border-brand-gold/30 hover:bg-brand-gold/5'
                } ${feedback ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {selectedOption && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onConfirm}
          disabled={feedback}
          className="w-full mt-6 py-4 bg-brand-emerald text-white rounded-xl font-black text-xl shadow-xl shadow-brand-emerald/20 hover:shadow-brand-emerald/40 transition-all flex items-center justify-center gap-4"
        >
          {feedback ? (
            <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-7 h-7" />
              <span>تأكيد الإجابة</span>
            </>
          )}
        </motion.button>
      )}
    </div>
    {onSkip && (
      <button onClick={onSkip} className="text-slate-400 font-bold hover:text-red-500 transition-colors flex items-center gap-2">
        <X className="w-4 h-4" /> تخطي السؤال
      </button>
    )}

    {/* Success Message - Positioned below confirm/skip */}
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-6 md:p-10 glass border-brand-emerald/10 text-brand-emerald rounded-2xl md:rounded-[3rem] text-center shadow-[0_30px_60px_-15px_rgba(6,78,59,0.1)] relative overflow-hidden mt-8 w-full"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <Trophy className="w-16 h-16 mb-4 text-brand-gold mx-auto drop-shadow-lg" />
          <h3 className="text-2xl md:text-4xl font-black mb-3 text-brand-emerald">فتح الله عليك!</h3>
          <p className="mb-8 text-slate-600 text-lg font-medium leading-relaxed">أحسنت التوقع، إجابة صحيحة بارك الله فيك.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                const firstVerse = currentChallenge?.verses?.[0];
                if (firstVerse) {
                  onViewTafsir(firstVerse.surah_number, firstVerse.verse_number, firstVerse.text);
                }
              }}
              className="px-8 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-lg hover:bg-emerald-100 transition-all border-2 border-emerald-100 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-6 h-6" />
              <span>عرض التفسير</span>
            </button>

            {challengeMode === 'daily' ? (
              <button
                onClick={() => {
                  saveScore(KEYWORD, score);
                  const todayStr = new Date().toISOString().split('T')[0];
                  localStorage.setItem('quran_daily_completed', todayStr);
                  setDailyCompleted(true);
                  updateStatsAfterWin();
                }}
                className="px-8 py-4 bg-brand-gold text-brand-emerald rounded-2xl font-black text-lg hover:bg-white transition-all shadow-xl"
              >
                إنهاء التحدي اليومي
              </button>
            ) : (
              <button
                onClick={() => {
                  handlePromptNextChallenge();
                  updateStatsAfterWin();
                }}
                className="px-8 py-4 bg-white text-brand-emerald rounded-2xl font-black text-lg hover:bg-brand-gold transition-all shadow-xl"
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

const VerseCard = memo(({ verse, keyword, isMatched, index, keywordWordCount, wordStates }: VerseCardProps) => {
  const [copied, setCopied] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);

  // Auto-reveal when matched
  useEffect(() => {
    if (isMatched) {
      setIsRevealed(true);
      setHintLevel(1);
    }
  }, [isMatched]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(verse.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHint = () => {
    if (isMatched) return;
    setHintLevel(prev => prev + 1);
  };

  const renderHighlightedVerse = () => {
    const words = verse.text.split(' ').filter(Boolean);
    // If we're hinting text (level 2+), show 25% more words per level after the keyword
    const visibleWordsCount = hintLevel >= 2
      ? keywordWordCount + Math.floor((words.length - keywordWordCount) * ((hintLevel - 1) * 0.25))
      : words.length;

    return (
      <p className={`quran-text quran-mushaf-layout text-right mb-1 md:mb-2 ${isMatched ? 'text-brand-emerald font-bold' : 'text-slate-600'}`}>
        {words.map((word, wIdx) => {
          const isKeyword = wIdx < keywordWordCount;
          const isVisible = isRevealed || wIdx < visibleWordsCount;

          if (!isVisible) return null;

          const wordIdx = wIdx - keywordWordCount;
          const status = wordIdx >= 0 ? wordStates[wordIdx] : 'correct';

          let colorClass = isKeyword ? 'text-brand-emerald/70' : 'text-brand-emerald';
          if (status === 'skipped') {
            colorClass = 'text-red-500 font-bold';
          } else if (!isMatched && status !== 'correct') {
            colorClass = 'text-slate-400';
          }

          return (
            <span
              key={wIdx}
              className={`transition-all duration-500 mx-0.5 ${colorClass}`}
            >
              {renderQuranText(word)}{' '}
            </span>
          );
        })}
        {!isRevealed && hintLevel >= 2 && visibleWordsCount < words.length && (
          <span className="text-slate-300 animate-pulse">...</span>
        )}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`relative p-1.5 md:p-6 rounded-xl md:rounded-3xl border md:border-2 transition-all duration-700 flex flex-col justify-between overflow-hidden group card-hover islamic-watermark ${isMatched
        ? 'glass bg-white/90 border-brand-emerald shadow-lg'
        : 'glass bg-white/40 border-white/50 hover:border-brand-gold/30'
        }`}
    >
      {isMatched && (
        <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-brand-emerald/5 rounded-bl-full -mr-12 -mt-12 md:-mr-16 md:-mt-16 transition-transform group-hover:scale-110" />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10"
      >
        <div className="flex items-start gap-2 md:gap-4 mb-1 md:mb-2">
          {isMatched && (
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-brand-emerald/10 p-0.5 md:p-1 rounded-full"
            >
              <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-brand-emerald" />
            </motion.div>
          )}
          <div className="flex-1 flex flex-col items-center">
            {isRevealed || hintLevel >= 2 ? (
              <div
                className={!isRevealed ? "cursor-pointer hover:opacity-80 transition-opacity w-full text-center" : "w-full text-center"}
                onClick={() => !isRevealed && setIsRevealed(true)}
              >
                {renderHighlightedVerse()}
              </div>
            ) : (
              <button
                onClick={() => setIsRevealed(true)}
                className="w-full flex flex-col items-center justify-center gap-1 group/reveal transition-all py-4"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-1 group-hover/reveal:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-500">آية مخفية</h3>
                <span className="text-slate-400 font-bold text-xs">انقر للإظهار</span>
                <div className="mt-1 px-3 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-black border border-red-100">
                  (يخصم 10 نقاط)
                </div>
              </button>
            )}

            {!isRevealed && (
              <button
                onClick={handleHint}
                className="mt-4 px-6 py-2 bg-white border border-brand-gold/20 rounded-full shadow-sm flex items-center gap-2 hover:bg-brand-gold/5 transition-all text-brand-gold font-bold text-sm"
              >
                <Lightbulb className="w-4 h-4" />
                <span>تلميح</span>
              </button>
            )}
          </div>
        </div>

        {(isRevealed || hintLevel >= 1) && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50">
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${isMatched ? 'text-brand-emerald bg-brand-emerald/10' : 'text-slate-500 bg-slate-100'}`}>
              <span>
                {verse.surah.includes('،') ? '' : 'سورة '} {verse.surah}
              </span> • آية {verse.number}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/5 rounded-xl transition-all flex items-center gap-2"
              title="نسخ الآية"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'تم' : 'نسخ'}</span>
              {copied ? <Check className="w-3 h-3 text-brand-emerald" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

const LibrarySettingsModal = ({ isOpen, onClose, settings, setSettings, showReadingMode = false }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/20 theme-transition ${settings.darkMode ? 'mushaf-dark border-white/5' : ''}`}
          >
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">إعدادات القراءة</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8 text-right" dir="rtl">
                {/* Dark Mode */}
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${settings.darkMode ? 'bg-indigo-500 text-white' : 'bg-brand-gold/10 text-brand-gold'}`}>
                      {settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800">الوضع الداكن</h4>
                      <p className="text-xs text-slate-400 font-bold">قراءة مريحة للعين في الليل</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 relative ${settings.darkMode ? 'bg-brand-emerald' : 'bg-slate-300'}`}
                    dir="ltr"
                  >
                    <motion.div
                      animate={{ x: settings.darkMode ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="w-6 h-6 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-slate-800 transition-all shadow-xl active:scale-95"
              >
                حفظ التغييرات
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('quran_admin_token'));
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(localStorage.getItem('quran_admin_super') === 'true');
  const [challenges, setChallenges] = useState<any[]>([]);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('quran_completed_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [activeListTab, setActiveListTab] = useState<'available' | 'completed'>('available');
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [challengesError, setChallengesError] = useState<string | null>(null);

  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('quran_player_name'));
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('quran_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'device-' + Date.now();
      localStorage.setItem('quran_device_id', id);
    }
    return id;
  });
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState(() => parseInt(localStorage.getItem('quran_total_cups') || '0'));

  const [leaderboard, setLeaderboard] = useState<{ name: string, cups: number, points: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('quran_leaderboard') || '[]');
    } catch {
      return [];
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [selectedAdhkarCategoryId, setSelectedAdhkarCategoryId] = useState<string | null>(null);
  const [adhkarProgress, setAdhkarProgress] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [adhkarSearchQuery, setAdhkarSearchQuery] = useState('');
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [isJuzMenuOpen, setIsJuzMenuOpen] = useState(false);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);

  const [librarySettings, setLibrarySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('quran_mushaf_settings');
      if (saved) return JSON.parse(saved);
      return { darkMode: false };
    } catch {
      return { darkMode: false };
    }
  });

  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isNextChallengeModalOpen, setIsNextChallengeModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [nameInput, setNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // 1v1 State
  const roomRef = useRef<any>(null);
  const [room, _setRoom] = useState<any>(null);
  const setRoom = (val: any) => {
    roomRef.current = val;
    _setRoom(val);
  };
  const prevParticipantsCount = useRef<number>(0);
  const prevRoomStatus = useRef<string>('WAITING');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [v1Error, setV1Error] = useState<string | null>(null);
  const [v1Polling, setV1Polling] = useState(false);
  const [v1GameMode, setV1GameMode] = useState<'audio' | 'complete' | 'surah'>('audio');
  const [v1Timer, setV1Timer] = useState(false);
  const [v1QuestionCount, setV1QuestionCount] = useState(5);
  const [v1TimePerQuestion, setV1TimePerQuestion] = useState(15);
  const [v1IsStartingRoom, setV1IsStartingRoom] = useState(false);
  const [v1Category, setV1Category] = useState<string>('');
  const [skillsType, setSkillsType] = useState<'audio' | 'complete' | 'surah'>('audio');
  const [skillsOptions, setSkillsOptions] = useState<any[]>([]);
  const [skillsCorrectAnswer, setSkillsCorrectAnswer] = useState<string>('');
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [skillsFeedback, setSkillsFeedback] = useState(false);

  // Speed Challenge State
  const [speedTimeLeft, setSpeedTimeLeft] = useState(30);
  const [speedTotalTimeSpent, setSpeedTotalTimeSpent] = useState(0);
  const [isSpeedGameOver, setIsSpeedGameOver] = useState(false);
  const [surahInputs, setSurahInputs] = useState<string[]>([]);
  const [speedStartTime, setSpeedStartTime] = useState<number | null>(null);

  // Quiz Session State
  const [dailyQuote, setDailyQuote] = useState('');

  const quotesArray = [
    "خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ",
    "اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
    "وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا",
    "إِنَّ هَذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ",
    "بَلْ هُوَ آيَاتٌ بَيِّنَاتٌ فِي صُدُورِ الَّذِينَ أُوتُوا الْعِلْمَ"
  ];

  useEffect(() => {
    const randomQuote = quotesArray[Math.floor(Math.random() * quotesArray.length)];
    setDailyQuote(randomQuote);
  }, []);

  const [questionsCount, setQuestionsCount] = useState(5);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionWrong, setSessionWrong] = useState(0);
  const [sessionMistakes, setSessionMistakes] = useState<any[]>([]);
  const [sessionCurrentIndex, setSessionCurrentIndex] = useState(0);
  const [showMistakes, setShowMistakes] = useState(false);

  const fetchChallenges = useCallback(async (type?: string, limit?: number, excludeIds?: number[]) => {
    setChallengesLoading(true);
    setChallengesError(null);
    try {
      let url = '/api/challenges';
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (limit) params.append('limit', limit.toString());
      if (excludeIds && excludeIds.length > 0) params.append('excludeIds', excludeIds.join(','));

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${text.substring(0, 100)}`);
      }
      const data = await res.json();
      setChallenges(data);
      return data; // Return data for recycling logic
    } catch (err: any) {
      console.error('Failed to fetch challenges:', err);
      setChallengesError(err.message || 'فشل تحميل التحديات');
      return [];
    } finally {
      setChallengesLoading(false);
    }
  }, []);

  // Fetch challenges from API
  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const handleAdminLogin = (token: string, superAdmin?: boolean) => {
    setAdminToken(token);
    setIsSuperAdmin(!!superAdmin);
    localStorage.setItem('quran_admin_token', token);
    localStorage.setItem('quran_admin_super', String(!!superAdmin));
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setIsSuperAdmin(false);
    localStorage.removeItem('quran_admin_token');
    localStorage.removeItem('quran_admin_super');
    fetchChallenges(); // Refresh data after admin work
    setView('home');
  };

  const handleRegisterPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsRegistering(true);
    setRegistrationError(null);
    try {
      const res = await fetch('/api/player-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, name: nameInput.trim() })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('JSON Parse Error:', text);
        if (import.meta.env.PROD) {
          setRegistrationError('عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.');
        } else {
          setRegistrationError(`فشل الاتصال: السيرفر أرجع رداً غير صالح. الرد: ${text.substring(0, 50) || '(فارغ)'}...`);
        }
        return;
      }

      if (res.ok) {
        setPlayerName(nameInput.trim());
        localStorage.setItem('quran_player_name', nameInput.trim());
      } else {
        const detail = data.error || data.message || '';
        if (import.meta.env.PROD) {
          setRegistrationError('عذراً، لم نتمكن من إكمال عملية التسجيل. يرجى التأكد من اسمك والمحاولة مرة أخرى.');
        } else {
          setRegistrationError(`فشل الاتصال: ${detail || 'خطأ غير معروف في السيرفر'}`);
        }
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      if (import.meta.env.PROD) {
        setRegistrationError('حدث خطأ غير متوقع. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.');
      } else {
        setRegistrationError(`خطأ في الاتصال: ${err.message || 'تعذر الوصول إلى السيرفر'}. تأكد من تشغيل المشروع عبر 'vercel dev'.`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStartSkillsSession = async (count: number) => {
    setQuestionsCount(count);
    setSessionCorrect(0);
    setSessionWrong(0);
    setSessionMistakes([]);
    setShowMistakes(false);
    setCurrentChallengeIndex(0);
    setSessionCurrentIndex(0);
    setMatchedIds(new Set());
    setSpeedTimeLeft(skillsType === 'audio' ? 30 : 15);

    const dbType = skillsType === 'audio' ? 'STANDARD' : skillsType === 'complete' ? 'COMPLETION' : 'SURAH';
    const excludeIds = Array.from(completedChallengeIds);

    let result = await fetchChallenges(dbType, count, excludeIds);

    // RECYCLE LOOP: If zero new questions, recycle all original challenges
    if (!result || result.length === 0) {
      console.log('App: Recycling challenges for type:', dbType);
      result = await fetchChallenges(dbType, count, []);
    }

    if (result && result.length > 0) {
      // Shuffle for localized variety
      setChallenges([...result].sort(() => Math.random() - 0.5));
      setView('challenge');
    } else {
      setChallengesError('قاعدة البيانات فارغة حالياً لهذا النوع من التحديات.');
    }
  };

  useEffect(() => {
    localStorage.setItem('quran_mushaf_settings', JSON.stringify(librarySettings));
  }, [librarySettings]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  // Sync selectedSurahId with currentPage
  useEffect(() => {
    if (selectedSurahId) {
      setCurrentPage(surahStartPages[selectedSurahId] || 1);
    }
  }, [selectedSurahId]);

  const [isPageModeActive, setIsPageModeActive] = useState(false);
  const [challengeMode, setChallengeMode] = useState<'daily' | 'normal'>('normal');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const dailyChallengeIndex = useMemo(() => {
    if (challenges.length === 0) return 0;
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / 86400000);
    return daysSinceEpoch % challenges.length;
  }, [challenges]);

  const [allTargetVerses, setAllTargetVerses] = useState<Verse[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wordStates, setWordStates] = useState<Record<string, Record<number, 'correct' | 'skipped'>>>({});
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>((localStorage.getItem('quran_game_difficulty') as Difficulty) || 'medium');

  // AI Explanation State
  const [showExplanation, setShowExplanation] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationText, setExplanationText] = useState('');

  const { width, height } = useWindowSize();

  const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognition } = useSpeechRecognition();

  const currentChallenge = useMemo(() => {
    if (view === 'group_game') {
      return challenges[currentChallengeIndex];
    }
    if (challenges.length === 0) return null;
    return challengeMode === 'daily' ? challenges[dailyChallengeIndex] : challenges[currentChallengeIndex];
  }, [view, challenges, room?.challenges, challengeMode, dailyChallengeIndex, currentChallengeIndex]);

  const KEYWORD = currentChallenge?.verseText || currentChallenge?.text || currentChallenge?.keyword || '';

  // Normalize DB gameMode (STANDARD/COMPLETION/SURAH) to frontend values (audio/complete/surah)
  const roomGameMode = useMemo((): 'audio' | 'complete' | 'surah' => {
    const raw = (room?.gameMode || '').toUpperCase();
    if (raw === 'COMPLETION') return 'complete';
    if (raw === 'SURAH') return 'surah';
    return 'audio'; // STANDARD, AUDIO, or empty defaults to audio
  }, [room?.gameMode]);

  const targetVerses = useMemo(() => {
    let limit = allTargetVerses.length;
    if (difficulty === 'easy') limit = Math.min(3, allTargetVerses.length);
    else if (difficulty === 'medium') limit = Math.min(5, allTargetVerses.length);
    return allTargetVerses.slice(0, limit);
  }, [allTargetVerses, difficulty]);

  const isComplete = targetVerses.length > 0 && matchedIds.size === targetVerses.length;
  const progress = targetVerses.length > 0 ? (matchedIds.size / targetVerses.length) * 100 : 0;

  // const [totalPoints, setTotalPoints] = useState(0); // This line is removed as totalPoints is declared above
  const [streak, setStreak] = useState(0);
  const [lastPlayedDate, setLastPlayedDate] = useState('');
  const [incompleteChallenge, setIncompleteChallenge] = useState<{ index: number, mode: 'daily' | 'normal', surah: string } | null>(null);
  const [motivationalQuote, setMotivationalQuote] = useState('');

  const currentJuz = useMemo(() => {
    let juz = 1;
    for (let i = 1; i <= 30; i++) {
      if (currentPage >= (juzStartPages[i] || 1)) {
        juz = i;
      } else {
        break;
      }
    }
    return juz;
  }, [currentPage]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const MOTIVATIONAL_HADITHS = useMemo(() => [
    "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    "الَّذِي يَقْرَأُ الْقُرْآنَ وَهُوَ مَاهِرٌ بِهِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ",
    "اقْرَؤُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لِأَصْحَابِهِ",
    "مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا",
    "يُقَالُ لِصَاحِبِ الْقُرْآنِ: اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا"
  ], []);

  useEffect(() => {
    const savedPoints = localStorage.getItem('quran_total_points');
    if (savedPoints) setTotalPoints(parseInt(savedPoints));

    const savedStreak = localStorage.getItem('quran_streak') || '0';
    const lastPlayed = localStorage.getItem('quran_last_played');
    const today = new Date().toISOString().split('T')[0];

    if (lastPlayed) {
      const lastDate = new Date(lastPlayed);
      const todayDate = new Date(today);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        setStreak(parseInt(savedStreak));
      } else if (diffDays > 1) {
        setStreak(0);
        localStorage.setItem('quran_streak', '0');
      } else {
        setStreak(parseInt(savedStreak));
      }
      setLastPlayedDate(lastPlayed);
    }

    const savedIncomplete = localStorage.getItem('quran_incomplete_challenge');
    if (savedIncomplete) {
      setIncompleteChallenge(JSON.parse(savedIncomplete));
    }

    setMotivationalQuote(MOTIVATIONAL_HADITHS[Math.floor(Math.random() * MOTIVATIONAL_HADITHS.length)]);
  }, [MOTIVATIONAL_HADITHS]);

  const updateStatsAfterWin = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    let newStreak = streak;

    if (lastPlayedDate !== today) {
      newStreak = streak + 1;
      setStreak(newStreak);
      setLastPlayedDate(today);
      localStorage.setItem('quran_streak', newStreak.toString());
      localStorage.setItem('quran_last_played', today);
    }

    const newTotalPoints = totalPoints + score;
    setTotalPoints(newTotalPoints);
    localStorage.setItem('quran_total_points', newTotalPoints.toString());

    // Record completed challenge ID
    if (challengeMode === 'normal' || view === 'group_game') {
      const currentId = currentChallenge?.id;
      if (currentId && !completedChallengeIds.has(currentId)) {
        setCompletedChallengeIds(prev => {
          const newSet = new Set(prev);
          newSet.add(currentId);
          localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(newSet)));
          return newSet;
        });
      }
    }

    // Clear incomplete challenge
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
  }, [streak, lastPlayedDate, totalPoints, score]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const savedDaily = localStorage.getItem('quran_daily_completed');
    if (savedDaily === todayStr) {
      setDailyCompleted(true);
    } else {
      setDailyCompleted(false);
    }
  }, []);

  // Check for 1v1 code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let code = params.get('code');
    if (!code) {
      code = localStorage.getItem('pending_join_code');
    }

    if (code && playerName) {
      handleJoinV1(code);
      localStorage.removeItem('pending_join_code');
    } else if (code && !playerName) {
      localStorage.setItem('pending_join_code', code);
    }
  }, [playerName]);

  const handleJoinV1 = async (code: string) => {
    if (!playerName) return;
    setIsJoiningRoom(true);
    setV1Error(null);
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code, player2Id: deviceId })
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data);
        if (data.status === 'PLAYING') {
          const roomMode = data.gameMode === 'STANDARD' ? 'audio' : data.gameMode === 'COMPLETION' ? 'complete' : 'surah';
          setSkillsType(roomMode);
          const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
          setChallenges(mapped);
          setCurrentChallengeIndex(0);
          setSessionCorrect(0);
          setSessionWrong(0);
          setSessionMistakes([]);
          setSkillsFeedback(false);
          setSelectedOption(null);
          setMatchedIds(new Set());
          setChallengesLoading(false);
          setView('challenge');
        } else {
          setView('group_waiting');
        }
        toast.success('تم دخول الغرفة بنجاح');
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        setV1Error(data.message || 'فشل الانضمام للعبة');
      }
    } catch (err) {
      setV1Error('حدث خطأ في الاتصال');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateV1 = async () => {
    if (!playerName) return;
    setIsCreatingRoom(true);
    setV1Error(null);
    try {
      const requestBody = {
        action: 'create',
        player1Id: deviceId,
        player1Name: playerName,
        gameMode: v1GameMode === 'audio' ? 'STANDARD' : v1GameMode === 'complete' ? 'COMPLETION' : 'SURAH',
        category: v1Category,
        questionCount: v1QuestionCount,
        timePerQuestion: v1Timer ? v1TimePerQuestion : 0
      };

      console.log('Request Body being sent:', requestBody);

      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data);
        setView('group_waiting');
      } else {
        setV1Error(data.message || 'فشل إنشاء الغرفة');
      }
    } catch (err) {
      setV1Error('حدث خطأ في الاتصال');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleStartRoomV1 = async () => {
    if (!room?.id || v1IsStartingRoom) return;
    if ((room?.participants?.length || 0) < 2) {
      toast.error('يجب وجود لاعبين على الأقل لبدء التحدي');
      return;
    }
    setV1IsStartingRoom(true);
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', roomId: room.id })
      });
      const data = await res.json();
      if (res.ok) {
        // Initialize Game State
        const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
        setChallenges(mapped);
        setCurrentChallengeIndex(0);
        setSessionCorrect(0);
        setSessionWrong(0);
        setSessionMistakes([]);
        setSkillsFeedback(false);
        setSelectedOption(null);
        setMatchedIds(new Set());

        const mode = v1GameMode === 'audio' ? 'audio' : v1GameMode === 'complete' ? 'complete' : 'surah';
        setSkillsType(mode);
        setRoom(data);
        setView('challenge');
      } else {
        toast.error(data.message || 'فشل بدء التحدي');
      }
    } catch (err) {
      console.error('Start room error:', err);
      toast.error('خطأ في الاتصال بالسيرفر');
    } finally {
      setV1IsStartingRoom(false);
    }
  };

  // Poll room status
  useEffect(() => {
    if (!room?.id || (view !== 'group_waiting' && view !== 'group_game')) return;
    if (room.status === 'FINISHED') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/1v1?action=poll&roomId=${room.id}`);
        const data = await res.json();
        if (res.ok) {
          const prevCount = prevParticipantsCount.current;
          const newCount = data.participants?.length || 0;
          if (newCount > prevCount && prevCount > 0) {
          }
          prevParticipantsCount.current = newCount;

          if (view === 'group_waiting' && data.status === 'PLAYING') {
            const roomMode = data.gameMode === 'STANDARD' ? 'audio' : data.gameMode === 'COMPLETION' ? 'complete' : 'surah';
            setSkillsType(roomMode);
            const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
            setChallenges(mapped);
            setChallengesLoading(false);
            setCurrentChallengeIndex(0);
            setSessionCorrect(0);
            setSessionWrong(0);
            setSessionMistakes([]);
            setSkillsFeedback(false);
            setSelectedOption(null);
            setMatchedIds(new Set());

            setView('challenge');
          }
          setRoom(data);
        } else {
          console.error('Polling API Error:', data.message || 'Unknown error');
        }
      } catch (err) {
        console.error('Polling Network/Runtime Error:', err);
      }
    };

    const interval = setInterval(poll, 1000); // Poll every 1 second for better responsiveness
    return () => clearInterval(interval);
  }, [room?.id, view, room?.status]);

  const syncGroupProgress = async (isFinished = false, forcedScore?: number) => {
    if (!room?.id) return;
    const progress = ((currentChallengeIndex + (isFinished ? 1 : 0)) / (challenges.length || 5)) * 100;
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-progress',
          roomId: room.id,
          playerId: deviceId,
          progress,
          score: forcedScore !== undefined ? forcedScore : sessionCorrect,
          isFinished
        })
      });
      const data = await res.json();
      if (res.ok) setRoom(data);
    } catch (err) {
      console.error('Group sync error:', err);
    }
  };
  // Speed Challenge Timer
  useEffect(() => {
    let interval: any;
    const isActive = (view === 'speed_challenge' || (view === 'challenge' && isSpeedMode) || (view === 'group_game' && room?.timePerQuestion > 0)) && !isSpeedGameOver && !isComplete && !skillsFeedback;

    if (isActive) {
      interval = setInterval(() => {
        setSpeedTimeLeft((prev) => {
          if (prev <= 1) {
            if (view === 'speed_challenge') {
              setIsSpeedGameOver(true);
            } else {
              handleSpeedTimeout();
            }
            stopListening();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, isSpeedGameOver, isComplete, isSpeedMode, stopListening, skillsFeedback]);

  // Reset Speed timer on each match
  useEffect(() => {
    if (view === 'speed_challenge' && !isSpeedGameOver && matchedIds.size > 0 && !isComplete) {
      const timeTaken = 30 - speedTimeLeft;
      setSpeedTotalTimeSpent(prev => prev + timeTaken);
      setSpeedTimeLeft(30);
    }
  }, [matchedIds.size, view, isSpeedGameOver, isComplete]);

  // Effect to handle Surah Name Challenge inputs initialization
  useEffect(() => {
    const isSurahMode = skillsType === 'surah' || (view === 'group_game' && roomGameMode === 'surah');
    if (currentChallenge && isSurahMode) {
      const text = currentChallenge.correctText || "";
      let surahs: string[] = [];
      try {
        if (text.startsWith("[")) {
          surahs = JSON.parse(text);
        } else if (text) {
          surahs = [text];
        } else {
          // Fallback to first verse surah if any
          const firstVerseSurah = currentChallenge.verses?.[0]?.surah;
          if (firstVerseSurah) surahs = [firstVerseSurah];
        }
      } catch (e) {
        if (text) surahs = [text];
      }

      const validSurahs = surahs.filter(s => s.trim());
      // Initialize with correct number of empty strings
      setSurahInputs(new Array(Math.max(1, validSurahs.length)).fill(''));
    }
  }, [currentChallenge, skillsType, room?.gameMode, view]);

  // Handle Speed Challenge progression
  useEffect(() => {
    if (view === 'speed_challenge' && isComplete && !isSpeedGameOver) {
      const timeTaken = 30 - speedTimeLeft;
      setSpeedTotalTimeSpent(prev => prev + timeTaken);

      const timer = setTimeout(() => {
        const nextIdx = Math.floor(Math.random() * challenges.length);
        setCurrentChallengeIndex(nextIdx);
        setSpeedTimeLeft(30);
        setMatchedIds(new Set());
        setWordStates({});
        resetTranscript();
        setSpeedStartTime(Date.now());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, view, isSpeedGameOver, challenges.length, speedTimeLeft, resetTranscript]);

  // Effect to lock body scroll when modal is open
  useEffect(() => {
    if (selectedHadith || isSettingsOpen || showScores) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedHadith, isSettingsOpen, showScores]);

  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const [tafsirData, setTafsirData] = useState('جاري تحميل التفسير من الخادم...');
  const [tafsirAyahText, setTafsirAyahText] = useState('');
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number | null>(null);
  const [currentAyahNumber, setCurrentAyahNumber] = useState<number | null>(null);

  useEffect(() => {
    if (showTafsirModal && currentSurahNumber && currentAyahNumber) {
      const fetchTafsir = async () => {
        try {
          // جلب التفسير الميسر ( Muyassar) لضمان الدقة وعدم تكرار الآية
          const res = await fetch(`https://api.alquran.cloud/v1/ayah/${currentSurahNumber}:${currentAyahNumber}/ar.muyassar`);
          const json = await res.json();
          if (json.code === 200) {
            setTafsirData(json.data.text);
          }
        } catch (err) {
          setTafsirData('حدث خطأ في جلب التفسير. يرجى المحاولة لاحقاً.');
        }
      };
      fetchTafsir();
    }
  }, [showTafsirModal, currentSurahNumber, currentAyahNumber]);

  const handleOpenTafsir = (surah: number, ayah: number, ayahText: string) => {
    setCurrentSurahNumber(surah);
    setCurrentAyahNumber(ayah);
    setTafsirAyahText(ayahText);
    setTafsirData('جاري تحميل التفسير من الخادم...');
    setShowTafsirModal(true);
  };

  const handleStartDaily = () => {
    if (dailyCompleted) return;
    setChallengeMode('daily');
    setView('challenge');

    // Save as incomplete if not finished
    const firstVerse = challenges[dailyChallengeIndex]?.verses?.[0];
    const info = { index: dailyChallengeIndex, mode: 'daily' as const, surah: firstVerse?.surah || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const handleStartNormal = () => {
    setChallengeMode('normal');
    setView('list'); // Show all challenges to pick from
  };

  const handleStartSpeedChallenge = () => {
    setChallengeMode('normal');
    const randomIdx = Math.floor(Math.random() * Math.min(challenges.length, 50));
    setCurrentChallengeIndex(randomIdx);
    setView('speed_challenge');
    setSpeedTimeLeft(30);
    setSpeedTotalTimeSpent(0);
    setIsSpeedGameOver(false);
    setSpeedStartTime(Date.now());
    resetTranscript();
    startListening();
  };

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem('quran_game_difficulty', diff);
    setView('challenge');

    // Save as incomplete
    const firstVerse = challenges[currentChallengeIndex]?.verses?.[0];
    const info = { index: currentChallengeIndex, mode: 'normal' as const, surah: firstVerse?.surah || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const superNormalizeArabic = (text: any) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '') // حذف التشكيل
      .replace(/[أإآ]/g, 'ا') // توحيد الألف
      .replace(/ة/g, 'ه') // توحيد التاء المربوطة والهاء
      .replace(/ي/g, 'ى') // توحيد الياء
      .replace(/\s+/g, '') // حذف جميع المسافات العادية
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); // حذف المسافات والرموز المخفية
  };

  const generateOptions = useCallback((type: 'complete' | 'surah', correctValue: string) => {
    if (type === 'surah') return;
    if (!currentChallenge) return;
    let rawOptions: string[] = [];

    if (currentChallenge?.options && Array.isArray(currentChallenge.options)) {
      rawOptions = [...currentChallenge.options];
    } else {
      // Fallback
      rawOptions = [correctValue];
      const words = ["يؤمنون", "يتقون", "يعلمون", "يفلحون", "يبصرون", "يسمعون", "يشعرون", "ينصرون", "تعلمون", "تعملون"];
      for (let i = 0; i < 3; i++) {
        const rand = words[Math.floor(Math.random() * words.length)];
        if (rand && !rawOptions.includes(rand)) rawOptions.push(rand);
        else i--;
      }
    }

    // Convert to objects and flag the correct one using Identity or Aggressive Normalization
    const normalizedCorrect = superNormalizeArabic(correctValue);
    const mappedOptions = rawOptions.filter((opt): opt is NonNullable<typeof opt> => opt !== null).map(opt => {
      // 1. Check if option is already an identity-based object from DB
      if (typeof opt === 'object' && (opt as any) !== null && 'isCorrect' in (opt as any)) {
        const o = opt as { text: string; isCorrect: boolean };
        return {
          text: o.text,
          isCorrect: !!o.isCorrect
        };
      }

      // 2. Legacy Fallback: Use Aggressive Normalization for string options
      const optText = typeof opt === 'string' ? opt : ((opt as any).text || '');
      const isCorrect = superNormalizeArabic(optText) === normalizedCorrect;

      // Keep debug logs for any cases that rely on text comparison
      if (isCorrect || superNormalizeArabic(optText).length > 0) {
        console.log('--- DEBUG MATCH (Legacy Fallback) ---');
        console.log('Selected Raw:', optText, 'Type:', typeof optText);
        console.log('Correct Raw:', correctValue, 'Type:', typeof correctValue);
        console.log('Selected Clean:', superNormalizeArabic(optText));
        console.log('Correct Clean:', normalizedCorrect);
        console.log('MATCH RESULT:', isCorrect);
      }

      return {
        text: optText,
        isCorrect: isCorrect
      };
    });

    const shuffled = [...mappedOptions].sort(() => Math.random() - 0.5);
    setSkillsOptions(shuffled);
    setSkillsCorrectAnswer(correctValue);
  }, [currentChallenge?.id || currentChallenge?.keyword]);

  const handleSpeedTimeout = () => {
    if (skillsFeedback || isComplete) return;

    if (skillsType === 'surah' || (view === 'group_game' && roomGameMode === 'surah')) {
      handleSubmitSurah();
    } else if (skillsType === 'audio' || (view === 'group_game' && roomGameMode === 'audio') || skillsType === 'complete' || (view === 'group_game' && roomGameMode === 'complete')) {
      if (skillsType === 'audio' || (view === 'group_game' && roomGameMode === 'audio')) {
        const currentQuestion = currentChallenge;
        if (!currentQuestion) return;
        setSkillsFeedback(true);
        setTimeout(() => {
          moveToNextQuestion();
        }, 1000);
      } else {
        handleConfirmAnswer();
      }
    }
  };

  const moveToNextQuestion = () => {
    setSkillsFeedback(false);
    setSelectedOption(null);

    const challengesLength = challenges.length || room?.challenges?.length || 0;

    if (currentChallengeIndex >= challengesLength - 1) {
      if (room) {
        syncGroupProgress(true);
      }
      if (view === 'challenge') {
        if (room) setView('group_game'); // Show leaderboard at end
        else setView('skills_results');
      }
      return;
    }

    if (room) {
      syncGroupProgress(false);
    }

    setCurrentChallengeIndex(prev => prev + 1);
    setMatchedIds(new Set());
    setWordStates({});
    const isAudio = skillsType === 'audio' || roomGameMode === 'audio';
    setSpeedTimeLeft(isAudio ? 30 : 15);
  };

  const handleOptionSelect = (option: any) => {
    if (skillsFeedback) return;
    setSelectedOption(option);
  };

  const handleConfirmAnswerWithOption = (option: any) => {
    setSelectedOption(option);
    handleConfirmAnswer();
  };

  const handleConfirmAnswer = () => {
    try {
      if (skillsFeedback) return;
      setSkillsFeedback(true);

      const currentQuestion = currentChallenge;
      if (!currentQuestion) {
        setSkillsFeedback(false);
        return;
      }

      const rawSelected = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.text : selectedOption) : null;
      const rawCorrect = currentQuestion.correctText || "";

      const isCorrect = rawSelected && String(rawSelected).trim().includes(String(rawCorrect).trim());
      const answer = rawSelected || "لم يتم اختيار إجابة (انتهى الوقت)";

      if (isCorrect) {
        const newScore = sessionCorrect + 10;
        setSessionCorrect(newScore);
        if (view === 'group_game') {
          syncGroupProgress(false, newScore);
        }
        if (window.navigator.vibrate) window.navigator.vibrate(50);

        if (view === 'group_game' && currentQuestion.verses) {
          const allVerseIds = currentQuestion.verses.map((v: any) => v.id);
          setMatchedIds(new Set(allVerseIds));
        }

        if (currentQuestion?.id) {
          setCompletedChallengeIds(prev => {
            const next = new Set(prev);
            next.add(currentQuestion.id);
            localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(next)));
            return next;
          });
        }
      } else {
        setSessionWrong(prev => prev + 1);
        if (window.navigator.vibrate) window.navigator.vibrate(200);
        setSessionMistakes(prev => [...prev, {
          challenge: currentQuestion,
          userAnswer: answer || "لا يوجد إجابة",
          correctAnswer: rawCorrect
        }]);
      }

      setTimeout(() => {
        moveToNextQuestion();
      }, 1000);
    } catch (error) {
      console.error('handleConfirmAnswer Error:', error);
      setSkillsFeedback(false);
    }
  };

  const handleSubmitSurah = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentQuestion = currentChallenge;
    if (!currentQuestion || skillsFeedback) return;

    setSkillsFeedback(true);

    // 1. Determine all correct surahs
    const text = currentQuestion.correctText || "";
    let correctSurahs: string[] = [];
    try {
      if (text.startsWith("[")) {
        correctSurahs = JSON.parse(text);
      } else if (text) {
        correctSurahs = [text];
      } else {
        const firstVerseSurah = currentQuestion.verses?.[0]?.surah || (targetVerses && targetVerses[0]?.surah);
        if (firstVerseSurah) correctSurahs = [firstVerseSurah];
      }
    } catch (e) {
      if (text) correctSurahs = [text];
    }
    correctSurahs = correctSurahs.filter(s => s.trim());

    // 2. Normalize and check matches
    const normalizedCorrect = correctSurahs.map(s => normalizeArabicText(s).trim());
    const normalizedInputs = surahInputs.map(s => normalizeArabicText(s).trim());

    let correctCount = 0;
    const matchedCorrectIndices = new Set<number>();

    normalizedInputs.forEach(input => {
      if (!input) return;
      const matchIndex = normalizedCorrect.findIndex((correct, idx) => correct === input && !matchedCorrectIndices.has(idx));
      if (matchIndex !== -1) {
        correctCount++;
        matchedCorrectIndices.add(matchIndex);
      }
    });

    const isFullyCorrect = correctCount === normalizedCorrect.length && normalizedInputs.length === normalizedCorrect.length;

    if (isFullyCorrect) {
      const newScore = sessionCorrect + 10;
      setSessionCorrect(newScore);
      if (view === 'group_game') {
        syncGroupProgress(false, newScore);
      }
      if (view === 'group_game' && currentQuestion.verses) {
        const allVerseIds = currentQuestion.verses.map((v: any) => v.id);
        setMatchedIds(new Set(allVerseIds));
      }
    } else {
      setSessionWrong(prev => prev + (correctSurahs.length - correctCount));
    }
    setTotalPoints(prev => prev + correctCount);

    setSessionMistakes(prev => [...prev, {
      challenge: currentQuestion,
      text: currentQuestion.keyword || "",
      type: 'SURAH',
      userInputs: surahInputs,
      correctSurahsList: correctSurahs,
      pointsEarned: correctCount,
      totalPossible: correctSurahs.length,
      isFullyCorrect
    }]);

    setSurahInputs(new Array(surahInputs.length).fill(''));

    // 4. Auto-advance
    setTimeout(() => {
      moveToNextQuestion();
    }, 1000);
  };

  const handleBackToHome = () => {
    if (view === 'challenge' && !isComplete) {
      setIsExitModalOpen(true);
      return;
    }
    setView('home');
    setShowScores(false);
    resetTranscript();
    stopListening();
  };

  const confirmExitToHome = () => {
    setView('home');
    setShowScores(false);
    resetTranscript();
    stopListening();
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
  };

  const handleSkip = () => {
    if (challengeMode === 'daily') return;

    // Count as mistake as requested
    const currentQuestion = currentChallenge;
    if (currentQuestion) {
      setSessionWrong(prev => prev + 1);
      setSessionMistakes(prev => [...prev, {
        challenge: currentQuestion,
        userAnswer: "تخطي",
        correctAnswer: currentQuestion.correctText || currentQuestion.keyword || ""
      }]);
    }

    const maxQuestions = view === 'group_game' ? (room?.questionCount || 5) : questionsCount;
    const currentChallengesLength = view === 'group_game' ? (room?.challenges?.length || 0) : challenges.length;
    moveToNextQuestion();

    if (challenges.length > 1) {
      const dbType = skillsType === 'audio' ? 'STANDARD' : skillsType === 'complete' ? 'COMPLETION' : 'SURAH';
      let nextIndex = currentChallengeIndex;
      let found = false;

      // Try to find the next matching uncompleted challenge
      for (let i = 1; i <= challenges.length; i++) {
        const idx = (currentChallengeIndex + i) % challenges.length;
        const c = challenges[idx];
        const matchesType = dbType === 'STANDARD'
          ? (c.type === 'STANDARD' || c.type === 'AUDIO' || !c.type)
          : c.type === dbType;

        if (matchesType && !completedChallengeIds.has(c.id)) {
          nextIndex = idx;
          found = true;
          break;
        }
      }

      // If no matching uncompleted found, pick next matching regardless of completion
      if (!found) {
        for (let i = 1; i <= challenges.length; i++) {
          const idx = (currentChallengeIndex + i) % challenges.length;
          const c = challenges[idx];
          const matchesType = dbType === 'STANDARD'
            ? (c.type === 'STANDARD' || c.type === 'AUDIO' || !c.type)
            : c.type === dbType;

          if (matchesType) {
            nextIndex = idx;
            found = true;
            break;
          }
        }
      }

      setCurrentChallengeIndex(nextIndex);
      resetTranscript();

      if (!found) {
        console.log("All challenges completed! Looping back to start.");
      }
    } else if (challenges.length === 1) {
      resetTranscript();
    }
  };

  const syncLeaderboard = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Leaderboard sync failed: ${text.substring(0, 100)}`);
      }
      const data = await response.json();
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
        localStorage.setItem('quran_leaderboard', JSON.stringify(data.leaderboard));
      }
    } catch (error) {
      console.error('Leaderboard sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quran_total_points', totalPoints.toString());
    localStorage.setItem('quran_cups', cups.toString());
    localStorage.setItem('quran_leaderboard', JSON.stringify(leaderboard));
    if (playerName) localStorage.setItem('quran_player_name', playerName);
    localStorage.setItem('quran_settings', JSON.stringify(librarySettings));
  }, [totalPoints, cups, leaderboard, playerName, librarySettings]);

  useEffect(() => {
    syncLeaderboard();
  }, []);



  const saveScore = (challenge: string, score: number) => {
    const challengeKey = challengeMode === 'daily' ? `[يومي] ${challenge}` : challenge;
    let newCups = cups;

    setBestScores(prev => {
      const currentBest = prev[challengeKey] || 0;
      const updated = { ...prev };
      if (score > currentBest) {
        const cupThreshold = Math.min(50, targetVerses.length * 8);
        if (score >= cupThreshold && currentBest < cupThreshold) {
          newCups = cups + 1;
          setCups(newCups);
        }
        updated[challengeKey] = score;
        localStorage.setItem('quran_game_scores', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    const isNewCompletion = currentChallenge?.id && !completedChallengeIds.has(currentChallenge.id);

    if (isNewCompletion) {
      setCompletedChallengeIds(prev => {
        const newSet = new Set(prev);
        newSet.add(currentChallenge!.id);
        localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(newSet)));
        return newSet;
      });
      const newPoints = totalPoints + score;
      setTotalPoints(newPoints);
      localStorage.setItem('quran_total_points', newPoints.toString());

      const newCupsCount = cups + 1;
      setCups(newCupsCount);
      localStorage.setItem('quran_total_cups', newCupsCount.toString());

      // Sync with backend using deviceId
      fetch('/api/player-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, points: score, challengeId: currentChallenge?.id })
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error('Score sync failed:', text);
          }
        })
        .catch(err => console.error('Failed to sync score:', err));
    } else {
      console.log('Challenge already completed previously. No new points/cups awarded.');
    }

    // Update leaderboard entry & sync
    syncLeaderboard();
  };
  useEffect(() => {
    if (challengeMode !== 'daily' || !dailyCompleted) return;

    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [challengeMode, dailyCompleted]);

  useEffect(() => {
    const savedScores = localStorage.getItem('quran_game_scores');
    if (savedScores) {
      setBestScores(JSON.parse(savedScores));
    }
    const savedDifficulty = localStorage.getItem('quran_game_difficulty');
    if (savedDifficulty) {
      setDifficulty(savedDifficulty as Difficulty);
    }
  }, []);

  // Retroactive Cup Synchronization
  useEffect(() => {
    if (challenges.length > 0 && Object.keys(bestScores).length > 0) {
      const calculatedCups = challenges.reduce((total, c) => {
        const score = bestScores[c.keyword] || 0;
        const verses = Array.isArray(c.verses) ? c.verses : [];
        const threshold = Math.min(50, verses.length * 8);
        return score >= threshold ? total + 1 : total;
      }, 0);

      if (calculatedCups > cups) {
        setCups(calculatedCups);
        // Sync with backend using current state
        const newPoints = totalPoints;
        fetch('/api/player-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, points: newPoints, cups: calculatedCups })
        })
          .catch(err => console.error('Failed to sync retroactive cups:', err));
      }
    }
  }, [challenges, bestScores, cups, deviceId, totalPoints]);


  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    localStorage.setItem('quran_game_difficulty', newDiff);
    setShowSettings(false);
  };

  useEffect(() => {
    // تحميل الآيات عند بدء التطبيق أو تغيير التحدي
    if (!KEYWORD) return;

    let verses: Verse[] = [];
    if (currentChallenge && Array.isArray(currentChallenge.verses) && currentChallenge.verses.length > 0) {
      // Use verses stored in the database if available
      verses = currentChallenge.verses as Verse[];
      console.log('App: Loaded verses from DB challenge:', currentChallenge.keyword, verses);
    } else if (currentChallenge && (skillsType === 'complete' || skillsType === 'surah' || roomGameMode === 'complete' || roomGameMode === 'surah')) {
      // Create a virtual verse from the keyword for Completion/Surah challenges that lack explicit verses
      verses = [{
        id: `virtual-${currentChallenge.id}`,
        number: 1,
        text: currentChallenge.keyword,
        surah: currentChallenge.correctText || 'سورة',
      }] as Verse[];
      console.log('App: Using virtual verse from keyword:', currentChallenge.keyword);
    } else {
      // Fallback to automatic search disabled as per strict requirement
      verses = [];
      console.log('App: Search fallback disabled for:', KEYWORD);
    }

    if (verses.length === 0 && (view === 'challenge' || view === 'group_game')) {
      console.warn('App: No verses found for keyword:', KEYWORD);
    }

    setAllTargetVerses(verses);
    setMatchedIds(new Set());
    setWordStates({});
    setScore(0);
    resetTranscript();
    console.log('App: currentChallenge updated:', currentChallenge);
  }, [KEYWORD, resetTranscript, view, challengeMode, currentChallenge, challenges.length, roomGameMode]);

  useEffect(() => {
    const isSkillsMode = view === 'challenge' || view === 'group_game';
    const effectiveType = view === 'group_game' ? roomGameMode : skillsType;

    if (isSkillsMode && (effectiveType === 'complete' || effectiveType === 'surah') && targetVerses.length > 0) {
      if (effectiveType === 'surah') {
        generateOptions('surah', targetVerses[0]?.surah || '');
      } else {
        const firstUnmatched = targetVerses.find(v => !matchedIds.has(v.id));
        if (firstUnmatched) {
          const words = firstUnmatched.text.split(' ').filter(Boolean);
          const lastWord = words[words.length - 1];
          generateOptions('complete', lastWord);
        }
      }
    }
  }, [view, skillsType, targetVerses, matchedIds.size, generateOptions, roomGameMode, currentChallenge?.id || currentChallenge?.keyword]);

  const keywordWordCount = useMemo(() => KEYWORD.split(' ').filter(Boolean).length, [KEYWORD]);

  const distinguishingWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const normalizedKeyword = normalizeArabicText(KEYWORD);

    targetVerses.forEach(verse => {
      const normalizedVerse = normalizeArabicText(verse.text);
      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = uniquePart.split(' ').filter(Boolean);

      if (uniqueWords.length === 0) {
        counts[verse.id] = 0;
        return;
      }

      let wordsNeeded = 1;
      while (wordsNeeded < uniqueWords.length) {
        const prefix = uniqueWords.slice(0, wordsNeeded).join(' ');
        const isUnique = !targetVerses.some(otherVerse => {
          if (otherVerse.id === verse.id) return false;
          const otherNormalized = normalizeArabicText(otherVerse.text);
          const otherUniquePart = otherNormalized.replace(normalizedKeyword, '').trim();
          return otherUniquePart.startsWith(prefix);
        });

        if (isUnique) break;
        wordsNeeded++;
      }
      counts[verse.id] = Math.max(wordsNeeded, Math.min(2, uniqueWords.length));
    });
    return counts;
  }, [targetVerses, KEYWORD]);

  // التحقق من المطابقة كلما تغير النص المسموع
  useEffect(() => {
    if (!transcript) return;

    const normalizedTranscript = normalizeArabicText(transcript);
    const transcriptWords = normalizedTranscript.split(' ').filter(Boolean);

    const candidates: { verse: Verse, score: number, distRatio: number, fullRatio: number }[] = [];
    const newWordStates = { ...wordStates };
    let countsChanged = false;

    targetVerses.forEach(verse => {
      if (matchedIds.has(verse.id)) return;

      const normalizedVerse = normalizeArabicText(verse.text);
      const normalizedKeyword = normalizeArabicText(KEYWORD);

      const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
      const uniqueWords = uniquePart.split(' ').filter(Boolean);

      if (uniqueWords.length === 0) {
        if (normalizedTranscript.includes(normalizedKeyword)) {
          candidates.push({ verse, score: 1000, distRatio: 1, fullRatio: 1 });
        }
        return;
      }

      // Linear Word Tracking Logic
      const currentVerseStates = { ...(newWordStates[verse.id] || {}) };
      let lastIndex = -1;
      const indices = Object.keys(currentVerseStates).map(Number);
      if (indices.length > 0) {
        lastIndex = Math.max(...indices);
      }

      transcriptWords.forEach(tWord => {
        const normTWord = normalizeArabicText(tWord);

        for (let i = lastIndex + 1; i < uniqueWords.length; i++) {
          const normVWord = normalizeArabicText(uniqueWords[i]);

          if (normTWord === normVWord || getSimilarity(normTWord, normVWord) > 0.8) {
            // Found a match at index i
            // Mark intermediate as skipped - REMOVED for strictness
            // Mark current as correct
            if (currentVerseStates[i] !== 'correct') {
              currentVerseStates[i] = 'correct';
              countsChanged = true;
            }
            lastIndex = i;
            break;
          }
        }
      });

      if (countsChanged) {
        newWordStates[verse.id] = currentVerseStates;
      }

      const correctCount = Object.values(currentVerseStates).filter(s => s === 'correct').length;
      const skippedCount = Object.values(currentVerseStates).filter(s => s === 'skipped').length;
      const fullRatio = (correctCount + skippedCount) / uniqueWords.length;

      const transcriptRemaining = transcriptWords.slice(keywordWordCount).join(' ');
      const targetRemaining = uniqueWords.join(' ');
      const similarity = getSimilarity(transcriptRemaining, targetRemaining);

      const score = (correctCount * 20) - (skippedCount * 5) + (similarity * 50);

      let requiredFullRatio = 0.9;
      if (difficulty === 'easy') requiredFullRatio = 0.75;
      else if (difficulty === 'medium') requiredFullRatio = 0.85;

      // Full Text Match Fallback: If the transcript clearly contains the verse, consider it matched
      const normalizedTranscriptFull = normalizeArabicText(transcript);
      const normalizedVerseMatch = normalizeArabicText(verse.text);
      const isFullTextMatch = normalizedTranscriptFull.includes(normalizedVerseMatch) ||
        (getSimilarity(normalizedTranscriptFull, normalizedVerseMatch) > 0.85) ||
        (normalizedTranscriptFull.includes(normalizeArabicText(KEYWORD)) &&
          uniqueWords.filter(w => normalizedTranscriptFull.includes(normalizeArabicText(w))).length / uniqueWords.length >= 0.8);

      if (isFullTextMatch || fullRatio >= requiredFullRatio || similarity > 0.9 || (correctCount + skippedCount >= uniqueWords.length - 1 && uniqueWords.length > 3)) {
        candidates.push({ verse, score, distRatio: correctCount / uniqueWords.length, fullRatio });
      }
    });

    if (countsChanged) {
      setWordStates(newWordStates);
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      setMatchedIds(prev => {
        const newSet = new Set(prev);
        newSet.add(best.verse.id);
        return newSet;
      });

      stopListening();
      resetTranscript();
      setTimeout(() => {
        startListening();
      }, 400);

      const pointsEarned = 10;
      setScore(prev => prev + pointsEarned);
    }
  }, [transcript, targetVerses, matchedIds, KEYWORD, difficulty, wordStates, stopListening, resetTranscript, startListening, keywordWordCount, distinguishingWordCounts]);

  const handlePromptNextChallenge = () => {
    setIsNextChallengeModalOpen(true);
  };

  const confirmNextChallenge = () => {
    saveScore(KEYWORD, score);
    if (challenges.length > 0) {
      setChallengeMode('normal');

      let nextIndex = (currentChallengeIndex + 1) % challenges.length;
      // Find the next uncompleted challenge
      for (let i = 0; i < challenges.length; i++) {
        const idx = (currentChallengeIndex + 1 + i) % challenges.length;
        if (!completedChallengeIds.has(challenges[idx].id)) {
          nextIndex = idx;
          break;
        }
      }

      setSessionCurrentIndex(prev => prev + 1);
      setCurrentChallengeIndex(nextIndex);
      setMatchedIds(new Set());
      setWordStates({});
    }
  };


  const matchedKeywords = useMemo(() => {
    return Array.from(matchedIds).map(id => {
      const verse = targetVerses.find(v => v.id === id);
      return verse ? verse.text : '';
    });
  }, [matchedIds, targetVerses]);

  const searchResults = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const normalizedQuery = normalizeArabicText(trimmed);
    if (!normalizedQuery) return [];

    const results: any[] = [];
    quranData.forEach(surah => {
      surah.verses.forEach((verse: any) => {
        const normalizedVerse = normalizeArabicText(verse.text);
        // Exact phrase matching
        if (normalizedVerse.includes(normalizedQuery)) {
          results.push({ ...verse, surahName: surah.name, surahId: surah.id });
        }
      });
    });
    // Sort by verse length to show more specific matches first, limit to 100
    return results.sort((a, b) => a.text.length - b.text.length).slice(0, 100);
  }, [searchQuery]);

  const juzVerses = useMemo(() => {
    if (selectedJuz === null) return [];
    const boundary = juzBoundaries.find(b => b.juz === selectedJuz);
    if (!boundary) return [];

    const results: any[] = [];
    quranData.forEach(surah => {
      if (surah.id >= boundary.startSurah && surah.id <= boundary.endSurah) {
        surah.verses.forEach((verse: any) => {
          const isStart = surah.id === boundary.startSurah ? verse.id >= boundary.startVerse : true;
          const isEnd = surah.id === boundary.endSurah ? verse.id <= boundary.endVerse : true;
          if (isStart && isEnd) {
            results.push({ ...verse, surahName: surah.name, surahId: surah.id });
          }
        });
      }
    });
    return results;
  }, [selectedJuz]);

  const pageVerses = useMemo(() => {
    const results: any[] = [];
    quranData.forEach(surah => {
      surah.verses.forEach((verse: any) => {
        const versePage = getPageNumber(surah.id, verse.id);
        if (versePage === currentPage) {
          results.push({ ...verse, surahName: surah.name, surahId: surah.id, page: versePage });
        }
      });
    });
    return results;
  }, [currentPage]);

  const currentSurahName = useMemo(() => {
    return pageVerses[0]?.surahName || '...';
  }, [pageVerses]);

  const handleExplain = async () => {
    setShowExplanation(true);
    if (explanationText) return;

    setIsExplaining(true);
    try {
      const ai = new GoogleGenAI((import.meta as any).env.VITE_GEMINI_API_KEY || '');

      const versesList = targetVerses.map(v => `- سورة ${v.surah}: ${v.text}`).join('\n');
      const prompt = `أنا أقوم ببناء تطبيق لحفظ القرآن الكريم وتحديداً المتشابهات.
الآيات التالية تبدأ جميعها بـ "${KEYWORD}":
${versesList}

يرجى تقديم شرح مختصر ومفيد (في حدود 3-4 فقرات) يوضح:
1. لماذا تتشابه هذه الآيات (السياق العام).
2. كيف يمكن للحافظ التمييز بينها (الضوابط أو العلامات المميزة لكل سورة).
استخدم لغة عربية فصحى مبسطة ومشجعة.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setExplanationText(response.text || "عذراً، لم أتمكن من توليد الشرح.");
    } catch (error) {
      console.error("Error generating explanation:", error);
      setExplanationText("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة لاحقاً.");
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className={`min-h-screen relative text-slate-900 font-sans selection:bg-brand-emerald/10 ${librarySettings.darkMode ? 'lib-dark' : 'bg-slate-50'}`} dir="rtl">
      {/* Background with Generated Pattern */}
      <div
        className={`absolute inset-0 z-0 opacity-10 pointer-events-none transition-opacity duration-700 ${librarySettings.darkMode ? 'mix-blend-soft-light opacity-5' : 'mix-blend-multiply opacity-10'}`}
        style={{
          backgroundImage: `url('/islamic_pattern.png')`,
          backgroundSize: '400px',
        }}
      />

      {isComplete && <Confetti width={width} height={height} recycle={false} numberOfPieces={400} gravity={0.15} colors={['#064e3b', '#d4af37', '#fdfbf7', '#10b981']} />}

      {view === 'admin' ? (
        <div className="relative z-10 w-full min-h-screen">
          {adminToken ? (
            <AdminDashboard
              token={adminToken}
              isSuperAdmin={isSuperAdmin}
              onLogout={handleAdminLogout}
              onBackHome={() => setView('home')}
            />
          ) : (
            <AdminLogin
              onLogin={handleAdminLogin}
              onBack={() => setView('home')}
            />
          )}
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="relative z-50 glass-dark text-white shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-10">
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex items-center gap-4"
              >
                <div className="bg-white/5 p-1 rounded-xl md:rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden shadow-xl shadow-black/10">
                  <img src="/logo.png" className="w-10 h-10 md:w-20 md:h-20 object-contain" alt="Logo" />
                </div>
                <div>
                  <h1 className="text-sm md:text-2xl font-black tracking-tight text-white leading-tight">تحدي المتشابهات</h1>
                  <p className="text-[7px] md:text-[10px] uppercase font-black tracking-[0.2em] text-brand-gold/70 leading-none mt-0.5">القرآن الكريم</p>
                </div>
              </motion.div>

              <div className="flex items-center gap-3">
                {(view !== 'home' || showScores) && (
                  <button
                    onClick={handleBackToHome}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-sm font-bold shadow-lg"
                    title="الرئيسية"
                  >
                    <Home className="w-4 h-4" />
                    <span className="hidden sm:inline">الرئيسية</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowScores(!showScores);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all text-sm font-bold shadow-lg ${showScores ? 'bg-brand-gold text-brand-emerald' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                >
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">{showScores ? 'العودة' : 'المتصدرين'}</span>
                </button>

                <button
                  onClick={() => setView('admin')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-sm font-bold shadow-lg"
                  title="لوحة التحكم"
                >
                  <Lock className="w-4 h-4" />
                  <span className="hidden sm:inline">الإدارة</span>
                </button>
              </div>
            </div>
          </header>

          <AnimatePresence>
            {!playerName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="glass p-6 md:p-12 rounded-3xl md:rounded-[3.5rem] max-w-md w-full shadow-2xl text-center"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-emerald rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-xl shadow-brand-emerald/20">
                    <User className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-black text-brand-emerald mb-4">أهلاً بك في تحدي المتشابهات</h2>
                  <p className="text-slate-500 font-bold mb-8">يرجى إدخال اسمك لحفظ تقدمك في لوحة المتصدرين</p>

                  {registrationError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100"
                    >
                      {registrationError}
                    </motion.div>
                  )}

                  <form onSubmit={handleRegisterPlayer} className="space-y-4">
                    <input
                      type="text"
                      required
                      placeholder="أدخل اسمك هنا..."
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 transition-all font-bold text-center"
                    />
                    <button
                      type="submit"
                      disabled={isRegistering || !nameInput.trim()}
                      className="w-full py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isRegistering ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>ابدأ اللعب</span>
                          <ArrowLeft className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content*/}
          <main className="max-w-6xl mx-auto px-6 pt-12 pb-40 relative z-10">
            {challengesLoading ? (

              <div className="flex flex-col items-center justify-center py-40">
                <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-brand-emerald font-black animate-pulse">يتم استظهار الآيات...</p>
              </div>
            ) : challengesError && challenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-4">
                  {import.meta.env.PROD ? 'عذراً، حدث خطأ في الاتصال بالخادم' : 'تعذر الاتصال بقاعدة البيانات'}
                </h3>
                <p className="text-slate-500 font-bold mb-8 max-w-md mx-auto">
                  {import.meta.env.PROD ? (
                    'يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى لاحقاً'
                  ) : (
                    <>
                      تأكد من تشغيل المشروع عبر الأمر التالي في الـ Terminal:
                      <code className="block mt-4 bg-slate-100 p-4 rounded-xl text-brand-emerald">npx vercel dev</code>
                    </>
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => fetchChallenges()}
                    disabled={challengesLoading}
                    className="px-10 py-4 bg-brand-emerald text-white rounded-2xl font-black shadow-lg hover:bg-brand-emerald/90 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    {challengesLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    إعادة المحاولة
                  </button>
                  {import.meta.env.PROD && (
                    <button
                      onClick={() => window.location.reload()}
                      className="px-10 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-black shadow-sm hover:bg-slate-50 transition-all"
                    >
                      تحديث الصفحة
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {showScores ? (
                  <motion.div
                    key="scores"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass p-4 md:p-10 rounded-2xl md:rounded-[3rem] max-w-3xl mx-auto"
                  >
                    <div className="flex items-center justify-between mb-6 md:mb-10">
                      <h2 className="text-xl md:text-3xl font-black text-brand-emerald flex items-center gap-2 md:gap-3">
                        <Trophy className="w-6 h-6 md:w-8 md:h-8 text-brand-gold" />
                        لوحة المتصدرين العالمية
                      </h2>
                      <button
                        onClick={() => syncLeaderboard()}
                        disabled={isSyncing}
                        className={`p-2 md:p-3 rounded-xl md:rounded-2xl bg-brand-emerald/5 text-brand-emerald border border-brand-emerald/10 hover:bg-brand-emerald/10 transition-all ${isSyncing ? 'animate-spin' : ''}`}
                      >
                        <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>

                    {isSyncing && leaderboard.length === 0 ? (
                      <div className="text-center py-12 md:py-20 bg-slate-50/50 rounded-2xl md:rounded-3xl border border-dashed border-slate-200">
                        <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-sm">جاري جلب قائمة المتصدرين...</p>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-12 md:py-20 bg-slate-50/50 rounded-2xl md:rounded-3xl border border-dashed border-slate-200">
                        <Sparkles className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-sm">كن أول من يسجل اسمه هنا</p>
                      </div>
                    ) : (
                      <div className="space-y-2 md:space-y-4 pr-1 md:pr-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {leaderboard.map((player, index) => (
                          <motion.div
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            key={player.name}
                            className={`flex justify-between items-center p-3 md:p-6 rounded-2xl md:rounded-3xl border transition-all group ${player.name === playerName ? 'bg-brand-emerald/5 border-brand-emerald/20 shadow-lg' : 'bg-white/60 border-white hover:shadow-xl'}`}
                          >
                            <div className="flex items-center gap-3 md:gap-6">
                              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-sm md:text-lg transition-transform group-hover:rotate-12 ${index === 0 ? 'bg-brand-gold/10 text-brand-gold scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                {index === 0 ? '👑' : index + 1}
                              </div>
                              <div className="text-right">
                                <span className="font-black text-slate-800 text-sm md:text-xl block leading-tight">{player.name}</span>
                                <span className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-400">{player.points} نقطة</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 md:gap-4">
                              <div className="flex items-center gap-1 bg-brand-gold/10 px-2 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-brand-gold/20">
                                <Trophy className="w-3 h-3 md:w-4 md:h-4 text-brand-gold" />
                                <span className="font-black text-base md:text-2xl text-brand-emerald tabular-nums">{player.cups}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : view === 'group_menu' ? (
                  <motion.div
                    key="group_menu"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-10 max-w-4xl mx-auto py-10 px-4"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setView('home')}
                        className="p-4 rounded-2xl bg-white/50 hover:bg-white transition-all text-slate-500 font-bold flex items-center gap-2"
                      >
                        <ArrowRight className="w-5 h-5" />
                        الرئيسية
                      </button>
                    </div>

                    <div className="text-center mb-4">
                      <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/10">
                        <User className="w-10 h-10" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-800 mb-2">التحدي الجماعي</h2>
                      <p className="text-slate-500 font-bold">نافس أصدقاءك في سباق مباشر للمتشابهات</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <motion.button
                        whileHover={{ y: -5 }}
                        onClick={() => setView('group_create')}
                        className="group p-10 rounded-[2.5rem] bg-white border-2 border-orange-100 hover:border-orange-500 transition-all text-center flex flex-col items-center gap-6 shadow-xl"
                      >
                        <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform">
                          <Zap className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 mb-2">إنشاء غرفة</h3>
                          <p className="text-slate-400 font-bold text-sm">تخصيص الخصائص ودعوة صديق</p>
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ y: -5 }}
                        onClick={() => setView('group_join')}
                        className="group p-10 rounded-[2.5rem] bg-white border-2 border-brand-emerald/10 hover:border-brand-emerald transition-all text-center flex flex-col items-center gap-6 shadow-xl"
                      >
                        <div className="w-16 h-16 bg-brand-emerald text-white rounded-2xl flex items-center justify-center shadow-lg">
                          <Lock className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 mb-2">الانضمام لغرفة</h3>
                          <p className="text-slate-400 font-bold text-sm">أدخل كود الغرفة للمنافسة</p>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                ) : view === 'group_create' ? (
                  <motion.div
                    key="group_create"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto py-10 px-4"
                  >
                    <div className="glass p-10 rounded-[3.5rem] border-orange-100 shadow-2xl">
                      <h2 className="text-3xl font-black text-slate-800 mb-8 text-center">إعدادات التحدي الجماعي</h2>

                      <div className="space-y-8">
                        <div>
                          <label className="block text-sm font-black text-slate-400 mb-6 uppercase tracking-widest text-center">اختر مهارة التحدي</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                              { id: 'audio', label: 'التحدي الصوتي', icon: Mic, color: 'emerald', bg: 'bg-brand-emerald/10', desc: 'تحدى نفسك بقراءة بداية الآيات' },
                              { id: 'complete', label: 'تحدي إكمال الآية', icon: CheckCircle, color: 'blue', bg: 'bg-blue-600/10', desc: 'توقع الكلمات المفقودة في الآية' },
                              { id: 'surah', label: 'تحديد اسم السورة', icon: BookOpen, color: 'purple', bg: 'bg-purple-600/10', desc: 'تعرف على اسم السورة من الآية' }
                            ].map(mode => (
                              <button
                                key={mode.id}
                                onClick={() => setV1GameMode(mode.id as any)}
                                className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center text-center gap-4 relative overflow-hidden ${v1GameMode === mode.id
                                  ? `border-brand-emerald bg-brand-emerald/5 shadow-2xl scale-[1.05]`
                                  : 'border-slate-100 hover:border-slate-200 bg-white'
                                  }`}
                              >
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-1 shadow-sm ${v1GameMode === mode.id ? `bg-brand-emerald text-white shadow-brand-emerald/20` : 'bg-slate-50 text-slate-400'}`}>
                                  <mode.icon className="w-8 h-8" />
                                </div>
                                <div className={`text-xl font-black ${v1GameMode === mode.id ? `text-brand-emerald` : 'text-slate-700'}`}>{mode.label}</div>
                                <div className="text-xs text-slate-400 font-bold leading-relaxed">{mode.desc}</div>
                                {v1GameMode === mode.id && <div className={`absolute top-4 right-4 w-3 h-3 rounded-full bg-brand-emerald animate-pulse`} />}
                              </button>
                            ))}
                          </div>
                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                          {/* Room capacity removed - now unlimited */}
                          <div className="md:col-span-1">
                            <label className="block text-xs font-black text-slate-400 mb-4 uppercase tracking-widest text-center">عدد الأسئلة</label>
                            <div className="flex items-center justify-center gap-2">
                              {[5, 10, 15, 20].map(num => (
                                <button
                                  key={num}
                                  onClick={() => setV1QuestionCount(num)}
                                  className={`w-11 h-11 rounded-2xl font-black text-sm transition-all ${v1QuestionCount === num ? 'bg-orange-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 shadow-sm'}`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-1">
                            <label className="block text-xs font-black text-slate-400 mb-4 uppercase tracking-widest text-center">المؤقت</label>
                            <button
                              onClick={() => setV1Timer(!v1Timer)}
                              className={`w-full py-2.5 px-4 rounded-2xl border-2 font-black text-sm transition-all flex items-center justify-center gap-3 ${v1Timer ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                            >
                              {v1Timer ? <Zap className="w-5 h-5" /> : <X className="w-5 h-5" />}
                              {v1Timer ? `${v1TimePerQuestion} ثانية` : 'معطل'}
                            </button>
                          </div>
                        </div>

                        {v1Timer && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-8 bg-orange-50/50 backdrop-blur-sm rounded-[2.5rem] border border-orange-100 shadow-inner"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-black text-orange-600 uppercase tracking-widest">تخصيص الوقت</label>
                              <span className="bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-black shadow-lg">{v1TimePerQuestion} ثانية لكل سؤال</span>
                            </div>
                            <input
                              type="range"
                              min="5"
                              max="60"
                              step="5"
                              value={v1TimePerQuestion}
                              onChange={(e) => setV1TimePerQuestion(parseInt(e.target.value))}
                              className="w-full h-3 bg-orange-200 rounded-full appearance-none cursor-pointer accent-orange-500"
                            />
                            <div className="flex justify-between mt-2 text-[10px] font-bold text-orange-300 uppercase tracking-[0.2em]">
                              <span>سريع جداً</span>
                              <span>وقت كافٍ</span>
                            </div>
                          </motion.div>
                        )}

                        <div className="pt-6 space-y-4">
                          <button
                            onClick={handleCreateV1}
                            disabled={isCreatingRoom}
                            className="w-full py-6 bg-orange-500 text-white rounded-[2rem] font-black text-2xl shadow-2xl shadow-orange-500/30 hover:bg-orange-600 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-4 group/btn"
                          >
                            {isCreatingRoom ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /> : (
                              <>
                                <ArrowLeft className="w-8 h-8 transition-transform group-hover/btn:-translate-x-2" />
                                <span>أنشئ الغرفة الآن</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setView('group_menu')}
                            className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                          >
                            رجوع للإعدادات
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : view === 'group_waiting' ? (
                  <motion.div
                    key="group_waiting"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-w-2xl mx-auto py-10 px-4"
                  >
                    <div className="glass p-10 rounded-[3.5rem] border-orange-100 shadow-2xl text-center">
                      <div className="flex items-center justify-center gap-4 mb-8">
                        <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                          <Users className="w-8 h-8" />
                        </div>
                        <div className="text-right">
                          <h2 className="text-3xl font-black text-slate-800">قاعة الانتظار</h2>
                          <p className="text-slate-400 font-bold">انتظار انضمام بقية المتسابقين...</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-8 rounded-[2.5rem] mb-10 border-2 border-slate-100 shadow-inner">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">رمز الانضمام للغرفة</div>
                        <div className="text-5xl font-black text-orange-500 tracking-[0.2em] mb-4">{room?.code}</div>
                        <button
                          onClick={() => {
                            if (room?.code) {
                              navigator.clipboard.writeText(room.code);
                            }
                          }}
                          className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
                        >
                          نسخ الرمز
                        </button>
                      </div>

                      <div className="space-y-4 mb-10">
                        <div className="flex items-center justify-between px-4">
                          <span className="text-sm font-black text-slate-800">المتسابقون ({room?.participants?.length || 1})</span>
                          <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {(room?.participants || []).map((p: any, i: number) => (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={p?.id || i}
                              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
                            >
                              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
                                {i + 1}
                              </div>
                              <span className="font-bold text-slate-700">{p?.name || 'لاعب'}</span>
                              {p?.deviceId === room?.player1?.deviceId && <span className="mr-auto px-3 py-1 bg-orange-500 text-white text-[10px] font-black rounded-lg uppercase">المنشئ</span>}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {room?.player1?.deviceId === deviceId && (
                        <button
                          onClick={handleStartRoomV1}
                          disabled={v1IsStartingRoom || (room?.participants?.length || 0) < 2}
                          className={`w-full py-5 text-white rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${(room?.participants?.length || 0) < 2
                            ? 'bg-slate-400 opacity-50 cursor-not-allowed'
                            : v1IsStartingRoom ? 'bg-orange-400' : 'bg-brand-emerald hover:bg-brand-emerald/90'
                            }`}
                        >
                          {v1IsStartingRoom && <Loader2 className="w-5 h-5 animate-spin" />}
                          {v1IsStartingRoom ? 'جاري التحميل...' : 'ابدأ التحدي الآن'}
                        </button>
                      )}

                      <button onClick={() => setView('home')} className="mt-8 text-slate-400 font-bold hover:text-slate-600">إلغاء والتراجع</button>
                    </div>
                  </motion.div>
                ) : view === 'group_join' ? (
                  <motion.div
                    key="group_join"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md mx-auto py-20 px-4"
                  >
                    <div className="glass p-12 rounded-[3.5rem] border-brand-emerald/10 shadow-2xl text-center">
                      <div className="w-20 h-20 bg-brand-emerald text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
                        <Lock className="w-10 h-10" />
                      </div>
                      <h2 className="text-3xl font-black text-slate-800 mb-4">رمز الانضمام</h2>
                      <p className="text-slate-500 font-bold mb-8">أدخل الرمز المكون من 6 أرقام</p>

                      <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-brand-emerald focus:outline-none text-center font-black tracking-[0.5em] text-3xl mb-6 shadow-inner"
                      />

                      <button
                        onClick={() => handleJoinV1(joinCode)}
                        disabled={isJoiningRoom || joinCode.length < 4}
                        className="w-full py-5 bg-brand-emerald text-white rounded-2xl font-black text-xl shadow-xl hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {isJoiningRoom ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" /> : 'دخول الغرفة'}
                      </button>

                      <button onClick={() => setView('group_menu')} className="mt-8 text-slate-400 font-bold hover:text-slate-600">رجوع</button>
                    </div>
                  </motion.div>
                ) : view === 'group_game' ? (
                  <motion.div
                    key="group_results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-8 max-w-6xl mx-auto py-20 px-4 min-h-[70vh]"
                  >
                    <AnimatePresence>
                      {room?.status === 'FINISHED' ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="glass p-12 rounded-[4rem] text-center border-brand-gold/20 shadow-2xl relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-brand-gold/5 animate-pulse" />
                          <div className="relative z-10">
                            <Trophy className="w-20 h-20 text-brand-gold mx-auto mb-6" />
                            <h2 className="text-4xl font-black text-brand-emerald mb-4">اكتمل السباق!</h2>

                            <div className="max-w-md mx-auto space-y-3 mb-10 text-right">
                              {(room?.participants || [])
                                .map((p: any) => ({
                                  ...p,
                                  finishTime: room?.playersProgress?.[p.id]?.finishTime,
                                  score: room?.playersProgress?.[p.id]?.score || 0,
                                  isFinished: !!room?.playersProgress?.[p.id]?.finishTime
                                }))
                                .sort((a: any, b: any) => {
                                  if (b.score !== a.score) return b.score - a.score;
                                  return (a.finishTime || Infinity) - (b.finishTime || Infinity);
                                })
                                .map((p: any, idx: number) => (
                                  <motion.div
                                    key={p.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${idx === 0 ? 'bg-brand-gold/10 border-brand-gold' : 'bg-white border-slate-100 shadow-sm'}`}
                                  >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-brand-gold text-brand-emerald' : 'bg-slate-100 text-slate-400'}`}>
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-black text-slate-800 flex justify-between items-center">
                                        <div className="flex flex-col items-start">
                                          <span>{p.name} {p.deviceId === deviceId && '(أنت)'}</span>
                                          {!p.isFinished && <span className="text-[10px] text-slate-400 font-bold">جاري الحل...</span>}
                                        </div>
                                        <span className="text-xs text-brand-gold font-bold">النقاط: {p.score}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                            </div>

                            <button
                              onClick={() => {
                                setRoom(null);
                                setView('home');
                              }}
                              className="px-12 py-5 bg-brand-emerald text-white rounded-3xl font-black text-xl shadow-xl hover:scale-105 transition-all"
                            >
                              العودة للرئيسية
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 min-h-[60vh] rounded-3xl">
                          <h2 className="text-3xl font-black text-brand-emerald mb-2">أنهيت التحدي! 🎉</h2>
                          <p className="text-slate-500 font-bold mb-8">راقب نتائج أصدقائك مباشرة...</p>

                          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                            {/* قائمة اللاعبين الحية */}
                            {(room?.participants || [])
                              .map((p: any) => ({
                                ...p,
                                score: room?.playersProgress?.[p.id]?.score || 0,
                                hasFinished: !!room?.playersProgress?.[p.id]?.finishTime
                              }))
                              .sort((a: any, b: any) => b.score - a.score)
                              .map((player: any, index: number) => (
                                <div key={player.id} className={`flex items-center justify-between p-5 border-b border-slate-50 last:border-0 ${player.id === deviceId ? 'bg-emerald-50/50' : ''}`}>

                                  <div className="flex items-center gap-4">
                                    <span className="font-black text-slate-300 w-6">{index + 1}</span>
                                    <span className={`font-black ${player.id === deviceId ? 'text-brand-emerald' : 'text-slate-700'}`}>{player.name} {player.id === deviceId && '(أنت)'}</span>
                                  </div>

                                  <div className="flex items-center gap-5">
                                    <span className="text-brand-emerald font-black tabular-nums">{player.score} نقطة</span>
                                    {/* حالة اللاعب: انتهى أم لا يزال يلعب */}
                                    {player.hasFinished ? (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-black uppercase">أنهى</span>
                                    ) : (
                                      <span className="text-[10px] bg-orange-100 text-orange-600 px-3 py-1 rounded-lg font-black uppercase flex items-center gap-1.5 animate-pulse">
                                        <div className="w-1 h-1 bg-orange-500 rounded-full animate-ping" />
                                        يلعب...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>

                          <p className="mt-10 text-slate-400 font-bold text-sm">سيتم عرض النتائج النهائية فور انتهاء الجميع</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : view === 'speed_challenge' ? (
                  <motion.div
                    key="speed_challenge"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-8 max-w-6xl mx-auto py-6 px-4 min-h-[70vh]"
                  >
                    {/* Floating Timer UI */}
                    <div className="flex justify-center mb-6 sticky top-4 z-50">
                      <motion.div
                        animate={{
                          scale: speedTimeLeft <= 10 ? [1, 1.1, 1] : 1,
                          backgroundColor: speedTimeLeft <= 10 ? '#fee2e2' : '#ffffff'
                        }}
                        transition={{ repeat: speedTimeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
                        className={`glass px-10 py-5 rounded-full shadow-2xl border-2 flex items-center gap-6 ${speedTimeLeft <= 10 ? 'border-red-500' : 'border-brand-emerald/20'}`}
                      >
                        <div className={`p-3 rounded-2xl ${speedTimeLeft <= 10 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
                          <Zap className="w-8 h-8" />
                        </div>
                        <div className="text-right">
                          <span className={`text-4xl font-black block tabular-nums ${speedTimeLeft <= 10 ? 'text-red-600' : 'text-slate-800'}`}>
                            {speedTimeLeft} ثانية
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">الوقت المتبقي للآية</span>
                        </div>
                        <div className="w-px h-10 bg-slate-100 mx-2" />
                        <div className="text-right">
                          <span className="text-2xl font-black text-brand-emerald block tabular-nums">
                            {Math.floor(speedTotalTimeSpent / 60)}:{String(speedTotalTimeSpent % 60).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">إجمالي الوقت</span>
                        </div>
                      </motion.div>
                    </div>

                    {isSpeedGameOver ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass p-12 rounded-[4rem] text-center border-red-200 shadow-2xl relative overflow-hidden my-10 max-w-2xl mx-auto"
                      >
                        <div className="absolute inset-0 bg-red-50/50" />
                        <div className="relative z-10">
                          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                            <AlertCircle className="w-12 h-12" />
                          </div>
                          <h2 className="text-4xl font-black text-slate-800 mb-4">انتهى الوقت!</h2>
                          <p className="text-xl text-slate-600 font-bold mb-10 leading-relaxed">
                            لا بأس، استعن بالله وعاود المحاولة
                          </p>
                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                              onClick={handleStartSpeedChallenge}
                              className="px-12 py-5 bg-red-600 text-white rounded-3xl font-black text-xl shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3"
                            >
                              <RotateCcw className="w-6 h-6" />
                              كرر المحاولة
                            </button>
                            <button
                              onClick={() => setView('home')}
                              className="px-12 py-5 bg-white border-2 border-slate-100 text-slate-500 rounded-3xl font-black text-xl hover:bg-slate-50 transition-all"
                            >
                              العودة للرئيسية
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="max-w-4xl mx-auto w-full px-4 pt-10">
                        <SkillsChallengeHeader
                          mode={skillsType}
                          verseText={KEYWORD}
                          totalPoints={totalPoints}
                        />

                        {skillsType === 'audio' ? (
                          <AudioChallengeUI
                            targetVerses={targetVerses}
                            matchedIds={matchedIds}
                            isListening={isListening}
                            onToggleListening={isListening ? stopListening : startListening}
                            keyword={KEYWORD}
                            keywordWordCount={keywordWordCount}
                            wordStates={wordStates}
                          />
                        ) : skillsType === 'surah' ? (
                          <SurahChallengeUI
                            verseText={KEYWORD}
                            inputs={surahInputs}
                            onInputChange={(idx: number, val: string) => {
                              const newInputs = [...surahInputs];
                              newInputs[idx] = val;
                              setSurahInputs(newInputs);
                            }}
                            onSubmit={handleSubmitSurah}
                            feedback={skillsFeedback}
                          />
                        ) : (
                          <CompleteChallengeUI
                            verseText={KEYWORD}
                            options={skillsOptions || []}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                            onConfirm={handleConfirmAnswer}
                            feedback={skillsFeedback}
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : view === 'skills_menu' || view === 'speed_menu' ? (
                  <motion.div
                    key="skills_menu"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="max-w-4xl mx-auto py-10 px-4"
                  >
                    <SkillsMenu
                      onSelectMode={(mode) => {
                        setSkillsType(mode);
                        setView('skills_count_selection');
                      }}
                      onBack={() => setView('home')}
                      title={isSpeedMode ? 'تحدي السرعة' : 'تحدي المهارات'}
                      subtitle={isSpeedMode ? 'أسرع في الإجابة واجمع النقاط' : 'اختر التحدي الذي تفضله'}
                    />
                  </motion.div>
                ) : view === 'skills_count_selection' ? (
                  <motion.div
                    key="skills_count_selection"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="max-w-4xl mx-auto py-20 px-6 text-center"
                  >
                    <h2 className="text-4xl font-black text-brand-emerald mb-4">اختر عدد الأسئلة</h2>
                    <p className="text-slate-500 font-bold mb-12">كم عدد الأسئلة التي تود التحدي فيها؟</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {[5, 10, 15, 20].map((count) => (
                        <button
                          key={count}
                          onClick={() => handleStartSkillsSession(count)}
                          className="glass p-10 rounded-[2.5rem] border-2 border-slate-100 hover:border-brand-emerald/30 hover:shadow-2xl transition-all group active:scale-95"
                        >
                          <span className="text-5xl font-black text-brand-emerald block mb-2">{count}</span>
                          <span className="text-slate-400 font-bold">سؤال</span>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setView('skills_menu')}
                      className="mt-16 text-slate-400 font-bold hover:text-brand-emerald transition-colors flex items-center gap-2 mx-auto"
                    >
                      <ArrowRight className="w-5 h-5" />
                      العودة للأوضاع
                    </button>
                  </motion.div>
                ) : view === 'skills_results' ? (
                  <motion.div
                    key="skills_results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="max-w-3xl mx-auto py-20 px-6"
                  >
                    <div className="glass p-12 rounded-[3.5rem] text-center border-white/50 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-brand-emerald via-brand-gold to-brand-emerald" />

                      <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Trophy className="w-12 h-12 text-brand-gold" />
                      </div>

                      <h2 className="text-4xl font-black text-slate-800 mb-2">اكتمل التحدي!</h2>
                      <h2 className="text-3xl font-black text-brand-gold mb-2">بارك الله فيك</h2>

                      <p className="text-slate-500 font-bold mb-10">إليك ملخص أدائك في هذا التحدي</p>

                      <div className="grid grid-cols-2 gap-6 mb-12">
                        <div className="bg-brand-emerald/5 p-8 rounded-[2rem] border border-brand-emerald/10">
                          <span className="text-4xl font-black text-brand-emerald block mb-1">{sessionCorrect}</span>
                          <span className="text-slate-500 font-bold">{skillsType === 'surah' ? 'سورة صحيحة' : 'إجابة صحيحة'}</span>
                        </div>
                        <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100">
                          <span className="text-4xl font-black text-red-600 block mb-1">{sessionWrong}</span>
                          <span className="text-slate-500 font-bold">{skillsType === 'surah' ? 'سورة خاطئة' : 'إجابة خاطئة'}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        {sessionMistakes.length > 0 && (
                          <button
                            onClick={() => setShowMistakes(!showMistakes)}
                            className="w-full py-5 bg-slate-800 text-white rounded-3xl font-black text-lg shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3"
                          >
                            <History className="w-6 h-6" />
                            {showMistakes ? 'إخفاء التفاصيل' : 'عرض تفاصيل الإجابات'}
                          </button>
                        )}

                        <button
                          onClick={() => setView('home')}
                          className="w-full py-5 bg-white border-2 border-slate-100 text-slate-500 rounded-3xl font-black text-lg hover:bg-slate-50 transition-all"
                        >
                          العودة للرئيسية
                        </button>
                      </div>

                      <AnimatePresence>
                        {showMistakes && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-10 pt-10 border-t border-slate-100 text-right overflow-hidden"
                          >
                            <h3 className="text-xl font-black text-slate-800 mb-6">مراجعة الإجابات:</h3>
                            <div className="space-y-6 max-h-[600px] overflow-y-auto px-2">
                              {sessionMistakes.map((m, i) => (
                                <div key={i} className={`p-3 md:p-6 rounded-xl md:rounded-2xl border ${m.isFullyCorrect ? 'bg-brand-emerald/5 border-brand-emerald/10' : 'bg-slate-50 border-slate-100'}`}>
                                  <div className="flex justify-between items-start mb-2 md:mb-4 gap-2 md:gap-4">
                                    <p className="quran-text text-sm md:text-xl text-slate-700 leading-loose flex-1 text-right">{m.keyword || m.text}</p>
                                    <div className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${m.isFullyCorrect ? 'bg-brand-emerald text-white' : 'bg-brand-gold text-brand-emerald'}`}>
                                      {m.pointsEarned} / {m.totalPossible || 1}
                                    </div>
                                  </div>

                                  {m.type === 'AUDIO_MISS' ? (
                                    <div className="mt-4 p-4 rounded-xl bg-red-50/50 border border-red-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-black text-slate-500">نتيجة التلاوة:</span>
                                        <span className="text-lg font-black text-red-600 tabular-nums">{m.matchedCount} / {m.totalPossible}</span>
                                      </div>
                                      <p className="text-xs font-bold text-red-500">تم التعرف على {m.matchedCount} آيات، وفاتك {m.missedCount} آيات بسبب ضيق الوقت.</p>
                                    </div>
                                  ) : m.correctSurahsList ? (
                                    <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-3 mt-2 md:mt-4">
                                      {m.correctSurahsList.map((correct: string, idx: number) => {
                                        const userHasIt = m.userInputs?.some((input: string) => normalizeArabicText(input).trim() === normalizeArabicText(correct).trim());
                                        return (
                                          <div key={idx} className={`p-2 md:p-3 rounded-lg md:rounded-xl flex items-center justify-between gap-2 md:gap-3 border ${userHasIt ? 'bg-white border-brand-emerald/30 text-brand-emerald shadow-sm' : 'bg-red-50/50 border-red-100 text-red-600'}`}>
                                            <span className="font-bold text-[10px] md:font-quran-text-sm leading-tight">{correct}</span>
                                            {userHasIt ? <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-2 text-sm">
                                      <div className="flex items-center gap-2 text-red-600 font-bold">
                                        <XCircle className="w-4 h-4" />
                                        <span>إجابتك: <span className="quran-text-sm">{m.userAnswer}</span></span>
                                      </div>
                                      <div className="flex items-center gap-2 text-brand-emerald font-bold">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>الإجابة الصحيحة: <span className="quran-text-sm">{m.correctText || (m.type === 'COMPLETION' ? m.text.split(' ').pop() : (m.challenge?.verses?.[0]?.surah || ''))}</span></span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : view === 'home' ? (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-6 md:gap-10 max-w-6xl mx-auto py-6 md:py-10 px-4"
                  >
                    {/* Premium Welcome Header Section */}
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center text-center space-y-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-1000"
                    >
                      <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">
                        السلام عليكم يا <span className="text-brand-emerald underline decoration-brand-gold/30 decoration-4 underline-offset-8">{playerName || 'يا ضيفنا الكريم'}</span>
                      </h1>

                      {/* Motivational Quote Display - Flattened & Integrated */}
                      {motivationalQuote && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className="px-4"
                        >
                          <h3 className="font-uthmani text-lg md:text-xl lg:text-2xl text-slate-700 leading-normal max-w-3xl mx-auto text-center" dir="rtl">
                            "{motivationalQuote}"
                          </h3>
                        </motion.div>
                      )}

                      <div className="h-1 w-20 bg-brand-gold/20 rounded-full mx-auto" />
                    </motion.div>

                    <Dashboard streakCount={streak} />


                    {/* Quick Stats Overview - Optimized for same level on mobile */}
                    <div className="grid grid-cols-4 gap-2 md:gap-4 px-2">
                      <div className="glass p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">إجمالي الكؤوس</span>
                        <span className="text-base md:text-2xl font-black text-brand-gold tabular-nums leading-none">{cups}</span>
                      </div>
                      <div className="glass p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">نقاط المهارة</span>
                        <span className="text-base md:text-2xl font-black text-brand-emerald tabular-nums leading-none">{totalPoints}</span>
                      </div>
                      <div className="glass p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">التقدم الكلي</span>
                        <span className="text-base md:text-2xl font-black text-brand-emerald tabular-nums leading-none">{completedChallengeIds.size}</span>
                      </div>
                      <div className="glass p-2 md:p-4 rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">آخر زيارة</span>
                        <span className="text-[9px] md:text-sm font-black text-slate-500 leading-none">{lastPlayedDate || 'اليوم'}</span>
                      </div>
                    </div>

                    {/* Incomplete Challenge Alert */}
                    {incompleteChallenge && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        className="relative overflow-hidden bg-brand-gold text-brand-emerald p-4 md:p-8 rounded-2xl md:rounded-[3.5rem] flex flex-col md:flex-row items-center justify-between px-6 md:px-10 shadow-2xl shadow-brand-gold/30 group mb-10"
                      >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 transition-transform duration-700 group-hover:scale-110" />

                        <div className="flex items-center gap-6 relative z-10 text-center md:text-right">
                          <div className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur-md flex items-center justify-center animate-bounce">
                            <Zap className="w-8 h-8" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-xl md:text-2xl leading-tight">لديك تحدي لم يكتمل بعد!</span>
                            <span className="font-bold text-sm opacity-80 uppercase tracking-widest">استمر في رحلتك وسجل اسمك بين المتصدرين</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setChallengeMode(incompleteChallenge.mode);
                            if (incompleteChallenge.mode === 'normal') {
                              setCurrentChallengeIndex(incompleteChallenge.index);
                            }
                            setView('challenge');
                          }}
                          className="mt-6 md:mt-0 relative z-10 px-10 py-4 bg-brand-emerald text-white rounded-2xl font-black text-lg hover:bg-white hover:text-brand-emerald transition-all shadow-xl active:scale-95 flex items-center gap-3 group/btn"
                        >
                          <span>متابعة التحدي الآن</span>
                          <ArrowLeft className="w-5 h-5 transition-transform group-hover/btn:-translate-x-1" />
                        </button>
                      </motion.div>
                    )}

                    {/* Main Challenges Grid */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-4">
                        <div className="w-1 h-6 bg-brand-gold rounded-full" />
                        <h3 className="text-xl font-black text-brand-emerald tracking-tight">تحديات إسلامية</h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
                        {/* Daily Challenge Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={handleStartDaily}
                          disabled={dailyCompleted}
                          className={`group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[120px] md:min-h-[160px] ${dailyCompleted ? 'bg-slate-50 opacity-60 grayscale' : 'bg-white shadow-sm hover:shadow-md hover:border-brand-gold/30'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-300 ${dailyCompleted ? 'bg-slate-200' : 'bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-emerald shadow-sm'}`}>
                              <Calendar className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            {!dailyCompleted && <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-brand-gold opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />}
                          </div>

                          <div className="mt-2 md:mt-4">
                            <h2 className={`text-xs md:text-lg font-black ${dailyCompleted ? 'text-slate-400' : 'text-brand-emerald'}`}>التحدي اليومي</h2>
                            <p className="text-slate-400 font-bold text-[8px] md:text-xs mt-0.5 md:mt-1">
                              {dailyCompleted ? 'نراك غداً' : 'مواضع يومية مختارة'}
                            </p>
                          </div>

                          {dailyCompleted && (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">الموعد القادم</span>
                              <span className="text-[10px] md:text-sm font-black text-brand-emerald tabular-nums">{timeLeft}</span>
                            </div>
                          )}
                        </motion.button>

                        {/* Skill Challenge Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => {
                            setIsSpeedMode(false);
                            setView('skills_menu');
                          }}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[120px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-brand-emerald/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-brand-emerald/10 text-brand-emerald flex items-center justify-center transition-all duration-300 group-hover:bg-brand-emerald group-hover:text-white shadow-sm">
                              <Zap className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-brand-emerald opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>

                          <div className="mt-2 md:mt-4">
                            <h2 className="text-xs md:text-lg font-black text-brand-emerald">تحدي المهارات</h2>
                            <p className="text-slate-400 font-bold text-[8px] md:text-xs mt-0.5 md:mt-1">صوتي، خيارات، أو اسم السورة</p>
                          </div>
                        </motion.button>

                        {/* Group Challenge Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => setView('group_menu')}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[120px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-orange-300/30"
                        >
                          <div className="absolute top-0 left-0 w-16 h-16 md:w-24 md:h-24 bg-orange-500/5 rounded-full -ml-8 -mt-8 md:-ml-12 md:-mt-12 transition-transform duration-700 group-hover:scale-150" />

                          <div className="flex items-start justify-between relative z-10">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center transition-all duration-300 group-hover:bg-orange-500 group-hover:text-white shadow-sm">
                              <Users className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <span className="text-[7px] md:text-[10px] text-orange-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">مباشر الآن</span>
                          </div>

                          <div className="mt-2 md:mt-4 relative z-10">
                            <div className="flex items-center justify-between">
                              <h2 className="text-xs md:text-lg font-black text-orange-900 group-hover:text-orange-600 transition-colors">التحدي الجماعي</h2>
                              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-orange-500 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                            </div>
                            <p className="text-slate-400 font-bold text-[8px] md:text-xs mt-0.5 md:mt-1">سباق مباشر في 3 تحديات مهارية</p>
                          </div>
                        </motion.button>

                        {/* Speed Challenge Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => {
                            setIsSpeedMode(true);
                            setView('speed_menu');
                          }}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[120px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-red-300/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center transition-all duration-300 group-hover:bg-red-500 group-hover:text-white shadow-sm">
                              <Zap className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <span className="text-[7px] md:text-[10px] text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">30 ثانية</span>
                          </div>

                          <div className="mt-2 md:mt-4">
                            <div className="flex items-center justify-between">
                              <h2 className="text-xs md:text-lg font-black text-red-900">تحدي السرعة</h2>
                              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-red-500 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                            </div>
                            <p className="text-slate-400 font-bold text-[8px] md:text-xs mt-0.5 md:mt-1">اختبار السرعة المثير مع العداد</p>
                          </div>
                        </motion.button>

                        {/* Islamic Quiz Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => setView('islamic_quiz')}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[120px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-emerald-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white shadow-sm">
                              <Sparkles className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-slate-800 group-hover:text-emerald-600 transition-colors">مسابقة معلومات اسلامية</h2>
                            <p className="text-slate-400 font-bold text-[8px] md:text-xs mt-0.5 md:mt-1">تحدي ثقافي شامل في العلوم الإسلامية</p>
                          </div>
                        </motion.button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3 px-4">
                        <div className="w-1 h-6 bg-blue-500 rounded-full shadow-lg shadow-blue-500/20" />
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">المكتبة والعلوم الشرعية</h3>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {/* Mushaf Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => { setView('mushaf'); setSelectedSurahId(null); }}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[110px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-blue-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white shadow-sm">
                              <BookOpen className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-blue-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-blue-950 group-hover:text-blue-600 transition-colors">المصحف الشريف</h2>
                            <p className="hidden md:block text-slate-400 font-bold text-xs mt-1">تصفح القرآن الكريم كاملاً بالرسم العثماني</p>
                          </div>
                        </motion.button>

                        {/* Adhkar Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => { setView('adhkar'); setSelectedAdhkarCategoryId(null); }}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[110px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-indigo-400 font-inter"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white shadow-sm">
                              <Sun className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-indigo-950 group-hover:text-indigo-600 transition-colors">أذكار المسلم</h2>
                            <p className="hidden md:block text-slate-400 font-bold text-xs mt-1">أذكار الصباح والمساء واليوم والليل</p>
                          </div>
                        </motion.button>

                        {/* Hadith Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => { setView('hadith'); setSelectedHadith(null); }}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[110px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-teal-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-teal-600/10 text-teal-600 flex items-center justify-center transition-all duration-300 group-hover:bg-teal-600 group-hover:text-white shadow-sm">
                              <Quote className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-teal-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-teal-900 group-hover:text-teal-600 transition-colors">الأربعون النووية</h2>
                            <p className="hidden md:block text-slate-400 font-bold text-xs mt-1">شرح وتبسيط أحاديث الأربعون النووية</p>
                          </div>
                        </motion.button>


                        {/* Book Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => setView('book')}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[110px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-amber-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center transition-all duration-300 group-hover:bg-amber-600 group-hover:text-white shadow-sm">
                              <BookOpen className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-amber-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-amber-950 group-hover:text-amber-600 transition-colors">كتاب المتشابهات</h2>
                            <p className="hidden md:block text-slate-400 font-bold text-xs mt-1">كتاب اللؤلؤ والمرجان في متشابه القرآن</p>
                          </div>
                        </motion.button>

                        {/* Encyclopedia Card */}
                        <motion.button
                          whileHover={{ y: -4 }}
                          onClick={() => setView('encyclopedia')}
                          className="group relative p-3 md:p-6 rounded-xl md:rounded-2xl text-right overflow-hidden transition-all duration-300 flex flex-col justify-between border border-slate-100 min-h-[110px] md:min-h-[160px] bg-white shadow-sm hover:shadow-md hover:border-purple-400"
                        >
                          <div className="flex items-center justify-between">
                            <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center transition-all duration-300 group-hover:bg-purple-600 group-hover:text-white shadow-sm">
                              <Compass className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-purple-600 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                          </div>
                          <div>
                            <h2 className="text-xs md:text-lg font-black text-purple-950 group-hover:text-purple-600 transition-colors">الموسوعة</h2>
                            <p className="hidden md:block text-slate-400 font-bold text-xs mt-1">موسوعة العلوم الشرعية والمتشابهات</p>
                          </div>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ) : view === 'list' ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-10 max-w-6xl mx-auto py-10 px-4"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setView('home')}
                        className="p-4 rounded-2xl bg-white/50 hover:bg-white transition-all text-slate-500 font-bold flex items-center gap-2"
                      >
                        <ArrowRight className="w-5 h-5" />
                        الرئيسية
                      </button>
                    </div>

                    <div className="flex bg-white/50 backdrop-blur-md p-1.5 rounded-[2rem] border border-white/20 self-start shadow-inner max-w-fit">
                      <button
                        onClick={() => setActiveListTab('available')}
                        className={`px-6 md:px-8 py-3 rounded-[1.5rem] font-black text-xs md:text-sm transition-all ${activeListTab === 'available' ? 'bg-brand-emerald text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        المسابقات المتاحة ({challenges.filter(c => !completedChallengeIds.has(c.id)).length})
                      </button>
                      <button
                        onClick={() => setActiveListTab('completed')}
                        className={`px-6 md:px-8 py-3 rounded-[1.5rem] font-black text-xs md:text-sm transition-all ${activeListTab === 'completed' ? 'bg-brand-gold text-brand-emerald shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        تحديات تم اجتيازها ({challenges.filter(c => completedChallengeIds.has(c.id)).length})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {challenges
                        .filter(c => activeListTab === 'available' ? !completedChallengeIds.has(c.id) : completedChallengeIds.has(c.id))
                        .map((c, idx) => {
                          const originalIndex = challenges.findIndex(orig => orig.id === c.id);
                          return (
                            <motion.button
                              key={c.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              onClick={() => {
                                setCurrentChallengeIndex(originalIndex);
                                setDifficulty('hard');
                                localStorage.setItem('quran_game_difficulty', 'hard');
                                setView('challenge');

                                // Save as incomplete if not finished
                                const firstVerse = (c.verses && Array.isArray(c.verses)) ? c.verses[0] : null;
                                const info = { index: originalIndex, mode: 'normal' as const, surah: firstVerse?.surah || '' };
                                setIncompleteChallenge(info);
                                localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
                              }}
                              className={`group p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-white border transition-all text-right flex flex-col justify-between min-h-[180px] md:min-h-[220px] ${activeListTab === 'completed' ? 'border-brand-gold/30 bg-brand-gold/5' : 'border-slate-100 shadow-xl hover:shadow-2xl hover:border-brand-emerald/30'}`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className={`text-xs font-black uppercase tracking-widest ${activeListTab === 'completed' ? 'text-brand-emerald' : 'text-brand-gold'}`}>
                                    مسابقة #{c.id}
                                  </div>
                                  {activeListTab === 'completed' && (
                                    <div className="bg-brand-emerald text-white p-1 rounded-full shadow-lg">
                                      <CheckCircle className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-4 group-hover:text-brand-emerald transition-colors quran-text leading-relaxed">
                                  {c.keyword}
                                </h3>
                                <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                                  <ListFilter className="w-4 h-4" />
                                  <span>{Array.isArray(c.verses) ? c.verses.length : 0} مواضع متشابهة</span>
                                </div>
                              </div>
                              <div className="mt-6 flex items-center justify-end">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeListTab === 'completed' ? 'bg-brand-gold text-brand-emerald' : 'bg-brand-emerald/5 group-hover:bg-brand-emerald group-hover:text-white'}`}>
                                  <ArrowLeft className="w-6 h-6" />
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                    </div>

                    {challenges.filter(c => activeListTab === 'available' ? !completedChallengeIds.has(c.id) : completedChallengeIds.has(c.id)).length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-20 text-center bg-white/30 backdrop-blur-md rounded-[3rem] border border-dashed border-slate-200"
                      >
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          {activeListTab === 'available' ? <Trophy className="w-10 h-10 text-slate-300" /> : <ListFilter className="w-10 h-10 text-slate-300" />}
                        </div>
                        <h3 className="text-xl font-black text-slate-400">
                          {activeListTab === 'available' ? 'أتممت جميع التحديات المتاحة! بارك الله فيك.' : 'لم تجتز أي تحديات بعد، انطلق الآن!'}
                        </h3>
                      </motion.div>
                    )}
                  </motion.div>
                ) : challengeMode === 'daily' && dailyCompleted ? (
                  <motion.div
                    key="daily-done"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 md:p-12 rounded-2xl md:rounded-[4rem] text-center max-w-2xl mx-auto border-brand-gold/20"
                  >
                    <div className="mb-8 relative inline-block">
                      <div className="absolute inset-0 bg-brand-gold/20 blur-3xl rounded-full scale-150 animate-pulse" />
                      <CheckCircle className="w-24 h-24 text-brand-gold relative z-10" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black text-brand-emerald mb-4">أتممت تحديك اليومي!</h2>
                    <p className="text-slate-500 mb-10 text-lg font-medium">بارك الله فيك، التحدي القادم ينتظرك في:</p>
                    <div className="text-4xl md:text-6xl font-black text-brand-emerald mb-12 tabular-nums tracking-tighter" dir="ltr">
                      {timeLeft}
                    </div>
                    <button
                      onClick={() => {
                        setChallengeMode('normal');
                        setCurrentChallengeIndex(0);
                        setView('home');
                      }}
                      className="group relative px-10 py-5 bg-brand-emerald text-white rounded-3xl font-black text-lg hover:bg-brand-emerald/90 transition-all shadow-2xl hover:scale-105 active:scale-95"
                    >
                      <span className="relative z-10">استمر بالتحديات الحرة</span>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 rounded-b-3xl group-hover:h-full transition-all duration-300 opacity-0 group-hover:opacity-10" />
                    </button>
                  </motion.div>
                ) : view === 'mushaf' ? (
                  <motion.div
                    key="mushaf"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-6xl mx-auto space-y-8 p-4 md:p-8 transition-all duration-500"
                  >
                    {!selectedSurahId && !selectedJuz && !isSearchSubmitted ? (
                      <div className="space-y-10">
                        {/* Header & Search */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <h2 className="text-2xl md:text-5xl font-black text-brand-emerald flex items-center gap-2 md:gap-4">
                            <BookOpen className="w-8 h-8 md:w-12 md:h-12 text-brand-gold" />
                            {`الصفحة ${currentPage}`}
                          </h2>
                          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (searchQuery.trim()) {
                                  setIsSearchSubmitted(true);
                                }
                              }}
                              className="flex items-center gap-1.5 w-full md:w-96"
                            >
                              <div className="relative flex-1">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="ابحث عن آية..."
                                  value={searchQuery}
                                  onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (e.target.value === '') setIsSearchSubmitted(false);
                                  }}
                                  className="w-full pr-10 pl-4 py-2 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 transition-all font-bold text-sm md:text-base"
                                />
                              </div>
                              <button
                                type="submit"
                                className="px-4 md:px-8 py-2 md:py-4 bg-brand-emerald text-white rounded-xl md:rounded-2xl font-black hover:bg-brand-emerald/90 transition-all shadow-lg active:scale-95 whitespace-nowrap text-sm md:text-base"
                              >
                                بحث
                              </button>
                            </form>
                            <button
                              onClick={() => setIsSettingsOpen(true)}
                              className="p-2 md:p-4 rounded-xl md:rounded-2xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm flex items-center justify-center"
                              title="إعدادات المصحف"
                            >
                              <Settings className="w-6 h-6" />
                            </button>
                            <button
                              onClick={handleBackToHome}
                              className="px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all text-xs md:text-base whitespace-nowrap"
                            >
                              رجوع
                            </button>
                          </div>
                        </div>

                        {/* Juz' Curtain Selector */}
                        <div className="bg-white/50 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-sm overflow-hidden">
                          <button
                            onClick={() => setIsJuzMenuOpen(!isJuzMenuOpen)}
                            className="w-full flex items-center justify-between p-3 md:p-6 hover:bg-white/50 transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isJuzMenuOpen ? 'bg-brand-emerald text-white' : 'bg-brand-emerald/5 text-brand-emerald'}`}>
                                <ListFilter className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <h3 className="font-black text-slate-800 tracking-tight text-sm md:text-lg">تصفح بالأجزاء (1-30)</h3>
                                <p className="text-slate-400 text-xs font-bold">افتح الستارة لاختيار الجزء المطلوب</p>
                              </div>
                            </div>
                            <div className={`transition-transform duration-500 ${isJuzMenuOpen ? 'rotate-180' : ''}`}>
                              <ChevronDown className="w-6 h-6 text-slate-300 group-hover:text-brand-emerald" />
                            </div>
                          </button>

                          <AnimatePresence>
                            {isJuzMenuOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.5, ease: "circOut" }}
                              >
                                <div className="p-6 pt-0">
                                  <div className="h-px bg-slate-100 mb-6" />
                                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-1.5 md:gap-3">
                                    {Array.from({ length: 30 }).map((_, i) => (
                                      <button
                                        key={i + 1}
                                        onClick={() => {
                                          setSelectedJuz(i + 1);
                                          setIsJuzMenuOpen(false);
                                          setCurrentPage(juzStartPages[i + 1] || 1);
                                          setIsPageModeActive(true);
                                        }}
                                        className="aspect-square rounded-xl bg-white border border-slate-100 text-slate-600 font-extrabold flex flex-col items-center justify-center hover:bg-brand-emerald hover:text-white hover:border-brand-emerald transition-all shadow-sm hover:shadow-brand-emerald/20 hover:-translate-y-1"
                                      >
                                        <span className="text-[10px] opacity-50 uppercase mb-0.5">جزء</span>
                                        <span className="text-sm tabular-nums">{i + 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {!isPageModeActive ? (
                          <div className="flex flex-col items-center gap-6 py-12">
                            <button
                              onClick={() => {
                                setCurrentPage(1);
                                setIsPageModeActive(true);
                              }}
                              className="group relative px-12 py-6 rounded-[2.5rem] bg-brand-emerald text-white font-black text-2xl shadow-2xl shadow-brand-emerald/40 hover:-translate-y-2 transition-all active:scale-95 overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                              <div className="flex items-center gap-4">
                                <BookOpen className="w-8 h-8 text-brand-gold" />
                                <span>فتح المصحف الشريف</span>
                              </div>
                            </button>
                            <p className="text-slate-400 font-bold text-sm">البدء من الصفحة الأولى (سورة الفاتحة)</p>

                            <div className="w-full h-px bg-slate-100 my-8" />

                            <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                              {quranData.map((surah: any) => (
                                <motion.button
                                  key={surah.id}
                                  whileHover={{ scale: 1.03, y: -5 }}
                                  onClick={() => {
                                    setCurrentPage(surahStartPages[surah.id] || 1);
                                    setIsPageModeActive(true);
                                  }}
                                  className="glass p-2 md:p-6 rounded-xl md:rounded-3xl border border-white/50 text-right flex items-center gap-2 md:gap-4 hover:shadow-xl transition-all group relative overflow-hidden"
                                >
                                  <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-brand-emerald/10 group-hover:bg-brand-emerald transition-colors" />
                                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald font-black text-xs md:text-xl group-hover:bg-brand-emerald group-hover:text-white transition-colors flex-shrink-0">
                                    {surah.id}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs md:text-xl font-black text-slate-800 leading-tight">{surah.name}</div>
                                    <div className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                      {surah.verses.length} آ <span className="hidden md:inline">• {surah.type.toLowerCase() === 'meccan' ? 'مكية' : 'مدنية'}</span>
                                    </div>
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        ) : isPageModeActive ? (
                          <div className="flex flex-col items-center">
                            <div
                              className="mushaf-page-container islamic-watermark w-full"
                              style={{
                                backgroundColor: librarySettings.darkMode ? '#0f172a' : '#fdfbf7',
                                color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                                borderColor: librarySettings.darkMode ? '#1e293b' : '#e2e8f0',
                                paddingBottom: '2rem'
                              }}
                            >



                              {/* Mushaf Viewer with Offline Images */}
                              <div className="w-full flex flex-col items-center gap-10 p-4 md:p-8 bg-white/40 rounded-[2.5rem] overflow-hidden min-h-[60vh]">
                                <motion.img
                                  key={currentPage}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  src={`/quran-pages/${currentPage.toString().padStart(3, '0')}.png`}
                                  alt={`صفحة ${currentPage}`}
                                  className="w-full h-auto max-h-[200vh] object-contain shadow-premium rounded-2xl border border-white/60"
                                />

                                {/* Pagination controls for Page Mode */}
                                <div className="flex flex-col items-center gap-6 mt-10">
                                  <div className="flex items-center justify-center gap-6 glass p-2 px-6 rounded-full shadow-lg border border-white/60 mx-auto w-fit">
                                    <button
                                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                      disabled={currentPage === 1}
                                      className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                      <ChevronRight className="w-6 h-6" />
                                    </button>

                                    <div className="flex items-center gap-2 relative group">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={currentPage}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/[^0-9]/g, '');
                                          if (val === '') return; // Let them delete, but we keep the last valid or just don't update
                                          const num = parseInt(val);
                                          if (num >= 1 && num <= 604) {
                                            setCurrentPage(num);
                                          }
                                        }}
                                        className="w-16 bg-transparent border-none text-center text-2xl font-black text-brand-emerald focus:outline-none appearance-none"
                                      />
                                      <span className="text-[10px] font-bold text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">صفحة</span>
                                    </div>

                                    <button
                                      onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                      disabled={currentPage === 604}
                                      className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                      <ChevronLeft className="w-6 h-6" />
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setIsPageModeActive(false);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="text-slate-500 hover:text-slate-800 font-bold transition-colors"
                                  >
                                    العودة للفهرس
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {quranData.map((surah: any) => (
                              <motion.button
                                key={surah.id}
                                whileHover={{ scale: 1.03, y: -5 }}
                                onClick={() => setSelectedSurahId(surah.id)}
                                className="glass p-6 rounded-3xl border border-white/50 text-right flex items-center gap-4 hover:shadow-xl transition-all group relative overflow-hidden"
                              >
                                <div className="absolute top-0 left-0 w-2 h-full bg-brand-emerald/10 group-hover:bg-brand-emerald transition-colors" />
                                <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald font-black group-hover:bg-brand-emerald group-hover:text-white transition-colors">
                                  {surah.id}
                                </div>
                                <div className="flex-1">
                                  <div className="text-xl font-black text-slate-800">{surah.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                    {surah.verses.length} آية • {surah.type.toLowerCase() === 'meccan' ? 'مكية' : 'مدنية'}
                                  </div>
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : isSearchSubmitted && searchQuery.trim().length > 0 ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold">
                              <Search className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-xl md:text-3xl font-black text-brand-emerald">نتائج البحث</h2>
                              <p className="text-slate-400 font-bold text-sm">تم العثور على {searchResults.length} نتيجة لـ "{searchQuery}"</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setIsSearchSubmitted(false);
                            }}
                            className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            إلغاء البحث
                          </button>
                        </div>

                        <div className="glass p-8 md:p-12 rounded-[3rem] border border-white/50 shadow-2xl space-y-10">
                          {searchResults.length === 0 ? (
                            <div className="text-center py-20">
                              <p className="text-slate-400 font-bold text-xl italic">لا توجد نتائج تطابق بحثك..</p>
                            </div>
                          ) : (
                            <div className="space-y-10 divide-y divide-slate-100">
                              {searchResults.map((result, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (librarySettings.readingMode === 'page') {
                                      setCurrentPage(result.page);
                                      setIsPageModeActive(true);
                                      setIsSearchSubmitted(false);
                                    } else {
                                      setSelectedSurahId(result.surahId);
                                      setIsSearchSubmitted(false);
                                    }
                                  }}
                                  className="w-full text-right pt-10 first:pt-0 group focus:outline-none"
                                >
                                  <div className="flex items-center gap-4 mb-6">
                                    <span className="w-10 h-10 rounded-xl bg-brand-emerald/5 flex items-center justify-center text-brand-emerald font-black text-xs group-hover:bg-brand-emerald group-hover:text-white transition-all">
                                      {result.surahId}
                                    </span>
                                    <span className="text-lg font-black text-slate-700">سورة {result.surahName} - آية {result.id}</span>
                                  </div>
                                  <p className="text-xl md:text-3xl quran-text text-slate-800 leading-relaxed text-center group-hover:text-brand-emerald transition-colors">
                                    {result.text}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedJuz ? (
                      <div className="space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold">
                              <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                              <h2 className="text-xl md:text-3xl font-black text-brand-emerald">الجزء {selectedJuz}</h2>
                              <p className="text-slate-400 font-bold text-sm">عرض آيات الجزء المختار</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setIsSettingsOpen(true)}
                              className="p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm"
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setSelectedJuz(null)}
                              className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              إغلاق الجزء
                            </button>
                          </div>
                        </div>

                        <div className="w-full flex flex-col items-center gap-10 p-4 md:p-8 bg-white/40 rounded-[2.5rem] overflow-hidden min-h-[60vh]">
                          <motion.img
                            key={currentPage}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            src={`/quran-pages/${currentPage.toString().padStart(3, '0')}.png`}
                            alt={`صفحة ${currentPage}`}
                            className="w-full h-auto max-h-[200vh] object-contain shadow-premium rounded-2xl border border-white/60"
                          />

                          {/* Pagination controls for Juz Mode */}
                          <div className="flex flex-col items-center gap-6">
                            <div className="flex items-center justify-center gap-6 glass p-2 px-6 rounded-full shadow-lg border border-white/60 mx-auto w-fit">
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>

                              <div className="flex items-center gap-2 relative group">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentPage}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === '') return;
                                    const num = parseInt(val);
                                    if (num >= 1 && num <= 604) {
                                      setCurrentPage(num);
                                    }
                                  }}
                                  className="w-16 bg-transparent border-none text-center text-2xl font-black text-brand-emerald focus:outline-none appearance-none"
                                />
                                <span className="text-[10px] font-bold text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">صفحة</span>
                              </div>

                              <button
                                onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                disabled={currentPage === 604}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronLeft className="w-6 h-6" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedJuz(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-slate-500 hover:text-slate-800 font-bold transition-colors"
                            >
                              العودة للفهرس
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between sticky top-4 z-50 glass p-6 rounded-[2.5rem] border border-white/80 shadow-2xl">
                          <div className="flex items-center gap-6">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold text-xl md:text-2xl font-black shadow-lg">
                              {selectedSurahId}
                            </div>
                            <div>
                              <h2 className="text-2xl md:text-3xl font-black text-brand-emerald leading-none">
                                سورة {quranData.find(s => s.id === selectedSurahId)?.name}
                              </h2>
                              <p className="text-slate-400 font-bold text-xs md:text-sm mt-1">
                                {quranData.find(s => s.id === selectedSurahId)?.type.toLowerCase() === 'meccan' ? 'سورة مكية' : 'سورة مدنية'} • {quranData.find(s => s.id === selectedSurahId)?.verses.length} آية
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedSurahId(null)}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-brand-emerald hover:bg-white transition-all shadow-sm"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        <div className="glass p-8 md:p-12 rounded-[3.5rem] md:rounded-[4rem] border border-white/50 shadow-2xl space-y-12 bg-white/40 backdrop-blur-3xl min-h-[60vh]">
                          {selectedSurahId !== 1 && selectedSurahId !== 9 && (
                            <div className="text-center py-8">
                              <p className="text-3xl md:text-4xl quran-text text-brand-emerald font-bold mb-4 opacity-80">
                                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                              </p>
                              <div className="w-24 h-1 bg-brand-gold/20 mx-auto rounded-full" />
                            </div>
                          )}

                          <div className="w-full flex justify-center p-4 md:p-8 bg-white/40 rounded-[2.5rem] overflow-hidden">
                            <motion.img
                              key={currentPage}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              src={`/quran-pages/${currentPage.toString().padStart(3, '0')}.png`}
                              alt={`صفحة ${currentPage}`}
                              className="w-full h-auto max-h-[200vh] object-contain shadow-premium rounded-2xl border border-white/60"
                            />
                          </div>

                          {/* Pagination controls for Surah mode */}
                          <div className="flex flex-col items-center gap-6">
                            <div className="flex items-center justify-center gap-6 glass p-2 px-6 rounded-full shadow-lg border border-white/60 mx-auto w-fit">
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>

                              <div className="flex items-center gap-2 relative group">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={currentPage}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === '') return;
                                    const num = parseInt(val);
                                    if (num >= 1 && num <= 604) {
                                      setCurrentPage(num);
                                    }
                                  }}
                                  className="w-16 bg-transparent border-none text-center text-2xl font-black text-brand-emerald focus:outline-none appearance-none"
                                />
                                <span className="text-[10px] font-bold text-slate-400 absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">صفحة</span>
                              </div>

                              <button
                                onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                                disabled={currentPage === 604}
                                className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-brand-emerald disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronLeft className="w-6 h-6" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedSurahId(null);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-slate-500 hover:text-slate-800 font-bold transition-colors"
                            >
                              العودة للفهرس
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : view === 'adhkar' ? (
                  <motion.div
                    key="adhkar"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500"
                  >
                    {/* Adhkar Header */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold shadow-lg">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div>
                          <h2 className="text-2xl md:text-4xl font-black text-brand-emerald">أذكار المسلم</h2>
                          <p className="text-slate-400 font-bold text-sm mt-1">حصن المسلم اليومي المستحب</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setIsSettingsOpen(true)}
                          className="p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleBackToHome}
                          className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          الرئيسية
                        </button>
                      </div>
                    </div>

                    {/* Adhkar Search Bar - Only visible in the main categories list */}
                    {!selectedAdhkarCategoryId && (
                      <div className="max-w-2xl mx-auto w-full relative group animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-brand-emerald/40 group-focus-within:text-brand-emerald transition-colors">
                          <Hash className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          value={adhkarSearchQuery}
                          onChange={(e) => setAdhkarSearchQuery(e.target.value)}
                          placeholder="ابحث عن أقسام الأذكار... (مثل: الصباح، النوم، المسجد)"
                          className="w-full h-16 bg-white border-2 border-slate-100 rounded-3xl pr-14 pl-6 text-lg font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-brand-emerald/50 focus:ring-4 focus:ring-brand-emerald/5 transition-all shadow-sm"
                        />
                        {adhkarSearchQuery && (
                          <button
                            onClick={() => setAdhkarSearchQuery('')}
                            className="absolute inset-y-0 left-5 flex items-center text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <XCircle className="w-6 h-6" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="w-full">
                      {!selectedAdhkarCategoryId ? (
                        /* القائمة الرئيسية المفلترة */
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
                          {Object.values(adhkarData)
                            .filter(cat => cat.title.toLowerCase().includes(adhkarSearchQuery.toLowerCase()))
                            .map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  setSelectedAdhkarCategoryId(cat.id);
                                  setAdhkarSearchQuery(''); // Clear search on selection
                                }}
                                className={`flex flex-col items-center gap-2 md:gap-3 px-1.5 py-4 md:p-6 rounded-xl md:rounded-[2rem] border transition-all duration-300 ${selectedAdhkarCategoryId === cat.id
                                  ? 'bg-brand-emerald text-white border-brand-emerald shadow-lg -translate-y-1'
                                  : 'bg-white text-slate-400 border-white/50 hover:border-brand-emerald/30 hover:text-brand-emerald shadow-sm'}`}
                              >
                                <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${selectedAdhkarCategoryId === cat.id ? 'bg-white/20' : 'bg-slate-50'}`}>
                                  {cat.icon === 'Sun' && <Sun className="w-5 h-5 md:w-6 md:h-6" />}
                                  {cat.icon === 'Moon' && <Moon className="w-5 h-5 md:w-6 md:h-6" />}
                                  {cat.icon === 'Mosque' && <Compass className="w-5 h-5 md:w-6 md:h-6" />}
                                  {cat.icon === 'Home' && <Home className="w-5 h-5 md:w-6 md:h-6" />}
                                  {cat.icon === 'Plane' && <Plane className="w-5 h-5 md:w-6 md:h-6" />}
                                  {!['Sun', 'Moon', 'Mosque', 'Home', 'Plane'].includes(cat.icon) && <BookOpen className="w-5 h-5 md:w-6 md:h-6" />}
                                </div>
                                <span className="font-black text-[10px] md:text-sm rtl leading-tight text-center">{cat.title}</span>
                              </button>
                            ))}
                        </div>
                      ) : (
                        /* واجهة الأذكار المخصصة */
                        /* القسم الثاني: واجهة الأذكار المخصصة (تظهر وحدها) */
                        <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          {/* رأس الواجهة (العنوان) */}
                          <div className="text-center mb-4">
                            <h2 className="text-3xl font-black text-brand-emerald">
                              {adhkarData[selectedAdhkarCategoryId].title}
                            </h2>
                          </div>

                          <div className="grid gap-4">
                            {adhkarData[selectedAdhkarCategoryId].items.map((dhikr) => (
                              <motion.div
                                key={dhikr.id}
                                layout
                                className={`glass p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/50 relative overflow-hidden transition-all duration-500 cursor-pointer ${adhkarProgress[dhikr.id] === 0 ? 'opacity-60 grayscale' : 'hover:shadow-2xl active:scale-[0.98]'}`}
                                onClick={() => {
                                  if (adhkarProgress[dhikr.id] === 0) return;
                                  const currentCount = adhkarProgress[dhikr.id] ?? dhikr.count;
                                  setAdhkarProgress(prev => ({ ...prev, [dhikr.id]: Math.max(0, currentCount - 1) }));
                                  if (window.navigator.vibrate) window.navigator.vibrate(50);
                                }}
                              >
                                {/* Progress Bar Background */}
                                <motion.div
                                  className="absolute bottom-0 right-0 h-1 bg-brand-gold/20"
                                  initial={{ width: '100%' }}
                                  animate={{ width: `${((adhkarProgress[dhikr.id] ?? dhikr.count) / dhikr.count) * 100}%` }}
                                />

                                <div className="flex items-start justify-between gap-4 md:gap-8 relative z-10">
                                  <div className="flex-1 space-y-4">
                                    <p
                                      className="quran-text text-slate-800 leading-[1.6] md:leading-relaxed text-lg md:text-3xl"
                                    >
                                      {dhikr.text}
                                    </p>
                                    {(dhikr.description || dhikr.reference) && (
                                      <div className="flex flex-wrap items-center gap-3">
                                        {dhikr.description && (
                                          <p className="px-3 py-1 rounded-full bg-brand-emerald/5 text-[10px] md:text-xs font-bold text-brand-emerald italic">
                                            {dhikr.description}
                                          </p>
                                        )}
                                        {dhikr.reference && (
                                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md">
                                            {dhikr.reference}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-col items-center gap-3">
                                    <motion.div
                                      key={adhkarProgress[dhikr.id] ?? dhikr.count}
                                      initial={{ scale: 0.8, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.8rem] flex flex-col items-center justify-center shadow-xl transition-all duration-500 ${adhkarProgress[dhikr.id] === 0 ? 'bg-green-500 text-white shadow-green-200 rotate-12 scale-110' : 'bg-white text-slate-800'}`}
                                    >
                                      {adhkarProgress[dhikr.id] === 0 ? (
                                        <CheckCircle className="w-8 h-8" />
                                      ) : (
                                        <>
                                          <span className="text-xl md:text-2xl font-black tabular-nums">{adhkarProgress[dhikr.id] ?? dhikr.count}</span>
                                          <span className="text-[9px] font-black uppercase tracking-widest opacity-40">تكرار</span>
                                        </>
                                      )}
                                    </motion.div>
                                    <div className={`text-[9px] font-black transition-all ${adhkarProgress[dhikr.id] === 0 ? 'text-green-600' : 'text-slate-400 opacity-50'}`}>
                                      {adhkarProgress[dhikr.id] === 0 ? 'تم' : 'للعد'}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {/* زر الرجوع السفلي (للعودة للقائمة) */}
                          <button
                            onClick={() => {
                              setSelectedAdhkarCategoryId(null);
                              // Scroll to top of the card
                              document.querySelector('.adhkar-container')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="mt-8 w-full py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-3xl transition-all flex items-center justify-center gap-2 group"
                          >
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            <span>الرجوع لواجهة الأدعية</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-center pt-12 pb-8">
                      <button
                        onClick={() => setAdhkarProgress({})}
                        className="group flex items-center gap-3 mx-auto px-8 py-3 rounded-full border border-slate-200 text-xs font-black text-slate-400 hover:text-brand-emerald hover:border-brand-emerald/30 transition-all active:scale-95"
                      >
                        <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
                        إعادة تصفير جميع العدادات والمتابعة
                      </button>
                    </div>
                  </motion.div>
                ) : view === 'hadith' ? (
                  <motion.div
                    key="hadith"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500"
                  >
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
                          <Quote className="w-8 h-8" />
                        </div>
                        <div>
                          <h2 className="text-2xl md:text-4xl font-black text-teal-900 font-quran">الأربعون النووية</h2>
                          <p className="text-slate-400 font-bold text-sm mt-1">من جوامع كلم النبي ﷺ</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setIsSettingsOpen(true)}
                          className="p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleBackToHome}
                          className="px-8 py-3 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          الرئيسية
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {HADITHS.map((hadith) => (
                        <motion.button
                          key={hadith.id}
                          whileHover={{ scale: 1.02, y: -5 }}
                          onClick={() => setSelectedHadith(hadith)}
                          className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border border-white/50 text-right flex flex-col gap-3 md:gap-4 hover:shadow-2xl transition-all group relative overflow-hidden text-right items-start"
                        >
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500/10 group-hover:bg-teal-500 transition-colors" />
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 font-black group-hover:bg-teal-600 group-hover:text-white transition-colors text-sm md:text-base">
                            {hadith.id}
                          </div>
                          <div className="flex-1 w-full text-right">
                            <div className="text-base md:text-xl font-black text-slate-800 font-quran line-clamp-2">{hadith.title}</div>
                            <p className="text-slate-500 font-medium text-[10px] md:text-sm mt-2 line-clamp-2 leading-relaxed md:leading-loose">
                              {hadith.hadith.split('\n').filter(l => l.trim()).slice(1, 4).join(' ')}...
                            </p>
                          </div>
                          <div className="w-full h-px bg-slate-50 my-1 md:my-2" />
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[8px] md:text-[10px] font-black text-teal-600 uppercase tracking-widest">عرض الحديث وشرحه</span>
                            <ChevronLeft className="w-4 h-4 text-teal-400 group-hover:translate-x-[-4px] transition-transform" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : view === 'book' ? (
                  <motion.div
                    key="book"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <BookReader onBack={() => setView('home')} />
                  </motion.div>
                ) : view === 'encyclopedia' ? (
                  <motion.div
                    key="encyclopedia"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <Encyclopedia onBack={() => setView('home')} />
                  </motion.div>
                ) : view === 'islamic_quiz' ? (
                  <motion.div
                    key="islamic_quiz"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <IslamicQuiz onBack={() => setView('home')} onWin={updateStatsAfterWin} />
                  </motion.div>
                ) : (
                  <>
                    {!currentChallenge ? (
                      <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
                        <p className="text-brand-emerald font-black animate-pulse">جاري التحميل...</p>
                      </div>
                    ) : (currentChallenge && !currentChallenge.verseText && !currentChallenge.text) ? (
                      <div style={{ padding: '40px', backgroundColor: '#fee', color: '#c00', direction: 'ltr', zIndex: 9999, position: 'relative', borderRadius: '2rem', margin: '40px auto', maxWidth: '800px' }} className="glass border-red-200 shadow-2xl">
                        <h3 className="text-2xl font-black mb-4">Debug: Missing Verse Data</h3>
                        <p className="mb-4 font-bold text-slate-700">The currentChallenge object exists but lacks 'verseText' or 'text' keys.</p>
                        <pre className="bg-white/80 p-6 rounded-xl overflow-auto max-h-[400px] border border-red-100 shadow-inner text-sm">{JSON.stringify(currentChallenge, null, 2)}</pre>
                        <button onClick={() => setView('home')} className="mt-8 px-8 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg hover:bg-red-700 transition-all">العودة للرئيسية (Back to Home)</button>
                      </div>
                    ) : (
                      <div key="game" className="space-y-10 max-w-4xl mx-auto w-full px-4 pt-10">
                        {/* Floating Timer UI for Speed Mode */}
                        {isSpeedMode && (
                          <div className="flex justify-center mb-6 sticky top-4 z-50">
                            <motion.div
                              animate={{
                                scale: speedTimeLeft <= 10 ? [1, 1.1, 1] : 1,
                                backgroundColor: speedTimeLeft <= 10 ? '#fee2e2' : '#ffffff'
                              }}
                              transition={{ repeat: speedTimeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
                              className={`glass px-10 py-5 rounded-full shadow-2xl border-2 flex items-center gap-6 ${speedTimeLeft <= 10 ? 'border-red-500' : 'border-brand-emerald/20'}`}
                            >
                              <div className={`p-3 rounded-2xl ${speedTimeLeft <= 10 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
                                <Zap className="w-8 h-8" />
                              </div>
                              <div className="text-right">
                                <span className={`text-2xl md:text-4xl font-black block tabular-nums ${speedTimeLeft <= 10 ? 'text-red-600' : 'text-slate-800'}`}>
                                  {speedTimeLeft} ثانية
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">الوقت المتبقي للسؤال</span>
                              </div>
                            </motion.div>
                          </div>
                        )}

                        <SkillsChallengeHeader
                          index={challengeMode === 'daily' ? dailyChallengeIndex : (view === 'challenge' ? currentChallengeIndex : sessionCurrentIndex)}
                          total={challengeMode === 'daily' ? 1 : (challenges.length > 50 ? 20 : Math.max(challenges.length, 1))}
                          mode={skillsType}
                          verseText={KEYWORD}
                          totalPoints={totalPoints}
                        />
                        {skillsType === 'audio' ? (
                          <AudioChallengeUI
                            targetVerses={targetVerses}
                            matchedIds={matchedIds}
                            isListening={isListening}
                            onToggleListening={isListening ? stopListening : startListening}
                            keyword={KEYWORD}
                            keywordWordCount={keywordWordCount}
                            wordStates={wordStates}
                            onSkip={handleSkip}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                          />
                        ) : skillsType === 'surah' ? (
                          <SurahChallengeUI
                            verseText={KEYWORD}
                            inputs={surahInputs}
                            onInputChange={(idx: number, val: string) => {
                              const newInputs = [...surahInputs];
                              newInputs[idx] = val;
                              setSurahInputs(newInputs);
                            }}
                            onSubmit={handleSubmitSurah}
                            feedback={skillsFeedback}
                            onSkip={handleSkip}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                            currentChallenge={currentChallenge}
                          />
                        ) : (
                          <CompleteChallengeUI
                            verseText={KEYWORD}
                            options={skillsOptions || []}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                            onConfirm={handleConfirmAnswer}
                            feedback={skillsFeedback}
                            onSkip={handleSkip}
                            isComplete={isComplete}
                            challengeMode={challengeMode}
                            saveScore={saveScore}
                            KEYWORD={KEYWORD}
                            score={score}
                            setDailyCompleted={setDailyCompleted}
                            updateStatsAfterWin={updateStatsAfterWin}
                            handlePromptNextChallenge={handlePromptNextChallenge}
                            onViewTafsir={handleOpenTafsir}
                            currentChallenge={currentChallenge}
                          />
                        )}

                        {/* Transcript Debug */}
                        <AnimatePresence>
                          {isListening && transcript && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="p-4 md:p-8 glass bg-brand-gold/5 border-brand-gold/10 rounded-2xl md:rounded-3xl text-slate-700 text-center quran-text text-lg md:text-xl italic mt-6"
                            >
                              "{transcript}"
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                )}
              </AnimatePresence>
            )}
          </main>

          {view === 'home' && (
            <>
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0, x: 20 }}
                  animate={{ scale: 1, x: 0 }}
                  className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] group cursor-pointer"
                  title="شعلة الاستمرار اليومية"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full scale-110 streak-pulse" />
                    <div className="glass bg-white/90 p-2.5 md:p-4 rounded-2xl md:rounded-[2rem] border-orange-200 shadow-2xl flex items-center gap-2 md:gap-3 relative z-10 transition-all group-hover:scale-105">
                      <div className="w-8 h-8 md:w-12 md:h-12 bg-orange-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden relative">
                        <Flame className="w-4 h-4 md:w-6 md:h-6 fill-current relative z-10" />
                        <div className="absolute inset-0 bg-linear-to-t from-white/20 to-transparent" />
                      </div>
                      <div className="text-right">
                        <span className="text-lg md:text-2xl font-black text-orange-600 tabular-nums block leading-none">{streak}</span>
                        <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">أيام متتالية</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <footer className="max-w-4xl mx-auto px-4 md:px-6 pb-8 md:pb-12 relative z-10">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="glass p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/50 text-center shadow-lg hover:shadow-xl transition-all group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-brand-emerald/5 p-2 rounded-xl group-hover:scale-110 transition-transform duration-500">
                      <Sparkles className="w-4 h-4 text-brand-gold" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-brand-emerald font-black text-xs md:text-base tracking-tight">
                        قام بإنشاء هذا التطبيق <span className="text-brand-gold">علاء الدين الحجي</span>
                      </p>
                      <p className="text-brand-emerald font-black text-xs md:text-base tracking-tight">
                        صاحب فكرة التطبيق<span className="text-brand-gold"> الاخ عمر سمير طبش</span>
                      </p>
                      <p className="text-slate-500 font-bold text-[10px] md:text-xs leading-relaxed">
                        لا تنسونا من دعواكم، هذا التطبيق صدقة عني وعن اخي عمر وعن والدينا وأحبائنا
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-8 h-px bg-slate-200" />
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/30" />
                      <div className="w-8 h-px bg-slate-200" />
                    </div>
                  </div>
                </motion.div>
              </footer>
            </>
          )
          }


          {/* Styled scrollbar & custom animations for the shimmers */}
          <style dangerouslySetInnerHTML={{
            __html: `
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #fdfbf7; }
        ::-webkit-scrollbar-thumb { background: #064e3b20; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #064e3b40; }
        ::selection { background: #d4af3730; color: #064e3b; }
      `}} />

          <AnimatePresence>
            {selectedHadith && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl"
                onClick={() => setSelectedHadith(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className={`p-5 md:p-12 rounded-2xl md:rounded-[3.5rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl transition-all duration-500 theme-transition relative ${librarySettings.darkMode ? 'lib-dark' : 'glass border-white/20'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelectedHadith(null)}
                    className="absolute top-4 md:top-8 left-4 md:left-8 p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all z-20"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="relative z-10 space-y-8 md:space-y-12 pb-6 md:pb-10" dir="rtl">
                    <div className="text-center space-y-3 md:space-y-4">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-teal-600 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-xl shadow-teal-600/30">
                        <Quote className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      </div>
                      <h2 className="text-xl md:text-4xl font-black text-teal-900 font-quran px-6">{selectedHadith.title}</h2>
                      <div className="h-1 w-16 md:w-24 bg-teal-500/20 rounded-full mx-auto" />
                    </div>

                    <div className="space-y-6 md:space-y-8">
                      <div className="glass bg-white/40 p-5 md:p-10 rounded-xl md:rounded-[2.5rem] border border-white shadow-premium">
                        <h3 className="text-[10px] md:text-sm font-black text-teal-600 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4 md:mb-6 opacity-60">نص الحديث الشريف</h3>
                        <p
                          className="text-xs md:text-xl text-slate-800 leading-relaxed md:leading-relaxed text-center font-bold"
                        >
                          {selectedHadith.hadith.split('\n').filter(l => l.trim()).slice(1).join('\n')}
                        </p>
                      </div>

                      <div className="glass bg-teal-50/30 p-5 md:p-10 rounded-xl md:rounded-[2.5rem] border-teal-100 shadow-premium">
                        <h3 className="text-[10px] md:text-sm font-black text-teal-600 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-4 md:mb-6 opacity-60">الشرح والفوائد</h3>
                        <div
                          className="text-xs md:text-xl font-medium text-slate-700 leading-relaxed md:leading-relaxed text-center"
                        >
                          {selectedHadith.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4 md:pt-8">
                      <button
                        onClick={() => setSelectedHadith(null)}
                        className="px-10 py-4 md:px-12 md:py-5 bg-teal-600 text-white rounded-2xl md:rounded-3xl font-black text-base md:text-lg shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-all active:scale-95"
                      >
                        تمت القراءة
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <ConfirmModal
            isOpen={isExitModalOpen}
            onClose={() => setIsExitModalOpen(false)}
            onConfirm={confirmExitToHome}
            title="تأكيد الخروج"
            message="هل تريد العودة للرئيسية؟ سيتم فقدان تقدمك الحالي في هذه الآية."
          />

          <ConfirmModal
            isOpen={isNextChallengeModalOpen}
            onClose={() => setIsNextChallengeModalOpen(false)}
            onConfirm={confirmNextChallenge}
            title="التحدي التالي"
            message="هل أنت مستعد للتحدي التالي؟"
          />

          <LibrarySettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={librarySettings}
            setSettings={setLibrarySettings}
            showReadingMode={view === 'mushaf'}
          />

          <DailyAyah />

          <AnimatePresence>
            {showTafsirModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 bg-slate-900/60 backdrop-blur-md"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-2xl max-w-2xl w-full relative overflow-hidden"
                >
                  <div className="absolute top-0 inset-x-0 h-2 bg-emerald-500" />

                  <div className="flex items-center gap-4 mb-6 md:mb-10">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                      <BookOpen className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-3xl font-black text-slate-800 leading-none mb-2">تفسير الآية الكريمة</h3>
                      <p className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-widest leading-none">تفسير السعدي (تيسير الكريم الرحمن)</p>
                    </div>
                  </div>

                  <p
                    className="!text-2xl md:!text-3xl text-slate-800 leading-loose !font-quran font-normal text-center my-6 !tracking-normal"
                    dir="rtl"
                    style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                  >
                    {tafsirAyahText}
                  </p>

                  <div className="mt-6 p-5 bg-slate-50 rounded-xl border-r-4 border-emerald-500 w-full text-right" dir="rtl">
                    <p className="text-xs font-bold text-slate-500 mb-3">التفسير (الميسر):</p>
                    <p
                      className="text-lg md:text-xl text-slate-700 leading-relaxed !font-quran font-normal text-justify !tracking-normal"
                      style={{ letterSpacing: '0', wordSpacing: 'normal', fontFeatureSettings: '"rlig" 1, "calt" 1' }}
                    >
                      {tafsirData}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowTafsirModal(false)}
                    className="mt-6 md:mt-10 w-full py-4 md:py-5 bg-emerald-600 text-white rounded-xl md:rounded-2xl font-black text-md md:text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                  >
                    حسناً، فهمت
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div >
  );
}
