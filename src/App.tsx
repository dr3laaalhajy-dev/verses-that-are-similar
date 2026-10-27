import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import {
  Sparkles, Trophy, RotateCcw, X, Mic, MicOff, Search, BookOpen, CheckCircle, CheckCircle2,
  ChevronRight, ChevronLeft, LayoutGrid, Heart, History, Compass, Home, Plane, Award, Star,
  ListFilter, Sun, Moon, Calendar, Settings, Copy, Check, Lightbulb, ChevronDown, User, Users, Quote,
  ArrowRight, ArrowLeft, Zap, Lock, AlertCircle, Hash, XCircle, Eye, EyeOff, List, Loader2, Flame, ZoomIn, ZoomOut, Maximize2, LogOut,
  Info, HelpCircle, AtSign, Key, LogIn, UserPlus, Smartphone, Download, Share2, Mail, ExternalLink, Send,
  Clock, RefreshCw, Globe, Plus
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import CertificateGenerator from './components/CertificateGenerator';
import { quranData } from './services/QuranRepository';

interface Verse {
  id: string;
  text: string;
  surah: string;
  number: string | number;
}
import { HADITHS, Hadith } from './services/HadithRepository';
import { juzBoundaries, JUZ_NAMES_AR, ALL_QURAN_SURAHS, getJuzsForSurah } from './services/JuzRepository';
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
import { IslamicVideos } from './components/IslamicVideos';
import QuranZoomViewer from './components/QuranZoomViewer';
import AyahActionSheet from './components/AyahActionSheet';
import IslamicRoomConfigModal from './components/IslamicRoomConfigModal';
import { getRandomIslamicRoomQuestions, getTargetedIslamicQuestions, getTotalIslamicAvailableCount, getIslamicTopicAvailableCount } from './utils/islamicChallengeHelper';
import { islamicCategoriesList } from './data/islamicCategories';
import DailyAyah from './components/DailyAyah';
import { renderQuranText } from './utils/quranUtils';
import { calculateStreakInfo, StreakInfo } from './utils/streakManager';
import { StreakModal } from './components/StreakModal';
import { generateCompletionChallenges } from './services/challengeGenerator';
import SettingsView from './components/Settings/SettingsView';
import IslamicOccasionsModal from './components/IslamicOccasionsModal';
import { AppDownloadModal } from './components/AppDownloadModal';
import { GooglePlayTesterModal, GooglePlayButton, GooglePlayLogo } from './components/GooglePlayTesterModal';
import { PrivacyModal } from './components/PrivacyModal';
import { defaultChallenges } from './data/defaultChallenges';
import { PullToRefresh } from './components/PullToRefresh';
import {
  GroupChallengeEmblem,
  DailyChallengeEmblem,
  SkillsChallengeEmblem,
  SpeedChallengeEmblem,
  IslamicQuizEmblem,
  MushafLibraryIcon,
  AdhkarLibraryIcon,
  HadithLibraryIcon,
  BookLibraryIcon,
  EncyclopediaLibraryIcon,
  VideoLibraryIcon
} from './components/IslamicChallengeEmblems';
import {
  getHijriDate,
  getUpcomingOccasions,
  getNearestOccasion,
  syncAladhanHijri,
  HijriDateInfo,
  IslamicOccasion
} from './services/IslamicOccasionsService';

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

type View = 'home' | 'difficulty' | 'challenge' | 'mushaf' | 'adhkar' | 'hadith' | 'admin' | 'list' | 'group_menu' | 'group_waiting' | 'group_game' | 'speed_challenge' | 'skills_menu' | 'speed_menu' | 'group_create' | 'group_join' | 'book' | 'encyclopedia' | 'skills_count_selection' | 'skills_results' | 'islamic_quiz' | 'settings' | 'library' | 'challenges' | 'islamic_videos';
const VALID_VIEWS: View[] = [
  'home', 'difficulty', 'challenge', 'mushaf', 'adhkar', 'hadith', 'admin',
  'list', 'group_menu', 'group_waiting', 'group_game', 'speed_challenge',
  'skills_menu', 'speed_menu', 'group_create', 'group_join', 'book',
  'encyclopedia', 'skills_count_selection', 'skills_results', 'islamic_quiz',
  'settings', 'library', 'challenges', 'islamic_videos'
];
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

export const superNormalizeArabic = (text: any) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '') // حذف التشكيل
    .replace(/[أإآ]/g, 'ا') // توحيد الألف
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة والهاء
    .replace(/ي/g, 'ى') // توحيد الياء
    .replace(/\s+/g, '') // حذف جميع المسافات العادية
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, ''); // حذف المسافات والرموز المخفية
};

// Helper to determine question time in Speed Challenge based on admin level:
// صعب = 20s, سهل = 10s, متوسط = 15s (default)
export const getSpeedQuestionDuration = (challenge: any): number => {
  if (!challenge) return 15;
  const lvl = String(challenge.level || challenge.difficulty || '').toLowerCase().trim();
  if (lvl === 'hard' || lvl === 'صعب') return 20;
  if (lvl === 'easy' || lvl === 'سهل') return 10;
  return 15; // متوسط (medium) default
};

const SkillsChallengeHeader = ({ index, total, mode, title, verseText, totalPoints: pts, onSkip, isComplete, level }: any) => (
  <div className="flex justify-between items-start gap-2 mb-2 md:mb-4 relative z-10 w-full">
    <div className="flex items-center gap-2 md:gap-3 min-w-0 pt-0.5">
      <div className="w-7 h-7 md:w-11 md:h-11 bg-brand-gold/10 rounded-lg md:rounded-xl flex items-center justify-center text-brand-gold shrink-0">
        {mode === 'audio' ? <Mic className="w-3.5 h-3.5 md:w-5 md:h-5" /> : mode === 'surah' ? <BookOpen className="w-3.5 h-3.5 md:w-5 md:h-5" /> : <CheckCircle className="w-3.5 h-3.5 md:w-5 md:h-5" />}
      </div>
      <div className="text-right min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-black text-brand-emerald block leading-tight ${mode === 'complete' ? 'text-xs md:text-lg' : 'text-[9px] md:text-xs mb-0.5'}`}>
            {title ? title : (mode === 'audio' ? 'تحدي التلاوة' : mode === 'surah' ? 'تحدي السور' : 'تحدي الإكمال')}
          </span>
          {level && (
            <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border ${
              (level === 'hard' || level === 'صعب') ? 'bg-rose-50 text-rose-700 border-rose-200' :
              (level === 'easy' || level === 'سهل') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {(level === 'hard' || level === 'صعب') ? 'صعب 🔥 (20ث)' :
               (level === 'easy' || level === 'سهل') ? 'سهل 🌱 (10ث)' :
               'متوسط ⚡ (15ث)'}
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
      {onSkip && !isComplete && (
        <button
          onClick={onSkip}
          className="text-red-500 hover:text-red-600 font-bold transition-all flex items-center gap-1.5 text-[11px] md:text-sm mt-1 md:mt-2 px-1.5 md:px-3 py-0.5 md:py-1 rounded-lg hover:bg-red-50 active:scale-95"
          title="تخطي السؤال"
        >
          <X className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
          <span>تخطي السؤال</span>
        </button>
      )}
    </div>
  </div>
);

const AudioChallengeUI = ({ targetVerses, matchedIds, isListening, onToggleListening, keyword, keywordWordCount, wordStates, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir }: any) => {
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

              {challengeMode === 'daily' ? (
                <button
                  onClick={() => {
                    saveScore(KEYWORD, score);
                    const todayStr = new Date().toISOString().split('T')[0];
                    localStorage.setItem('quran_daily_completed', todayStr);
                    setDailyCompleted(true);
                    updateStatsAfterWin();
                  }}
                  className="px-5 py-2.5 bg-brand-gold text-brand-emerald rounded-xl font-bold text-xs md:text-sm hover:bg-white transition-all shadow-md"
                >
                  إنهاء التحدي اليومي
                </button>
              ) : (
                <button
                  onClick={() => {
                    handlePromptNextChallenge();
                    updateStatsAfterWin();
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

const SurahChallengeUI = ({ verseText, inputs, onInputChange, onSubmit, feedback, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir, currentChallenge, surahFeedbackData }: any) => (
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
            isMatch = surahFeedbackData.correctSurahs.some((c: string) => normalizeArabicText(c).trim() === normalizeArabicText(input).trim());
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

            {challengeMode === 'daily' ? (
              <button
                onClick={() => {
                  saveScore(KEYWORD, score);
                  const todayStr = new Date().toISOString().split('T')[0];
                  localStorage.setItem('quran_daily_completed', todayStr);
                  setDailyCompleted(true);
                  updateStatsAfterWin();
                }}
                className="px-5 py-2.5 bg-brand-gold text-brand-emerald rounded-xl font-bold text-xs md:text-sm hover:bg-white transition-all shadow-md"
              >
                إنهاء التحدي اليومي
              </button>
            ) : (
              <button
                onClick={() => {
                  handlePromptNextChallenge();
                  updateStatsAfterWin();
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

const CompleteChallengeUI = ({ verseText, options, selectedOption, onOptionSelect, onConfirm, feedback, onSkip, isComplete, challengeMode, saveScore, KEYWORD, score, setDailyCompleted, updateStatsAfterWin, handlePromptNextChallenge, onViewTafsir, currentChallenge, onFinishDaily, correctText }: any) => (
  <div className="flex flex-col items-center gap-2 md:gap-4 w-full max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto">
    <div className="glass p-3.5 md:p-8 lg:p-10 rounded-2xl md:rounded-3xl w-full text-center border-white/80 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-brand-emerald/30 to-transparent" />
      <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-brand-emerald leading-loose quran-text mb-3.5 md:mb-7 px-2 md:px-4">
        {renderQuranText(verseText)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4 w-full">
        {options.map((opt: any, idx: number) => {
          const rawSelectedText = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.text : selectedOption) : null;
          const isSelected = selectedOption === opt || (rawSelectedText !== null && rawSelectedText === opt.text);
          const isOptionCorrect = !!opt.isCorrect || (correctText && superNormalizeArabic(opt.text) === superNormalizeArabic(correctText));

          let btnClass = 'bg-white border-slate-100 text-slate-700 hover:border-brand-gold/30 hover:bg-brand-gold/5';
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
          className={`w-full mt-3.5 p-3.5 sm:p-4 rounded-xl md:rounded-2xl text-right shadow-sm border ${
            selectedOption && (selectedOption.isCorrect || (correctText && superNormalizeArabic(typeof selectedOption === 'object' ? selectedOption.text : selectedOption) === superNormalizeArabic(correctText)))
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {selectedOption && (selectedOption.isCorrect || (correctText && superNormalizeArabic(typeof selectedOption === 'object' ? selectedOption.text : selectedOption) === superNormalizeArabic(correctText))) ? (
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

            {challengeMode === 'daily' ? (
              <button
                onClick={() => {
                  saveScore(KEYWORD, score);
                  const todayStr = new Date().toISOString().split('T')[0];
                  localStorage.setItem('quran_daily_completed', todayStr);
                  setDailyCompleted(true);
                  updateStatsAfterWin();
                  if (onFinishDaily) onFinishDaily();
                }}
                className="px-6 py-3 bg-brand-gold text-brand-emerald rounded-xl font-bold text-sm md:text-base hover:bg-white transition-all shadow-lg"
              >
                إنهاء التحدي اليومي
              </button>
            ) : (
              <button
                onClick={() => {
                  handlePromptNextChallenge();
                  updateStatsAfterWin();
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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
  const [view, setViewState] = useState<View>(() => {
    try {
      const saved = sessionStorage.getItem('current_app_view');
      if (saved && VALID_VIEWS.includes(saved as View)) {
        return saved as View;
      }
    } catch (e) {}
    return 'home';
  });

  const isPoppingRef = useRef(false);

  const setView = useCallback((next: View | ((prev: View) => View), pushToHistory = true) => {
    setViewState(prev => {
      const nextView = typeof next === 'function' ? next(prev) : next;
      if (nextView === prev) return prev;

      try {
        sessionStorage.setItem('current_app_view', nextView);
      } catch (e) {}

      if (pushToHistory && !isPoppingRef.current) {
        window.history.pushState({ view: nextView }, '', '');
      }
      return nextView;
    });
  }, []);

  useEffect(() => {
    if (!window.history.state || window.history.state.view !== view) {
      window.history.replaceState({ view }, '', '');
    }

    const handlePopState = (e: PopStateEvent) => {
      isPoppingRef.current = true;
      const targetView = (e.state && e.state.view && VALID_VIEWS.includes(e.state.view))
        ? (e.state.view as View)
        : 'home';

      try {
        sessionStorage.setItem('current_app_view', targetView);
      } catch (err) {}

      setViewState(targetView);

      setTimeout(() => {
        isPoppingRef.current = false;
      }, 50);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('quran_admin_token'));
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(localStorage.getItem('quran_admin_super') === 'true');
  const [adminRole, setAdminRole] = useState<string>(() => localStorage.getItem('quran_admin_role') || '');
  const [adminUsername, setAdminUsername] = useState<string>(() => localStorage.getItem('quran_admin_username') || '');
  const [adminName, setAdminName] = useState<string>(() => localStorage.getItem('quran_admin_name') || '');
  const [canManageUsers, setCanManageUsers] = useState<boolean>(() => localStorage.getItem('quran_admin_can_manage_users') === 'true');
  const [adminId, setAdminId] = useState<number | null>(() => {
    const saved = localStorage.getItem('quran_admin_id');
    return saved ? parseInt(saved) : null;
  });

  const isNativeApp = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() || 
    window.location.protocol === 'capacitor:'
  );

  const [shareCopied, setShareCopied] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const handleShareApp = useCallback(async () => {
    const downloadUrl = 'https://github.com/dr3laaalhajy-dev/verses-that-are-similar/releases/download/v1.0.0/Mutashabihat.apk';
    const shareData = {
      title: 'تطبيق متين للقرآن الكريم للأندرويد',
      text: 'حمّل تطبيق متين للأندرويد الآن واستمتع بكافة التحديات والمتشابهات والقرآن كاملاً بدون إنترنت!\nرابط تحميل التطبيق المباشر:',
      url: downloadUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (downloadUrl) {
        await navigator.clipboard.writeText(downloadUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch {}
  }, []);

  // Google Play Testers state & automatic real-time sync
  const [showGooglePlayModal, setShowGooglePlayModal] = useState(false);
  const [testerEmail, setTesterEmail] = useState(() => {
    try {
      return localStorage.getItem('mateen_tester_email') || '';
    } catch {
      return '';
    }
  });
  const [testerStatus, setTesterStatus] = useState<'idle' | 'loading' | 'pending' | 'approved' | 'rejected' | 'error'>('idle');
  const [testerMessage, setTesterMessage] = useState('');
  const [internalTestLink, setInternalTestLink] = useState('https://play.google.com/apps/testing/com.mateen.game');
  const [isCheckingSavedStatus, setIsCheckingSavedStatus] = useState(false);

  const checkTesterStatus = useCallback(async (emailToCheck: string, isSilent = false) => {
    const clean = (emailToCheck || '').trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.') || clean.indexOf('@') >= clean.lastIndexOf('.')) return;
    if (!isSilent) setIsCheckingSavedStatus(true);
    try {
      const res = await fetch(`/api/testers?email=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.registered) {
        if (data.status === 'APPROVED') {
          setTesterStatus('approved');
          setTesterMessage('تهانينا! تمت الموافقة على طلبك بنجاح. يمكنك الآن فتح الرابط وتثبيت التطبيق.');
          if (data.internalTestUrl) setInternalTestLink(data.internalTestUrl);
        } else if (data.status === 'REJECTED') {
          setTesterStatus('rejected');
          setTesterMessage('طلبك قيد المراجعة أو تم رفضه. يمكنك إرسال طلب جديد.');
        } else {
          setTesterStatus('pending');
          setTesterMessage('طلبك قيد المراجعة حالياً من قبل الإدارة. سيتم تفعيل حسابك وإظهار رابط التثبيت تلقائياً فور الموافقة عليه.');
        }
      } else {
        if (!isSilent) {
          setTesterStatus('idle');
        }
      }
    } catch (err) {
      console.error('Error checking tester status:', err);
    } finally {
      if (!isSilent) setIsCheckingSavedStatus(false);
    }
  }, []);

  // Automatic real-time status polling for saved registered tester email
  useEffect(() => {
    const saved = localStorage.getItem('mateen_tester_email');
    if (!saved || !saved.includes('@') || !saved.includes('.')) return;

    // Immediate check
    checkTesterStatus(saved, true);

    if (testerStatus === 'approved') return;

    const timer = setInterval(() => {
      const currentSaved = localStorage.getItem('mateen_tester_email');
      if (currentSaved && currentSaved.includes('@') && currentSaved.includes('.')) {
        checkTesterStatus(currentSaved, true);
      }
    }, 8000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const currentSaved = localStorage.getItem('mateen_tester_email');
        if (currentSaved && currentSaved.includes('@') && currentSaved.includes('.')) {
          checkTesterStatus(currentSaved, true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [testerStatus, checkTesterStatus]);

  const handleRegisterTester = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = testerEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setTesterStatus('error');
      setTesterMessage('يرجى إدخال بريد إلكتروني صحيح (Gmail)');
      return;
    }
    setTesterStatus('loading');
    setTesterMessage('');
    try {
      const res = await fetch('/api/testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'حدث خطأ أثناء إرسال الطلب');
      }
      try {
        localStorage.setItem('mateen_tester_email', clean);
      } catch {}
      if (data.status === 'APPROVED') {
        setTesterStatus('approved');
        setTesterMessage(data.message || 'تهانينا! تم قبول طلبك بنجاح.');
        if (data.internalTestUrl) setInternalTestLink(data.internalTestUrl);
      } else {
        setTesterStatus('pending');
        setTesterMessage(data.message || 'تم إرسال طلب انضمامك للتجربة بنجاح! بانتظار موافقة الإدارة.');
      }
    } catch (err: any) {
      setTesterStatus('error');
      setTesterMessage(err.message || 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً');
    }
  };

  const handleResetTesterForm = () => {
    try {
      localStorage.removeItem('mateen_tester_email');
    } catch {}
    setTesterEmail('');
    setTesterStatus('idle');
    setTesterMessage('');
  };

  const [systemSettings, setSystemSettings] = useState<{
    hideAudioChallenge: boolean;
    hideCompletionChallenge: boolean;
    hideSurahChallenge: boolean;
    hideIslamicVideos: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('cached_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          hideAudioChallenge: parsed.hideAudioChallenge !== undefined ? !!parsed.hideAudioChallenge : true,
          hideCompletionChallenge: !!parsed.hideCompletionChallenge,
          hideSurahChallenge: !!parsed.hideSurahChallenge,
          hideIslamicVideos: !!parsed.hideIslamicVideos
        };
      }
    } catch {}
    return {
      hideAudioChallenge: true, // Hidden by founder default
      hideCompletionChallenge: false,
      hideSurahChallenge: false,
      hideIslamicVideos: false
    };
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const newSettings = {
          hideAudioChallenge: !!data.hideAudioChallenge,
          hideCompletionChallenge: !!data.hideCompletionChallenge,
          hideSurahChallenge: !!data.hideSurahChallenge,
          hideIslamicVideos: !!data.hideIslamicVideos
        };
        setSystemSettings(newSettings);
        try {
          localStorage.setItem('cached_system_settings', JSON.stringify(newSettings));
        } catch {}
      }
    } catch (e) {
      console.warn('Failed to fetch settings (offline fallback active):', e);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getInitialChallenges = (): any[] => {
    try {
      const saved = localStorage.getItem('cached_challenges');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultChallenges;
  };

  const [challenges, setChallenges] = useState<any[]>(getInitialChallenges);
  const [completedChallengeIds, setCompletedChallengeIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('quran_completed_ids') || localStorage.getItem('quran_completed_challenges');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [activeListTab, setActiveListTab] = useState<'available' | 'completed'>('available');
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengesError, setChallengesError] = useState<string | null>(null);

  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('quran_player_name'));
  const [playerUsername, setPlayerUsername] = useState<string | null>(localStorage.getItem('quran_player_username'));
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState(() => parseInt(localStorage.getItem('quran_total_cups') || localStorage.getItem('quran_cups') || '0'));

  // Islamic Occasions & Sunan (مواسم الطاعات وسنن الأيام)
  const [isOccasionsModalOpen, setIsOccasionsModalOpen] = useState(false);
  const [hijriDate, setHijriDate] = useState<HijriDateInfo>(() => getHijriDate());
  const [upcomingOccasions, setUpcomingOccasions] = useState<IslamicOccasion[]>(() => getUpcomingOccasions(15));
  const [nearestOccasion, setNearestOccasion] = useState<IslamicOccasion>(() => getNearestOccasion());

  useEffect(() => {
    const h = getHijriDate();
    setHijriDate(h);
    setUpcomingOccasions(getUpcomingOccasions(15));
    setNearestOccasion(getNearestOccasion());
    syncAladhanHijri().catch(() => {});
  }, []);
  const [showProfileDecoration, setShowProfileDecoration] = useState(() => localStorage.getItem('quran_show_decoration') !== 'false');
  const [userCertificates, setUserCertificates] = useState<{ category: string, date: string, name: string }[]>(() => JSON.parse(localStorage.getItem('quran_user_certificates') || '[]'));
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'seerah' | 'general'>('seerah');

  // Game Gamification: Explicit Decoration State
  const [activeFrame, setActiveFrame] = useState<string | null>(() => localStorage.getItem('quran_active_frame'));
  const [isNameDecorated, setIsNameDecorated] = useState(() => localStorage.getItem('quran_name_decorated') === 'true');

  // Gamification: Achievement Style Definitions (Only official frames: seerah and general)
  const achievementStyles: Record<string, { className: string, icon: string, textColor: string }> = {
    seerah: {
      className: 'rounded-full bg-[url("/golden_seerah_achievement_frame.png")] bg-center bg-no-repeat bg-contain scale-110',
      icon: '/icons/seerah.png',
      textColor: 'from-amber-600 via-yellow-600 to-amber-700'
    },
    general: {
      className: 'rounded-full bg-[url("/golden_general_achievement_frame.png")] bg-center bg-no-repeat bg-contain scale-110',
      icon: '/icons/general.png',
      textColor: 'from-blue-600 via-sky-500 to-indigo-700'
    },
    none: {
      className: 'rounded-full bg-slate-200',
      icon: '',
      textColor: 'from-slate-600 to-slate-800'
    }
  };

  // Determine user's active achievement
  const getActiveAchievement = () => {
    // 1. Check Seerah (Full Completion: 3 groups)
    const seerahSaved = localStorage.getItem('quran_quiz_progress_seerah');
    if (seerahSaved) {
      try {
        const parsed = JSON.parse(seerahSaved);
        // Check for certificate or 3 levels reached
        const hasSeerahCert = userCertificates.some(c => c.category === 'seerah');
        if (hasSeerahCert || (parsed.easy >= 3 || parsed.hard >= 3)) return 'seerah';
      } catch { }
    }

    // 2. Check General (Full Completion: 5 groups)
    const generalSaved = localStorage.getItem('quran_quiz_progress_general');
    if (generalSaved) {
      try {
        const parsed = JSON.parse(generalSaved);
        const hasGeneralCert = userCertificates.some(c => c.category === 'general');
        if (hasGeneralCert || (parsed.easy >= 5 || parsed.hard >= 5)) return 'general';
      } catch { }
    }

    return 'none';
  };

  const userAchievement = activeFrame || getActiveAchievement();
  const safeAchievement = userAchievement && achievementStyles[userAchievement] ? userAchievement : 'none';
  const currentStyle = achievementStyles[safeAchievement];
  const isElite = safeAchievement !== 'none';

  const [leaderboard, setLeaderboard] = useState<{ name: string, cups: number, points: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('quran_leaderboard') || '[]');
    } catch {
      return [];
    }
  });

  const [totalUsersCount, setTotalUsersCount] = useState<number>(() => {
    return Number(localStorage.getItem('quran_total_users_count')) || 0;
  });

  const [userLeaderboardRank, setUserLeaderboardRank] = useState<number | null>(() => {
    const saved = localStorage.getItem('quran_user_leaderboard_rank');
    return saved ? Number(saved) : null;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
  const [selectedAdhkarCategoryId, setSelectedAdhkarCategoryId] = useState<string | null>(null);
  const [adhkarProgress, setAdhkarProgress] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [adhkarSearchQuery, setAdhkarSearchQuery] = useState('');
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [selectedSkillJuzs, setSelectedSkillJuzs] = useState<number[]>([]);
  const [selectedSkillSurahs, setSelectedSkillSurahs] = useState<string[]>([]);
  const [skillsScopeMode, setSkillsScopeMode] = useState<'juz' | 'surah'>('juz');
  const [skillSurahSearch, setSkillSurahSearch] = useState<string>('');
  const [selectedSkillCount, setSelectedSkillCount] = useState<number>(10);
  const [isJuzMenuOpen, setIsJuzMenuOpen] = useState(false);
  const [isSurahMenuOpen, setIsSurahMenuOpen] = useState(false);
  const [mushafZoomScale, setMushafZoomScale] = useState(1);
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev'>('next');
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
  const [isResignModalOpen, setIsResignModalOpen] = useState(false);
  const [isNextChallengeModalOpen, setIsNextChallengeModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [playerAuthMode, setPlayerAuthMode] = useState<'register' | 'login'>('login');
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [hasAgreedToPrivacy, setHasAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyModalInitialTab, setPrivacyModalInitialTab] = useState<'privacy' | 'terms'>('privacy');

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
  const [v1Error, setV1Error] = useState<string | null>(null);
  const [v1Polling, setV1Polling] = useState(false);
  const [v1GameModes, setV1GameModes] = useState<('audio' | 'complete' | 'surah' | 'islamic')[]>(() => {
    try {
      const saved = localStorage.getItem('cached_system_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.hideCompletionChallenge) return ['complete'];
        if (!parsed.hideSurahChallenge) return ['surah'];
        if (!parsed.hideAudioChallenge) return ['audio'];
        return ['islamic'];
      }
    } catch {}
    return ['complete'];
  });
  const [islamicRoomCategories, setIslamicRoomCategories] = useState<string[]>(['akida']);
  const [islamicRoomLevels, setIslamicRoomLevels] = useState<(1 | 2 | 3)[]>([1]);
  const [islamicRoomTopics, setIslamicRoomTopics] = useState<string[]>(['all']);
  const [showIslamicConfigModal, setShowIslamicConfigModal] = useState<boolean>(false);
  const [v1Timer, setV1Timer] = useState(false);
  const [v1QuestionCount, setV1QuestionCount] = useState(10);
  const [skillQuestionCounts, setSkillQuestionCounts] = useState<Record<'audio' | 'complete' | 'surah', number>>({
    audio: 0,
    complete: 5,
    surah: 0
  });
  const [islamicTopicQuestionCounts, setIslamicTopicQuestionCounts] = useState<Record<string, number>>({
    all: 5
  });
  const [availableSkillCounts, setAvailableSkillCounts] = useState<Record<'audio' | 'complete' | 'surah', number>>({
    audio: 0,
    complete: 0,
    surah: 0
  });
  const [v1TimePerQuestion, setV1TimePerQuestion] = useState(20);
  const [v1TransitionMode, setV1TransitionMode] = useState<'SYNC' | 'ASYNC'>('SYNC');
  const [v1RoomName, setV1RoomName] = useState<string>('');
  const [v1IsPrivate, setV1IsPrivate] = useState<boolean>(false);
  const [v1RoomPassword, setV1RoomPassword] = useState<string>('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [privateRoomModal, setPrivateRoomModal] = useState<{ isOpen: boolean; room: any | null; password: string; error?: string }>({
    isOpen: false,
    room: null,
    password: '',
    error: undefined
  });
  const [v1IsStartingRoom, setV1IsStartingRoom] = useState(false);
  const [v1Category, setV1Category] = useState<string>('');
  const [skillsType, setSkillsType] = useState<'audio' | 'complete' | 'surah'>('audio');
  const [skillsOptions, setSkillsOptions] = useState<any[]>([]);
  const [skillsCorrectAnswer, setSkillsCorrectAnswer] = useState<string>('');
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [skillsFeedback, setSkillsFeedback] = useState(false);
  const [hasAnsweredCurrentQuestion, setHasAnsweredCurrentQuestion] = useState(false);

  // Speed Challenge State
  const [speedTimeLeft, setSpeedTimeLeft] = useState(30);
  const [speedTotalTimeSpent, setSpeedTotalTimeSpent] = useState(0);
  const [isSpeedGameOver, setIsSpeedGameOver] = useState(false);
  const [surahInputs, setSurahInputs] = useState<string[]>([]);
  const [surahFeedbackData, setSurahFeedbackData] = useState<{ isFullyCorrect: boolean; correctSurahs: string[] } | null>(null);
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
  const [allChallenges, setAllChallenges] = useState<any[]>(getInitialChallenges);

  const fetchChallenges = useCallback(async (type?: string, limit?: number, excludeIds?: number[], retryCount = 0): Promise<any[]> => {
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
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (!type && !limit && (!excludeIds || excludeIds.length === 0)) {
          setAllChallenges(data);
          try {
            localStorage.setItem('cached_challenges', JSON.stringify(data));
          } catch {}
        }
        setChallenges(data);
        setChallengesError(null);
        return data;
      }
      return challenges;
    } catch (err: any) {
      if (retryCount > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchChallenges(type, limit, excludeIds, retryCount - 1);
      }
      console.warn('Network offline or server unavailable, using local/cached challenges:', err);
      // Offline fallback: load from cached_challenges or defaultChallenges
      const fallback = getInitialChallenges();
      if (!type && !limit && (!excludeIds || excludeIds.length === 0)) {
        setAllChallenges(fallback);
      }
      setChallenges(fallback);
      setChallengesError(null);
      return fallback;
    } finally {
      setChallengesLoading(false);
    }
  }, []);

  const [dbCompletionChallenges, setDbCompletionChallenges] = useState<any[]>([]);

  const fetchCompletionChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/challenges?type=COMPLETION');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDbCompletionChallenges(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch completion challenges for daily:', e);
    }
  }, []);

  // Fetch challenges from API
  useEffect(() => {
    fetchChallenges();
    fetchCompletionChallenges();
  }, [fetchChallenges, fetchCompletionChallenges]);

  const handleAdminLogin = (token: string, superAdmin?: boolean, role?: string, username?: string, id?: number, name?: string, canManageUsersFlag?: boolean) => {
    setAdminToken(token);
    setIsSuperAdmin(!!superAdmin);
    const resolvedRole = role || (superAdmin ? 'CO_FOUNDER' : 'ADMIN');
    setAdminRole(resolvedRole);
    setCanManageUsers(!!canManageUsersFlag);
    if (username) setAdminUsername(username);
    if (id) setAdminId(id);
    if (name) setAdminName(name);
    localStorage.setItem('quran_admin_token', token);
    localStorage.setItem('quran_admin_super', String(!!superAdmin));
    localStorage.setItem('quran_admin_role', resolvedRole);
    localStorage.setItem('quran_admin_can_manage_users', String(!!canManageUsersFlag));
    if (username) localStorage.setItem('quran_admin_username', username);
    if (id) localStorage.setItem('quran_admin_id', id.toString());
    if (name) localStorage.setItem('quran_admin_name', name);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setIsSuperAdmin(false);
    setAdminRole('');
    setAdminUsername('');
    setAdminName('');
    setAdminId(null);
    setCanManageUsers(false);
    localStorage.removeItem('quran_admin_token');
    localStorage.removeItem('quran_admin_super');
    localStorage.removeItem('quran_admin_role');
    localStorage.removeItem('quran_admin_username');
    localStorage.removeItem('quran_admin_name');
    localStorage.removeItem('quran_admin_id');
    localStorage.removeItem('quran_admin_can_manage_users');
    fetchChallenges(); // Refresh data after admin work
    setView('home');
  };

  useEffect(() => {
    if (!adminToken) return;
    const verifyAdmin = async () => {
      try {
        const res = await fetch('/api/admin?action=me', {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.status === 401) {
          handleAdminLogout();
        } else if (res.ok) {
          const data = await res.json();
          const serverCanManage = Boolean(data.canManageUsers);
          setCanManageUsers(serverCanManage);
          localStorage.setItem('quran_admin_can_manage_users', String(serverCanManage));
          if (data.role) {
            setAdminRole(data.role);
            localStorage.setItem('quran_admin_role', data.role);
          }
          if (data.username) {
            setAdminUsername(data.username);
            localStorage.setItem('quran_admin_username', data.username);
          }
        }
      } catch {
        // ignore
      }
    };
    verifyAdmin();
  }, [adminToken]);

  const handlePlayerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAgreedToPrivacy) {
      setRegistrationError('يرجى الموافقة على سياسة الخصوصية وشروط الاستخدام للمتابعة');
      return;
    }
    setIsRegistering(true);
    setRegistrationError(null);
    try {
      if (playerAuthMode === 'register') {
        const cleanName = nameInput.trim();
        const cleanUsername = usernameInput.trim().replace(/^@+/, '');
        const cleanPassword = passwordInput.trim();

        if (!cleanName) {
          setRegistrationError('يرجى إدخال اسمك');
          setIsRegistering(false);
          return;
        }
        if (!cleanUsername) {
          setRegistrationError('يرجى إدخال اسم المستخدم');
          setIsRegistering(false);
          return;
        }
        if (!cleanPassword) {
          setRegistrationError('يرجى إدخال كلمة المرور');
          setIsRegistering(false);
          return;
        }

        const res = await fetch('/api/player-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            name: cleanName,
            username: cleanUsername,
            password: cleanPassword
          })
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          setRegistrationError(data.error || data.message || 'فشلت عملية إنشاء الحساب');
          return;
        }

        const p = data.player;
        setPlayerName(p.name);
        setPlayerUsername(p.username);
        localStorage.setItem('quran_player_name', p.name);
        if (p.username) localStorage.setItem('quran_player_username', p.username);
      } else {
        // Login mode
        const cleanIdentifier = usernameInput.trim().replace(/^@+/, '');
        const cleanPassword = passwordInput.trim();

        if (!cleanIdentifier) {
          setRegistrationError('يرجى إدخال اسم المستخدم أو الاسم');
          setIsRegistering(false);
          return;
        }
        if (!cleanPassword) {
          setRegistrationError('يرجى إدخال كلمة المرور');
          setIsRegistering(false);
          return;
        }

        const res = await fetch('/api/player-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'login',
            username: cleanIdentifier,
            password: cleanPassword
          })
        });

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          setRegistrationError(data.error || data.message || 'بيانات الدخول غير صحيحة');
          return;
        }

        const p = data.player;
        setPlayerName(p.name);
        setPlayerUsername(p.username);
        localStorage.setItem('quran_player_name', p.name);
        if (p.username) localStorage.setItem('quran_player_username', p.username);

        // Sync player stats from database
        if (p.points !== undefined) {
          setTotalPoints(p.points);
          localStorage.setItem('quran_total_points', p.points.toString());
        }
        if (p.cups !== undefined) {
          setCups(p.cups);
          localStorage.setItem('quran_total_cups', p.cups.toString());
          localStorage.setItem('quran_cups', p.cups.toString());
        }
        if (Array.isArray(p.completedChallengeIds)) {
          setCompletedChallengeIds(new Set(p.completedChallengeIds));
          localStorage.setItem('quran_completed_ids', JSON.stringify(p.completedChallengeIds));
          localStorage.setItem('quran_completed_challenges', JSON.stringify(p.completedChallengeIds));
        }

        if (p.activeFrame === 'seerah' || p.activeFrame === 'general') {
          setActiveFrame(p.activeFrame);
          setIsNameDecorated(true);
          setShowProfileDecoration(true);
          localStorage.setItem('quran_active_frame', p.activeFrame);
          localStorage.setItem('quran_name_decorated', 'true');
          localStorage.setItem('quran_show_decoration', 'true');
        }
      }
    } catch (err: any) {
      console.error('Player auth failed:', err);
      setRegistrationError(err.message || 'تعذر الاتصال بالخادم');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStartSkillsSession = async (count: number, chosenJuzs?: number[], chosenSurahs?: string[]) => {
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

    let pool: any[] = [];
    try {
      let result = await fetchChallenges(dbType, count, excludeIds);
      // RECYCLE LOOP: If zero new questions, recycle all original challenges
      if (!result || result.length === 0) {
        console.log('App: Recycling challenges for type:', dbType);
        result = await fetchChallenges(dbType, count, []);
        // Reset completed IDs for this mode so the cycle starts fresh
        setCompletedChallengeIds(prev => {
          const next = new Set(prev);
          if (allChallenges.length > 0) {
            allChallenges
              .filter(c => (dbType === 'STANDARD' ? (!c.type || c.type === 'STANDARD' || c.type === 'AUDIO') : c.type === dbType))
              .forEach(c => next.delete(c.id));
          } else {
            next.clear();
          }
          localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(next)));
          localStorage.setItem('quran_completed_challenges', JSON.stringify(Array.from(next)));
          return next;
        });
      }
      if (result && result.length > 0) {
        pool = result;
      }
    } catch (err) {
      console.warn('Network fetch error for skills session:', err);
    }

    // In-memory fallback if server didn't return items
    if (pool.length === 0 && allChallenges.length > 0) {
      const matchesType = (c: any) => {
        if (dbType === 'STANDARD') return c.type === 'STANDARD' || c.type === 'AUDIO' || !c.type;
        return c.type === dbType;
      };
      const uncompleted = allChallenges.filter(c => matchesType(c) && !completedChallengeIds.has(c.id));
      if (uncompleted.length > 0) {
        pool = uncompleted;
      } else {
        pool = allChallenges.filter(matchesType);
      }
    }

    // 1. If specific Surahs are chosen (e.g. for completion challenge)
    if (chosenSurahs && chosenSurahs.length > 0 && pool.length > 0) {
      const isSurahMatch = (c: any) => {
        const vSurah = Array.isArray(c.verses) && c.verses[0]?.surah ? String(c.verses[0].surah).replace(/^سورة\s+/, '').trim() : '';
        const cat = c.category || '';
        const kw = c.keyword || '';
        return chosenSurahs.some(s => {
          const cleanS = s.replace(/^سورة\s+/, '').trim();
          const cleanSNorm = cleanS.replace(/[أإآ]/g, 'ا');
          if (vSurah && (vSurah === cleanS || vSurah.replace(/[أإآ]/g, 'ا') === cleanSNorm)) return true;
          if (cat && (cat.includes(cleanS) || cat.replace(/[أإآ]/g, 'ا').includes(cleanSNorm))) return true;
          if (kw && (kw.includes(cleanS) || kw.replace(/[أإآ]/g, 'ا').includes(cleanSNorm))) return true;
          return false;
        });
      };

      let surahFiltered = pool.filter(isSurahMatch);
      // If not enough questions from database, generate from local Quran dataset for those exact surahs
      if (surahFiltered.length < count && dbType === 'COMPLETION') {
        try {
          const gen = generateCompletionChallenges(count, { surahs: chosenSurahs });
          const mappedGen = gen.map((g, idx) => ({
            id: 98000 + idx,
            type: 'COMPLETION',
            keyword: g.prompt,
            verseText: g.prompt,
            text: g.prompt,
            category: g.verseSource,
            level: 'medium',
            options: g.options.map(opt => ({
              text: opt,
              isCorrect: opt === g.options[g.correctIndex]
            })),
            correctText: g.options[g.correctIndex],
            verses: [{
              id: `gen-comp-surah-${idx}`,
              number: 1,
              text: g.prompt,
              surah: g.surah || '',
              juz: g.juz || 1
            }]
          }));
          surahFiltered = [...surahFiltered, ...mappedGen];
        } catch (e) {
          console.warn('Failed to generate extra completion challenges for surahs:', e);
        }
      }
      if (surahFiltered.length > 0) {
        pool = surahFiltered;
      }
    }

    // 2. If specific Juzs are chosen (e.g. for completion challenge)
    if (chosenJuzs && chosenJuzs.length > 0 && chosenJuzs.length < 30 && pool.length > 0) {
      const isJuzMatch = (c: any) => {
        const cJuz = Array.isArray(c.verses) && c.verses[0]?.juz ? Number(c.verses[0].juz) : null;
        if (cJuz && chosenJuzs.includes(cJuz)) return true;
        if (!c.category) return false;
        return chosenJuzs.some(j => {
          const arOrdinal = JUZ_NAMES_AR[j] || '';
          return (
            (arOrdinal && c.category.includes(arOrdinal)) ||
            c.category.includes(`الجزء ${j}`) ||
            c.category.includes(`جزء ${j}`)
          );
        });
      };

      let juzFiltered = pool.filter(isJuzMatch);
      // If not enough questions from database, generate from local Quran dataset for those exact juzs
      if (juzFiltered.length < count && dbType === 'COMPLETION') {
        try {
          const gen = generateCompletionChallenges(count, { juzs: chosenJuzs });
          const mappedGen = gen.map((g, idx) => ({
            id: 97000 + idx,
            type: 'COMPLETION',
            keyword: g.prompt,
            verseText: g.prompt,
            text: g.prompt,
            category: g.verseSource,
            level: 'medium',
            options: g.options.map(opt => ({
              text: opt,
              isCorrect: opt === g.options[g.correctIndex]
            })),
            correctText: g.options[g.correctIndex],
            verses: [{
              id: `gen-comp-juz-${idx}`,
              number: 1,
              text: g.prompt,
              surah: g.surah || '',
              juz: g.juz || 1
            }]
          }));
          juzFiltered = [...juzFiltered, ...mappedGen];
        } catch (e) {
          console.warn('Failed to generate extra completion challenges for juzs:', e);
        }
      }
      if (juzFiltered.length > 0) {
        pool = juzFiltered;
      }
    }

    if (pool && pool.length > 0) {
      // Ensure we only take up to `count` questions and shuffle for variety
      const finalSelection = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
      setChallenges(finalSelection);
      if (isSpeedMode) {
        setSpeedTimeLeft(getSpeedQuestionDuration(finalSelection[0]));
      } else {
        setSpeedTimeLeft(skillsType === 'audio' ? 30 : 15);
      }
      setView('challenge');
    } else {
      setChallengesError('قاعدة البيانات فارغة حالياً لهذا النوع من التحديات أو لم يتم العثور على أسئلة للأجزاء أو السور المختارة.');
    }
  };

  useEffect(() => {
    localStorage.setItem('quran_mushaf_settings', JSON.stringify(librarySettings));
    if (librarySettings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [librarySettings]);
  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('quran_last_read_page');
      return saved ? Math.max(1, Math.min(604, parseInt(saved, 10))) : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('quran_last_read_page', currentPage.toString());
    } catch {
      // ignore
    }
  }, [currentPage]);

  const [selectedAyah, setSelectedAyah] = useState<{ surah: number; ayah: number } | null>(null);

  useEffect(() => {
    setSelectedAyah(null);
  }, [currentPage]);

  const [pageInput, setPageInput] = useState(() => currentPage.toString());

  // Sync selectedSurahId with currentPage
  useEffect(() => {
    if (selectedSurahId) {
      setCurrentPage(surahStartPages[selectedSurahId] || 1);
    }
  }, [selectedSurahId]);

  const filteredSurahsList = useMemo(() => {
    if (!skillSurahSearch.trim()) return ALL_QURAN_SURAHS;
    const cleanSearch = skillSurahSearch.trim().replace(/^سورة\s+/, '');
    const normSearch = cleanSearch.replace(/[أإآ]/g, 'ا');
    return ALL_QURAN_SURAHS.filter(s => {
      const sName = s.name.replace(/^سورة\s+/, '');
      const sNorm = sName.replace(/[أإآ]/g, 'ا');
      return sName.includes(cleanSearch) || sNorm.includes(normSearch) || String(s.id).includes(cleanSearch);
    });
  }, [skillSurahSearch]);

  const [isPageModeActive, setIsPageModeActive] = useState(false);
  const [isMushafFeaturesModalOpen, setIsMushafFeaturesModalOpen] = useState(false);
  const [isMushafFullscreen, setIsMushafFullscreen] = useState(false);
  const [areFullscreenControlsVisible, setAreFullscreenControlsVisible] = useState(true);
  const fullscreenControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetFullscreenControlsTimer = useCallback(() => {
    if (fullscreenControlsTimeoutRef.current) {
      clearTimeout(fullscreenControlsTimeoutRef.current);
    }
    setAreFullscreenControlsVisible(true);
    fullscreenControlsTimeoutRef.current = setTimeout(() => {
      setAreFullscreenControlsVisible(false);
    }, 5000);
  }, []);

  const toggleFullscreenControls = useCallback(() => {
    setAreFullscreenControlsVisible(prev => {
      if (!prev) {
        if (fullscreenControlsTimeoutRef.current) clearTimeout(fullscreenControlsTimeoutRef.current);
        fullscreenControlsTimeoutRef.current = setTimeout(() => {
          setAreFullscreenControlsVisible(false);
        }, 5000);
        return true;
      } else {
        if (fullscreenControlsTimeoutRef.current) clearTimeout(fullscreenControlsTimeoutRef.current);
        return false;
      }
    });
  }, []);

  const enterMushafFullscreen = useCallback(() => {
    setIsPageModeActive(true);
    setIsMushafFullscreen(true);
    resetFullscreenControlsTimer();
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [resetFullscreenControlsTimer]);

  const exitMushafFullscreen = useCallback(() => {
    setIsMushafFullscreen(false);
    if (fullscreenControlsTimeoutRef.current) {
      clearTimeout(fullscreenControlsTimeoutRef.current);
    }
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsMushafFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isMushafFullscreen) {
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
      return;
    }
    resetFullscreenControlsTimer();
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitMushafFullscreen();
      } else if (e.key === 'ArrowLeft') {
        if (currentPage < 604) {
          setPageTurnDirection('next');
          setCurrentPage(prev => Math.min(604, prev + 1));
          resetFullscreenControlsTimer();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentPage > 1) {
          setPageTurnDirection('prev');
          setCurrentPage(prev => Math.max(1, prev - 1));
          resetFullscreenControlsTimer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (fullscreenControlsTimeoutRef.current) {
        clearTimeout(fullscreenControlsTimeoutRef.current);
      }
    };
  }, [isMushafFullscreen, currentPage, exitMushafFullscreen, resetFullscreenControlsTimer]);

  const [challengeMode, setChallengeMode] = useState<'daily' | 'normal'>('normal');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const completionChallenges = useMemo(() => {
    // 1. Prioritize completion challenges added by the user/admin in the database
    if (dbCompletionChallenges.length > 0) {
      return dbCompletionChallenges;
    }
    const fromAll = allChallenges.filter((c: any) => c.type === 'COMPLETION');
    if (fromAll.length > 0) {
      return fromAll;
    }
    // 2. Fallback: generated challenges from local Quran dataset if none added yet
    try {
      const generated = generateCompletionChallenges(50);
      return generated.map((c, idx) => ({
        id: 99000 + idx,
        type: 'COMPLETION',
        keyword: c.prompt,
        verseText: c.prompt,
        text: c.prompt,
        options: c.options.map(opt => ({
          text: opt,
          isCorrect: opt === c.options[c.correctIndex]
        })),
        correctText: c.options[c.correctIndex],
        verses: [{
          id: `gen-comp-${idx}`,
          number: 1,
          text: c.prompt,
          surah: c.verseSource
        }]
      }));
    } catch (e) {
      console.warn('Fallback generator failed:', e);
      return [];
    }
  }, [dbCompletionChallenges, allChallenges]);

  const dailyChallengeIndex = useMemo(() => {
    const pool = completionChallenges.length > 0 ? completionChallenges : challenges;
    if (pool.length === 0) return 0;
    const today = new Date();
    const daysSinceEpoch = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    return Math.abs(daysSinceEpoch) % pool.length;
  }, [completionChallenges, challenges]);

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
    if (challengeMode === 'daily') {
      if (completionChallenges.length > 0) {
        return completionChallenges[dailyChallengeIndex % completionChallenges.length];
      }
      return challenges[dailyChallengeIndex] || null;
    }
    if (challenges.length === 0) return null;
    return challenges[currentChallengeIndex];
  }, [view, challenges, room?.challenges, challengeMode, dailyChallengeIndex, currentChallengeIndex, completionChallenges]);

  const KEYWORD = currentChallenge?.verseText || currentChallenge?.text || currentChallenge?.keyword || '';

  // Normalize DB gameMode (STANDARD/COMPLETION/SURAH) to frontend values (audio/complete/surah)
  const roomGameMode = useMemo((): 'audio' | 'complete' | 'surah' => {
    const qType = (currentChallenge?.type || '').toUpperCase();
    if (qType === 'SURAH') return 'surah';
    if (qType === 'COMPLETION') return 'complete';
    if (qType === 'STANDARD' || qType === 'AUDIO') return 'audio';

    const raw = (room?.gameMode || '').toUpperCase();
    if (raw === 'COMPLETION' || raw === 'ISLAMIC') return 'complete';
    if (raw === 'SURAH') return 'surah';
    return 'audio'; // STANDARD, AUDIO, or empty defaults to audio
  }, [room?.gameMode, currentChallenge?.type]);

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
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [streakInfo, setStreakInfo] = useState<StreakInfo>(() => calculateStreakInfo(0, '', null));
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

    const syncStreak = () => {
      const savedStreak = parseInt(localStorage.getItem('quran_streak') || '0');
      const lastPlayed = localStorage.getItem('quran_last_played') || '';
      const lastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
      const info = calculateStreakInfo(savedStreak, lastPlayed, lastPlayedTimeStr);
      setStreak(info.streak);
      setLastPlayedDate(info.lastPlayedDate);
      setStreakInfo(info);
      if (info.streak === 0 && savedStreak > 0) {
        localStorage.setItem('quran_streak', '0');
      }
    };

    syncStreak();
    const interval = setInterval(syncStreak, 1000);

    const savedIncomplete = localStorage.getItem('quran_incomplete_challenge');
    if (savedIncomplete) {
      setIncompleteChallenge(JSON.parse(savedIncomplete));
    }

    setMotivationalQuote(MOTIVATIONAL_HADITHS[Math.floor(Math.random() * MOTIVATIONAL_HADITHS.length)]);
    return () => clearInterval(interval);
  }, [MOTIVATIONAL_HADITHS]);

  const updateStatsAfterWin = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = Date.now();
    const savedLastPlayedTimeStr = localStorage.getItem('quran_last_played_time');
    const savedStreak = parseInt(localStorage.getItem('quran_streak') || streak.toString());

    const currentInfo = calculateStreakInfo(savedStreak, lastPlayedDate, savedLastPlayedTimeStr);

    let newStreak = currentInfo.streak;

    if (currentInfo.status === 'zero' || newStreak === 0) {
      newStreak = 1;
    } else if (currentInfo.status === 'warning') {
      // Completed within the 12-hour grace period! Restores & increases streak!
      newStreak = currentInfo.streak + 1;
    } else if (currentInfo.status === 'active') {
      if (lastPlayedDate !== today) {
        newStreak = currentInfo.streak + 1;
      }
    }

    setStreak(newStreak);
    setLastPlayedDate(today);
    localStorage.setItem('quran_streak', newStreak.toString());
    localStorage.setItem('quran_last_played', today);
    localStorage.setItem('quran_last_played_time', nowTime.toString());

    const updatedInfo = calculateStreakInfo(newStreak, today, nowTime.toString());
    setStreakInfo(updatedInfo);

    const newTotalPoints = totalPoints + score;
    setTotalPoints(newTotalPoints);
    localStorage.setItem('quran_total_points', newTotalPoints.toString());

    const hasSeerah = userCertificates.some(c => c.category === 'seerah');
    const hasGeneral = userCertificates.some(c => c.category === 'general');
    const effectiveFrame = (activeFrame === 'seerah' || activeFrame === 'general')
      ? activeFrame
      : (hasGeneral ? 'general' : (hasSeerah ? 'seerah' : null));

    // Sync completion status with backend
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        score: newTotalPoints,
        totalPoints: newTotalPoints,
        seerahCompleted: hasSeerah,
        generalCompleted: hasGeneral,
        activeFrame: effectiveFrame
      })
    }).catch(err => console.error('Failed to sync quiz completion:', err));

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

  // Check for 1v1 room ID in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetRoomId = params.get('roomId') || params.get('room') || params.get('code');

    if (targetRoomId && playerName) {
      handleJoinV1(targetRoomId);
    }
  }, [playerName]);

  const fetchAvailableRooms = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/1v1?action=list-rooms');
      const data = await res.json();
      if (res.ok && Array.isArray(data.rooms)) {
        setAvailableRooms(data.rooms);
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    } finally {
      if (showLoading) setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'group_join') {
      fetchAvailableRooms(true);
      const timer = setInterval(() => {
        fetchAvailableRooms(false);
      }, 3500);
      return () => clearInterval(timer);
    }
  }, [view, fetchAvailableRooms]);

  const fetchAvailableSkillCounts = useCallback(async () => {
    const audioLocal = allChallenges.filter(c => {
      const t = (c.type || '').toUpperCase();
      return t === 'STANDARD' || t === 'AUDIO' || t === '';
    }).length;
    const completeLocal = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION').length;
    const surahLocal = allChallenges.filter(c => (c.type || '').toUpperCase() === 'SURAH').length;

    setAvailableSkillCounts({
      audio: audioLocal,
      complete: completeLocal,
      surah: surahLocal
    });

    try {
      const res = await fetch('/api/1v1?action=available-counts');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setAvailableSkillCounts({
            audio: Math.max(audioLocal, Number(data.counts.audio) || 0),
            complete: Math.max(completeLocal, Number(data.counts.complete) || 0),
            surah: Math.max(surahLocal, Number(data.counts.surah) || 0)
          });
        }
      }
    } catch {
      // Fallback already set
    }
  }, [allChallenges]);

  useEffect(() => {
    if (view === 'group_create') {
      fetchAvailableSkillCounts();
    }
  }, [view, fetchAvailableSkillCounts]);

  // Synchronize v1GameModes and counts with systemSettings (remove any hidden challenges)
  useEffect(() => {
    setV1GameModes(prev => {
      const filtered = prev.filter(m => {
        if (m === 'audio' && systemSettings.hideAudioChallenge) return false;
        if (m === 'complete' && systemSettings.hideCompletionChallenge) return false;
        if (m === 'surah' && systemSettings.hideSurahChallenge) return false;
        return true;
      });
      if (filtered.length > 0) return filtered;
      if (!systemSettings.hideCompletionChallenge) return ['complete'];
      if (!systemSettings.hideSurahChallenge) return ['surah'];
      if (!systemSettings.hideAudioChallenge) return ['audio'];
      return ['islamic'];
    });

    setSkillQuestionCounts(prev => ({
      audio: systemSettings.hideAudioChallenge ? 0 : prev.audio,
      complete: systemSettings.hideCompletionChallenge ? 0 : prev.complete,
      surah: systemSettings.hideSurahChallenge ? 0 : prev.surah
    }));
  }, [systemSettings.hideAudioChallenge, systemSettings.hideCompletionChallenge, systemSettings.hideSurahChallenge]);

  const totalConfiguredQuestions = useMemo(() => {
    let sum = 0;
    if (v1GameModes.includes('audio') && !systemSettings.hideAudioChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.audio) || 0);
    }
    if (v1GameModes.includes('complete') && !systemSettings.hideCompletionChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.complete) || 0);
    }
    if (v1GameModes.includes('surah') && !systemSettings.hideSurahChallenge) {
      sum += Math.max(0, Number(skillQuestionCounts.surah) || 0);
    }
    if (v1GameModes.includes('islamic')) {
      if (islamicRoomTopics.includes('all')) {
        sum += Math.max(0, Number(islamicTopicQuestionCounts['all']) || 0);
      } else {
        islamicRoomTopics.forEach(t => {
          sum += Math.max(0, Number(islamicTopicQuestionCounts[t]) || 0);
        });
      }
    }
    return sum;
  }, [v1GameModes, skillQuestionCounts, islamicRoomTopics, islamicTopicQuestionCounts, systemSettings]);

  const hasCountValidationErrors = useMemo(() => {
    for (const skill of ['audio', 'complete', 'surah'] as const) {
      const isHidden = 
        (skill === 'audio' && systemSettings.hideAudioChallenge) ||
        (skill === 'complete' && systemSettings.hideCompletionChallenge) ||
        (skill === 'surah' && systemSettings.hideSurahChallenge);

      if (v1GameModes.includes(skill) && !isHidden) {
        const count = Number(skillQuestionCounts[skill]) || 0;
        const max = availableSkillCounts[skill] || 0;
        if (count <= 0 || (max > 0 && count > max)) {
          return true;
        }
      }
    }
    if (v1GameModes.includes('islamic')) {
      if (islamicRoomTopics.includes('all')) {
        const count = Number(islamicTopicQuestionCounts['all']) || 0;
        const max = getTotalIslamicAvailableCount(islamicRoomCategories, islamicRoomLevels, ['all']);
        if (count <= 0 || (max > 0 && count > max)) {
          return true;
        }
      } else {
        if (islamicRoomTopics.length === 0) return true;
        for (const t of islamicRoomTopics) {
          const count = Number(islamicTopicQuestionCounts[t]) || 0;
          const max = getIslamicTopicAvailableCount(t, undefined, islamicRoomLevels);
          if (count <= 0 || (max > 0 && count > max)) {
            return true;
          }
        }
      }
    }
    return false;
  }, [v1GameModes, skillQuestionCounts, availableSkillCounts, islamicRoomTopics, islamicTopicQuestionCounts, islamicRoomCategories, islamicRoomLevels, systemSettings]);

  const handleJoinV1 = async (roomId: string, password?: string) => {
    if (!playerName) {
      toast.error('يرجى تسجيل اسمك أولاً للانضمام');
      return;
    }
    setIsJoiningRoom(true);
    setV1Error(null);
    if (privateRoomModal.isOpen) {
      setPrivateRoomModal(prev => ({ ...prev, error: undefined }));
    }
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'join', 
          roomId,
          code: roomId,
          player2Id: playerUsername || playerName,
          password: password ? password.trim() : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data);
        setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined });
        if (data.status === 'PLAYING') {
          const roomMode = data.gameMode === 'STANDARD' ? 'audio' : (data.gameMode === 'COMPLETION' || data.gameMode === 'ISLAMIC') ? 'complete' : 'surah';
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
        const errMsg = data.message || 'فشل الانضمام للتحدي';
        if (privateRoomModal.isOpen) {
          setPrivateRoomModal(prev => ({ ...prev, error: errMsg }));
        } else {
          setV1Error(errMsg);
          toast.error(errMsg);
        }
      }
    } catch (err) {
      const errMsg = 'حدث خطأ في الاتصال';
      if (privateRoomModal.isOpen) {
        setPrivateRoomModal(prev => ({ ...prev, error: errMsg }));
      } else {
        setV1Error(errMsg);
        toast.error(errMsg);
      }
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateV1 = async () => {
    if (!playerName) return;
    if (v1IsPrivate && !v1RoomPassword.trim()) {
      toast.error('يرجى كتابة كلمة المرور للغرفة الخاصة');
      return;
    }
    if (totalConfiguredQuestions <= 0) {
      toast.error('يرجى تحديد عدد الأسئلة لمهارة واحدة على الأقل');
      return;
    }
    if (hasCountValidationErrors) {
      toast.error('يرجى تصحيح الأعداد التي تتجاوز الحد المتاح');
      return;
    }
    setIsCreatingRoom(true);
    setV1Error(null);
    try {
      const effectiveGameModes = v1GameModes.filter(m => {
        if (m === 'audio' && systemSettings.hideAudioChallenge) return false;
        if (m === 'complete' && systemSettings.hideCompletionChallenge) return false;
        if (m === 'surah' && systemSettings.hideSurahChallenge) return false;
        return true;
      });

      const isIslamicIncluded = effectiveGameModes.includes('islamic');
      const count = totalConfiguredQuestions;

      let customChallenges: any[] = [];

      // 1. Audio challenges
      if (effectiveGameModes.includes('audio') && !systemSettings.hideAudioChallenge) {
        const audioCount = Math.max(0, Number(skillQuestionCounts.audio) || 0);
        if (audioCount > 0) {
          const pool = allChallenges.filter(c => {
            const t = (c.type || '').toUpperCase();
            return t === 'STANDARD' || t === 'AUDIO' || t === '';
          });
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, audioCount);
          customChallenges.push(...picked);
        }
      }

      // 2. Completion challenges
      if (effectiveGameModes.includes('complete') && !systemSettings.hideCompletionChallenge) {
        const completeCount = Math.max(0, Number(skillQuestionCounts.complete) || 0);
        if (completeCount > 0) {
          const pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'COMPLETION');
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, completeCount);
          customChallenges.push(...picked);
        }
      }

      // 3. Surah challenges
      if (effectiveGameModes.includes('surah') && !systemSettings.hideSurahChallenge) {
        const surahCount = Math.max(0, Number(skillQuestionCounts.surah) || 0);
        if (surahCount > 0) {
          const pool = allChallenges.filter(c => (c.type || '').toUpperCase() === 'SURAH');
          const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, surahCount);
          customChallenges.push(...picked);
        }
      }

      // 4. Targeted Islamic questions
      if (isIslamicIncluded) {
        const allocations: Record<string, number> = {};
        if (islamicRoomTopics.includes('all')) {
          allocations['all'] = Math.max(0, Number(islamicTopicQuestionCounts['all']) || 0);
        } else {
          islamicRoomTopics.forEach(t => {
            allocations[t] = Math.max(0, Number(islamicTopicQuestionCounts[t]) || 0);
          });
        }
        const islamicQs = getTargetedIslamicQuestions(allocations, islamicRoomLevels, islamicRoomCategories);
        customChallenges.push(...islamicQs);
      }

      // 5. Shuffle all questions randomly
      const finalCustomChallenges = [...customChallenges].sort(() => Math.random() - 0.5);

      const requestBody = {
        action: 'create',
        player1Id: playerUsername || playerName,
        player1Name: playerName,
        name: v1RoomName.trim() || 'غرفة التحدي',
        isPrivate: v1IsPrivate,
        password: v1IsPrivate ? v1RoomPassword.trim() : null,
        gameMode: effectiveGameModes.length === 1 
          ? (effectiveGameModes[0] === 'islamic' ? 'ISLAMIC' : effectiveGameModes[0] === 'audio' ? 'STANDARD' : effectiveGameModes[0] === 'complete' ? 'COMPLETION' : 'SURAH')
          : 'MIXED',
        gameModes: effectiveGameModes.map(m => m === 'islamic' ? 'ISLAMIC' : m === 'audio' ? 'STANDARD' : m === 'complete' ? 'COMPLETION' : 'SURAH'),
        categories: isIslamicIncluded ? islamicRoomCategories : (v1Category ? [v1Category] : []),
        category: isIslamicIncluded ? islamicRoomCategories[0] : v1Category,
        levels: isIslamicIncluded ? islamicRoomLevels : undefined,
        topics: isIslamicIncluded ? islamicRoomTopics : undefined,
        questionCount: count,
        timePerQuestion: v1Timer ? v1TimePerQuestion : 0,
        transitionMode: v1TransitionMode,
        customChallenges: finalCustomChallenges
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

        const firstQ = mapped[0];
        const mode = firstQ?.type === 'SURAH' ? 'surah' : (firstQ?.type === 'STANDARD' || firstQ?.type === 'AUDIO') ? 'audio' : 'complete';
        setSkillsType(mode);
        setRoom(data);
        const roomTime = (data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0;
        if (roomTime > 0) {
          setSpeedTimeLeft(roomTime);
        }
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

  const handleRoomTimeout = async () => {
    if (!room?.id) return;
    if (room.transitionMode === 'ASYNC') {
      // In ASYNC mode: player timed out on their individual question
      try {
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: currentChallengeIndex,
            isCorrect: false,
            timestamp: Date.now()
          })
        }).catch(err => console.error('Error submitting ASYNC timeout answer:', err));
        moveToNextQuestion();
      } catch (err) {
        console.error('Error in ASYNC timeout:', err);
      }
      return;
    }

    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advance-question',
          roomId: room.id,
          questionIndex: room.currentQuestionIndex ?? currentChallengeIndex
        })
      });
      const data = await res.json();
      if (res.ok && data) {
        setRoom(data);
        if (data.status === 'FINISHED') {
          setView('group_game');
        } else if (data.currentQuestionIndex > currentChallengeIndex) {
          setCurrentChallengeIndex(data.currentQuestionIndex);
          setHasAnsweredCurrentQuestion(false);
          setSkillsFeedback(false);
          setSelectedOption(null);
          setMatchedIds(new Set());
          setSurahFeedbackData(null);
          setSpeedTimeLeft((data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0);
          const nextQ = challenges[data.currentQuestionIndex] || data.challenges?.[data.currentQuestionIndex];
          if (nextQ) {
            const mode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
            setSkillsType(mode);
          }
        }
      }
    } catch (err) {
      console.error('Error in handleRoomTimeout:', err);
    }
  };

  // Poll room status
  useEffect(() => {
    if (!room?.id || (view !== 'group_waiting' && view !== 'group_game' && view !== 'challenge')) return;
    if (room.status === 'FINISHED' && view === 'group_game') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/1v1?action=poll&roomId=${room.id}`);
        const data = await res.json();
        if (res.ok) {
          prevParticipantsCount.current = data.participants?.length || 0;

          // If room finished, switch to group_game results
          if (data.status === 'FINISHED') {
            setRoom(data);
            if (view !== 'group_game') {
              setView('group_game');
            }
            return;
          }

          // Initial start from waiting room
          if (view === 'group_waiting' && data.status === 'PLAYING') {
            const mapped = (data.challenges || []).map((q: any) => ({ ...q, verseText: q.verseText || q.keyword || q.text }));
            const firstQ = mapped[0];
            const roomMode = firstQ?.type === 'SURAH' ? 'surah' : (firstQ?.type === 'STANDARD' || firstQ?.type === 'AUDIO') ? 'audio' : 'complete';
            setSkillsType(roomMode);
            setChallenges(mapped);
            setChallengesLoading(false);
            setCurrentChallengeIndex(data.currentQuestionIndex || 0);
            setSessionCorrect(0);
            setSessionWrong(0);
            setSessionMistakes([]);
            setSkillsFeedback(false);
            setHasAnsweredCurrentQuestion(false);
            setSelectedOption(null);
            setMatchedIds(new Set());

            const roomTime = (data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0;
            if (roomTime > 0) {
              setSpeedTimeLeft(roomTime);
            }

            setView('challenge');
          } else if (view === 'challenge' && data.status === 'PLAYING') {
            if (data.transitionMode === 'ASYNC') {
              // In ASYNC mode, keep room data updated without overriding player's local question position
              setRoom(data);
            } else {
              // In SYNC mode: Check if server advanced to next question
              if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
                setCurrentChallengeIndex(data.currentQuestionIndex);
                setHasAnsweredCurrentQuestion(false);
                setSkillsFeedback(false);
                setSelectedOption(null);
                setMatchedIds(new Set());
                setSurahFeedbackData(null);
                const roomTime = (data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0;
                setSpeedTimeLeft(roomTime);

                const nextQ = challenges[data.currentQuestionIndex] || data.challenges?.[data.currentQuestionIndex];
                if (nextQ) {
                  const mode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
                  setSkillsType(mode);
                }
              } else {
                // Check if user's answer is recorded
                const myPId = String(data.participants?.find((p: any) => p.name === playerName || p.username === playerUsername)?.id);
                if (data.currentAnswers && myPId && data.currentAnswers[myPId] && !hasAnsweredCurrentQuestion) {
                  setHasAnsweredCurrentQuestion(true);
                  setSkillsFeedback(true);
                }
              }
              setRoom(data);
            }
          } else {
            setRoom(data);
          }
        } else {
          console.error('Polling API Error:', data.message || 'Unknown error');
        }
      } catch (err) {
        console.error('Polling Network/Runtime Error:', err);
      }
    };

    const interval = setInterval(poll, 1000); // Poll every 1 second for real-time multiplayer sync
    return () => clearInterval(interval);
  }, [room?.id, view, room?.status, currentChallengeIndex, playerName, playerUsername, hasAnsweredCurrentQuestion, challenges]);

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
          playerId: playerUsername || playerName,
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

  const handleResignGroupChallenge = async () => {
    if (!room?.id || (!playerUsername && !playerName)) return;
    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resign',
          roomId: room.id,
          playerId: playerUsername || playerName
        })
      });
      const data = await res.json();
      if (res.ok) setRoom(data);
    } catch (err) {
      console.error('Group resign error:', err);
    }
    setSessionCorrect(0);
    setView('group_game');
    setIsResignModalOpen(false);
  };
  // Speed & Multiplayer Timer
  useEffect(() => {
    let interval: any;
    const hasRoomTimer = !!(room && (room.timePerQuestion || 0) > 0);
    const isActive = room 
      ? (view === 'challenge' && hasRoomTimer && !isComplete && room.status === 'PLAYING')
      : ((view === 'speed_challenge' || (view === 'challenge' && isSpeedMode)) && !isSpeedGameOver && !isComplete && !skillsFeedback);

    if (isActive) {
      interval = setInterval(() => {
        setSpeedTimeLeft((prev) => {
          if (prev <= 1) {
            if (room) {
              handleRoomTimeout();
            } else if (view === 'speed_challenge') {
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
  }, [view, isSpeedGameOver, isComplete, isSpeedMode, stopListening, skillsFeedback, room?.timePerQuestion, room?.id, room?.status, currentChallengeIndex]);

  // Reset Speed timer on each match
  useEffect(() => {
    if (view === 'speed_challenge' && !isSpeedGameOver && matchedIds.size > 0 && !isComplete) {
      const qDuration = getSpeedQuestionDuration(currentChallenge);
      const timeTaken = Math.max(0, qDuration - speedTimeLeft);
      setSpeedTotalTimeSpent(prev => prev + timeTaken);
      setSpeedTimeLeft(qDuration);
    }
  }, [matchedIds.size, view, isSpeedGameOver, isComplete, currentChallenge]);

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
      const qDuration = getSpeedQuestionDuration(currentChallenge);
      const timeTaken = Math.max(0, qDuration - speedTimeLeft);
      setSpeedTotalTimeSpent(prev => prev + timeTaken);

      const timer = setTimeout(() => {
        const nextIdx = Math.floor(Math.random() * challenges.length);
        setCurrentChallengeIndex(nextIdx);
        setSpeedTimeLeft(getSpeedQuestionDuration(challenges[nextIdx]));
        setMatchedIds(new Set());
        setWordStates({});
        resetTranscript();
        setSpeedStartTime(Date.now());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, view, isSpeedGameOver, challenges.length, speedTimeLeft, resetTranscript, currentChallenge]);

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
    setSkillsType('complete');
    setSelectedOption(null);
    setSkillsFeedback(false);
    setView('challenge');

    // Save as incomplete if not finished
    const activeDaily = completionChallenges.length > 0
      ? completionChallenges[dailyChallengeIndex % completionChallenges.length]
      : challenges[dailyChallengeIndex];
    const firstVerse = activeDaily?.verses?.[0];
    const info = { index: dailyChallengeIndex, mode: 'daily' as const, surah: firstVerse?.surah || activeDaily?.keyword || '' };
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
    setSpeedTimeLeft(getSpeedQuestionDuration(challenges[randomIdx]));
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
    if (room?.id) {
      handleRoomTimeout();
      return;
    }
    if (skillsFeedback || isComplete) return;

    const isSurah = skillsType === 'surah' || (room && roomGameMode === 'surah');
    const isAudio = skillsType === 'audio' || (room && roomGameMode === 'audio');

    if (isSurah) {
      handleSubmitSurah();
    } else if (isAudio) {
      const currentQuestion = currentChallenge;
      if (!currentQuestion) return;
      setSkillsFeedback(true);
      setTimeout(() => {
        moveToNextQuestion();
      }, 1000);
    } else {
      handleConfirmAnswer();
    }
  };

  const moveToNextQuestion = () => {
    setSkillsFeedback(false);
    setSelectedOption(null);
    setSurahFeedbackData(null);

    const challengesLength = challenges.length || room?.challenges?.length || 0;

    if (currentChallengeIndex >= challengesLength - 1) {
      if (room) {
        syncGroupProgress(true);
      }
      if (view === 'challenge') {
        if (room) {
          setView('group_game'); // Show leaderboard at end
        } else {
          // Award a cup if the session was completed with correct answers!
          if (sessionCorrect > 0) {
            setCups(prev => {
              const nextCups = prev + 1;
              localStorage.setItem('quran_total_cups', nextCups.toString());
              localStorage.setItem('quran_cups', nextCups.toString());
              return nextCups;
            });
            if (playerUsername || playerName) {
              fetch('/api/player-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username: playerUsername,
                  name: playerName,
                  cups: 1,
                  totalCups: cups + 1,
                  totalPoints: totalPoints
                })
              }).catch(err => console.error('Failed to sync cup on session complete:', err));
            }
          }
          setView('skills_results');
        }
      }
      return;
    }

    if (room) {
      syncGroupProgress(false);
    }

    setCurrentChallengeIndex(prev => prev + 1);
    setSessionCurrentIndex(prev => prev + 1);
    setMatchedIds(new Set());
    setWordStates({});
    const isAudio = skillsType === 'audio' || roomGameMode === 'audio';
    const roomTime = (room && (room.timePerQuestion || 0) > 0) ? room.timePerQuestion : 0;
    const nextQ = challenges[currentChallengeIndex + 1];
    if (room && nextQ?.type) {
      const nextMode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
      setSkillsType(nextMode);
    }
    const nextTime = isSpeedMode ? getSpeedQuestionDuration(nextQ) : (isAudio ? 30 : 15);
    setSpeedTimeLeft(roomTime > 0 ? roomTime : nextTime);
    resetTranscript();
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
      let rawCorrect = currentQuestion.correctText || "";
      if (!rawCorrect && skillsOptions && Array.isArray(skillsOptions)) {
        const correctOpt = skillsOptions.find(o => o.isCorrect);
        if (correctOpt) rawCorrect = correctOpt.text;
      }
      if (!rawCorrect && currentQuestion.options && Array.isArray(currentQuestion.options)) {
        const correctOpt = currentQuestion.options.find((o: any) => o.isCorrect);
        if (correctOpt) rawCorrect = typeof correctOpt === 'object' ? correctOpt.text : correctOpt;
      }

      const isObjectCorrect = selectedOption && typeof selectedOption === 'object' && selectedOption.isCorrect === true;
      const isTextMatch = !!(
        (rawSelected && rawCorrect && superNormalizeArabic(rawSelected) === superNormalizeArabic(rawCorrect)) ||
        (rawSelected && rawCorrect && String(rawSelected).trim().includes(String(rawCorrect).trim()))
      );

      const isCorrect = isObjectCorrect || isTextMatch;
      const answer = rawSelected || "لم يتم اختيار إجابة (انتهى الوقت)";

      if (isCorrect) {
        setSessionCorrect(prev => prev + 1);

        const earnedPoints = 10;
        setTotalPoints(prev => {
          const next = prev + earnedPoints;
          localStorage.setItem('quran_total_points', next.toString());
          return next;
        });

        if (playerUsername || playerName) {
          fetch('/api/player-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: playerUsername,
              name: playerName,
              points: earnedPoints,
              totalPoints: totalPoints + earnedPoints,
              challengeId: currentQuestion?.id,
              roomId: room?.id
            })
          }).catch(err => console.error('Failed to sync score:', err));
        }

        if (view === 'group_game') {
          syncGroupProgress(false, sessionCorrect + 1);
        }
        if (window.navigator.vibrate) window.navigator.vibrate(50);

        if ((view === 'group_game' || challengeMode === 'daily') && (targetVerses.length > 0 || currentQuestion.verses)) {
          const allVerseIds = targetVerses.length > 0
            ? targetVerses.map((v: any) => v.id)
            : currentQuestion.verses.map((v: any) => v.id);
          setMatchedIds(new Set(allVerseIds));
        }

        if (currentQuestion?.id) {
          setCompletedChallengeIds(prev => {
            const next = new Set(prev);
            next.add(currentQuestion.id);
            localStorage.setItem('quran_completed_ids', JSON.stringify(Array.from(next)));
            localStorage.setItem('quran_completed_challenges', JSON.stringify(Array.from(next)));
            return next;
          });
        }

        if (challengeMode === 'daily') {
          setSkillsFeedback(false);
          return;
        }
      } else {
        setSessionWrong(prev => prev + 1);
        if (window.navigator.vibrate) window.navigator.vibrate(200);
        setSessionMistakes(prev => [...prev, {
          challenge: currentQuestion,
          keyword: currentQuestion.keyword || currentQuestion.verseText || currentQuestion.text || "",
          userAnswer: answer || "لا يوجد إجابة",
          correctAnswer: rawCorrect,
          correctText: rawCorrect,
          type: currentQuestion.type || 'COMPLETION',
          isFullyCorrect: false,
          pointsEarned: 0,
          totalPossible: 1
        }]);

        if (challengeMode === 'daily') {
          setTimeout(() => {
            setSkillsFeedback(false);
            setSelectedOption(null);
          }, 1200);
          return;
        }
      }

      if (room?.id) {
        if (room.transitionMode === 'ASYNC') {
          fetch('/api/1v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'submit-answer',
              roomId: room.id,
              playerId: playerUsername || playerName,
              questionIndex: currentChallengeIndex,
              isCorrect,
              timestamp: Date.now()
            })
          }).then(res => res.json()).then(data => {
            if (data && data.status) {
              setRoom(data);
              if (data.status === 'FINISHED') {
                setView('group_game');
              }
            }
          }).catch(err => console.error('Error submitting ASYNC room answer:', err));

          const advanceDelay = isCorrect ? 900 : 1500;
          setTimeout(() => {
            moveToNextQuestion();
          }, advanceDelay);
          return;
        }

        setHasAnsweredCurrentQuestion(true);
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
            isCorrect,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
            if (data.status === 'FINISHED') {
              setView('group_game');
            } else if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
              setCurrentChallengeIndex(data.currentQuestionIndex);
              setHasAnsweredCurrentQuestion(false);
              setSkillsFeedback(false);
              setSelectedOption(null);
              setMatchedIds(new Set());
              setSurahFeedbackData(null);
              setSpeedTimeLeft((data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0);
              const nextQ = challenges[data.currentQuestionIndex] || data.challenges?.[data.currentQuestionIndex];
              if (nextQ) {
                const mode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
                setSkillsType(mode);
              }
            }
          }
        }).catch(err => console.error('Error submitting room answer:', err));
        return;
      }

      const advanceDelay = isCorrect ? 1000 : 2500;
      setTimeout(() => {
        moveToNextQuestion();
      }, advanceDelay);
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
      setSessionCorrect(prev => prev + 1);

      const earnedPoints = 10;
      setTotalPoints(prev => {
        const next = prev + earnedPoints;
        localStorage.setItem('quran_total_points', next.toString());
        return next;
      });

      if (playerUsername || playerName) {
        fetch('/api/player-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: playerUsername,
            name: playerName,
            points: earnedPoints,
            totalPoints: totalPoints + earnedPoints,
            challengeId: currentQuestion?.id,
            roomId: room?.id
          })
        }).catch(err => console.error('Failed to sync score:', err));
      }

      if (view === 'group_game') {
        syncGroupProgress(false, sessionCorrect + 1);
      }
      if (view === 'group_game' && currentQuestion.verses) {
        const allVerseIds = currentQuestion.verses.map((v: any) => v.id);
        setMatchedIds(new Set(allVerseIds));
      }
    } else {
      setSessionWrong(prev => prev + 1);
    }

    setSurahFeedbackData({
      isFullyCorrect,
      correctSurahs
    });

    setSessionMistakes(prev => [...prev, {
      challenge: currentQuestion,
      text: currentQuestion.keyword || "",
      keyword: currentQuestion.keyword || "",
      type: 'SURAH',
      userInputs: [...surahInputs],
      correctSurahsList: correctSurahs,
      pointsEarned: correctCount,
      totalPossible: correctSurahs.length,
      isFullyCorrect
    }]);

    // 4. Auto-advance in single-player, or submit in multiplayer
    if (room?.id) {
      if (room.transitionMode === 'ASYNC') {
        fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit-answer',
            roomId: room.id,
            playerId: playerUsername || playerName,
            questionIndex: currentChallengeIndex,
            isCorrect: isFullyCorrect,
            timestamp: Date.now()
          })
        }).then(res => res.json()).then(data => {
          if (data && data.status) {
            setRoom(data);
            if (data.status === 'FINISHED') {
              setView('group_game');
            }
          }
        }).catch(err => console.error('Error submitting room surah answer:', err));

        const advanceDelay = isFullyCorrect ? 900 : 1800;
        setTimeout(() => {
          moveToNextQuestion();
        }, advanceDelay);
        return;
      }

      setHasAnsweredCurrentQuestion(true);
      fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          roomId: room.id,
          playerId: playerUsername || playerName,
          questionIndex: room.currentQuestionIndex ?? currentChallengeIndex,
          isCorrect: isFullyCorrect,
          timestamp: Date.now()
        })
      }).then(res => res.json()).then(data => {
        if (data && data.status) {
          setRoom(data);
          if (data.status === 'FINISHED') {
            setView('group_game');
          } else if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex > currentChallengeIndex) {
            setCurrentChallengeIndex(data.currentQuestionIndex);
            setHasAnsweredCurrentQuestion(false);
            setSkillsFeedback(false);
            setSelectedOption(null);
            setMatchedIds(new Set());
            setSurahFeedbackData(null);
            setSpeedTimeLeft((data.timePerQuestion && data.timePerQuestion > 0) ? data.timePerQuestion : 0);
            const nextQ = challenges[data.currentQuestionIndex] || data.challenges?.[data.currentQuestionIndex];
            if (nextQ) {
              const mode = nextQ.type === 'SURAH' ? 'surah' : (nextQ.type === 'STANDARD' || nextQ.type === 'AUDIO') ? 'audio' : 'complete';
              setSkillsType(mode);
            }
          }
        }
      }).catch(err => console.error('Error submitting room surah answer:', err));
      return;
    }

    const advanceDelay = isFullyCorrect ? 1000 : 2500;
    setTimeout(() => {
      moveToNextQuestion();
    }, advanceDelay);
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
    if (allChallenges.length > 0) {
      setChallenges(allChallenges);
    }
  };

  const confirmExitToHome = () => {
    setView('home');
    setShowScores(false);
    resetTranscript();
    stopListening();
    setIncompleteChallenge(null);
    localStorage.removeItem('quran_incomplete_challenge');
    if (allChallenges.length > 0) {
      setChallenges(allChallenges);
    }
  };

  const handleSkip = () => {
    if (challengeMode === 'daily') return;

    // Count as mistake as requested
    const currentQuestion = currentChallenge;
    if (currentQuestion) {
      setSessionWrong(prev => prev + 1);
      let rawCorrect = currentQuestion.correctText || "";
      if (!rawCorrect && skillsOptions && Array.isArray(skillsOptions)) {
        const correctOpt = skillsOptions.find(o => o.isCorrect);
        if (correctOpt) rawCorrect = correctOpt.text;
      }
      setSessionMistakes(prev => [...prev, {
        challenge: currentQuestion,
        keyword: currentQuestion.keyword || currentQuestion.verseText || currentQuestion.text || "",
        userAnswer: "تخطي السؤال",
        correctAnswer: rawCorrect,
        correctText: rawCorrect,
        type: currentQuestion.type || (skillsType === 'complete' ? 'COMPLETION' : skillsType === 'surah' ? 'SURAH' : 'STANDARD'),
        isFullyCorrect: false,
        pointsEarned: 0,
        totalPossible: 1
      }]);
    }

    moveToNextQuestion();
  };

  const syncLeaderboard = useCallback(async () => {
    setIsSyncing(true);
    try {
      // 1. Proactive sync of achievement flags before fetching rankings
      if (playerUsername || playerName) {
        const hasSeerah = userCertificates.some(c => c.category === 'seerah') || 
                          (Boolean(localStorage.getItem('quran_quiz_progress_seerah')) && (() => {
                            try {
                              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_seerah') || '{}');
                              return (p.easy >= 3 || p.hard >= 3);
                            } catch { return false; }
                          })());
        const hasGeneral = userCertificates.some(c => c.category === 'general') || 
                          (Boolean(localStorage.getItem('quran_quiz_progress_general')) && (() => {
                            try {
                              const p = JSON.parse(localStorage.getItem('quran_quiz_progress_general') || '{}');
                              return (p.easy >= 5 || p.hard >= 5);
                            } catch { return false; }
                          })());
        const storedFrame = localStorage.getItem('quran_active_frame') || activeFrame;
        const effectiveFrame = (storedFrame === 'seerah' || storedFrame === 'general')
          ? storedFrame
          : (storedFrame === 'none' ? 'none' : (hasSeerah ? 'seerah' : (hasGeneral ? 'general' : null)));

        try {
          const scoreRes = await fetch('/api/player-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: playerName,
              username: playerUsername,
              score: totalPoints,
              totalPoints: totalPoints,
              totalCups: cups,
              seerahCompleted: hasSeerah,
              generalCompleted: hasGeneral,
              activeFrame: effectiveFrame
            })
          });
          if (scoreRes.ok) {
            const pData = await scoreRes.json();
            if (pData) {
              if (typeof pData.cups === 'number' && pData.cups > 0) {
                setCups(prev => {
                  const best = Math.max(prev, pData.cups);
                  localStorage.setItem('quran_total_cups', best.toString());
                  localStorage.setItem('quran_cups', best.toString());
                  return best;
                });
              }
              if (typeof pData.points === 'number' && pData.points > 0) {
                setTotalPoints(prev => {
                  const best = Math.max(prev, pData.points);
                  localStorage.setItem('quran_total_points', best.toString());
                  return best;
                });
              }
            }
          }
        } catch (err) {
          console.warn('Pre-fetch sync failed:', err);
        }
      }

      const params = new URLSearchParams({ t: Date.now().toString() });
      if (playerName) params.append('name', playerName);
      if (playerUsername) params.append('username', playerUsername);

      const response = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Leaderboard sync failed: ${text.substring(0, 100)}`);
      }
      const data = await response.json();
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        const seenNames = new Set<string>();
        const unique = data.leaderboard.filter((p: any) => {
          const norm = (p.name || '').trim().toLowerCase();
          if (!norm || seenNames.has(norm)) return false;
          seenNames.add(norm);
          return true;
        });
        setLeaderboard(unique);
        localStorage.setItem('quran_leaderboard', JSON.stringify(unique));

        if (typeof data.totalUsers === 'number') {
          setTotalUsersCount(data.totalUsers);
          localStorage.setItem('quran_total_users_count', data.totalUsers.toString());
        }

        if (typeof data.userRank === 'number') {
          setUserLeaderboardRank(data.userRank);
          localStorage.setItem('quran_user_leaderboard_rank', data.userRank.toString());
        } else if (data.userRank === null) {
          const localIdx = unique.findIndex((p: any) => {
            if (playerUsername && p.username && p.username.replace(/^@+/, '').toLowerCase() === playerUsername.replace(/^@+/, '').toLowerCase()) return true;
            if (playerName && p.name && p.name.trim().toLowerCase() === playerName.trim().toLowerCase()) return true;
            return false;
          });
          if (localIdx !== -1) {
            setUserLeaderboardRank(localIdx + 1);
            localStorage.setItem('quran_user_leaderboard_rank', (localIdx + 1).toString());
          }
        }

        // Synchronize cups and points from leaderboard for current player
        const myEntry = unique.find((p: any) => {
          if (playerUsername && p.username && p.username.replace(/^@+/, '').toLowerCase() === playerUsername.replace(/^@+/, '').toLowerCase()) return true;
          if (playerName && p.name && p.name.trim().toLowerCase() === playerName.trim().toLowerCase()) return true;
          return false;
        });

        if (myEntry) {
          if (typeof myEntry.cups === 'number' && myEntry.cups > 0) {
            setCups(prev => {
              const best = Math.max(prev, myEntry.cups);
              localStorage.setItem('quran_total_cups', best.toString());
              localStorage.setItem('quran_cups', best.toString());
              return best;
            });
          }
          if (typeof myEntry.points === 'number' && myEntry.points > 0) {
            setTotalPoints(prev => {
              const best = Math.max(prev, myEntry.points);
              localStorage.setItem('quran_total_points', best.toString());
              return best;
            });
          }
        }
      }
    } catch (error) {
      console.error('Leaderboard sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [playerName, playerUsername, cups, totalPoints, completedChallengeIds, activeFrame, userCertificates]);

  useEffect(() => {
    localStorage.setItem('quran_total_points', totalPoints.toString());
    localStorage.setItem('quran_cups', cups.toString());
    localStorage.setItem('quran_total_cups', cups.toString());
    localStorage.setItem('quran_leaderboard', JSON.stringify(leaderboard));
    if (playerName) localStorage.setItem('quran_player_name', playerName);
    localStorage.setItem('quran_settings', JSON.stringify(librarySettings));
  }, [totalPoints, cups, leaderboard, playerName, librarySettings]);

  useEffect(() => {
    syncLeaderboard();
  }, [activeFrame, userCertificates.length]);

  // Sync leaderboard immediately when opened or when window gains focus (Zero periodic polling on server)
  useEffect(() => {
    if (showScores) {
      syncLeaderboard();
      const onFocus = () => syncLeaderboard();
      const onVisibility = () => {
        if (document.visibilityState === 'visible') syncLeaderboard();
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  }, [showScores, syncLeaderboard]);



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
    }

    const pointsToAdd = score > 0 ? score : 10;
    const newPoints = totalPoints + pointsToAdd;
    setTotalPoints(newPoints);
    localStorage.setItem('quran_total_points', newPoints.toString());

    let newCupsCount = cups;
    if (isNewCompletion) {
      newCupsCount = cups + 1;
      setCups(newCupsCount);
      localStorage.setItem('quran_total_cups', newCupsCount.toString());
      localStorage.setItem('quran_cups', newCupsCount.toString());
    }

    // Sync with backend using player username / name
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: playerUsername,
        name: playerName,
        points: pointsToAdd,
        totalPoints: newPoints,
        cups: isNewCompletion ? 1 : 0,
        totalCups: newCupsCount,
        challengeId: currentChallenge?.id,
        roomId: room?.id,
        score: newPoints,
        seerahCompleted: (getActiveAchievement() === 'seerah'),
        generalCompleted: (getActiveAchievement() === 'general'),
        quranCompleted: (completedChallengeIds.size >= 15)
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Score sync failed:', text);
        }
      })
      .catch(err => console.error('Failed to sync score:', err));

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
          body: JSON.stringify({
            username: playerUsername,
            name: playerName,
            points: newPoints,
            cups: calculatedCups,
            roomId: room?.id,
            score: newPoints
          })
        })
          .catch(err => console.error('Failed to sync retroactive cups:', err));
      }
    }
  }, [challenges, bestScores, cups, totalPoints, playerUsername, playerName]);


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
    } else if (currentChallenge && (skillsType === 'complete' || skillsType === 'surah' || roomGameMode === 'complete' || roomGameMode === 'surah' || challengeMode === 'daily')) {
      // Create a virtual verse from the keyword for Completion/Surah challenges that lack explicit verses
      verses = [{
        id: `comp-${currentChallenge.id || 'daily'}`,
        number: 1,
        text: currentChallenge.keyword || currentChallenge.verseText || currentChallenge.prompt || '',
        surah: currentChallenge.correctText || (currentChallenge.verses?.[0]?.surah) || 'إكمال الآية',
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

    if ((isSkillsMode || challengeMode === 'daily') && (effectiveType === 'complete' || effectiveType === 'surah' || challengeMode === 'daily') && targetVerses.length > 0) {
      if (effectiveType === 'surah' && challengeMode !== 'daily') {
        generateOptions('surah', targetVerses[0]?.surah || '');
      } else {
        const firstUnmatched = targetVerses.find(v => !matchedIds.has(v.id));
        const lastWord = firstUnmatched ? firstUnmatched.text.split(' ').filter(Boolean).slice(-1)[0] : '';
        const correctVal = currentChallenge?.correctText || lastWord;
        generateOptions('complete', correctVal);
      }
    }
  }, [view, skillsType, targetVerses, matchedIds.size, generateOptions, roomGameMode, currentChallenge?.id || currentChallenge?.keyword, challengeMode]);

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
    setSessionCorrect(prev => prev + 1);
    setIsNextChallengeModalOpen(false);

    if (currentChallengeIndex >= challenges.length - 1) {
      if (room) setView('group_game');
      else setView('skills_results');
      return;
    }

    setCurrentChallengeIndex(prev => prev + 1);
    setSessionCurrentIndex(prev => prev + 1);
    setMatchedIds(new Set());
    setWordStates({});
    if (isSpeedMode) {
      setSpeedTimeLeft(getSpeedQuestionDuration(challenges[currentChallengeIndex + 1]));
    }
    resetTranscript();
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
              adminRole={adminRole}
              currentUsername={adminUsername}
              currentName={adminName}
              currentAdminId={adminId}
              canManageUsers={canManageUsers}
              onPermissionsUpdated={(updated) => {
                setCanManageUsers(updated);
                localStorage.setItem('quran_admin_can_manage_users', String(updated));
              }}
              systemSettings={systemSettings}
              onSettingsUpdated={fetchSettings}
              onLogout={handleAdminLogout}
              onBackHome={() => {
                setView('home');
                fetchChallenges();
                fetchCompletionChallenges();
              }}
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
          {!isMushafFullscreen && (
            <header className="w-full sticky top-0 z-40 glass-dark text-white shadow-xl border-b border-white/10 backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="w-full px-4 sm:px-8 py-2 md:py-2 flex items-center justify-between gap-2 sm:gap-4 relative z-10">

              {/* Logo & Title */}
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={() => {
                  setView('home');
                  setShowScores(false);
                  setShowSettings(false);
                }}
                className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer group"
                title="تطبيق متين"
              >
                <div className="bg-white p-1 sm:p-1.5 rounded-xl md:rounded-2xl shadow-lg border border-white/60 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <img src="/logo.png" className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain" alt="شعار متين" />
                </div>
                <div className="flex flex-col justify-center select-none">
                  <div className="flex items-center">
                    <img
                      src="/matin-title-light.png"
                      className="h-6 sm:h-7 md:h-8 w-auto object-contain drop-shadow-md"
                      alt="متين"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold tracking-[0.2em] text-brand-gold/90 leading-none mt-1 whitespace-nowrap">
                    لعلوم القرآن الكريم
                  </p>
                </div>
              </motion.div>

              {/* Navigation Actions & Profile */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <button
                  onClick={() => {
                    setShowScores(!showScores);
                    setShowSettings(false);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 ${showScores ? 'bg-brand-gold text-brand-emerald font-black' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                    }`}
                  title="المتصدرين"
                >
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{showScores ? 'العودة' : 'المتصدرين'}</span>
                </button>

                {/* Dark Mode / Light Mode Toggle Button */}
                <button
                  onClick={() => setLibrarySettings(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 ${
                    librarySettings.darkMode
                      ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 hover:bg-amber-400/35'
                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                  }`}
                  title={librarySettings.darkMode ? 'التبديل إلى الوضع الفاتح (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
                  aria-label="تبديل الوضع الداكن والفاتح"
                >
                  {librarySettings.darkMode ? (
                    <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
                  )}
                  <span className="hidden sm:inline">
                    {librarySettings.darkMode ? 'فاتح' : 'داكن'}
                  </span>
                </button>


                <button
                  onClick={() => setShowAboutModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95"
                  title="عن التطبيق"
                >
                  <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-gold" />
                  <span className="hidden sm:inline">عن التطبيق</span>
                </button>

                <button
                  onClick={() => setView('admin')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95"
                  title="لوحة التحكم"
                >
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">الإدارة</span>
                </button>

                {playerName && (
                  <div
                    onClick={() => setView('settings')}
                    className="flex items-center gap-2 sm:gap-2.5 pr-2 sm:pr-2.5 border-r border-white/20 mr-0.5 sm:mr-1 shrink-0 cursor-pointer group"
                    title="ملفي الشخصي"
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <div className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-sm bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/30 shadow-md group-hover:scale-105 transition-transform">
                        {(playerName || '').trim().charAt(0).toUpperCase()}
                      </div>
                      {isElite && (
                        safeAchievement === 'seerah' ? (
                          <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                        ) : safeAchievement === 'general' ? (
                          <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                        ) : (
                          <div className={`absolute -inset-1 rounded-full pointer-events-none z-0 ${currentStyle.className}`} />
                        )
                      )}
                      {isElite && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-1 -left-1 z-30 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center bg-transparent drop-shadow-lg"
                          title={userAchievement}
                        >
                          {currentStyle.icon.startsWith('/') ? (
                            <img src={currentStyle.icon} className="w-full h-full object-contain" alt="Badge" />
                          ) : (
                            <div className="flex items-center justify-center bg-transparent text-white text-[8px] sm:text-[9px] drop-shadow-lg w-full h-full">
                              {currentStyle.icon}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                    <div className="hidden lg:flex flex-col text-right whitespace-nowrap">
                      <span className={`text-xs sm:text-sm font-black leading-none ${isElite ? `text-transparent bg-clip-text bg-gradient-to-r ${currentStyle.textColor}` : 'text-white'}`}>
                        {playerName}
                      </span>
                      <span className="text-[10px] font-bold text-brand-gold/80 mt-0.5">{totalPoints} نقطة</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          )}

          {/* Floating Back Button Directly Below Top Header Bar - ONLY visible when viewing Holy Quran (view === 'mushaf') */}
          {view === 'mushaf' && !isMushafFullscreen && (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-start items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <button
                onClick={() => {
                  setView('library');
                  setIsPageModeActive(false);
                  setSelectedSurahId(null);
                  setSelectedJuz(null);
                  setIsSearchSubmitted(false);
                  resetTranscript();
                  stopListening();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-emerald-200/60 dark:border-slate-700 shadow-sm hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
                title="الرجوع للمكتبة"
              >
                <ArrowRight className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
                <span className="text-emerald-800 dark:text-emerald-300 font-black">الرجوع للمكتبة</span>
              </button>

              {isPageModeActive && (
                <button
                  onClick={() => {
                    setIsPageModeActive(false);
                    setIsSurahMenuOpen(false);
                    setIsJuzMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-amber-300/60 dark:border-slate-700 shadow-sm hover:bg-amber-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
                  title="العودة لشاشة الدليل والمزايا"
                >
                  <BookOpen className="w-4 h-4 text-brand-emerald group-hover:scale-110 transition-transform" />
                  <span className="text-slate-700 dark:text-slate-200 font-black">دليل ومزايا المصحف</span>
                </button>
              )}
            </div>
          )}

          {/* Multiplayer Resign Button if in a room */}
          {room && (view === 'challenge' || view === 'group_waiting' || view === 'group_game') && (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-end items-center">
              <button
                onClick={() => setIsResignModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200/80 shadow-sm transition-all text-xs sm:text-sm font-black active:scale-95 group"
                title="الانسحاب من التحدي الجماعي"
              >
                <LogOut className="w-4 h-4 text-red-500 group-hover:rotate-180 transition-transform" />
                <span>الانسحاب من التحدي</span>
              </button>
            </div>
          )}

          {/* Daily Ayah Section (Below Header) - Only visible on Home Page */}
          {view === 'home' && !showScores && <DailyAyah />}

          <AnimatePresence>
            {!playerName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="glass p-6 sm:p-10 md:p-12 rounded-3xl md:rounded-[3.5rem] max-w-md w-full shadow-2xl text-center relative my-auto bg-white/95"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-emerald rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-xl shadow-brand-emerald/20 text-white">
                    {playerAuthMode === 'register' ? (
                      <UserPlus className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    ) : (
                      <Key className="w-8 h-8 md:w-10 md:h-10 text-white" />
                    )}
                  </div>

                  <h2 className="text-xl md:text-3xl font-black text-brand-emerald mb-2">
                    {playerAuthMode === 'register' ? 'أهلاً بك في تطبيق متين' : 'تسجيل الدخول'}
                  </h2>
                  <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">
                    {playerAuthMode === 'register'
                      ? 'أنشئ حسابك لحفظ تقدمك والتنافس في لوحة المتصدرين'
                      : 'أدخل بيانات حسابك لمتابعة التحدي وحفظ نقاطك'}
                  </p>

                  {registrationError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-5 p-3.5 bg-red-50 text-red-600 rounded-2xl text-xs md:text-sm font-bold border border-red-100 text-center"
                    >
                      {registrationError}
                    </motion.div>
                  )}

                  <form onSubmit={handlePlayerAuth} className="space-y-4 text-right">
                    {playerAuthMode === 'register' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand-emerald" />
                          <span>الاسم</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: أحمد محمد"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                        />
                      </div>
                    )}

                    {/* حقل اسم المستخدم مع @ مدمجة تلقائياً */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <AtSign className="w-3.5 h-3.5 text-brand-emerald" />
                          <span>{playerAuthMode === 'register' ? 'اسم المستخدم' : 'اسم المستخدم أو الاسم'}</span>
                        </span>
                        <span className="text-[9px] text-brand-emerald font-bold bg-brand-emerald/10 px-2 py-0.5 rounded-md">
                          تبدأ بـ @ تلقائياً
                        </span>
                      </label>
                      <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:ring-2 focus-within:ring-brand-emerald/20 focus-within:border-brand-emerald rounded-2xl transition-all overflow-hidden">
                        <span className="pr-4 pl-1 text-brand-emerald font-black text-lg select-none shrink-0 pointer-events-none">
                          @
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="username"
                          value={usernameInput}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/@/g, '').trim();
                            setUsernameInput(cleaned);
                          }}
                          className="w-full py-3.5 pr-1 pl-4 bg-transparent outline-none font-bold text-sm text-slate-800 text-right"
                        />
                      </div>
                    </div>

                    {/* حقل كلمة المرور */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>كلمة المرور</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                      />
                      {playerAuthMode === 'login' && (
                        <p className="text-[10px] text-slate-400 font-bold mr-1">
                          * كلمة المرور الافتراضية للحسابات السابقة: 1234
                        </p>
                      )}
                    </div>

                    {/* الموافقة على سياسة الخصوصية وشروط الاستخدام */}
                    <div className="pt-1 pb-1">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none text-right group">
                        <input
                          type="checkbox"
                          checked={hasAgreedToPrivacy}
                          onChange={(e) => {
                            setHasAgreedToPrivacy(e.target.checked);
                            if (registrationError && e.target.checked) {
                              setRegistrationError(null);
                            }
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald/30 cursor-pointer accent-emerald-600 shrink-0"
                        />
                        <span className="text-[11px] sm:text-xs text-slate-600 font-bold leading-relaxed">
                          أوافق على{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrivacyModalInitialTab('privacy');
                              setShowPrivacyModal(true);
                            }}
                            className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                          >
                            سياسة الخصوصية
                          </button>
                          {' '}و{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrivacyModalInitialTab('terms');
                              setShowPrivacyModal(true);
                            }}
                            className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                          >
                            شروط الاستخدام
                          </button>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="w-full py-4 mt-2 bg-brand-emerald text-white rounded-2xl font-black shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                      {isRegistering ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : playerAuthMode === 'register' ? (
                        <>
                          <span>ابدأ التحدي</span>
                          <ArrowLeft className="w-5 h-5" />
                        </>
                      ) : (
                        <>
                          <span>تسجيل الدخول ومتابعة التحدي</span>
                          <LogIn className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* التبديل بين لدي حساب بالفعل / ليس لدي حساب */}
                  <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                    {playerAuthMode === 'register' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerAuthMode('login');
                          setRegistrationError(null);
                        }}
                        className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1"
                      >
                        لدي حساب بالفعل؟ تسجيل الدخول
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerAuthMode('register');
                          setRegistrationError(null);
                        }}
                        className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1"
                      >
                        ليس لدي حساب، إنشاء حساب جديد
                      </button>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content*/}
          <PullToRefresh>
            <main className={`${view === 'mushaf'
              ? (isPageModeActive ? 'max-w-[96rem] px-0 sm:px-2 md:px-4 pt-1 sm:pt-2 md:pt-3' : 'max-w-6xl px-6 pt-1 sm:pt-2 md:pt-3')
              : (view === 'challenge' || view === 'speed_challenge' || view === 'islamic_quiz' || view === 'group_game' || view === 'skills_count_selection' || view === 'skills_menu' || view === 'speed_menu')
                ? 'max-w-4xl px-3 sm:px-4 pt-1 sm:pt-2 md:pt-3 pb-8 md:pb-12'
                : 'max-w-6xl px-4 sm:px-6 pt-6 md:pt-10 pb-20'
            } mx-auto relative z-10`}>
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
                      قاعدة البيانات السحابية قد تستغرق بضع ثوانٍ للاستيقاظ عند أول تشغيل، أو تأكد من تشغيل المشروع عبر:
                      <code className="block mt-4 bg-slate-100 p-4 rounded-xl text-brand-emerald">npm run dev</code>
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
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-4 max-w-3xl mx-auto py-3 md:py-5 px-3 sm:px-4 pb-24 text-right"
                    dir="rtl"
                  >
                    {/* Clean Header matching Challenges & Library */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-1.5 h-7 sm:h-8 bg-brand-gold rounded-full" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-black text-brand-emerald tracking-tight">
                              لوحة المتصدرين
                            </h2>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <Trophy className="w-3 h-3 text-amber-500" />
                              <span>أفضل 10 متصدرين</span>
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">
                            فرسان التنافس في المتشابهات القرآنية والمسابقات الإسلامية
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => syncLeaderboard()}
                          disabled={isSyncing}
                          title="تحديث القائمة"
                          className={`p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-all shadow-xs active:scale-95 cursor-pointer ${isSyncing ? 'animate-spin' : ''}`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Minimalist Summary Ribbon */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-150 dark:border-slate-800 p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold text-xs">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>عدد المستخدمين: <strong className="text-slate-900 dark:text-slate-100 font-black">{totalUsersCount || leaderboard.length}</strong> مستخدم</span>
                      </div>
                      {playerName && (
                        <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg flex items-center gap-1.5 flex-wrap">
                          <span>حسابك: <strong className="font-black text-slate-900 dark:text-white">{playerName}</strong></span>
                          <span className="text-emerald-300 dark:text-emerald-700 font-normal">|</span>
                          <span className="font-black text-amber-700 dark:text-amber-400">
                            {userLeaderboardRank === 1
                              ? 'ترتيبك: الأول 👑'
                              : userLeaderboardRank === 2
                              ? 'ترتيبك: الثاني 🥈'
                              : userLeaderboardRank === 3
                              ? 'ترتيبك: الثالث 🥉'
                              : userLeaderboardRank !== null
                              ? `ترتيبك: #${userLeaderboardRank}`
                              : 'ترتيبك: غير مصنف بعد'}
                          </span>
                        </div>
                      )}
                    </div>

                    {isSyncing && leaderboard.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm">جاري جلب قائمة الأبطال والمتصدرين...</p>
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-xs">
                        <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 dark:text-slate-500 font-bold text-xs sm:text-sm">كن أول من يسجل اسمه ويتصدر القائمة!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.slice(0, 10).map((player: any, index) => {
                          const isCurrentPlayer = (playerName && player.name)
                            ? player.name.trim().toLowerCase() === playerName.trim().toLowerCase()
                            : false;

                          // INDIVIDUAL PLAYER ACHIEVEMENT LOGIC (Global visibility)
                          const getPlayerAchievement = (p: any) => {
                            if (p.activeFrame === 'seerah' || p.activeFrame === 'general') return p.activeFrame;
                            if (p.activeFrame === 'none') return 'none';
                            if (p.seerahCompleted) return 'seerah';
                            if (p.generalCompleted) return 'general';
                            return 'none';
                          };

                          // Use individual player data for everyone in the list, and ensure current player uses active userAchievement
                          const achievement = (isCurrentPlayer && userAchievement && userAchievement !== 'none')
                            ? userAchievement
                            : getPlayerAchievement(player);
                          const style = achievementStyles[achievement];

                          // Decoration visibility (solely determined by selected frame: none or active frame)
                          const isPlayerElite = achievement !== 'none';

                          const isRank1 = index === 0;
                          const isRank2 = index === 1;
                          const isRank3 = index === 2;

                          return (
                            <motion.div
                              initial={{ x: 15, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: Math.min(index * 0.03, 0.3) }}
                              key={player.name + index}
                              className={`flex justify-between items-center px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-all duration-200 group relative ${
                                isRank1
                                  ? 'bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-white dark:to-slate-900 border-amber-300 dark:border-amber-700/60 shadow-xs'
                                  : isRank2
                                  ? 'bg-gradient-to-l from-slate-100/80 via-slate-50/40 to-white dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-xs'
                                  : isRank3
                                  ? 'bg-gradient-to-l from-amber-600/10 via-amber-600/5 to-white dark:to-slate-900 border-amber-200 dark:border-amber-800/60 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500 shadow-xs'
                              } ${isCurrentPlayer ? 'ring-1.5 ring-emerald-500 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/40' : ''}`}
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                {/* Rank Badge */}
                                <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                                  {isRank1 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      👑
                                    </div>
                                  ) : isRank2 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      🥈
                                    </div>
                                  ) : isRank3 ? (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-center justify-center font-black text-xs sm:text-sm shadow-xs">
                                      🥉
                                    </div>
                                  ) : (
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-400 flex items-center justify-center font-black text-[11px] sm:text-xs">
                                      #{index + 1}
                                    </div>
                                  )}
                                </div>

                                {/* Avatar & Frame */}
                                <div className="relative group shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10">
                                  {/* Inner Avatar */}
                                  <div className="relative z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-sm bg-gradient-to-br from-brand-emerald to-emerald-700 shadow-xs border border-white/60">
                                    {(player.name || '').trim().charAt(0).toUpperCase()}
                                  </div>

                                  {/* Frame / Achievement Decoration */}
                                  {isPlayerElite && (
                                    achievement === 'seerah' ? (
                                      <div className="absolute -inset-1 rounded-full pointer-events-none z-20 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                                    ) : achievement === 'general' ? (
                                      <div className="absolute -inset-1 rounded-full pointer-events-none z-20 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                                    ) : (
                                      <div className={`absolute -inset-0.5 rounded-full pointer-events-none z-0 ${style.className}`} />
                                    )
                                  )}

                                  {/* Badge Icon */}
                                  {isPlayerElite && (
                                    <div className="absolute -bottom-1 -left-1 z-30 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center bg-transparent drop-shadow">
                                      {style.icon.startsWith('/') ? (
                                        <img src={style.icon} className="w-full h-full object-contain" alt="Badge" />
                                      ) : (
                                        <div className="flex items-center justify-center text-[8px] w-full h-full">
                                          {style.icon}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Name & Stats */}
                                <div className="text-right min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`font-black text-xs sm:text-sm leading-tight truncate ${
                                      isPlayerElite
                                        ? `text-transparent bg-clip-text bg-gradient-to-r ${style.textColor}`
                                        : 'text-slate-800 dark:text-slate-100'
                                    }`}>
                                      {player.name}
                                    </span>
                                    {isCurrentPlayer && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shadow-xs">
                                        أنت
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">
                                      {player.points} نقطة
                                    </span>
                                    {player.username && (
                                      <span className="text-[10px] text-slate-300 font-medium hidden sm:inline">
                                        @{player.username.replace(/^@+/, '')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Cups Counter Pill */}
                              <div className="shrink-0 flex items-center pr-1.5">
                                <div className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 rounded-xl border transition-all ${
                                  isRank1
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 border-amber-400 shadow-xs'
                                    : 'bg-amber-50 text-amber-900 border-amber-200/80'
                                }`}>
                                  <Trophy className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRank1 ? 'text-amber-950 fill-amber-950' : 'text-amber-600'}`} />
                                  <span className={`font-black text-xs sm:text-sm tabular-nums ${isRank1 ? 'text-amber-950' : 'text-amber-900'}`}>
                                    {player.cups}
                                  </span>
                                  <span className="text-[9px] font-bold opacity-75 hidden sm:inline">كأس</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ) : view === 'group_create' ? (
                  <motion.div
                    key="group_create"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-xl mx-auto py-6 md:py-8 px-4"
                  >
                    <div className="glass p-6 md:p-8 rounded-3xl border-orange-100 shadow-xl">
                      <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-6 text-center">إعدادات التحدي الجماعي</h2>

                      <div className="space-y-6">
                        {/* 1. اسم الغرفة */}
                        <div className="text-right">
                          <label className="block text-xs font-black text-slate-600 mb-2">
                            اسم الغرفة
                          </label>
                          <input
                            type="text"
                            maxLength={40}
                            value={v1RoomName}
                            onChange={(e) => setV1RoomName(e.target.value)}
                            placeholder="اكتب اسماً مميزاً للغرفة (مثال: سباق الحفاظ، تحدي الأصدقاء)"
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-orange-500 focus:outline-none bg-white text-slate-800 font-bold text-sm text-right transition-all shadow-xs"
                          />
                        </div>

                        {/* 2. نوع الغرفة (عامة / خاصة) */}
                        <div className="text-right">
                          <label className="block text-xs font-black text-slate-600 mb-2">
                            نوع الغرفة (الخصوصية)
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setV1IsPrivate(false)}
                              className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                                !v1IsPrivate
                                  ? 'border-brand-emerald bg-brand-emerald/10 text-brand-emerald shadow-sm'
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                              }`}
                            >
                              <Globe className="w-5 h-5 shrink-0" />
                              <div className="text-right">
                                <div className="text-xs md:text-sm font-black">عامة (Public)</div>
                                <div className="text-[10px] opacity-75 font-bold">تظهر للجميع في القائمة</div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setV1IsPrivate(true)}
                              className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                                v1IsPrivate
                                  ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm'
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                              }`}
                            >
                              <Lock className="w-5 h-5 shrink-0" />
                              <div className="text-right">
                                <div className="text-xs md:text-sm font-black">خاصة (Private)</div>
                                <div className="text-[10px] opacity-75 font-bold">محمية بكلمة مرور</div>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* الظهور الشرطي لحقل كلمة المرور */}
                        {v1IsPrivate && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: -6 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -6 }}
                            className="bg-orange-50/70 border border-orange-200 p-4 rounded-2xl space-y-2 text-right"
                          >
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-orange-900 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />
                                <span>كلمة مرور الغرفة (مطلوبة) *</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => setShowPasswordText(!showPasswordText)}
                                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                              >
                                {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                <span>{showPasswordText ? 'إخفاء' : 'إظهار'}</span>
                              </button>
                            </div>
                            <input
                              type={showPasswordText ? "text" : "password"}
                              maxLength={30}
                              value={v1RoomPassword}
                              onChange={(e) => setV1RoomPassword(e.target.value)}
                              placeholder="أدخل كلمة مرور الغرفة ليتمكن أصدقاؤك من الانضمام"
                              required
                              className="w-full px-4 py-2.5 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none bg-white text-slate-800 font-bold text-sm text-right"
                            />
                            <p className="text-[10px] text-orange-700/80 font-bold">
                              🔒 لن يتمكن أي متسابق من الدخول للغرفة إلا بعد إدخال هذه الكلمة.
                            </p>
                          </motion.div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-3 text-right">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                              اختر مهارات التحدي (يمكنك اختيار أكثر من مهارة)
                            </label>
                            <span className="text-[10px] font-black bg-brand-emerald/10 text-brand-emerald px-2.5 py-0.5 rounded-full border border-brand-emerald/20">
                              تم اختيار ({v1GameModes.filter(m => !(m === 'audio' && systemSettings.hideAudioChallenge) && !(m === 'complete' && systemSettings.hideCompletionChallenge) && !(m === 'surah' && systemSettings.hideSurahChallenge)).length})
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            {[
                              { id: 'audio', label: 'التحدي الصوتي', icon: Mic, color: 'emerald', bg: 'bg-brand-emerald/10', desc: 'تحدى نفسك بقراءة بداية الآيات', hidden: systemSettings.hideAudioChallenge },
                              { id: 'complete', label: 'تحدي إكمال الآية', icon: CheckCircle, color: 'blue', bg: 'bg-blue-600/10', desc: 'توقع الكلمات المفقودة في الآية', hidden: systemSettings.hideCompletionChallenge },
                              { id: 'surah', label: 'تحديد اسم السورة', icon: BookOpen, color: 'purple', bg: 'bg-purple-600/10', desc: 'تعرف على اسم السورة من الآية', hidden: systemSettings.hideSurahChallenge },
                              { id: 'islamic', label: 'تحدي معلومات إسلامية', icon: Sparkles, color: 'amber', bg: 'bg-amber-500/10', desc: 'أسئلة في العقيدة، الفقه، والتفسير', hidden: false }
                            ].filter(m => !m.hidden).map(mode => {
                              const isSelected = v1GameModes.includes(mode.id as any);
                              const skillKey = mode.id as 'audio' | 'complete' | 'surah';
                              const maxAvail = availableSkillCounts[skillKey] || 0;
                              const currentVal = skillQuestionCounts[skillKey] || 0;
                              const isExceeded = isSelected && mode.id !== 'islamic' && maxAvail > 0 && currentVal > maxAvail;

                              return (
                                <div
                                  key={mode.id}
                                  className={`p-3 md:p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between relative overflow-hidden ${
                                    isSelected
                                      ? `border-brand-emerald bg-brand-emerald/5 shadow-md`
                                      : 'border-slate-100 hover:border-slate-200 bg-white text-slate-500'
                                  }`}
                                >
                                  {/* Clickable Header for Multi-select Toggle */}
                                  <div
                                    onClick={() => {
                                      if (isSelected) {
                                        const activeNonHidden = v1GameModes.filter(m => !(m === 'audio' && systemSettings.hideAudioChallenge) && !(m === 'complete' && systemSettings.hideCompletionChallenge) && !(m === 'surah' && systemSettings.hideSurahChallenge));
                                        if (activeNonHidden.length <= 1) {
                                          toast.error('يجب اختيار مهارة واحدة على الأقل');
                                          return;
                                        }
                                        setV1GameModes(v1GameModes.filter(m => m !== mode.id));
                                      } else {
                                        setV1GameModes([...v1GameModes, mode.id as any]);
                                        if (mode.id !== 'islamic' && (skillQuestionCounts[mode.id as 'audio' | 'complete' | 'surah'] || 0) <= 0) {
                                          setSkillQuestionCounts(prev => ({ ...prev, [mode.id]: 5 }));
                                        }
                                        if (mode.id === 'islamic') {
                                          setShowIslamicConfigModal(true);
                                        }
                                      }
                                    }}
                                    className="flex flex-col items-center text-center gap-1.5 cursor-pointer select-none"
                                  >
                                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center mb-0.5 shadow-sm ${
                                      isSelected ? `bg-brand-emerald text-white shadow-brand-emerald/20` : 'bg-slate-50 text-slate-400'
                                    }`}>
                                      <mode.icon className="w-5 h-5 md:w-5.5 md:h-5.5" />
                                    </div>
                                    <div className={`text-xs md:text-sm font-black ${isSelected ? `text-brand-emerald` : 'text-slate-700'}`}>
                                      {mode.label}
                                    </div>
                                    <div className="text-[9px] md:text-[10px] text-slate-400 font-bold leading-tight line-clamp-2">
                                      {mode.desc}
                                    </div>
                                    {/* Checkbox indicator */}
                                    <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                                      isSelected ? 'bg-brand-emerald text-white shadow-xs' : 'border border-slate-300 bg-white'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  </div>

                                  {/* Dynamic Numeric Input for Selected Skill */}
                                  {isSelected && mode.id !== 'islamic' && (
                                    <div className="mt-2.5 pt-2 border-t border-brand-emerald/20 flex flex-col gap-1 w-full text-right">
                                      <div className="flex items-center justify-between text-[10px] font-black">
                                        <span className="text-slate-600">عدد الأسئلة:</span>
                                        <span className="text-slate-400 font-bold">المتاح: {maxAvail}</span>
                                      </div>
                                      <input
                                        type="number"
                                        min={1}
                                        max={maxAvail || 100}
                                        value={currentVal || ''}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                          setSkillQuestionCounts(prev => ({
                                            ...prev,
                                            [skillKey]: isNaN(val) ? 0 : Math.max(0, val)
                                          }));
                                        }}
                                        placeholder="عدد الأسئلة"
                                        className={`w-full px-2.5 py-1.5 rounded-xl border-2 font-black text-xs text-center bg-white shadow-xs transition-all focus:outline-none ${
                                          isExceeded || currentVal === 0
                                            ? 'border-red-400 text-red-600 bg-red-50/40 focus:border-red-500'
                                            : 'border-slate-200 focus:border-brand-emerald text-slate-800'
                                        }`}
                                      />
                                      {isExceeded && (
                                        <span className="text-[9px] text-red-500 font-black text-center leading-tight">
                                          عذراً، أقصى عدد متاح هو {maxAvail}
                                        </span>
                                      )}
                                      {currentVal === 0 && (
                                        <span className="text-[9px] text-amber-600 font-bold text-center leading-tight">
                                          أدخل 1 على الأقل
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Dynamic Indicator for Islamic Quiz */}
                                  {isSelected && mode.id === 'islamic' && (
                                    <div className="mt-2.5 pt-2 border-t border-brand-emerald/20 flex flex-col gap-1 w-full text-right">
                                      <div className="flex items-center justify-between text-[10px] font-black">
                                        <span className="text-amber-800">الأسئلة:</span>
                                        <span className="text-amber-600 font-bold">
                                          {islamicRoomTopics.includes('all') 
                                            ? `${islamicTopicQuestionCounts['all'] || 0} سؤال`
                                            : `${islamicRoomTopics.reduce((s, t) => s + (islamicTopicQuestionCounts[t] || 0), 0)} سؤال`
                                          }
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setShowIslamicConfigModal(true)}
                                        className="w-full py-1 text-[10px] font-black bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-xs cursor-pointer"
                                      >
                                        تخصيص الأسئلة ⚙️
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Islamic Quiz Active Config Banner */}
                          {v1GameModes.includes('islamic') && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3.5 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 flex items-center justify-between text-right gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-amber-900 truncate">
                                    {islamicRoomCategories.map(catId => islamicCategoriesList.find(c => c.id === catId)?.title || catId).join('، ')}
                                    <span className="mx-1 text-amber-400">•</span>
                                    المستوى {islamicRoomLevels.slice().sort().join('، ')}
                                    <span className="mx-1 text-amber-400">•</span>
                                    {islamicRoomTopics.includes('all') 
                                      ? `جميع الموضوعات (${islamicTopicQuestionCounts['all'] || 0} سؤال)` 
                                      : `${islamicRoomTopics.length} موضوع (${islamicRoomTopics.reduce((s, t) => s + (islamicTopicQuestionCounts[t] || 0), 0)} سؤال)`
                                    }
                                  </div>
                                  <div className="text-[10px] font-bold text-amber-700/80 mt-0.5">
                                    تم تخصيص عدد الأسئلة والمجالات للتحدي الإسلامي بدقة
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowIslamicConfigModal(true)}
                                className="px-3 py-1.5 bg-white text-amber-800 text-xs font-black rounded-xl border border-amber-300 shadow-xs hover:bg-amber-100 transition-all shrink-0 cursor-pointer"
                              >
                                تخصيص الأسئلة ⚙️
                              </button>
                            </motion.div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 pt-1">
                          {/* 3. إجمالي عدد الأسئلة التلقائي (Reactive Total Counter) */}
                          <div className="md:col-span-1 text-right flex flex-col justify-between p-3.5 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-black text-slate-700">إجمالي عدد الأسئلة</span>
                              <span className="text-[10px] font-black text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded-full border border-brand-emerald/20">
                                عداد تلقائي ⚡
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2 my-1">
                              <span className={`text-2xl font-black ${hasCountValidationErrors || totalConfiguredQuestions === 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                {totalConfiguredQuestions}
                              </span>
                              <span className="text-xs font-black text-slate-400">سؤال في الغرفة</span>
                            </div>
                            {/* Breakdown */}
                            <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
                              {v1GameModes.includes('audio') && !systemSettings.hideAudioChallenge && (
                                <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">صوتي: {skillQuestionCounts.audio || 0}</span>
                              )}
                              {v1GameModes.includes('complete') && !systemSettings.hideCompletionChallenge && (
                                <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">إكمال: {skillQuestionCounts.complete || 0}</span>
                              )}
                              {v1GameModes.includes('surah') && !systemSettings.hideSurahChallenge && (
                                <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">سورة: {skillQuestionCounts.surah || 0}</span>
                              )}
                              {v1GameModes.includes('islamic') && (
                                <span className="bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                                  إسلامية: {islamicRoomTopics.includes('all') ? (islamicTopicQuestionCounts['all'] || 0) : islamicRoomTopics.reduce((s, t) => s + (islamicTopicQuestionCounts[t] || 0), 0)}
                                </span>
                              )}
                            </div>
                            {totalConfiguredQuestions === 0 && (
                              <p className="text-[10px] font-black text-red-500 mt-1.5">
                                ⚠️ يرجى تحديد عدد الأسئلة لمهارة واحدة على الأقل
                              </p>
                            )}
                            {hasCountValidationErrors && totalConfiguredQuestions > 0 && (
                              <p className="text-[10px] font-black text-red-500 mt-1.5">
                                ⚠️ هناك مهارات أو مواضيع تتجاوز العدد الأقصى المتاح من الأسئلة
                              </p>
                            )}
                          </div>

                          {/* 4. المؤقت - إدخال حر بالثواني */}
                          <div className="md:col-span-1 text-right">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-black text-slate-600">الوقت لكل سؤال</label>
                              <button
                                type="button"
                                onClick={() => setV1Timer(!v1Timer)}
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                                  v1Timer ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {v1Timer ? 'المؤقت مفعل ⚡' : 'المؤقت معطل'}
                              </button>
                            </div>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min={0}
                                max={300}
                                disabled={!v1Timer}
                                value={v1Timer ? (v1TimePerQuestion || '') : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                  setV1TimePerQuestion(isNaN(val) ? 0 : Math.max(0, Math.min(300, val)));
                                }}
                                placeholder={v1Timer ? 'اكتب الثواني (مثال: 20)' : 'المؤقت معطل (0)'}
                                className={`w-full pl-14 pr-4 py-3 rounded-2xl border-2 font-black text-sm text-right shadow-xs transition-all ${
                                  v1Timer
                                    ? 'border-orange-300 bg-white text-slate-800 focus:border-orange-500 focus:outline-none'
                                    : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                }`}
                              />
                              <span className="absolute left-3.5 text-xs font-black text-slate-400 pointer-events-none">
                                {v1Timer ? 'ثانية' : ''}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold px-1">
                              <span>{v1Timer ? 'الوقت بالثواني المتاح لكل سؤال' : 'انقر على الزر لتفعيل المؤقت'}</span>
                              {v1Timer && <span>(مثال: 15، 30، 60)</span>}
                            </div>
                          </div>
                        </div>

                        {/* 5. طريقة الانتقال بين الأسئلة (Question Transition Mode) */}
                        <div className="p-4 bg-slate-50 border-2 border-slate-200/80 rounded-2xl shadow-xs space-y-3 text-right">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🔄</span>
                              <span className="text-xs font-black text-slate-800">طريقة الانتقال بين الأسئلة</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                              {v1TransitionMode === 'SYNC' ? 'متزامن (سؤال بسؤال)' : 'فردي (سباق حر)'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Option 1: SYNC */}
                            <button
                              type="button"
                              onClick={() => setV1TransitionMode('SYNC')}
                              className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                v1TransitionMode === 'SYNC'
                                  ? 'border-orange-500 bg-orange-50/70 shadow-xs ring-2 ring-orange-500/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-black ${v1TransitionMode === 'SYNC' ? 'text-orange-900' : 'text-slate-800'}`}>
                                  متزامن - انتظار الجميع ⏳
                                </span>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${v1TransitionMode === 'SYNC' ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                  {v1TransitionMode === 'SYNC' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                ينتقل جميع اللاعبين معاً سؤالاً بسؤال عند إجابة الجميع أو انتهاء المؤقت.
                              </p>
                            </button>

                            {/* Option 2: ASYNC */}
                            <button
                              type="button"
                              onClick={() => setV1TransitionMode('ASYNC')}
                              className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                                v1TransitionMode === 'ASYNC'
                                  ? 'border-orange-500 bg-orange-50/70 shadow-xs ring-2 ring-orange-500/20'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-black ${v1TransitionMode === 'ASYNC' ? 'text-orange-900' : 'text-slate-800'}`}>
                                  تلقائي فردي 🚀
                                </span>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${v1TransitionMode === 'ASYNC' ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>
                                  {v1TransitionMode === 'ASYNC' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                ينتقل كل لاعب فور إجابته دون انتظار البقية، في سباق سرعة ودقة مستقل.
                              </p>
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 space-y-3">
                          <button
                            onClick={handleCreateV1}
                            disabled={isCreatingRoom || hasCountValidationErrors || totalConfiguredQuestions <= 0}
                            className={`w-full py-3.5 md:py-4 rounded-2xl font-black text-base md:text-lg shadow-xl transition-all flex items-center justify-center gap-3 group/btn ${
                              isCreatingRoom || hasCountValidationErrors || totalConfiguredQuestions <= 0
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-orange-500 text-white shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.01] active:scale-95 cursor-pointer'
                            }`}
                          >
                            {isCreatingRoom ? <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" /> : (
                              <>
                                <ArrowLeft className="w-5 h-5 transition-transform group-hover/btn:-translate-x-1" />
                                <span>أنشئ الغرفة الآن</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setView('group_join')}
                            className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs md:text-sm cursor-pointer"
                          >
                            رجوع لقائمة الغرف
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
                    className="max-w-lg mx-auto py-6 md:py-8 px-4"
                  >
                    <div className="glass p-6 md:p-8 rounded-3xl border-orange-100 shadow-xl text-center">
                      <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-md animate-pulse">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <h2 className="text-xl md:text-2xl font-black text-slate-800">قاعة الانتظار</h2>
                          <p className="text-slate-400 font-bold text-xs md:text-sm">انتظار انضمام بقية المتسابقين...</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 md:p-5 rounded-2xl mb-6 border border-slate-100 shadow-inner text-right space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm md:text-base font-black text-slate-800">{room?.name || 'غرفة التحدي'}</span>
                          {room?.isPrivate ? (
                            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-xs font-black flex items-center gap-1 border border-amber-500/20">
                              <Lock className="w-3 h-3" />
                              <span>غرفة خاصة</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black flex items-center gap-1 border border-emerald-500/20">
                              <Globe className="w-3 h-3" />
                              <span>غرفة عامة</span>
                            </span>
                          )}
                        </div>
                        {room?.isPrivate && room?.password && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                            <span className="text-slate-500 font-bold">كلمة المرور:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-lg text-sm">{room.password}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(room.password);
                                  toast.success('تم نسخ كلمة المرور');
                                }}
                                className="text-[11px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                              >
                                نسخ
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400 font-bold pt-1 flex items-center gap-1.5 justify-end">
                          <span>الغرفة ظاهرة في قائمة الغرف المتاحة ليتمكن الجميع من الدخول</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        </p>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-xs md:text-sm font-black text-slate-800">المتسابقون ({room?.participants?.length || 1})</span>
                          <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {(room?.participants || []).map((p: any, i: number) => (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={p?.id || i}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-xs"
                            >
                              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs">
                                {i + 1}
                              </div>
                              <span className="font-bold text-slate-700 text-sm">{p?.name || 'لاعب'}</span>
                              {p?.id === room?.player1Id && <span className="mr-auto px-2.5 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded-md uppercase">المنشئ</span>}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {(room?.player1?.name === playerName || (room?.player1?.username && room?.player1?.username === playerUsername)) && (
                        <button
                          onClick={handleStartRoomV1}
                          disabled={v1IsStartingRoom || (room?.participants?.length || 0) < 2}
                          className={`w-full py-3.5 text-white rounded-2xl font-black text-base md:text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${(room?.participants?.length || 0) < 2
                            ? 'bg-slate-400 opacity-50 cursor-not-allowed'
                            : v1IsStartingRoom ? 'bg-orange-400' : 'bg-brand-emerald hover:bg-brand-emerald/90'
                            }`}
                        >
                          {v1IsStartingRoom && <Loader2 className="w-5 h-5 animate-spin" />}
                          {v1IsStartingRoom ? 'جاري التحميل...' : 'ابدأ التحدي الآن'}
                        </button>
                      )}

                      <button onClick={() => setView('home')} className="mt-6 text-slate-400 font-bold hover:text-slate-600 text-xs md:text-sm">إلغاء والتراجع</button>
                    </div>
                  </motion.div>
                ) : view === 'group_join' ? (
                  <motion.div
                    key="group_join"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="max-w-2xl mx-auto py-6 md:py-8 px-4 space-y-6"
                  >
                    {/* Header with Back and Refresh */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setView('home')}
                        className="p-2.5 rounded-xl bg-white/60 hover:bg-white transition-all text-slate-500 font-bold flex items-center gap-2 text-xs md:text-sm border border-slate-100 shadow-xs cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>الرئيسية</span>
                      </button>

                      <div className="text-center">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">التحدي الجماعي</h2>
                        <p className="text-slate-400 font-bold text-xs">قائمة الغرف المتاحة للتحدي المباشر</p>
                      </div>

                      <button
                        onClick={() => fetchAvailableRooms(true)}
                        disabled={isLoadingRooms}
                        className="p-2.5 rounded-xl bg-white/60 hover:bg-white transition-all text-slate-600 font-bold flex items-center gap-1.5 text-xs md:text-sm border border-slate-100 shadow-xs cursor-pointer disabled:opacity-60"
                        title="تحديث قائمة الغرف"
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin text-orange-500' : ''}`} />
                        <span className="hidden sm:inline">تحديث</span>
                      </button>
                    </div>

                    {/* Prominent Create Room Action Banner */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setView('group_create')}
                      className="w-full p-4 md:p-5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-3xl font-black shadow-lg shadow-orange-500/25 flex items-center justify-between cursor-pointer border border-white/20 transition-all group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform shrink-0">
                          <Plus className="w-6 h-6 text-white stroke-[2.5]" />
                        </div>
                        <div className="text-right">
                          <div className="text-base md:text-lg font-black flex items-center gap-2">
                            <span>إنشاء غرفة تحدي جديدة</span>
                            <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold">مضيف 👑</span>
                          </div>
                          <p className="text-white/80 font-bold text-xs mt-0.5">خصص المهارات، عدد الأسئلة والمؤقت ثم نافس أصدقاءك</p>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-white text-orange-600 rounded-2xl font-black text-xs md:text-sm shadow-sm shrink-0 flex items-center gap-1.5 group-hover:bg-orange-50 transition-colors">
                        <Zap className="w-4 h-4 fill-orange-500" />
                        <span>أنشئ الآن</span>
                      </div>
                    </motion.button>

                    {/* Available Rooms List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-slate-700">
                            الغرف المتاحة حالياً ({availableRooms.length})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold">
                          يتم التحديث تلقائياً ⚡
                        </span>
                      </div>

                      {isLoadingRooms && availableRooms.length === 0 ? (
                        <div className="glass p-12 rounded-3xl text-center border-slate-100 shadow-md">
                          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-xs font-bold text-slate-400">جاري تحميل الغرف النشطة...</p>
                        </div>
                      ) : availableRooms.length === 0 ? (
                        <div className="glass p-8 md:p-10 rounded-3xl text-center border-slate-100 shadow-md space-y-4">
                          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                            <Users className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-700 mb-1">لا توجد غرف قيد الانتظار حالياً</h3>
                            <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto">
                              جميع التحديات بدأت أو تم إنهاؤها. بادر بإنشاء غرفتك ليراها الآخرون وينضموا إليك!
                            </p>
                          </div>
                          <button
                            onClick={() => setView('group_create')}
                            className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-black text-xs md:text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>إنشاء غرفة جديدة</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {availableRooms.map((r: any) => (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => {
                                if (r.isPrivate) {
                                  setPrivateRoomModal({
                                    isOpen: true,
                                    room: r,
                                    password: '',
                                    error: undefined
                                  });
                                } else {
                                  handleJoinV1(r.id);
                                }
                              }}
                              className="glass p-4 md:p-5 rounded-2xl border border-slate-100 hover:border-orange-300 transition-all shadow-xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                            >
                              <div className="text-right space-y-2">
                                <div className="flex items-center gap-2 justify-end sm:justify-start">
                                  {r.isPrivate ? (
                                    <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-[11px] font-black flex items-center gap-1 border border-amber-500/20">
                                      <Lock className="w-3 h-3" />
                                      <span>خاصة</span>
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[11px] font-black flex items-center gap-1 border border-emerald-500/20">
                                      <Globe className="w-3 h-3" />
                                      <span>عامة</span>
                                    </span>
                                  )}
                                  <h3 className="font-black text-slate-800 text-sm md:text-base group-hover:text-orange-600 transition-colors">
                                    {r.name || 'غرفة التحدي'}
                                  </h3>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs text-slate-500 font-bold justify-end sm:justify-start">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                                    المنشئ: {r.hostName || 'متسابق'}
                                  </span>
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{r.participantCount} متسابقين</span>
                                  </span>
                                  <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                                    {r.questionCount} أسئلة
                                  </span>
                                  {r.timePerQuestion > 0 && (
                                    <span className="bg-orange-100/70 text-orange-600 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                      <Clock className="w-3 h-3" />
                                      <span>{r.timePerQuestion} ثانية</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (r.isPrivate) {
                                      setPrivateRoomModal({
                                        isOpen: true,
                                        room: r,
                                        password: '',
                                        error: undefined
                                      });
                                    } else {
                                      handleJoinV1(r.id);
                                    }
                                  }}
                                  disabled={isJoiningRoom}
                                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                    r.isPrivate
                                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                      : 'bg-brand-emerald hover:bg-brand-emerald/90 text-white shadow-brand-emerald/20'
                                  }`}
                                >
                                  {r.isPrivate ? (
                                    <>
                                      <Lock className="w-3.5 h-3.5" />
                                      <span>انضمام بكلمة مرور</span>
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-3.5 h-3.5" />
                                      <span>انضمام مباشر</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Floating Action Button (FAB) on mobile */}
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setView('group_create')}
                      className="fixed bottom-6 left-6 z-40 sm:hidden p-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-2xl shadow-orange-500/50 flex items-center gap-2 font-black cursor-pointer border-2 border-white"
                      title="إنشاء غرفة جديدة"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                      <span className="text-xs">غرفة جديدة</span>
                    </motion.button>
                  </motion.div>
                ) : view === 'group_game' ? (
                  <motion.div
                    key="group_results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-6 max-w-3xl mx-auto py-6 md:py-8 px-4 min-h-[60vh]"
                  >
                    <AnimatePresence>
                      {room?.status === 'FINISHED' ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="glass p-6 md:p-8 rounded-3xl text-center border-brand-gold/20 shadow-xl relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-brand-gold/5 animate-pulse" />
                          <div className="relative z-10">
                            <Trophy className="w-14 h-14 md:w-16 md:h-16 text-brand-gold mx-auto mb-4 drop-shadow-md" />
                            <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-3">اكتمل السباق!</h2>

                            <div className="max-w-lg mx-auto space-y-3 mb-8 text-right">
                              {(room?.participants || [])
                                .map((p: any) => {
                                  const prog = room?.playersProgress?.[p.id] || {};
                                  const totalQ = room?.questionCount || 1;
                                  const correctCount = prog.correctCount || 0;
                                  const accuracy = prog.accuracy ?? Math.round((correctCount / totalQ) * 100);
                                  const score = prog.finalTotalScore ?? prog.score ?? 0;
                                  const basePoints = prog.basePoints ?? (correctCount * 10);
                                  const speedBonusCount = prog.speedBonusCount || 0;
                                  const completionBonus = prog.completionBonus || 0;
                                  const accuracyBonus = prog.accuracyBonus || 0;
                                  const isFinished = !!prog.finishTime;

                                  return {
                                    ...p,
                                    finishTime: prog.finishTime,
                                    score,
                                    basePoints,
                                    speedBonusCount,
                                    completionBonus,
                                    accuracyBonus,
                                    correctCount,
                                    accuracy,
                                    isFinished
                                  };
                                })
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
                                    className={`flex flex-col gap-2 p-3.5 md:p-4 rounded-2xl border ${
                                      idx === 0
                                        ? 'bg-gradient-to-r from-amber-50 to-orange-50/60 border-amber-300 shadow-md ring-2 ring-amber-400/20'
                                        : 'bg-white border-slate-200/80 shadow-xs'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                                          idx === 0 ? 'bg-amber-500 text-white shadow-xs' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                        </div>
                                        <div className="flex flex-col items-start">
                                          <span className="font-black text-slate-800 text-sm">
                                            {p.name} {(p.name === playerName || (p.username && p.username === playerUsername)) && '(أنت)'}
                                          </span>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                            <span>{p.correctCount}/{room?.questionCount || 0} صحيحة</span>
                                            <span>•</span>
                                            <span className={`font-black ${p.accuracy >= 90 ? 'text-emerald-600' : p.accuracy >= 70 ? 'text-amber-600' : 'text-slate-500'}`}>
                                              دقة {p.accuracy}%
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-left flex flex-col items-end">
                                        <span className="text-sm md:text-base text-brand-emerald font-black bg-brand-emerald/10 px-2.5 py-0.5 rounded-lg border border-brand-emerald/20">
                                          {p.score} نقطة
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                                          الأساسية: {p.basePoints}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Bonus Badges Breakdown */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px] font-black">
                                      {p.speedBonusCount > 0 && (
                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200">
                                          <Zap className="w-3 h-3 text-amber-600 fill-amber-600" />
                                          <span>+{p.speedBonusCount} بونص سرعة</span>
                                        </span>
                                      )}
                                      {p.completionBonus > 0 && (
                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                                          <span>🏆 +{p.completionBonus} إنهاء أول مشروط (دقة &gt; 70%)</span>
                                        </span>
                                      )}
                                      {p.accuracyBonus > 0 && (
                                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md flex items-center gap-1 border border-purple-200">
                                          <span>🎯 +{p.accuracyBonus} تمكن فائق (دقة &gt; 90%)</span>
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                            </div>

                            <button
                              onClick={() => {
                                setRoom(null);
                                setView('home');
                              }}
                              className="px-8 py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-base md:text-lg shadow-lg hover:scale-105 transition-all"
                            >
                              العودة للرئيسية
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-5 md:p-6 bg-slate-50 min-h-[45vh] rounded-2xl md:rounded-3xl">
                          <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-2">أنهيت التحدي! 🎉</h2>
                          <p className="text-slate-500 font-bold mb-6 text-xs md:text-sm">راقب نتائج أصدقائك مباشرة...</p>

                          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                            {/* قائمة اللاعبين الحية */}
                            {(room?.participants || [])
                              .map((p: any) => ({
                                ...p,
                                score: room?.playersProgress?.[p.id]?.score || 0,
                                hasFinished: !!room?.playersProgress?.[p.id]?.finishTime
                              }))
                              .sort((a: any, b: any) => b.score - a.score)
                              .map((player: any, index: number) => {
                                const isMe = (player.name === playerName || (player.username && player.username === playerUsername));
                                return (
                                <div key={player.id} className={`flex items-center justify-between p-3.5 border-b border-slate-50 last:border-0 ${isMe ? 'bg-emerald-50/50' : ''}`}>

                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-slate-300 w-5 text-sm">{index + 1}</span>
                                    <span className={`font-black text-sm ${isMe ? 'text-brand-emerald' : 'text-slate-700'}`}>{player.name} {isMe && '(أنت)'}</span>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <span className="text-brand-emerald font-black tabular-nums text-sm">{player.score} نقطة</span>
                                    {/* حالة اللاعب: انتهى أم لا يزال في التحدي */}
                                    {player.hasFinished ? (
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-black uppercase">أنهى</span>
                                    ) : (
                                      <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md font-black uppercase flex items-center gap-1 animate-pulse">
                                        <div className="w-1 h-1 bg-orange-500 rounded-full animate-ping" />
                                        في التحدي...
                                      </span>
                                    )}
                                  </div>
                                </div>
                                );
                              })}
                          </div>

                          <p className="mt-8 text-slate-400 font-bold text-xs md:text-sm">سيتم عرض النتائج النهائية فور انتهاء الجميع</p>
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
                    className="flex flex-col gap-6 max-w-3xl mx-auto py-4 md:py-6 px-4 min-h-[60vh]"
                  >
                    {/* Floating Timer UI */}
                    <div className="flex justify-center mb-4 sticky top-4 z-50">
                      <motion.div
                        animate={{
                          scale: speedTimeLeft <= 10 ? [1, 1.05, 1] : 1,
                          backgroundColor: speedTimeLeft <= 10 ? '#fee2e2' : '#ffffff'
                        }}
                        transition={{ repeat: speedTimeLeft <= 10 ? Infinity : 0, duration: 0.5 }}
                        className={`glass px-5 md:px-7 py-2 md:py-2.5 rounded-full shadow-xl border-2 flex items-center gap-3 md:gap-4 ${speedTimeLeft <= 10 ? 'border-red-500' : 'border-brand-emerald/20'}`}
                      >
                        <div className={`p-1.5 md:p-2 rounded-xl ${speedTimeLeft <= 10 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
                          <Zap className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="text-right">
                          <span className={`text-base md:text-xl font-black block tabular-nums ${speedTimeLeft <= 10 ? 'text-red-600' : 'text-slate-800'}`}>
                            {speedTimeLeft} ثانية
                          </span>
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">
                            الوقت المتبقي للآية ({
                              (currentChallenge?.level === 'hard' || currentChallenge?.level === 'صعب') ? 'صعب: 20ث' :
                              (currentChallenge?.level === 'easy' || currentChallenge?.level === 'سهل') ? 'سهل: 10ث' :
                              'متوسط: 15ث'
                            })
                          </span>
                        </div>
                        <div className="w-px h-7 bg-slate-100 mx-1" />
                        <div className="text-right">
                          <span className="text-sm md:text-base font-black text-brand-emerald block tabular-nums">
                            {Math.floor(speedTotalTimeSpent / 60)}:{String(speedTotalTimeSpent % 60).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">إجمالي الوقت</span>
                        </div>
                      </motion.div>
                    </div>

                    {isSpeedGameOver ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass p-6 md:p-8 rounded-3xl text-center border-red-200 shadow-xl relative overflow-hidden my-6 max-w-md mx-auto"
                      >
                        <div className="absolute inset-0 bg-red-50/50" />
                        <div className="relative z-10">
                          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-7 h-7" />
                          </div>
                          <h2 className="text-2xl font-black text-slate-800 mb-2">انتهى الوقت!</h2>
                          <p className="text-sm md:text-base text-slate-600 font-bold mb-6 leading-relaxed">
                            لا بأس، استعن بالله وعاود المحاولة
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                              onClick={handleStartSpeedChallenge}
                              className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm md:text-base shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              كرر المحاولة
                            </button>
                            <button
                              onClick={() => setView('home')}
                              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-500 rounded-xl font-bold text-sm md:text-base hover:bg-slate-50 transition-all"
                            >
                              العودة للرئيسية
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-2 md:px-4 pt-2 md:pt-4">
                        {/* Multiplayer Real-time Question Counter & Speed Bonus Indicator */}
                        {room && room.transitionMode !== 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              <span className="text-white font-black text-xs md:text-sm">
                                أجاب {room.answeredCount ?? 0} من {room.totalParticipants ?? room.participants?.length ?? 1} لاعبين
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {room && room.transitionMode === 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🚀</span>
                              <span className="text-white font-black text-xs md:text-sm">
                                سباق فردي سريع (أجب بأقصى سرعة ودقة!)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {/* Multiplayer Waiting State after answering - Placed ABOVE the question (Only in SYNC mode) */}
                        {room && room.transitionMode !== 'ASYNC' && hasAnsweredCurrentQuestion && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="mb-4 p-3.5 md:p-4 rounded-2xl bg-linear-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-300 shadow-md text-center space-y-2"
                          >
                            <div className="flex items-center justify-center gap-2.5">
                              <div className="w-7 h-7 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                              <h4 className="text-sm md:text-base font-black text-amber-900">
                                تم تسجيل إجابتك بنجاح، بانتظار باقي المتسابقين...
                              </h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-amber-700 font-bold max-w-lg mx-auto leading-relaxed">
                              سينتقل الجميع تلقائياً إلى السؤال التالي فور اكتمال إجابات اللاعبين أو انتهاء وقت السؤال.
                            </p>
                            <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border border-amber-200 text-[11px] font-black text-amber-800 shadow-xs">
                              <Users className="w-3.5 h-3.5 text-amber-600" />
                              <span>أجاب ({room.answeredCount ?? 0} من {room.totalParticipants ?? room.participants?.length ?? 1})</span>
                            </div>
                          </motion.div>
                        )}

                        <SkillsChallengeHeader
                          mode={skillsType}
                          verseText={KEYWORD}
                          totalPoints={totalPoints}
                          level={currentChallenge?.level}
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
                            surahFeedbackData={surahFeedbackData}
                          />
                        ) : (
                          <CompleteChallengeUI
                            verseText={KEYWORD}
                            options={skillsOptions || []}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                            onConfirm={handleConfirmAnswer}
                            feedback={skillsFeedback}
                            correctText={skillsCorrectAnswer || currentChallenge?.correctText}
                            currentChallenge={currentChallenge}
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
                      hideAudio={systemSettings.hideAudioChallenge}
                      hideComplete={systemSettings.hideCompletionChallenge}
                      hideSurah={systemSettings.hideSurahChallenge}
                    />
                  </motion.div>
                ) : view === 'skills_count_selection' ? (
                  skillsType === 'complete' ? (
                    <motion.div
                      key="skills_complete_selection"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="max-w-2xl mx-auto py-6 md:py-8 px-4"
                    >
                      <div className="glass bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border-2 border-brand-gold/30 shadow-xl space-y-6">
                        {/* Header */}
                        <div className="text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 rounded-full border border-amber-200 dark:border-amber-800/60">
                            تحدي إكمال الآية
                          </span>
                          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">
                            إعدادات التحدي وتحديد الأجزاء
                          </h2>
                          <p className="text-slate-400 font-bold text-xs md:text-sm mt-1">
                            حدد عدد الأسئلة والأجزاء التي تود التحدي في آياتها
                          </p>
                        </div>

                        {/* 1. عدد الأسئلة */}
                        <div>
                          <label className="block text-xs font-black text-slate-500 mb-3 uppercase tracking-wider text-right">
                            1. عدد الأسئلة
                          </label>
                          <div className="grid grid-cols-4 gap-3">
                            {[5, 10, 15, 20].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setSelectedSkillCount(num)}
                                className={`py-3.5 px-2 rounded-2xl border-2 font-black text-center transition-all ${
                                  selectedSkillCount === num
                                    ? 'border-brand-gold bg-brand-gold text-white shadow-lg shadow-brand-gold/20 scale-[1.02]'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span className="text-xl block">{num}</span>
                                <span className="text-[10px] opacity-80">أسئلة</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 2. نطاق التحدي (الأجزاء أو السور) */}
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                              2. نطاق الأسئلة (الأجزاء أو سور معينة)
                            </label>

                            {/* Mode toggle tabs */}
                            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto border border-slate-200/60 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => setSkillsScopeMode('juz')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                  skillsScopeMode === 'juz'
                                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                              >
                                <Hash className="w-3.5 h-3.5 text-brand-gold" />
                                <span>حسب الأجزاء</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSkillsScopeMode('surah')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                  skillsScopeMode === 'surah'
                                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                              >
                                <BookOpen className="w-3.5 h-3.5 text-brand-gold" />
                                <span>سور معينة</span>
                              </button>
                            </div>
                          </div>

                          {skillsScopeMode === 'juz' ? (
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[11px] font-bold text-slate-400">
                                  اختر جزءاً أو عدة أجزاء لتخصيص التحدي:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedSkillJuzs.length === 30) {
                                      setSelectedSkillJuzs([]);
                                    } else {
                                      setSelectedSkillJuzs(Array.from({ length: 30 }, (_, i) => i + 1));
                                    }
                                  }}
                                  className="text-xs font-black text-brand-gold hover:text-amber-700 transition-colors"
                                >
                                  {selectedSkillJuzs.length === 30 ? 'إلغاء التحديد' : 'تحديد كامل القرآن (30 جزءاً)'}
                                </button>
                              </div>

                              {/* Quick selection status */}
                              <div className="mb-3 flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
                                <span>
                                  {selectedSkillJuzs.length === 0
                                    ? '📖 يتم التحدي في: كامل القرآن الكريم'
                                    : selectedSkillJuzs.length === 30
                                      ? '📖 يتم التحدي في: كامل القرآن (جميع الأجزاء)'
                                      : `📖 تم تحديد ${selectedSkillJuzs.length} ${selectedSkillJuzs.length === 1 ? 'جزء' : 'أجزاء'}: (${selectedSkillJuzs.join(', ')})`}
                                </span>
                                {selectedSkillJuzs.length > 0 && selectedSkillJuzs.length < 30 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSkillJuzs([])}
                                    className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline"
                                  >
                                    إعادة لكامل المصحف
                                  </button>
                                )}
                              </div>

                              {/* 30 Juz Grid */}
                              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
                                {Array.from({ length: 30 }, (_, i) => i + 1).map((juzNum) => {
                                  const isSelected = selectedSkillJuzs.includes(juzNum);
                                  return (
                                    <button
                                      key={juzNum}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedSkillJuzs(selectedSkillJuzs.filter(j => j !== juzNum));
                                        } else {
                                          setSelectedSkillJuzs([...selectedSkillJuzs, juzNum].sort((a, b) => a - b));
                                        }
                                      }}
                                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                                        isSelected
                                          ? 'bg-brand-gold text-white border-brand-gold shadow-xs scale-105'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-gold/50'
                                      }`}
                                      title={`الجزء ${JUZ_NAMES_AR[juzNum] || juzNum}`}
                                    >
                                      <span>{juzNum}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {/* Search & Actions */}
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  <input
                                    type="text"
                                    value={skillSurahSearch}
                                    onChange={(e) => setSkillSurahSearch(e.target.value)}
                                    placeholder="ابحث عن سورة (مثال: الكهف، البقرة، 18)..."
                                    className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold outline-none focus:border-brand-gold focus:bg-white dark:focus:bg-slate-800 transition-all text-right"
                                  />
                                  {skillSurahSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setSkillSurahSearch('')}
                                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                      مسح
                                    </button>
                                  )}
                                </div>

                                {selectedSkillSurahs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSkillSurahs([])}
                                    className="text-xs font-black text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 transition-all shrink-0"
                                  >
                                    مسح الكل
                                  </button>
                                )}
                              </div>

                              {/* Presets */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black text-slate-400">اختيارات سريعة:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const amma = ALL_QURAN_SURAHS.filter(s => s.id >= 78).map(s => s.name);
                                    setSelectedSkillSurahs(amma);
                                  }}
                                  className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all"
                                >
                                  جزء عمّ (قصار السور)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const longSurahs = ['البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف'];
                                    setSelectedSkillSurahs(longSurahs);
                                  }}
                                  className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all"
                                >
                                  السبع الطوال
                                </button>
                              </div>

                              {/* Selected Status */}
                              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-900 dark:text-amber-200">
                                <span className="truncate">
                                  {selectedSkillSurahs.length === 0
                                    ? '📖 لم تحدد سوراً بعد (سيتم التحدي في كامل القرآن الكريم)'
                                    : `📖 تم تحديد ${selectedSkillSurahs.length} ${selectedSkillSurahs.length === 1 ? 'سورة' : 'سور'}: ${selectedSkillSurahs.slice(0, 3).map(s => `سورة ${s}`).join('، ')}${selectedSkillSurahs.length > 3 ? ` و+${selectedSkillSurahs.length - 3}` : ''}`}
                                </span>
                                {selectedSkillSurahs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSkillSurahs([])}
                                    className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline shrink-0 mr-2"
                                  >
                                    إلغاء التحديد
                                  </button>
                                )}
                              </div>

                              {/* Surahs Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800 custom-scrollbar">
                                {filteredSurahsList.map((surah) => {
                                  const isSelected = selectedSkillSurahs.includes(surah.name);
                                  return (
                                    <button
                                      key={surah.id}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedSkillSurahs(selectedSkillSurahs.filter(s => s !== surah.name));
                                        } else {
                                          setSelectedSkillSurahs([...selectedSkillSurahs, surah.name]);
                                        }
                                      }}
                                      className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border text-right flex items-center justify-between gap-1.5 ${
                                        isSelected
                                          ? 'bg-brand-gold text-white border-brand-gold shadow-xs scale-[1.02]'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-gold/50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className={`w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-black shrink-0 ${
                                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                        }`}>
                                          {surah.id}
                                        </span>
                                        <span className="truncate">سورة {surah.name}</span>
                                      </div>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                                    </button>
                                  );
                                })}
                                {filteredSurahsList.length === 0 && (
                                  <div className="col-span-full py-6 text-center text-xs font-bold text-slate-400">
                                    لم يتم العثور على سورة مطابقة
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="pt-2 space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (skillsScopeMode === 'juz') {
                                handleStartSkillsSession(selectedSkillCount, selectedSkillJuzs, undefined);
                              } else {
                                handleStartSkillsSession(selectedSkillCount, undefined, selectedSkillSurahs);
                              }
                            }}
                            className="w-full py-4 bg-brand-gold hover:bg-amber-600 text-white rounded-2xl font-black text-base shadow-xl shadow-brand-gold/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                          >
                            <span>
                              ابدأ تحدي إكمال الآية ({selectedSkillCount} أسئلة)
                              {skillsScopeMode === 'surah' && selectedSkillSurahs.length > 0 
                                ? ` • ${selectedSkillSurahs.length} سور` 
                                : skillsScopeMode === 'juz' && selectedSkillJuzs.length > 0 && selectedSkillJuzs.length < 30 
                                  ? ` • ${selectedSkillJuzs.length} أجزاء` 
                                  : ' • كامل القرآن'}
                            </span>
                            <ArrowLeft className="w-5 h-5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setView('skills_menu')}
                            className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs md:text-sm flex items-center justify-center gap-1.5"
                          >
                            <ArrowRight className="w-4 h-4" />
                            <span>العودة للأوضاع</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="skills_count_selection"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="max-w-xl mx-auto py-6 md:py-8 px-4 text-center"
                    >
                      <h2 className="text-xl md:text-2xl font-black text-brand-emerald mb-1">اختر عدد الأسئلة</h2>
                      <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">كم عدد الأسئلة التي تود التحدي فيها؟</p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                        {[5, 10, 15, 20].map((count) => (
                          <button
                            key={count}
                            onClick={() => handleStartSkillsSession(count)}
                            className="glass bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border-2 border-slate-150 dark:border-slate-700 hover:border-brand-emerald/30 dark:hover:border-emerald-500/50 hover:shadow-lg transition-all group active:scale-95"
                          >
                            <span className="text-3xl md:text-4xl font-black text-brand-emerald dark:text-emerald-400 block mb-1">{count}</span>
                            <span className="text-slate-500 dark:text-slate-300 font-bold text-xs md:text-sm">سؤال</span>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setView('skills_menu')}
                        className="mt-6 text-slate-400 font-bold hover:text-brand-emerald transition-colors flex items-center gap-1.5 mx-auto text-xs md:text-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        العودة للأوضاع
                      </button>
                    </motion.div>
                  )
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

                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="bg-brand-emerald/5 p-8 rounded-[2rem] border border-brand-emerald/10">
                          <span className="text-4xl font-black text-brand-emerald block mb-1">{sessionCorrect}</span>
                          <span className="text-slate-500 font-bold">{skillsType === 'surah' ? 'سورة صحيحة' : 'إجابة صحيحة'}</span>
                        </div>
                        <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100">
                          <span className="text-4xl font-black text-red-600 block mb-1">{sessionWrong}</span>
                          <span className="text-slate-500 font-bold">{skillsType === 'surah' ? 'سورة خاطئة' : 'إجابة خاطئة'}</span>
                        </div>
                      </div>

                      {/* Points and cups summary badge */}
                      <div className="mb-10 p-5 rounded-3xl bg-linear-to-r from-brand-emerald/10 via-amber-500/10 to-brand-emerald/10 border border-brand-gold/30 flex items-center justify-around gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-brand-gold shrink-0" />
                          <span className="text-slate-600 font-bold text-sm">النقاط المكتسبة:</span>
                          <span className="text-brand-emerald font-black text-xl">+{sessionCorrect * 10} نقطة</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                          <span className="text-slate-600 font-bold text-sm">إجمالي رصيدك:</span>
                          <span className="text-slate-800 font-black text-base">{totalPoints} نقطة • {cups} كأس</span>
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
                                    <div className="flex flex-col gap-2.5 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-200/60">
                                      {/* ما أدخله المستخدم */}
                                      <div className="flex items-start gap-2 bg-red-50/70 p-2.5 rounded-xl border border-red-100">
                                        <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                                        <div className="flex-1">
                                          <span className="text-slate-500 font-semibold block text-[11px]">ما اخترته/أدخلته أنت:</span>
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {m.userInputs && m.userInputs.length > 0 && m.userInputs.some((u: string) => u.trim()) ? (
                                              m.userInputs.map((input: string, uIdx: number) => {
                                                const isMatch = m.correctSurahsList?.some((c: string) => normalizeArabicText(c).trim() === normalizeArabicText(input).trim());
                                                return (
                                                  <span
                                                    key={uIdx}
                                                    className={`px-2 py-0.5 rounded-md text-xs font-black ${
                                                      isMatch
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                        : 'bg-red-100 text-red-800 border border-red-300'
                                                    }`}
                                                  >
                                                    {input.trim() || "(فارغ)"} {isMatch ? '✓' : '✗'}
                                                  </span>
                                                );
                                              })
                                            ) : (
                                              <span className="text-red-700 font-bold">لم تُدخل أي إجابة</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* الإجابات الصحيحة */}
                                      <div className="flex items-start gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                                        <div>
                                          <span className="text-slate-500 font-semibold block text-[11px]">الإجابات الصحيحة (أسماء السور):</span>
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {m.correctSurahsList?.map((s: string, sIdx: number) => (
                                              <span key={sIdx} className="px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                {s}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-2.5 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-200/60">
                                      {/* إجابة المستخدم */}
                                      <div className="flex items-start gap-2 bg-red-50/70 p-2.5 rounded-xl border border-red-100 text-red-700">
                                        <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                                        <div>
                                          <span className="text-slate-500 font-semibold block text-[11px]">إجابتك التي اخترتها:</span>
                                          <span className="quran-text text-sm sm:text-base font-black text-red-700">{m.userAnswer || "لم يتم اختيار إجابة"}</span>
                                        </div>
                                      </div>

                                      {/* الإجابة الصحيحة لتكملة الآية */}
                                      <div className="flex items-start gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 text-emerald-800">
                                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                                        <div>
                                          <span className="text-slate-500 font-semibold block text-[11px]">الإجابة الصحيحة (تكملة الآية):</span>
                                          <span className="quran-text text-sm sm:text-base font-black text-emerald-800">
                                            {m.correctAnswer || m.correctText || m.challenge?.correctText || m.challenge?.options?.find((o: any) => o.isCorrect)?.text || "غير متوفر"}
                                          </span>
                                          {m.challenge?.verses?.[0]?.surah && (
                                            <span className="block text-[11px] text-emerald-600 font-bold mt-1">
                                              (الموضع: سورة {m.challenge.verses[0].surah}{m.challenge.verses[0].juz ? ` • الجزء ${m.challenge.verses[0].juz}` : ''})
                                            </span>
                                          )}
                                        </div>
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
                ) : view === 'settings' ? (
                  <SettingsView
                    playerName={playerName}
                    playerUsername={playerUsername}
                    totalPoints={totalPoints}
                    cups={cups}
                    activeFrame={activeFrame}
                    showProfileDecoration={showProfileDecoration}
                    setShowProfileDecoration={setShowProfileDecoration}
                    userCertificates={userCertificates}
                    onOpenCertificate={(cat) => {
                      setSelectedCategory(cat);
                      setShowCertificate(true);
                    }}
                    onActivateFrameAndCertificate={(cat) => {
                      const todayDate = new Date().toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      });
                      const certEntry = {
                        category: cat,
                        date: todayDate,
                        name: playerName || 'علاء'
                      };
                      const filtered = userCertificates.filter(c => c.category !== cat);
                      const updated = [...filtered, certEntry];
                      setUserCertificates(updated);
                      localStorage.setItem('quran_user_certificates', JSON.stringify(updated));

                      setActiveFrame(cat);
                      setIsNameDecorated(true);
                      setShowProfileDecoration(true);
                      localStorage.setItem('quran_active_frame', cat);
                      localStorage.setItem('quran_name_decorated', 'true');
                      localStorage.setItem('quran_show_decoration', 'true');

                      // Immediately sync active frame and achievement to database
                      if (playerUsername || playerName) {
                        fetch('/api/player-score', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: playerName,
                            username: playerUsername,
                            seerahCompleted: cat === 'seerah' || userCertificates.some(c => c.category === 'seerah'),
                            generalCompleted: cat === 'general' || userCertificates.some(c => c.category === 'general'),
                            activeFrame: cat
                          })
                        }).then(() => syncLeaderboard()).catch(err => console.error('Frame sync failed:', err));
                      }

                      setSelectedCategory(cat);
                      setShowCertificate(true);
                    }}
                    onSelectFrame={(frame) => {
                      setActiveFrame(frame);
                      if (frame) {
                        setIsNameDecorated(true);
                        setShowProfileDecoration(true);
                        localStorage.setItem('quran_active_frame', frame);
                        localStorage.setItem('quran_name_decorated', 'true');
                        localStorage.setItem('quran_show_decoration', 'true');
                      } else {
                        setIsNameDecorated(false);
                        setShowProfileDecoration(false);
                        localStorage.setItem('quran_active_frame', 'none');
                        localStorage.removeItem('quran_name_decorated');
                        localStorage.removeItem('quran_show_decoration');
                      }

                      if (playerUsername || playerName) {
                        fetch('/api/player-score', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: playerName,
                            username: playerUsername,
                            activeFrame: frame || 'none'
                          })
                        }).then(() => syncLeaderboard()).catch(err => console.error('Frame select sync failed:', err));
                      }
                    }}
                    onLogout={() => {
                      setPlayerName(null);
                      setPlayerUsername(null);
                      localStorage.removeItem('quran_player_name');
                      localStorage.removeItem('quran_player_username');
                      localStorage.removeItem('quran_device_id');
                      setView('home');
                    }}
                    onBackToHome={() => setView('home')}
                    onUpdatePlayer={(name, username) => {
                      setPlayerName(name);
                      setPlayerUsername(username);
                      localStorage.setItem('quran_player_name', name);
                      localStorage.setItem('quran_player_username', username);
                    }}
                    onStartQuizCategory={(_cat) => {
                      setView('islamic_quiz');
                    }}
                    onOpenDownloadApp={() => setShowDownloadModal(true)}
                    onOpenPrivacyPolicy={(tab) => {
                      setPrivacyModalInitialTab(tab || 'privacy');
                      setShowPrivacyModal(true);
                    }}
                  />
                ) : view === 'home' ? (
                  <motion.div
                    key="home"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-6 md:gap-10 max-w-6xl mx-auto py-6 md:py-10 px-4 overflow-visible pb-36 sm:pb-48"
                  >
                    {/* Premium Welcome Header Section */}
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center text-center space-y-4 mb-4"
                    >
                      <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">
                        السلام عليكم يا <span className={`underline decoration-brand-gold/30 decoration-4 underline-offset-8 transition-all ${isElite && isNameDecorated ? `text-transparent bg-clip-text bg-gradient-to-r ${currentStyle.textColor}` : 'text-brand-emerald'}`}>{playerName || 'يا ضيفنا الكريم'}</span>
                      </h1>

                      {/* Motivational Quote / Hadith */}
                      {motivationalQuote && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="max-w-3xl mx-auto px-4 py-2 text-center"
                        >
                          <h3 className="font-uthmani text-lg md:text-2xl lg:text-3xl text-emerald-950 font-bold leading-relaxed" dir="rtl">
                            "{motivationalQuote}"
                          </h3>
                        </motion.div>
                      )}

                      <div className="h-1 w-20 bg-brand-gold/30 rounded-full mx-auto mt-2" />
                    </motion.div>

                    {/* Top Interactive Hub: Prayer Times & 2x2 Stats Grid Side-by-Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch px-1">
                      {/* Prayer Times Box (Compact & Balanced) */}
                      <div className="lg:col-span-6 flex flex-col">
                        <Dashboard streakCount={streak} />
                      </div>

                      {/* 2x2 Stats Grid (مربعين فوق ومربعين تحت) */}
                      <div className="lg:col-span-6 flex flex-col justify-between">
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 h-full">
                          {/* 1. إجمالي الكؤوس */}
                          <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-amber-300 hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">إجمالي الكؤوس</span>
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Trophy className="w-4 h-4 text-amber-500" />
                              </div>
                            </div>
                            <div className="mt-3 text-right">
                              <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{cups}</span>
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">الأوسمة والبطولات</span>
                            </div>
                          </div>

                          {/* 2. نقاط المهارة */}
                          <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">نقاط المهارة</span>
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                              </div>
                            </div>
                            <div className="mt-3 text-right">
                              <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{totalPoints}</span>
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">رصيد الخبرة</span>
                            </div>
                          </div>

                          {/* 3. التقدم الكلي */}
                          <div className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-teal-300 hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">التقدم الكلي</span>
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                              </div>
                            </div>
                            <div className="mt-3 text-right">
                              <span className="text-2xl sm:text-3xl font-black text-slate-800 tabular-nums leading-tight block">{completedChallengeIds.size}</span>
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">تحدياً مكتملاً</span>
                            </div>
                          </div>

                          {/* 4. مواسم الطاعات وسنن الأيام */}
                          <button
                            onClick={() => setIsOccasionsModalOpen(true)}
                            className="bg-white p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between border border-slate-150 shadow-xs hover:border-amber-300 hover:shadow-md transition-all duration-200 text-right group cursor-pointer"
                            title="انقر لاستعراض أقرب مواسم الطاعات وسُنن الأيام والأحاديث الواردة فيها"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
                                مواسم الطاعات
                              </span>
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <Moon className="w-4 h-4 text-amber-500 fill-amber-500" />
                              </div>
                            </div>
                            <div className="mt-2 text-right">
                              <span className="text-sm sm:text-base font-black text-slate-800 leading-tight block truncate group-hover:text-amber-700 transition-colors">
                                {nearestOccasion.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/60 font-bold px-1.5 py-0.2 rounded-md shrink-0">
                                  {nearestOccasion.timingBadge}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold truncate">
                                  {nearestOccasion.hijriDateText}
                                </span>
                              </div>
                              <span className="text-[10px] text-amber-600 font-bold block mt-1 group-hover:underline">
                                استعراض السُنن والأحاديث 🌙
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subtitle / Last Played Date info */}
                    <div className="flex items-center justify-between px-3 -mt-2 text-xs text-slate-400 font-medium">
                      <span>آخر نشاط: <strong className="text-slate-600 font-bold">{lastPlayedDate ? (lastPlayedDate === new Date().toISOString().split('T')[0] ? 'اليوم' : lastPlayedDate) : 'لم يبدأ بعد'}</strong></span>
                      <span className="text-[11px] text-emerald-700/80 font-bold hidden sm:inline">انقر على شعلة الزاوية لمعرفة نظام الـ 24 ساعة ومهلة الإنقاذ 🔥</span>
                    </div>

                    {/* Daily Challenge Card on Home */}
                    <div className="px-1">
                      {dailyCompleted ? (
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-800 text-sm sm:text-base">تم إنجاز التحدي اليومي بنجاح!</h4>
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold px-2 py-0.5 rounded-full">مكتمل</span>
                              </div>
                              <p className="text-xs text-slate-400 font-bold mt-0.5">شعلتك مشتعلة بأمان حتى الغد. استمر في تعاهد كتاب الله.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setView('challenges')}
                            className="px-4 py-2 bg-slate-50 hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 shrink-0"
                          >
                            استكشف التحديات الأخرى
                          </button>
                        </div>
                      ) : streakInfo.status === 'warning' ? (
                        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-amber-500/10 border-2 border-amber-400 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                              <Flame className="w-5 h-5 text-amber-200" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                                  مهلة إنقاذ الشعلة: متبقي {streakInfo.timeLeftFormatted}
                                </span>
                              </div>
                              <h4 className="font-black text-amber-950 text-sm sm:text-base mt-1">
                                شعلتك انطفأت مؤقتاً! أنقذ سلسلتك الآن
                              </h4>
                              <p className="text-xs text-amber-900/80 font-bold mt-0.5">
                                أكمل التحدي اليومي قبل انتهاء المهلة لتعود الشعلة للاشتعال فوراً ولا تفقد تقدمك!
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleStartDaily}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0"
                          >
                            <Zap className="w-4 h-4 text-amber-200" />
                            <span>أنقذ الشعلة الآن 🔥</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-150 hover:border-emerald-400 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 text-right group">
                          <div className="flex items-center gap-3.5">
                            <DailyChallengeEmblem className="w-11 h-11 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-black text-slate-800 text-base group-hover:text-brand-emerald transition-colors">
                                  التحدي اليومي: إكمال الآية
                                </h4>
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-black px-2 py-0.5 rounded-full">
                                  تحدي اليوم
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                أكمل الآية الكريمة، وحافظ على اشتعال شعلتك اليومية واكسب نقاط المهارة القرآنية
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleStartDaily}
                            className="w-full sm:w-auto px-5 py-2.5 bg-brand-emerald hover:bg-[#033628] text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                          >
                            <span>ابدأ التحدي اليومي</span>
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Islamic Videos Quick Entry on Home */}
                    {!systemSettings.hideIslamicVideos && (
                      <div className="px-1 mt-1">
                        <motion.div
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setView('islamic_videos')}
                          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0D6E52] via-[#0A5640] to-[#043325] text-white shadow-md hover:shadow-xl transition-all cursor-pointer relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#D4AF37]/30"
                        >
                          {/* Geometric Pattern Overlay */}
                          <div
                            className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30zM30 6.863L53.137 30 30 53.137 6.863 30zM30 15l15 15-15 15-15-15z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                              backgroundSize: '40px 40px'
                            }}
                          />

                          <div className="flex items-center gap-3.5 relative z-10 w-full sm:w-auto">
                            <VideoLibraryIcon className="w-12 h-12 shrink-0 drop-shadow-md" />
                            <div className="text-right">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-black text-white text-base">
                                  المكتبة المرئية الإسلامية
                                </h4>
                                <span className="text-[10px] bg-[#D4AF37] text-[#0A5640] font-black px-2 py-0.5 rounded-full shadow-xs">
                                  جديد
                                </span>
                              </div>
                              <p className="text-xs text-emerald-100/90 font-semibold leading-relaxed">
                                روائع المقاطع الدعوية، شروحات الحديث، الفقه، والتفسير لكبار العلماء
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 relative z-10 self-end sm:self-center shrink-0">
                            <span className="px-4 py-2 bg-white/15 hover:bg-white/25 text-[#FCEEB5] border border-white/20 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 backdrop-blur-md">
                              <span>استعراض المرئيات</span>
                              <ArrowLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {/* Google Play Tester Button at the bottom (Web Version Only) */}
                    {!isNativeApp && (
                      <div className="px-1 mt-4 flex items-center justify-center">
                        <GooglePlayButton
                          status={testerStatus}
                          onClick={() => setShowGooglePlayModal(true)}
                        />
                      </div>
                    )}
                  </motion.div>
                ) : view === 'challenges' ? (
                  <motion.div
                    key="challenges"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-6 max-w-6xl mx-auto py-4 md:py-6 px-4 pb-36 sm:pb-48"
                  >
                    {/* Clean Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-brand-gold rounded-full" />
                        <div>
                          <h2 className="text-2xl md:text-3xl font-black text-brand-emerald tracking-tight">
                            التحديات الإسلامية
                          </h2>
                          <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
                            مسابقات قرآنية وثقافية لتثبيت الحفظ والمنافسة الشريفة
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Incomplete Challenge Alert */}
                    {incompleteChallenge && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50 border border-amber-200/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-right shadow-xs"
                      >
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Zap className="w-5 h-5 animate-bounce" />
                          </div>
                          <div>
                            <span className="font-black text-slate-800 text-sm sm:text-base block">لديك تحدٍ لم يكتمل بعد!</span>
                            <span className="text-xs font-bold text-slate-500">استمر في رحلتك وسجل اسمك بين المتصدرين</span>
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
                          className="w-full sm:w-auto px-5 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-xs sm:text-sm hover:bg-[#033628] transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2"
                        >
                          <span>متابعة التحدي</span>
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}

                    {/* Clean & Beautiful Challenges Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

                      {/* 1. Group Live Challenge Card (التحدي الجماعي) */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setView('group_join')}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-amber-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <GroupChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>مباشر الآن</span>
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-amber-700 transition-colors">
                            التحدي الجماعي
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            سباق مباشر في غرف خاصة وعامة في المتشابهات والمعلومات الإسلامية
                          </p>
                        </div>
                      </motion.button>

                      {/* 2. Daily Challenge Card (التحدي اليومي) */}
                      <motion.button
                        whileHover={{ y: dailyCompleted ? 0 : -3 }}
                        whileTap={{ scale: dailyCompleted ? 1 : 0.98 }}
                        onClick={handleStartDaily}
                        disabled={dailyCompleted}
                        className={`group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border min-h-[160px] ${
                          dailyCompleted
                            ? 'bg-slate-50 border-slate-150 opacity-70 grayscale'
                            : 'bg-white border-slate-150 hover:border-emerald-400 shadow-xs hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <DailyChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/40">
                              {dailyCompleted ? 'تم إنجازه' : 'كل 24 ساعة'}
                            </span>
                            {!dailyCompleted && (
                              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-brand-emerald group-hover:-translate-x-1 transition-all" />
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className={`text-base md:text-lg font-black ${dailyCompleted ? 'text-slate-500' : 'text-slate-800 group-hover:text-brand-emerald'} transition-colors`}>
                            التحدي اليومي
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            {dailyCompleted ? 'أحسنت! نراك غداً لمتابعة سلسلة إنجازك' : 'إكمال الآية اليومية لتثبيت حفظ الورد ومضاعفة نقاطك'}
                          </p>
                        </div>

                        {dailyCompleted && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">الموعد القادم:</span>
                            <span className="text-xs font-black text-brand-emerald tabular-nums">{timeLeft}</span>
                          </div>
                        )}
                      </motion.button>

                      {/* 3. Skills Challenge Card (تحدي المهارات) */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setIsSpeedMode(false);
                          setView('skills_menu');
                        }}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-teal-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <SkillsChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/40">
                              {systemSettings.hideAudioChallenge ? 'مهارتان' : '3 مهارات'}
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-teal-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-teal-700 transition-colors">
                            تحدي المهارات
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            {systemSettings.hideAudioChallenge
                              ? 'إكمال المتشابهات القرآنية، وتحديد اسم السورة الكريمة'
                              : 'تلاوة صوتية بالذكاء الاصطناعي، أو إكمال المتشابهات، أو اسم السورة'}
                          </p>
                        </div>
                      </motion.button>

                      {/* 4. Speed Challenge Card (تحدي السرعة) */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setIsSpeedMode(true);
                          setView('speed_menu');
                        }}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-rose-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <SpeedChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/40">
                              30 ثانية
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-rose-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-rose-700 transition-colors">
                            تحدي السرعة
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            اختبار سرعة البديهة واستحضار الآيات المتشابهة مع العداد
                          </p>
                        </div>
                      </motion.button>

                      {/* 5. Islamic Knowledge Quiz Card (تحدي معلومات إسلامية) */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setView('islamic_quiz')}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-emerald-500 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <IslamicQuizEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/40">
                              5,820 سؤال
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                            تحدي معلومات إسلامية
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            موسوعة أسئلة شاملة في العقيدة، الفقه، السيرة، التفسير، والتاريخ
                          </p>
                        </div>
                      </motion.button>

                    </div>
                  </motion.div>
                ) : view === 'library' ? (
                  <motion.div
                    key="library"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col gap-6 max-w-6xl mx-auto py-4 md:py-6 px-4 pb-36 sm:pb-48"
                  >
                    {/* Clean Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-brand-gold rounded-full" />
                        <div>
                          <h2 className="text-2xl md:text-3xl font-black text-brand-emerald tracking-tight">
                            المكتبة والعلوم الشرعية
                          </h2>
                          <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
                            المصحف الشريف، الأذكار، الأحاديث، وتفاسير القرآن الكريم
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Clean & Beautiful Library Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

                      {/* 1. Mushaf Card */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setView('mushaf');
                          setSelectedSurahId(null);
                          setSelectedJuz(null);
                          setIsSearchSubmitted(false);
                          setIsPageModeActive(false);
                        }}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-blue-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <MushafLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                              القرآن الكريم
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-blue-700 transition-colors">
                            المصحف الشريف
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            تصفح القرآن الكريم كاملاً بالرسم العثماني المقروء
                          </p>
                        </div>
                      </motion.button>

                      {/* 2. Adhkar Card */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setView('adhkar'); setSelectedAdhkarCategoryId(null); }}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-indigo-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <AdhkarLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                              حصن المسلم
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-indigo-700 transition-colors">
                            أذكار المسلم
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            أذكار الصباح والمساء واليوم والليلة بالأدعية الصحيحة المأثورة
                          </p>
                        </div>
                      </motion.button>

                      {/* 3. Hadith Card */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setView('hadith'); setSelectedHadith(null); }}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-teal-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <HadithLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/50">
                              السنة النبوية
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-teal-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-teal-700 transition-colors">
                            الأربعون النووية
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            قراءة وشرح وتبسيط أحاديث الأربعين النووية الشريفة
                          </p>
                        </div>
                      </motion.button>

                      {/* 4. Book Card */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setView('book')}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-amber-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <BookLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/50">
                              كتاب تعليمي
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-amber-700 transition-colors">
                            كتاب المتشابهات
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            كتاب اللؤلؤ والمرجان في ضبط متشابهات القرآن الكريم
                          </p>
                        </div>
                      </motion.button>

                      {/* 5. Encyclopedia Card */}
                      <motion.button
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setView('encyclopedia')}
                        className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-purple-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
                      >
                        <div className="flex items-start justify-between">
                          <EncyclopediaLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/50">
                              موسوعة شاملة
                            </span>
                            <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-purple-600 group-hover:-translate-x-1 transition-all" />
                          </div>
                        </div>

                        <div className="mt-4">
                          <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-purple-700 transition-colors">
                            الموسوعة
                          </h3>
                          <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                            موسوعة العلوم الشرعية وتوجيه متشابهات القرآن
                          </p>
                        </div>
                      </motion.button>

                      {/* 6. Islamic Videos Card (المكتبة المرئية) */}
                      {!systemSettings.hideIslamicVideos && (
                        <motion.button
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setView('islamic_videos')}
                          className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-[#0D6E52] bg-white shadow-xs hover:shadow-md min-h-[160px]"
                        >
                          <div className="flex items-start justify-between">
                            <VideoLibraryIcon className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/50">
                                مرئيات دعوية
                              </span>
                              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-[#0D6E52] group-hover:-translate-x-1 transition-all" />
                            </div>
                          </div>

                          <div className="mt-4">
                            <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-[#0D6E52] transition-colors">
                              المكتبة المرئية
                            </h3>
                            <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                              دروس وشروحات ومواعظ مرئية مبوبة لكبار العلماء والدعاة
                            </p>
                          </div>
                        </motion.button>
                      )}

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
                    className={`w-full ${isPageModeActive ? 'max-w-full lg:max-w-[92rem] px-0' : 'md:max-w-5xl lg:max-w-6xl px-0 md:px-6'} mx-auto space-y-4 pt-1 pb-56 sm:pb-64 md:pt-2 transition-all duration-500`}
                  >
                    {!selectedSurahId && !selectedJuz && !isSearchSubmitted ? (
                      <div className="space-y-6 px-2 md:px-0">
                        {!isPageModeActive ? (
                          /* ========================================================
                             شاشة الترحيب والتعريف بمزايا المصحف الشريف وتفاصيل الآيات
                             ======================================================== */
                          <div className="space-y-5 max-w-4xl mx-auto px-2 md:px-0 py-1">
                            {/* شريط ملاحة علوي بسيط: العودة للمكتبة + شارة المصحف */}
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => {
                                  setView('library');
                                  setIsPageModeActive(false);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`px-4 py-2 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs md:text-sm shadow-xs cursor-pointer ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:text-emerald-400'
                                    : 'bg-white/80 border-slate-200 text-slate-600 hover:text-brand-emerald'
                                }`}
                              >
                                <ArrowRight className="w-4 h-4 text-brand-emerald" />
                                <span>العودة إلى المكتبة</span>
                              </button>

                              <span className="text-xs font-black px-3.5 py-1 rounded-full bg-emerald-500/10 text-brand-emerald border border-emerald-500/20 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                                <span>مصحف المدينة النبوية • أوفلاين 100%</span>
                              </span>
                            </div>

                            {/* رأس الصفحة: الأيقونة والعنوان والوصف (بدون خلفية بيضاء) */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right pt-1">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-brand-emerald to-teal-800 text-brand-gold flex items-center justify-center shrink-0 shadow-md border-2 border-brand-gold/30">
                                <BookOpen className="w-7 h-7 md:w-8 md:h-8 text-brand-gold" />
                              </div>
                              <div className="flex-1">
                                <h2 className="text-2xl md:text-3xl font-black text-brand-emerald flex items-center justify-center sm:justify-start gap-2">
                                  <span>المصحف الشريف</span>
                                  <Sparkles className="w-5 h-5 text-brand-gold" />
                                </h2>
                                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                  نسخة رقمية تفاعلية فائقة الجودة بالرسم العثماني المعتمد لمصحف المدينة النبوية، تعمل محلياً بالكامل بدون إنترنت.
                                </p>
                              </div>
                            </div>

                            {/* أزرار العمل في الأعلى: فتح المصحف الشريف + زر الميزات */}
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              {/* زر فتح المصحف الشريف في الأعلى مباشرة */}
                              <button
                                onClick={() => {
                                  setIsPageModeActive(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="flex-1 min-w-[220px] px-6 md:px-8 py-3.5 md:py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm md:text-base shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2.5 border border-emerald-400/30 cursor-pointer group"
                              >
                                <BookOpen className="w-5 h-5 text-brand-gold group-hover:rotate-6 transition-transform" />
                                <span>فتح المصحف الشريف</span>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                                  {currentPage > 1 ? `متابعة (صفحة ${currentPage})` : 'سورة الفاتحة'}
                                </span>
                              </button>

                              {/* زر إظهار المميزات والخصائص في نافذة منبثقة */}
                              <button
                                onClick={() => setIsMushafFeaturesModalOpen(true)}
                                className={`px-5 py-3.5 md:py-4 rounded-2xl border transition-all flex items-center justify-center gap-2 font-black text-xs md:text-sm shadow-xs cursor-pointer active:scale-95 ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-emerald-400'
                                    : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-brand-emerald hover:border-emerald-300'
                                }`}
                                title="عرض مميزات وخصائص المصحف"
                              >
                                <Sparkles className="w-4 h-4 text-brand-gold" />
                                <span>مميزات وخصائص المصحف</span>
                              </button>

                              {currentPage > 1 && (
                                <button
                                  onClick={() => {
                                    setCurrentPage(1);
                                    setIsPageModeActive(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`px-4 py-3.5 md:py-4 rounded-2xl border font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                    librarySettings.darkMode
                                      ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                                      : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                  title="البدء من الفاتحة صفحة 1"
                                >
                                  <RotateCcw className="w-4 h-4 text-slate-400" />
                                  <span>البدء من الفاتحة (ص 1)</span>
                                </button>
                              )}
                            </div>

                            {/* مربع الإرشاد البارز: لإظهار تفاصيل الآية، اضغط عليها (بدون خلفية بيضاء صلبة) */}
                            <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-colors space-y-4 ${
                              librarySettings.darkMode
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                                : 'bg-emerald-50/70 border-emerald-500/25 text-slate-800'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-emerald text-brand-gold flex items-center justify-center shrink-0 shadow-md">
                                  <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="text-lg md:text-xl font-black text-brand-emerald">
                                    لإظهار تفاصيل الآية، اضغط عليها
                                  </h3>
                                  <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
                                    أثناء تصفحك للمصحف، انقر مباشرة على أي آية وستظهر لك نافذة تفاعلية شاملة تقدم:
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* تفصيل 1: التفسير الميسر */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-emerald-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-xl">
                                    📖
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">التفسير الميسر أوفلاين</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      قراءة التفسير المعتمد للآية كاملاً وفهم معانيها مباشرة دون الحاجة لأي اتصال بالإنترنت.
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 2: كشف المتشابهات */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-amber-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-xl">
                                    🔍
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">كشف المتشابهات القرآنية</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      كشف فوري ودقيق للآيات المتشابهة لفظاً وموضعاً في كافة سور القرآن الكريم لضبط وتثبيت الحفظ.
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 3: الاستماع للتلاوة */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-blue-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-xl">
                                    🔊
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">الاستماع للتلاوة العطرة</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      استماع فوري للآية بصوت نخبة من كبار القراء (الحصري، المنشاوي، مشاري العفاسي، عبد الباسط).
                                    </p>
                                  </div>
                                </div>

                                {/* تفصيل 4: نسخ ومشاركة الآية */}
                                <div className={`p-3.5 rounded-xl border shadow-xs flex items-start gap-3 transition-colors ${
                                  librarySettings.darkMode
                                    ? 'bg-slate-800/60 border-slate-700'
                                    : 'bg-white/85 border-purple-100'
                                }`}>
                                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 text-xl">
                                    📋
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">نسخ ومشاركة الآية</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5 leading-relaxed">
                                      نسخ نص الآية الكريمة بالرسم العثماني المعتمد موثقة باسم السورة ورقم الآية للمشاركة السريعة.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* نافذة منبثقة لمميزات وخصائص المصحف الشريف */}
                            <AnimatePresence>
                              {isMushafFeaturesModalOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 md:p-8 shadow-2xl border ${
                                      librarySettings.darkMode
                                        ? 'bg-slate-900 border-slate-800 text-slate-100'
                                        : 'bg-white border-slate-200 text-slate-900'
                                    }`}
                                  >
                                    {/* رأس النافذة */}
                                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-emerald text-brand-gold flex items-center justify-center shadow-md">
                                          <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <h3 className="text-lg md:text-xl font-black text-brand-emerald">
                                            مميزات وخصائص المصحف الشريف
                                          </h3>
                                          <p className="text-xs font-bold text-slate-400">
                                            مصحف المدينة النبوية الشريف بالرسم العثماني • أوفلاين 100%
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => setIsMushafFeaturesModalOpen(false)}
                                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="إغلاق"
                                      >
                                        <X className="w-5 h-5" />
                                      </button>
                                    </div>

                                    {/* شبكة المميزات */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🖼️</span>
                                          <span>رسم عثماني أصيل فائق النقاء</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          صفحات مصحف المدينة النبوية المعتمدة عالية الدقة بدون أي حواف أو إطارات مشتتة.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🔎</span>
                                          <span>تكبير وتحريك ثنائي الأبعاد</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          حرية كاملة لتكبير الصفحات (2D Zoom & Pan) وقراءة الآيات بأي حجم مريح لعينيك.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">📑</span>
                                          <span>فهرس السور والأجزاء</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          تصفح سريع لكافة الـ 114 سورة والـ 30 جزءاً مع الانتقال المباشر لأي صفحة وبحث نصي ذكي.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">📴</span>
                                          <span>يعمل 100% بدون إنترنت</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          جميع صفحات المصحف وإحداثيات الآيات والتفاسير والمتشابهات مدمجة محلياً دون الحاجة لشبكة.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🌙</span>
                                          <span>الوضع الليلي والنهاري</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          خلفيات مخطوطات دافئة في النهار، مع وضع داكن مهدئ ومريح للقراءة في الليل.
                                        </p>
                                      </div>

                                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                          <span className="text-xl">🖥️</span>
                                          <span>قراءة غامرة بملء الشاشة</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1.5 leading-relaxed">
                                          إمكانية تفعيل وضع ملء الشاشة لإخفاء كل ما حول الصفحة للتفرغ التام للتدبر والتلاوة.
                                        </p>
                                      </div>
                                    </div>

                                    {/* أزرار أسفل النافذة */}
                                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                      <button
                                        onClick={() => setIsMushafFeaturesModalOpen(false)}
                                        className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      >
                                        إغلاق
                                      </button>
                                      <button
                                        onClick={() => {
                                          setIsMushafFeaturesModalOpen(false);
                                          setIsPageModeActive(true);
                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="px-6 py-2.5 rounded-xl bg-brand-emerald text-white font-black text-xs hover:bg-brand-emerald/90 transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                                      >
                                        <BookOpen className="w-4 h-4 text-brand-gold" />
                                        <span>فتح المصحف الآن</span>
                                      </button>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : (
                          /* ========================================================
                             وضع القراءة النشط: يظهر فقط شريط الفلاتر والبحث والمصحف
                             ======================================================== */
                          <>
                            {/* Header Title & Search Bar with Buttons Side-by-Side */}
                            <div className={`flex flex-col gap-4 p-4 md:p-6 rounded-2xl md:rounded-3xl border shadow-sm transition-colors ${librarySettings.darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/70 border-white/80 text-slate-900'
                              }`}>
                              <div className="flex items-center justify-between gap-4">
                                <h2 className={`text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3 ${librarySettings.darkMode ? 'text-emerald-400' : 'text-brand-emerald'
                                  }`}>
                                  <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-brand-gold" />
                                  {`المصحف الشريف - الصفحة ${currentPage}`}
                                </h2>

                                <button
                                  onClick={() => {
                                    setIsPageModeActive(false);
                                    setIsSurahMenuOpen(false);
                                    setIsJuzMenuOpen(false);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                    }`}
                                  title="دليل ومزايا المصحف"
                                >
                                  <ArrowRight className="w-4 h-4 text-brand-emerald" />
                                  <span>دليل المصحف</span>
                                </button>
                              </div>

                              {/* Row 1: Search Form + Settings + Fullscreen */}
                              <div className="flex items-center gap-2 md:gap-3 w-full">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    if (searchQuery.trim()) {
                                      setIsSearchSubmitted(true);
                                    }
                                  }}
                                  className="flex items-center gap-2 flex-1 min-w-[180px]"
                                >
                                  <div className="relative flex-1">
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                      type="text"
                                      placeholder="ابحث عن آية أو كلمة..."
                                      value={searchQuery}
                                      onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (e.target.value === '') setIsSearchSubmitted(false);
                                      }}
                                      className={`w-full pr-10 pl-4 py-2.5 md:py-3.5 rounded-2xl border shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 transition-all font-bold text-sm md:text-base ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900'
                                        }`}
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    className="px-4 md:px-6 py-2.5 md:py-3.5 bg-brand-emerald text-white rounded-2xl font-black hover:bg-brand-emerald/90 transition-all shadow-md active:scale-95 whitespace-nowrap text-sm md:text-base shrink-0 cursor-pointer"
                                  >
                                    بحث
                                  </button>
                                </form>

                                {/* Settings button */}
                                <button
                                  onClick={() => setIsSettingsOpen(true)}
                                  className={`px-3.5 md:px-4 py-2.5 md:py-3.5 rounded-2xl border transition-all shadow-sm flex items-center justify-center gap-1.5 font-bold text-xs md:text-sm whitespace-nowrap shrink-0 cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                    }`}
                                  title="إعدادات المصحف"
                                >
                                  <Settings className="w-4 h-4 text-brand-emerald" />
                                  <span className="hidden sm:inline">الإعدادات</span>
                                </button>

                                {/* Fullscreen button */}
                                <button
                                  type="button"
                                  onClick={enterMushafFullscreen}
                                  className={`px-3.5 md:px-4 py-2.5 md:py-3.5 rounded-2xl border transition-all shadow-sm flex items-center justify-center gap-1.5 font-bold text-xs md:text-sm whitespace-nowrap shrink-0 cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-200 text-slate-600 hover:text-brand-emerald'
                                    }`}
                                  title="ملء الشاشة"
                                >
                                  <Maximize2 className="w-4 h-4 text-brand-gold" />
                                  <span className="hidden sm:inline">ملء الشاشة</span>
                                </button>
                              </div>

                              {/* Row 2: Surah & Juz Buttons directly Underneath Search & Settings */}
                              <div className="flex items-center gap-2.5 w-full pt-1">
                                <button
                                  onClick={() => {
                                    setIsSurahMenuOpen(!isSurahMenuOpen);
                                    setIsJuzMenuOpen(false);
                                  }}
                                  className={`flex-1 py-2.5 md:py-3 rounded-2xl border transition-all font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs whitespace-nowrap cursor-pointer ${isSurahMenuOpen ? 'bg-brand-emerald text-white border-brand-emerald' : (librarySettings.darkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-emerald-600 hover:text-white' : 'bg-white text-slate-700 border-slate-200 hover:bg-brand-emerald/5 hover:text-brand-emerald')
                                    }`}
                                  title="تصفح بالسور"
                                >
                                  <BookOpen className="w-4 h-4 text-brand-gold" />
                                  <span>تصفح بالسور (114 سورة)</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setIsJuzMenuOpen(!isJuzMenuOpen);
                                    setIsSurahMenuOpen(false);
                                  }}
                                  className={`flex-1 py-2.5 md:py-3 rounded-2xl border transition-all font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xs whitespace-nowrap cursor-pointer ${isJuzMenuOpen ? 'bg-brand-emerald text-white border-brand-emerald' : (librarySettings.darkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-emerald-600 hover:text-white' : 'bg-white text-slate-700 border-slate-200 hover:bg-brand-emerald/5 hover:text-brand-emerald')
                                    }`}
                                  title="تصفح بالأجزاء"
                                >
                                  <ListFilter className="w-4 h-4 text-brand-gold" />
                                  <span>تصفح بالأجزاء (30 جزء)</span>
                                </button>
                              </div>
                            </div>

                            {/* Surah Dropdown Popup Menu */}
                            <AnimatePresence>
                              {isSurahMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`backdrop-blur-xl p-4 rounded-3xl border shadow-lg ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/90 border-white/80'}`}
                                >
                                  <h3 className={`font-black text-sm mb-3 ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>اختر السورة (114 سورة):</h3>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-72 overflow-y-auto">
                                    {quranData.map((surah: any) => (
                                      <button
                                        key={surah.id}
                                        onClick={() => {
                                          setCurrentPage(surahStartPages[surah.id] || 1);
                                          setIsSurahMenuOpen(false);
                                          setIsPageModeActive(true);
                                        }}
                                        className={`p-2 rounded-xl transition-all text-xs font-bold text-right flex items-center justify-between ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
                                      >
                                        <span className="truncate">{surah.id}. {surah.name}</span>
                                        <span className="text-[9px] opacity-70">ص {surahStartPages[surah.id] || 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Juz Dropdown Popup Menu */}
                            <AnimatePresence>
                              {isJuzMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`backdrop-blur-xl p-4 rounded-3xl border shadow-lg ${librarySettings.darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/90 border-white/80'}`}
                                >
                                  <h3 className={`font-black text-sm mb-3 ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'}`}>اختر الجزء (1-30):</h3>
                                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                                    {Array.from({ length: 30 }).map((_, i) => (
                                      <button
                                        key={i + 1}
                                        onClick={() => {
                                          setSelectedJuz(i + 1);
                                          setIsJuzMenuOpen(false);
                                          setCurrentPage(juzStartPages[i + 1] || 1);
                                          setIsPageModeActive(true);
                                        }}
                                        className={`aspect-square rounded-xl transition-all font-black text-xs flex flex-col items-center justify-center ${librarySettings.darkMode ? 'bg-slate-800 text-slate-200 hover:bg-brand-emerald hover:text-white' : 'bg-slate-50 hover:bg-brand-emerald hover:text-white'}`}
                                      >
                                        <span className="text-[8px] opacity-50">جزء</span>
                                        <span>{i + 1}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Page Container: Premium Islamic Manuscript Background Frame */}
                            <div className="w-full flex flex-col items-center gap-4">
                              <div
                                className="w-full p-0 sm:p-1 md:p-2 border-0 md:border-2 md:border-brand-gold/30 md:rounded-[2.5rem] md:shadow-2xl transition-all overflow-hidden relative group"
                                style={{
                                  backgroundColor: librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
                                  color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                                  backgroundImage: librarySettings.darkMode
                                    ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.95) 75%)'
                                    : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, transparent 75%)',
                                }}
                              >
                                {/* Decorative Inner Gold Border Line for Desktop */}
                                <div className="hidden md:block absolute inset-2 rounded-[2rem] border border-brand-gold/20 pointer-events-none" />

                                {/* Full-Width Mobile & Desktop Image with 2D Pan, Pinch-Zoom & Page Flip */}
                                <div className="w-full flex flex-col items-center p-0 relative z-10 min-h-[70vh]">
                                  <QuranZoomViewer
                                    pageNumber={currentPage}
                                    darkMode={librarySettings.darkMode}
                                    isFullscreen={false}
                                    externalScale={mushafZoomScale}
                                    onExternalScaleChange={setMushafZoomScale}
                                    onPageTurn={(dir) => {
                                      setPageTurnDirection(dir);
                                      if (dir === 'next') {
                                        setCurrentPage(prev => Math.min(604, prev + 1));
                                      } else {
                                        setCurrentPage(prev => Math.max(1, prev - 1));
                                      }
                                    }}
                                    onTap={() => setSelectedAyah(null)}
                                    pageTurnDirection={pageTurnDirection}
                                    selectedAyah={selectedAyah}
                                    onSelectAyah={(s, a) => setSelectedAyah({ surah: s, ayah: a })}
                                  />
                                </div>
                              </div>

                              {/* Controls Area Completely OUTSIDE & BELOW Image Frame Container */}
                              <div className={`flex flex-col items-center gap-2 py-2.5 px-3 w-full max-w-2xl backdrop-blur-xl border rounded-2xl shadow-md mt-2 transition-colors ${librarySettings.darkMode
                                  ? 'bg-slate-900/95 border-slate-800 text-slate-100'
                                  : 'bg-white/85 border-slate-200/90 text-slate-800'
                                }`}>
                                {/* Single Row: Page Navigation + Zoom Controls Side-by-Side */}
                                <div className="flex flex-nowrap items-center justify-center gap-2 sm:gap-3 w-full overflow-x-auto">
                                  {/* Page Navigation Group */}
                                  <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-xs shrink-0 ${librarySettings.darkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200/80'
                                    }`}>
                                    <button
                                      onClick={() => {
                                        setPageTurnDirection('prev');
                                        setCurrentPage(prev => Math.max(1, prev - 1));
                                      }}
                                      disabled={currentPage === 1}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="الصفحة السابقة"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1 px-1">
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
                                        className={`w-10 sm:w-12 border rounded text-center text-xs sm:text-sm font-black focus:outline-none focus:ring-1 focus:ring-brand-emerald/30 shadow-2xs py-0.5 ${librarySettings.darkMode ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-brand-emerald'
                                          }`}
                                      />
                                      <span className={`text-[10px] sm:text-xs font-bold shrink-0 ${librarySettings.darkMode ? 'text-slate-400' : 'text-slate-500'}`}>من 604</span>
                                    </div>

                                    <button
                                      onClick={() => {
                                        setPageTurnDirection('next');
                                        setCurrentPage(prev => Math.min(604, prev + 1));
                                      }}
                                      disabled={currentPage === 604}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="الصفحة التالية"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Separator Divider */}
                                  <div className={`w-px h-6 shrink-0 ${librarySettings.darkMode ? 'bg-slate-700' : 'bg-slate-300/80'}`} />

                                  {/* Zoom Controls Group */}
                                  <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-xs shrink-0 ${librarySettings.darkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-100/90 border-slate-200/80'
                                    }`}>
                                    <button
                                      onClick={() => setMushafZoomScale(prev => Math.min(1.8, Number((prev + 0.1).toFixed(1))))}
                                      disabled={mushafZoomScale >= 1.8}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="تكبير الصفحة"
                                    >
                                      <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>

                                    <button
                                      onClick={() => setMushafZoomScale(1)}
                                      className={`px-2 py-1 rounded border text-[10px] sm:text-xs font-black transition-colors shadow-2xs shrink-0 ${mushafZoomScale === 1
                                          ? (librarySettings.darkMode ? 'bg-emerald-900/60 border-emerald-500 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-brand-emerald font-black')
                                          : (librarySettings.darkMode ? 'bg-slate-900 border-slate-700 text-slate-200 hover:text-emerald-400' : 'bg-white border-slate-300 text-slate-800 hover:text-brand-emerald')
                                        }`}
                                      title="إعادة تعيين 100%"
                                    >
                                      {Math.round(mushafZoomScale * 100)}%
                                    </button>

                                    <button
                                      onClick={() => setMushafZoomScale(prev => Math.max(0.7, Number((prev - 0.1).toFixed(1))))}
                                      disabled={mushafZoomScale <= 0.7}
                                      className={`p-1.5 sm:p-2 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs shrink-0 active:scale-95 ${librarySettings.darkMode ? 'bg-slate-700 hover:bg-emerald-600' : 'bg-emerald-700 hover:bg-emerald-800'
                                        }`}
                                      title="تصغير الصفحة"
                                    >
                                      <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Row 2: Index Return Button */}
                                <button
                                  onClick={() => {
                                    setIsPageModeActive(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white transition-all font-bold text-xs shadow-sm border active:scale-95 cursor-pointer ${librarySettings.darkMode ? 'bg-slate-800 hover:bg-emerald-600 border-slate-700' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-emerald-500/60'
                                    }`}
                                  title="العودة لدليل وفهرس المصحف"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-brand-gold" />
                                  <span>العودة لدليل وفهرس المصحف</span>
                                </button>
                              </div>

                              {/* Generous Bottom Spacer */}
                              <div className="h-28 sm:h-36 w-full shrink-0" />
                            </div>
                          </>
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
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                                librarySettings.darkMode
                                  ? 'bg-slate-800 text-slate-100 hover:bg-emerald-600 border border-slate-700'
                                  : 'bg-brand-emerald text-white hover:bg-emerald-700 shadow-emerald-800/20'
                              }`}
                            >
                              <RotateCcw className="w-4 h-4 text-brand-gold" />
                              <span>العودة لفهرس السور والأجزاء</span>
                            </button>
                          </div>
                          <div className="h-28 sm:h-36 w-full shrink-0" />
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
                              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs md:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                                librarySettings.darkMode
                                  ? 'bg-slate-800 text-slate-100 hover:bg-emerald-600 border border-slate-700'
                                  : 'bg-brand-emerald text-white hover:bg-emerald-700 shadow-emerald-800/20'
                              }`}
                            >
                              <RotateCcw className="w-4 h-4 text-brand-gold" />
                              <span>العودة لفهرس السور والأجزاء</span>
                            </button>
                          </div>
                          <div className="h-28 sm:h-36 w-full shrink-0" />
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
                    className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500 pb-36 sm:pb-48"
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
                    className="w-full max-w-5xl mx-auto space-y-12 transition-all duration-500 pb-36 sm:pb-48"
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
                    <BookReader onBack={() => setView('home')} darkMode={librarySettings.darkMode} />
                  </motion.div>
                ) : view === 'encyclopedia' ? (
                  <motion.div
                    key="encyclopedia"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <Encyclopedia onBack={() => setView('home')} darkMode={librarySettings.darkMode} />
                  </motion.div>
                ) : view === 'islamic_videos' ? (
                  !systemSettings.hideIslamicVideos ? (
                    <motion.div
                      key="islamic_videos"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="w-full"
                    >
                      <IslamicVideos onBack={() => setView('library')} />
                    </motion.div>
                  ) : (
                    <div className="text-center py-24 px-4 max-w-md mx-auto">
                      <p className="text-slate-500 font-bold mb-4">هذا القسم غير متاح حالياً.</p>
                      <button onClick={() => setView('home')} className="px-6 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-sm">
                        العودة للرئيسية
                      </button>
                    </div>
                  )
                ) : view === 'islamic_quiz' ? (
                  <motion.div
                    key="islamic_quiz"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full"
                  >
                    <IslamicQuiz
                      onBack={() => setView('home')}
                      onWin={updateStatsAfterWin}
                      claimedCategories={userCertificates.map(c => c.category)}
                      onShowCertificate={(cat) => {
                        setSelectedCategory(cat);
                        setShowCertificate(true);
                      }}
                    />
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
                      <div key="game" className="space-y-2 md:space-y-4 max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto w-full px-2 md:px-4 pt-1 md:pt-4">
                        {/* Floating Timer UI for Speed Mode or Multiplayer Room with Timer */}
                        {(isSpeedMode || (room && (room.timePerQuestion || 0) > 0)) && (
                          <div className="flex justify-center mb-2 sticky top-2 z-50">
                            <motion.div
                              animate={{
                                scale: speedTimeLeft <= 5 ? [1, 1.05, 1] : 1,
                                backgroundColor: speedTimeLeft <= 5 ? '#fee2e2' : '#ffffff'
                              }}
                              transition={{ repeat: speedTimeLeft <= 5 ? Infinity : 0, duration: 0.5 }}
                              className={`glass px-3.5 md:px-4 py-1 rounded-full shadow-md border flex items-center gap-2 ${speedTimeLeft <= 5 ? 'border-red-500' : 'border-brand-emerald/20'}`}
                            >
                              <div className={`p-1 rounded-lg ${speedTimeLeft <= 5 ? 'bg-red-500 text-white' : 'bg-brand-emerald text-white'}`}>
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div className="text-right flex items-center gap-1.5">
                                <span className={`text-xs md:text-sm font-black tabular-nums ${speedTimeLeft <= 5 ? 'text-red-600' : 'text-slate-800'}`}>
                                  {speedTimeLeft} ثانية
                                </span>
                                {isSpeedMode && currentChallenge?.level && (
                                  <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                    (currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'bg-rose-100 text-rose-700' :
                                    (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {(currentChallenge.level === 'hard' || currentChallenge.level === 'صعب') ? 'صعب (20ث)' :
                                     (currentChallenge.level === 'easy' || currentChallenge.level === 'سهل') ? 'سهل (10ث)' :
                                     'متوسط (15ث)'}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        )}

                        {/* Multiplayer Real-time Question Counter & Speed Bonus Indicator */}
                        {room && room.transitionMode !== 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              <span className="text-white font-black text-xs md:text-sm">
                                أجاب {room.answeredCount ?? 0} من {room.totalParticipants ?? room.participants?.length ?? 1} لاعبين
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {room && room.transitionMode === 'ASYNC' && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-between gap-2.5 p-3 md:p-3.5 bg-linear-to-r from-slate-900/90 to-slate-800/90 text-white rounded-2xl border border-white/10 shadow-lg mb-4 text-xs font-bold"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🚀</span>
                              <span className="text-white font-black text-xs md:text-sm">
                                سباق فردي سريع (أجب بأقصى سرعة ودقة!)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-xl border border-amber-400/30 text-[11px] font-black">
                              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>أول 4 إجابات صحيحة تنال بونص سرعة (+1) ⚡</span>
                            </div>
                          </motion.div>
                        )}

                        {/* Multiplayer Waiting State after answering - Placed ABOVE the question (Only in SYNC mode) */}
                        {room && room.transitionMode !== 'ASYNC' && hasAnsweredCurrentQuestion && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="mb-4 p-3.5 md:p-4 rounded-2xl bg-linear-to-r from-amber-50 via-orange-50/80 to-amber-50 border-2 border-amber-300 shadow-md text-center space-y-2"
                          >
                            <div className="flex items-center justify-center gap-2.5">
                              <div className="w-7 h-7 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                              <h4 className="text-sm md:text-base font-black text-amber-900">
                                تم تسجيل إجابتك بنجاح، بانتظار باقي المتسابقين...
                              </h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-amber-700 font-bold max-w-lg mx-auto leading-relaxed">
                              سينتقل الجميع تلقائياً إلى السؤال التالي فور اكتمال إجابات اللاعبين أو انتهاء وقت السؤال.
                            </p>
                            <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border border-amber-200 text-[11px] font-black text-amber-800 shadow-xs">
                              <Users className="w-3.5 h-3.5 text-amber-600" />
                              <span>أجاب ({room.answeredCount ?? 0} من {room.totalParticipants ?? room.participants?.length ?? 1})</span>
                            </div>
                          </motion.div>
                        )}

                        <SkillsChallengeHeader
                          index={challengeMode === 'daily' ? dailyChallengeIndex : (view === 'challenge' ? currentChallengeIndex : sessionCurrentIndex)}
                          total={challengeMode === 'daily' ? 1 : (challenges.length > 50 ? 20 : Math.max(challenges.length, 1))}
                          mode={challengeMode === 'daily' ? 'complete' : skillsType}
                          title={challengeMode === 'daily' ? 'التحدي اليومي: إكمال الآية' : (room?.gameMode === 'ISLAMIC' || v1GameModes.includes('islamic') ? 'تحدي معلومات إسلامية' : undefined)}
                          verseText={KEYWORD}
                          totalPoints={totalPoints}
                          onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
                          isComplete={isComplete}
                          level={currentChallenge?.level}
                        />
                        {skillsType === 'audio' && challengeMode !== 'daily' ? (
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
                        ) : skillsType === 'surah' && challengeMode !== 'daily' ? (
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
                            surahFeedbackData={surahFeedbackData}
                          />
                        ) : (
                          <CompleteChallengeUI
                            verseText={KEYWORD}
                            options={skillsOptions || []}
                            selectedOption={selectedOption}
                            onOptionSelect={handleOptionSelect}
                            onConfirm={handleConfirmAnswer}
                            feedback={skillsFeedback}
                            correctText={skillsCorrectAnswer || currentChallenge?.correctText}
                            onSkip={challengeMode !== 'daily' ? handleSkip : undefined}
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
                            onFinishDaily={() => {
                              setChallengeMode('normal');
                              setView('home');
                            }}
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
        </PullToRefresh>

          {view === 'home' && (
            <motion.div
              initial={{ scale: 0, x: 20 }}
              animate={{ scale: 1, x: 0 }}
              onClick={() => setIsStreakModalOpen(true)}
              className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 md:bottom-28 md:right-8 z-40 group cursor-pointer"
              title="شعلة الاستمرار اليومية - انقر لعرض التفاصيل"
            >
              <div className="relative">
                {streakInfo.status === 'active' && (
                  <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full scale-110 streak-pulse" />
                )}
                {streakInfo.status === 'warning' && (
                  <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-full scale-110 animate-pulse" />
                )}
                <div className={`glass p-2 md:p-3 rounded-2xl md:rounded-[2rem] shadow-2xl flex items-center gap-2 md:gap-3 relative z-10 transition-all group-hover:scale-105 border ${
                  streakInfo.status === 'active'
                    ? 'bg-white/95 border-orange-200 shadow-orange-500/10'
                    : streakInfo.status === 'warning'
                    ? 'bg-amber-50/95 border-amber-300 shadow-amber-500/20 animate-pulse'
                    : 'bg-white/90 border-slate-200 shadow-slate-900/5'
                }`}>
                  <div className={`w-8 h-8 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-md overflow-hidden relative shrink-0 ${
                    streakInfo.status === 'active'
                      ? 'bg-gradient-to-tr from-orange-600 to-amber-500 shadow-orange-500/30'
                      : streakInfo.status === 'warning'
                      ? 'bg-gradient-to-tr from-slate-700 via-amber-700 to-amber-600 shadow-amber-600/30'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none'
                  }`}>
                    <Flame className={`w-4 h-4 md:w-5 md:h-5 fill-current relative z-10 ${
                      streakInfo.status === 'active'
                        ? 'text-white'
                        : streakInfo.status === 'warning'
                        ? 'text-amber-200'
                        : 'text-slate-400 stroke-1'
                    }`} />
                    <div className="absolute inset-0 bg-linear-to-t from-white/20 to-transparent" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className={`text-base md:text-xl font-black tabular-nums block leading-none ${
                        streakInfo.status === 'active'
                          ? 'text-orange-600'
                          : streakInfo.status === 'warning'
                          ? 'text-amber-800'
                          : 'text-slate-600'
                      }`}>
                        {streakInfo.streak}
                      </span>
                      {streakInfo.status === 'warning' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      )}
                    </div>
                    <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none block mt-0.5">
                      {streakInfo.status === 'active'
                        ? 'أيام متتالية'
                        : streakInfo.status === 'warning'
                        ? 'مهلة الإنقاذ ⏳'
                        : 'ابدأ الشعلة'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}


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

          {/* About App Modal (نافذة عن التطبيق وصناع العمل) */}
          <AnimatePresence>
            {showAboutModal && (
              <div
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-xl"
                onClick={() => setShowAboutModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white rounded-3xl md:rounded-[3rem] p-6 md:p-10 max-w-lg w-full shadow-2xl relative overflow-hidden text-center border border-emerald-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setShowAboutModal(false)}
                    className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-slate-100 transition-colors"
                    title="إغلاق"
                  >
                    <X className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-md border border-brand-gold/30 p-2">
                    <img src="/logo.png" className="w-full h-full object-contain drop-shadow-sm" alt="شعار متين" />
                  </div>

                  <div className="flex items-center justify-center mb-1">
                    <img src="/matin-title.png" className="h-9 md:h-10 object-contain drop-shadow-xs" alt="متين" />
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-slate-500 mb-4">
                    عن تطبيق متين لعلوم ومتشابهات القرآن الكريم
                  </h3>

                  <div className="space-y-3.5 my-6 text-right">
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                      <span className="text-[10px] md:text-xs font-black text-brand-emerald block mb-1">
                        إعداد وبرمجة التطبيق
                      </span>
                      <p className="text-sm md:text-base font-black text-slate-800">
                        علاء الدين الحجي
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <span className="text-[10px] md:text-xs font-black text-amber-700 block mb-1">
                        صاحب فكرة التطبيق
                      </span>
                      <p className="text-sm md:text-base font-black text-slate-800">
                        عمر سمير طبش
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                      <p className="text-slate-600 font-bold text-xs md:text-sm leading-relaxed">
                        لا تنسونا من صالح دعائكم، هذا التطبيق صدقة جارية عني وعن أخي عمر وعن والدينا وأحبائنا.
                      </p>
                    </div>
                  </div>

                    {!isNativeApp && (
                      <div className="flex flex-col gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAboutModal(false);
                            setShowGooglePlayModal(true);
                          }}
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2.5 border border-slate-700/80 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                        >
                          <GooglePlayLogo className="w-5 h-5" />
                          <span>تطبيق متين على Google Play</span>
                          {testerStatus === 'approved' && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                              تم القبول ✓
                            </span>
                          )}
                          {testerStatus === 'pending' && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                              قيد المراجعة ⏳
                            </span>
                          )}
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDownloadModal(true)}
                            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                          >
                            <Smartphone className="w-5 h-5 text-emerald-200" />
                            <span>تحميل التطبيق (APK)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleShareApp}
                            className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-sm border border-slate-200 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                            title="مشاركة رابط تحميل تطبيق الأندرويد"
                          >
                            {shareCopied ? (
                              <>
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-4 h-4 text-slate-600" />
                                <span>مشاركة</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowAboutModal(false)}
                    className="w-full py-3.5 bg-brand-emerald text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-[0.98]"
                  >
                    إغلاق
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedHadith && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl"
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
                      {/* Hadith Text Box */}
                      <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${librarySettings.darkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white/90 border-slate-200/80 text-slate-900 shadow-md'
                        }`}>
                        <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">نص الحديث الشريف</h3>
                        <div className="w-full space-y-3" dir="rtl">
                          {selectedHadith.hadith
                            .split('\n')
                            .filter(l => l.trim())
                            .slice(1)
                            .map((line, i) => (
                              <p
                                key={i}
                                className={`text-base sm:text-lg md:text-xl font-bold leading-relaxed md:leading-loose text-justify w-full ${librarySettings.darkMode ? 'text-slate-100' : 'text-slate-800'
                                  }`}
                                style={{
                                  textAlign: 'justify',
                                  textJustify: 'inter-word',
                                  textAlignLast: 'right',
                                }}
                              >
                                {line}
                              </p>
                            ))}
                        </div>
                      </div>

                      {/* Hadith Explanation & Benefits Box */}
                      <div className={`p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-lg transition-colors ${librarySettings.darkMode ? 'bg-teal-950/40 border-teal-900/60 text-slate-100' : 'bg-teal-50/60 border-teal-100 text-slate-900 shadow-md'
                        }`}>
                        <h3 className="text-xs md:text-sm font-black text-teal-600 uppercase tracking-widest mb-4 opacity-80 border-b border-teal-500/20 pb-2">الشرح والفوائد</h3>
                        <div className="w-full space-y-3" dir="rtl">
                          {selectedHadith.description
                            .split(/\n\s*\n/)
                            .filter(p => p.trim())
                            .map((paragraph, i) => (
                              <p
                                key={i}
                                className={`text-sm sm:text-base md:text-xl font-medium leading-relaxed md:leading-loose text-justify w-full ${librarySettings.darkMode ? 'text-slate-200' : 'text-slate-800'
                                  }`}
                                style={{
                                  textAlign: 'justify',
                                  textJustify: 'inter-word',
                                  textAlignLast: 'right',
                                }}
                              >
                                {paragraph.split('\n').join(' ')}
                              </p>
                            ))}
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
            isOpen={isResignModalOpen}
            onClose={() => setIsResignModalOpen(false)}
            onConfirm={handleResignGroupChallenge}
            title="تأكيد الانسحاب من التحدي"
            message="هل أنت متأكد من الانسحاب من هذا التحدي الجماعي؟ سيتم احتساب 0 نقاط وتسجيل أنك أنهيت التحدي بالانسحاب."
            confirmText="تأكيد الانسحاب"
            cancelText="إلغاء"
            isDanger={true}
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

          <StreakModal
            isOpen={isStreakModalOpen}
            onClose={() => setIsStreakModalOpen(false)}
            streakInfo={streakInfo}
            onStartChallenge={() => {
              setIsStreakModalOpen(false);
              handleStartDaily();
            }}
          />

          <IslamicOccasionsModal
            isOpen={isOccasionsModalOpen}
            onClose={() => setIsOccasionsModalOpen(false)}
            occasions={upcomingOccasions}
            hijriDate={hijriDate}
            initialSelectedId={nearestOccasion?.id}
          />

          <AppDownloadModal
            isOpen={showDownloadModal}
            onClose={() => setShowDownloadModal(false)}
          />

          <GooglePlayTesterModal
            isOpen={showGooglePlayModal}
            onClose={() => setShowGooglePlayModal(false)}
            testerEmail={testerEmail}
            setTesterEmail={setTesterEmail}
            testerStatus={testerStatus}
            testerMessage={testerMessage}
            internalTestLink={internalTestLink}
            onRegister={handleRegisterTester}
            onReset={handleResetTesterForm}
            onOpenDirectApk={() => setShowDownloadModal(true)}
            onShareApp={handleShareApp}
            shareCopied={shareCopied}
            isCheckingSavedStatus={isCheckingSavedStatus}
          />

          {selectedAyah && (
            <AyahActionSheet
              selectedAyah={selectedAyah}
              onClose={() => setSelectedAyah(null)}
              onNavigateToPage={(p) => {
                setCurrentPage(p);
                setSelectedAyah(null);
              }}
              onOpenEncyclopedia={(s, a) => {
                setSelectedAyah(null);
                setView('encyclopedia');
              }}
              darkMode={librarySettings.darkMode}
            />
          )}
      

          <PrivacyModal
            isOpen={showPrivacyModal}
            onClose={() => setShowPrivacyModal(false)}
            initialTab={privacyModalInitialTab}
          />

          <IslamicRoomConfigModal
            isOpen={showIslamicConfigModal}
            onClose={() => setShowIslamicConfigModal(false)}
            selectedCategories={islamicRoomCategories}
            onSelectCategories={setIslamicRoomCategories}
            selectedLevels={islamicRoomLevels}
            onSelectLevels={setIslamicRoomLevels}
            selectedTopics={islamicRoomTopics}
            onSelectTopics={setIslamicRoomTopics}
            topicQuestionCounts={islamicTopicQuestionCounts}
            onUpdateTopicCount={(topic, count) => setIslamicTopicQuestionCounts(prev => ({ ...prev, [topic]: count }))}
          />

          {/* Private Room Password Dialog */}
          <AnimatePresence>
            {privateRoomModal.isOpen && privateRoomModal.room && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-orange-100 text-right space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <button
                      onClick={() => setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <h3 className="font-black text-slate-800 text-base md:text-lg">غرفة خاصة محمية</h3>
                        <p className="text-[11px] text-slate-400 font-bold">{privateRoomModal.room.name || 'غرفة التحدي'}</p>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1 text-xs text-slate-600 font-bold">
                    <div className="flex justify-between">
                      <span className="text-slate-400">المنشئ:</span>
                      <span className="text-slate-800 font-black">{privateRoomModal.room.hostName}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700">
                      أدخل كلمة المرور للانضمام
                    </label>
                    <input
                      type="password"
                      autoFocus
                      value={privateRoomModal.password}
                      onChange={(e) => setPrivateRoomModal(prev => ({ ...prev, password: e.target.value, error: undefined }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && privateRoomModal.password.trim() && !isJoiningRoom) {
                          handleJoinV1(privateRoomModal.room.id, privateRoomModal.password);
                        }
                      }}
                      placeholder="كلمة مرور الغرفة"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none text-slate-800 font-black text-sm text-center shadow-inner"
                    />
                    {privateRoomModal.error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-500 justify-end"
                      >
                        <span>{privateRoomModal.error}</span>
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      </motion.div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleJoinV1(privateRoomModal.room.id, privateRoomModal.password)}
                      disabled={isJoiningRoom || !privateRoomModal.password.trim()}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-2xl font-black text-sm hover:bg-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isJoiningRoom ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الانضمام'}
                    </button>
                    <button
                      onClick={() => setPrivateRoomModal({ isOpen: false, room: null, password: '', error: undefined })}
                      className="px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCertificate && (
              <CertificateGenerator
                category={selectedCategory}
                onClose={() => setShowCertificate(false)}
                isClaimed={userCertificates.some(c => c.category === selectedCategory)}
                claimedName={userCertificates.find(c => c.category === selectedCategory)?.name}
                onSave={(certData) => {
                  // Prevent duplicate entries for the same category
                  if (userCertificates.some(c => c.category === certData.category)) return;

                  const newCerts = [...userCertificates, certData];
                  setUserCertificates(newCerts);
                  localStorage.setItem('quran_user_certificates', JSON.stringify(newCerts));

                  // Automatically activate frame and decoration upon earning certificate
                  const category = certData.category === 'seerah' ? 'seerah' : 'general';
                  setActiveFrame(category);
                  setIsNameDecorated(true);
                  localStorage.setItem('quran_active_frame', category);
                  localStorage.setItem('quran_name_decorated', 'true');

                  // Immediately sync to server so others see the frame in the leaderboard
                  if (playerUsername || playerName) {
                    fetch('/api/player-score', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: playerName,
                        username: playerUsername,
                        seerahCompleted: category === 'seerah' || userCertificates.some(c => c.category === 'seerah'),
                        generalCompleted: category === 'general' || userCertificates.some(c => c.category === 'general'),
                        activeFrame: category
                      })
                    }).then(() => syncLeaderboard()).catch(err => console.error('Certificate save sync failed:', err));
                  }
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showTafsirModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10 bg-slate-900/60 backdrop-blur-md"
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

          {/* Fixed Bottom Navigation Bar */}
          {!isMushafFullscreen && (
            <nav className="fixed bottom-0 left-0 right-0 z-40 glass-dark border-t border-white/15 shadow-2xl backdrop-blur-2xl py-2 px-3 sm:px-6">
              <div className="max-w-md mx-auto flex items-center justify-around">

                {/* 1. الرئيسية (Home) */}
                <button
                  onClick={() => {
                    setView('home');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'home' && !showScores
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="الرئيسية"
                >
                  <Home className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الرئيسية</span>
                </button>

                {/* 2. التحديات (Challenges) */}
                <button
                  onClick={() => {
                    setView('challenges');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'challenges'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="التحديات"
                >
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">التحديات</span>
                </button>

                {/* 3. المكتبة والعلوم الشرعية (Library) */}
                <button
                  onClick={() => {
                    setView('library');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'library' || view === 'mushaf' || view === 'adhkar' || view === 'hadith' || view === 'book' || view === 'encyclopedia' || view === 'islamic_videos'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="المكتبة والعلوم الشرعية"
                >
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">المكتبة</span>
                </button>

                {/* 4. الإعدادات (Settings) */}
                <button
                  onClick={() => {
                    setView('settings');
                    setShowScores(false);
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all duration-300 ${view === 'settings'
                      ? 'text-brand-gold bg-white/15 scale-105 shadow-inner'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  title="الإعدادات"
                >
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الإعدادات</span>
                </button>

              </div>
            </nav>
          )}

          {/* Fullscreen Mushaf Mode Overlay */}
          <AnimatePresence>
            {isMushafFullscreen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={toggleFullscreenControls}
                className="fixed inset-0 z-[100] w-screen h-screen flex flex-col justify-between overflow-hidden select-none cursor-pointer"
                style={{
                  backgroundColor: librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
                  color: librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
                  backgroundImage: librarySettings.darkMode
                    ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.98) 85%)'
                    : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, #fcfaf5 85%)',
                }}
              >
                {/* Floating Top Controls: Exit 'X' Button on Corner & Page Info */}
                <AnimatePresence>
                  {areFullscreenControlsVisible && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-3 sm:top-5 sm:left-5 z-50 pointer-events-auto"
                      >
                        <button
                          onClick={exitMushafFullscreen}
                          className="p-2.5 sm:p-3 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all active:scale-95 flex items-center gap-2 group cursor-pointer"
                          title="خروج من ملء الشاشة (Esc)"
                          aria-label="خروج من ملء الشاشة"
                        >
                          <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-90 transition-transform duration-200" />
                          <span className="text-xs sm:text-sm font-black hidden sm:inline text-white/90">خروج</span>
                        </button>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 pointer-events-auto"
                      >
                        <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-black/60 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-xs sm:text-sm font-black flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-brand-gold" />
                          <span>المصحف الشريف</span>
                          <span className="text-white/40">•</span>
                          <span className="text-brand-gold">صفحة {currentPage}</span>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Main Fullscreen Quran Page View with Pinch-to-Zoom & Free 2D Pan */}
                <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden p-0 sm:p-2">
                  <QuranZoomViewer
                    pageNumber={currentPage}
                    darkMode={librarySettings.darkMode}
                    isFullscreen={true}
                    onPageTurn={(dir) => {
                      setPageTurnDirection(dir);
                      if (dir === 'next') {
                        setCurrentPage(prev => Math.min(604, prev + 1));
                      } else {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                      }
                      resetFullscreenControlsTimer();
                    }}
                    onTap={() => {
                      if (selectedAyah) {
                        setSelectedAyah(null);
                      } else {
                        toggleFullscreenControls();
                      }
                    }}
                    onInteraction={resetFullscreenControlsTimer}
                    pageTurnDirection={pageTurnDirection}
                    selectedAyah={selectedAyah}
                    onSelectAyah={(s, a) => {
                      setSelectedAyah({ surah: s, ayah: a });
                      resetFullscreenControlsTimer();
                    }}
                  />
                </div>

                {/* Bottom Floating Navigation Arrows & Page Jump */}
                <AnimatePresence>
                  {areFullscreenControlsVisible && (
                    <motion.div
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 25 }}
                      transition={{ duration: 0.2 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFullscreenControlsTimer();
                      }}
                      className="absolute bottom-4 sm:bottom-6 inset-x-0 flex justify-center items-center pointer-events-none z-50 px-4"
                    >
                      <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-2xl border border-white/20 shadow-2xl transition-all">
                        {/* Previous Page Button (In Arabic RTL: right arrow = previous page) */}
                        <button
                          onClick={() => {
                            if (currentPage > 1) {
                              setPageTurnDirection('prev');
                              setCurrentPage(prev => Math.max(1, prev - 1));
                              resetFullscreenControlsTimer();
                            }
                          }}
                          disabled={currentPage === 1}
                          className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                          title="الصفحة السابقة"
                          aria-label="الصفحة السابقة"
                        >
                          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        {/* Page indicator & direct input */}
                        <div className="flex items-center gap-1.5 px-2 text-white font-black text-xs sm:text-sm select-none">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={currentPage}
                            onClick={(e) => {
                              e.stopPropagation();
                              resetFullscreenControlsTimer();
                            }}
                            onChange={(e) => {
                              resetFullscreenControlsTimer();
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              if (val === '') return;
                              const num = parseInt(val);
                              if (num >= 1 && num <= 604) {
                                setCurrentPage(num);
                              }
                            }}
                            className="w-10 sm:w-12 bg-white/10 border border-white/20 rounded-lg text-center text-xs sm:text-sm font-black text-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold py-0.5"
                          />
                          <span className="text-white/40">/</span>
                          <span className="text-white/70">604</span>
                        </div>

                        {/* Next Page Button (In Arabic RTL: left arrow = next page) */}
                        <button
                          onClick={() => {
                            if (currentPage < 604) {
                              setPageTurnDirection('next');
                              setCurrentPage(prev => Math.min(604, prev + 1));
                              resetFullscreenControlsTimer();
                            }
                          }}
                          disabled={currentPage === 604}
                          className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                          title="الصفحة التالية"
                          aria-label="الصفحة التالية"
                        >
                          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div >
  );
}
