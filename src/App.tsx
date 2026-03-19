import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Sparkles, Trophy, RotateCcw, X, Mic, MicOff, Search, BookOpen, CheckCircle,
  ChevronRight, ChevronLeft, LayoutGrid, Heart, History, Compass, Home, Plane,
  ListFilter, Sun, Moon, Calendar, Settings, Copy, Check, Lightbulb, ChevronDown, User, Quote,
  ArrowRight, ArrowLeft, Zap, Lock
} from 'lucide-react';
import { searchAyahsByStart, Ayah as Verse, quranData } from './services/QuranRepository';
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
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import { v4 as uuidv4 } from 'uuid';

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

type View = 'home' | 'difficulty' | 'challenge' | 'mushaf' | 'adhkar' | 'hadith' | 'admin';
type Difficulty = 'easy' | 'medium' | 'hard';

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
  isRevealed: boolean;
  hints: number;
  onReveal: (id: string) => void;
  onHint: (id: string, e: React.MouseEvent) => void;
  index: number;
  keywordWordCount: number;
  distinguishingWordCount: number;
  wordStates: Record<number, 'correct' | 'skipped'>;
}

const VerseCard = memo(({ verse, keyword, isMatched, isRevealed, hints, onReveal, onHint, index, keywordWordCount, distinguishingWordCount, wordStates }: VerseCardProps) => {
  const showText = isMatched || isRevealed;
  const [copied, setCopied] = useState(false);

  const getHintText = () => {
    const words = verse.text.split(' ').filter(Boolean);
    const uniqueWords = words.slice(keywordWordCount);

    if (hints === 0 || uniqueWords.length === 0) return null;

    const wordsToShow = Math.min(hints * 2, uniqueWords.length);
    const keywordText = words.slice(0, keywordWordCount).join(' ');
    const hintTextValue = uniqueWords.slice(0, wordsToShow).join(' ');

    return `${keywordText} ${hintTextValue} ...`;
  };

  const hintText = getHintText();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(verse.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderHighlightedVerse = () => {
    const words = verse.text.split(' ').filter(Boolean);
    return (
      <p className={`text-2xl quran-text leading-loose mb-4 ${isMatched ? 'text-brand-emerald font-bold' : 'text-slate-600'}`}>
        {words.map((word, wIdx) => {
          const isKeyword = wIdx < keywordWordCount;
          const isDistinguishing = wIdx >= keywordWordCount && wIdx < keywordWordCount + distinguishingWordCount;

          // State for words after the keyword
          const wordIdx = wIdx - keywordWordCount;
          const status = wordIdx >= 0 ? wordStates[wordIdx] : 'correct'; // Keyword is always 'correct' if we are here

          const isMatchedWord = isMatched || isRevealed || status === 'correct' || status === 'skipped';

          let colorClass = 'text-slate-400 opacity-20 blur-[1px]';
          if (isMatched || isRevealed || status === 'correct') {
            colorClass = isKeyword ? 'text-brand-emerald/70' : 'text-brand-emerald';
          } else if (status === 'skipped') {
            colorClass = 'text-red-500 font-bold';
          }

          return (
            <span
              key={wIdx}
              className={`
                transition-all duration-500 mx-0.5
                ${colorClass}
                ${isDistinguishing && !isMatched && !isRevealed && !status ? 'text-brand-gold bg-brand-gold/5 px-0.5 rounded' : ''}
                ${isMatchedWord ? 'opacity-100 blur-0' : ''}
              `}
            >
              {word}{' '}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`relative p-8 rounded-3xl border-2 transition-all duration-700 flex flex-col justify-between overflow-hidden group card-hover islamic-watermark ${isMatched
        ? 'glass bg-white/90 border-brand-emerald shadow-lg'
        : 'glass bg-white/40 border-white/50 hover:border-brand-gold/30'
        }`}
    >
      {isMatched && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-emerald/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
      )}

      {showText ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10"
        >
          <div className="flex items-start gap-4 mb-4">
            {isMatched && (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="bg-brand-emerald/10 p-1 rounded-full"
              >
                <CheckCircle className="w-6 h-6 text-brand-emerald" />
              </motion.div>
            )}
            <div className="flex-1">
              {renderHighlightedVerse()}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200/50">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${isMatched ? 'text-brand-emerald bg-brand-emerald/10' : 'text-slate-500 bg-slate-100'}`}>
              سورة {verse.surah} • آية {verse.verseNumber}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/5 rounded-xl transition-all flex items-center gap-2"
              title="نسخ الآية"
            >
              <span className="text-xs font-bold uppercase tracking-wider">{copied ? 'تم' : 'نسخ'}</span>
              {copied ? <Check className="w-4 h-4 text-brand-emerald" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="relative z-10 flex flex-col h-full min-h-[140px]">
          <div
            className="flex-1 flex items-center justify-center text-slate-400 cursor-pointer group-hover:text-brand-gold transition-all text-center px-4"
            onClick={() => onReveal(verse.id)}
          >
            {hintText ? (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-slate-800 text-xl quran-text"
              >
                {hintText}
              </motion.span>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <BookOpen className="w-10 h-10 opacity-20 group-hover:opacity-40 transition-opacity" />
                <span className="font-medium text-lg">آية مخفية</span>
                <span className="text-xs text-slate-400">انقر للإظهار</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center border-t border-white/50 pt-4">
            <button
              onClick={(e) => onHint(verse.id, e)}
              className="flex items-center gap-2 text-sm text-brand-gold hover:text-brand-emerald font-bold px-5 py-2 rounded-full border border-brand-gold/20 hover:border-brand-emerald/20 hover:bg-brand-emerald/5 transition-all shadow-sm"
            >
              <Lightbulb className="w-4 h-4" />
              تلميح
            </button>
          </div>
        </div>
      )}
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
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 theme-transition ${settings.darkMode ? 'mushaf-dark border-white/5' : ''}`}
          >
            <div className="p-8">
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
                {/* Reading Mode */}
                {showReadingMode && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">نمط العرض</h3>
                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-3xl border border-slate-100">
                      <button
                        onClick={() => setSettings({ ...settings, readingMode: 'continuous' })}
                        className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.readingMode === 'continuous' ? 'bg-white shadow-lg text-brand-emerald ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <LayoutGrid className="w-5 h-5" />
                        <span className="font-extrabold text-sm">عرض مستمر</span>
                      </button>
                      <button
                        onClick={() => setSettings({ ...settings, readingMode: 'page' })}
                        className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all ${settings.readingMode === 'page' ? 'bg-white shadow-lg text-brand-emerald ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <BookOpen className="w-5 h-5" />
                        <span className="font-extrabold text-sm">عرض صفحات</span>
                      </button>
                    </div>
                  </div>
                )}

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
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${settings.darkMode ? 'bg-brand-emerald' : 'bg-slate-300'}`}
                  >
                    <motion.div
                      animate={{ x: settings.darkMode ? 24 : 0 }}
                      className="w-6 h-6 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Font Size */}
                <div className="space-y-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800">حجم الخط</h4>
                    <span className="px-3 py-1 bg-brand-emerald/10 text-brand-emerald rounded-lg text-sm font-black">{settings.fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400">أ</span>
                    <input
                      type="range"
                      min="16"
                      max="48"
                      value={settings.fontSize}
                      onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                      className="flex-1 accent-brand-emerald h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xl font-bold text-slate-800">أ</span>
                  </div>
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
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);

  const [playerName, setPlayerName] = useState<string | null>(localStorage.getItem('quran_player_name'));
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('quran_device_id');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('quran_device_id', id);
    }
    return id;
  });
  const [totalPoints, setTotalPoints] = useState<number>(() => Number(localStorage.getItem('quran_total_points')) || 0);
  const [cups, setCups] = useState<number>(() => Number(localStorage.getItem('quran_cups')) || 0);
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
  const [isSearchSubmitted, setIsSearchSubmitted] = useState(false);
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);
  const [isJuzMenuOpen, setIsJuzMenuOpen] = useState(false);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Fetch challenges from API
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await fetch('/api/challenges');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Server error: ${text.substring(0, 100)}`);
        }
        const data = await res.json();
        setChallenges(data);
      } catch (err) {
        console.error('Failed to fetch challenges:', err);
      } finally {
        setChallengesLoading(false);
      }
    };
    fetchChallenges();
  }, []);

  const handleAdminLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('quran_admin_token', token);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('quran_admin_token');
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
        setRegistrationError(`فشل الاتصال: السيرفر أرجع رداً غير صالح. الرد: ${text.substring(0, 50) || '(فارغ)'}...`);
        return;
      }
      
      if (res.ok) {
        setPlayerName(nameInput.trim());
        localStorage.setItem('quran_player_name', nameInput.trim());
      } else {
        const detail = data.error || data.message || '';
        setRegistrationError(`فشل الاتصال: ${detail || 'خطأ غير معروف في السيرفر'}`);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      setRegistrationError(`خطأ في الاتصال: ${err.message || 'تعذر الوصول إلى السيرفر'}. تأكد من تشغيل المشروع عبر 'vercel dev'.`);
    } finally {
      setIsRegistering(false);
    }
  };

  // Library Settings (Shared across Mushaf, Adhkar, Hadith)
  const [librarySettings, setLibrarySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('quran_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return {
      readingMode: 'continuous' as 'continuous' | 'page',
      darkMode: false,
      fontSize: 24,
    };
  });

  useEffect(() => {
    localStorage.setItem('mushaf_settings', JSON.stringify(librarySettings));
  }, [librarySettings]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [isPageModeActive, setIsPageModeActive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const currentChallenge = challenges.length > 0
    ? (challengeMode === 'daily' ? challenges[dailyChallengeIndex] : challenges[currentChallengeIndex])
    : null;

  const KEYWORD = currentChallenge?.keyword || '';

  const [allTargetVerses, setAllTargetVerses] = useState<Verse[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wordStates, setWordStates] = useState<Record<string, Record<number, 'correct' | 'skipped'>>>({});
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [hintLevels, setHintLevels] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [difficulty, setDifficulty] = useState<Difficulty>((localStorage.getItem('quran_game_difficulty') as Difficulty) || 'medium');

  // AI Explanation State
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const { width, height } = useWindowSize();

  const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognition } = useSpeechRecognition();

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
    "مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حسنة",
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

  // Effect to lock body scroll when modal is open
  useEffect(() => {
    if (selectedHadith || showExplanation || isSettingsOpen || showScores) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedHadith, showExplanation, isSettingsOpen, showScores]);

  const handleStartDaily = () => {
    if (dailyCompleted) return;
    setChallengeMode('daily');
    setView('challenge');

    // Save as incomplete if not finished
    const firstVerse = searchAyahsByStart(challenges[dailyChallengeIndex]?.keyword || '')[0];
    const info = { index: dailyChallengeIndex, mode: 'daily' as const, surah: firstVerse?.surah || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const handleStartNormal = () => {
    setChallengeMode('normal');
    setView('difficulty');
  };

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem('quran_game_difficulty', diff);
    setView('challenge');

    // Save as incomplete
    const firstVerse = searchAyahsByStart(challenges[currentChallengeIndex]?.keyword || '')[0];
    const info = { index: currentChallengeIndex, mode: 'normal' as const, surah: firstVerse?.surah || '' };
    setIncompleteChallenge(info);
    localStorage.setItem('quran_incomplete_challenge', JSON.stringify(info));
  };

  const handleBackToHome = () => {
    if (view === 'challenge' && !isComplete) {
      if (!window.confirm('هل تريد العودة للرئيسية؟ سيتم فقدان تقدمك الحالي في هذه الآية.')) return;
    }
    setView('home');
    resetTranscript();
    stopListening();
  };

  const handleSkip = () => {
    if (challengeMode === 'daily') return;
    if (challenges.length > 0) {
      setCurrentChallengeIndex((prev) => (prev + 1) % challenges.length);
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
        if (score >= 50 && currentBest < 50) {
          newCups = cups + 1;
          setCups(newCups);
        }
        updated[challengeKey] = score;
        localStorage.setItem('quran_game_scores', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    const newPoints = totalPoints + score;
    setTotalPoints(newPoints);

    // Sync with backend using deviceId
    fetch('/api/player-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, points: newPoints, cups: newCups })
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


  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    localStorage.setItem('quran_game_difficulty', newDiff);
    setShowSettings(false);
  };

  useEffect(() => {
    // تحميل الآيات عند بدء التطبيق أو تغيير التحدي
    if (!KEYWORD) return;
    const verses = searchAyahsByStart(KEYWORD);

    // Fallback: If this specific challenge/keyword has no matches in the repository
    if (verses.length === 0 && view === 'challenge') {
      if (challengeMode === 'normal' && challenges.length > 0) {
        // Automatically move to the next challenge in list
        setCurrentChallengeIndex((prev) => (prev + 1) % challenges.length);
      } else {
        // If daily is broken, go back to home
        setView('home');
      }
      return;
    }

    setAllTargetVerses(verses);
    setMatchedIds(new Set());
    setWordStates({});
    setRevealedIds(new Set());
    setHintLevels({});
    setScore(0);
    setExplanationText(null);
    setShowExplanation(false);
    resetTranscript();
  }, [KEYWORD, resetTranscript, view, challengeMode]);

  const targetVerses = useMemo(() => {
    let limit = allTargetVerses.length;
    if (difficulty === 'easy') limit = Math.min(3, allTargetVerses.length);
    else if (difficulty === 'medium') limit = Math.min(5, allTargetVerses.length);
    return allTargetVerses.slice(0, limit);
  }, [allTargetVerses, difficulty]);

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
            // Mark intermediate as skipped
            for (let j = lastIndex + 1; j < i; j++) {
              if (currentVerseStates[j] !== 'correct') {
                currentVerseStates[j] = 'skipped';
                countsChanged = true;
              }
            }
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

      let requiredFullRatio = 0.95;
      if (difficulty === 'easy') requiredFullRatio = 0.85;
      else if (difficulty === 'hard') requiredFullRatio = 1.0;

      if (fullRatio >= requiredFullRatio || similarity > 0.95 || (correctCount + skippedCount === uniqueWords.length)) {
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

      const hintsUsed = hintLevels[best.verse.id] || 0;
      const pointsEarned = Math.max(2, 10 - (hintsUsed * 2));
      setScore(prev => prev + pointsEarned);
    }
  }, [transcript, targetVerses, matchedIds, KEYWORD, difficulty, hintLevels, wordStates, stopListening, resetTranscript, startListening, keywordWordCount, distinguishingWordCounts]);

  const handleNextChallenge = () => {
    saveScore(KEYWORD, score);
    if (window.confirm('هل أنت مستعد للتحدي التالي؟')) {
      if (challenges.length > 0) {
        setChallengeMode('normal');
        setCurrentChallengeIndex((prev) => (prev + 1) % challenges.length);
      }
    }
  };

  const handleHint = useCallback((verseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHintLevels(prev => ({
      ...prev,
      [verseId]: (prev[verseId] || 0) + 1
    }));
  }, []);

  const handleReveal = useCallback((verseId: string) => {
    setRevealedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(verseId);
      return newSet;
    });
  }, []);

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

  const progress = targetVerses.length > 0 ? (matchedIds.size / targetVerses.length) * 100 : 0;
  const isComplete = targetVerses.length > 0 && matchedIds.size === targetVerses.length;

  return (
    <div className="min-h-screen relative text-slate-900 font-sans selection:bg-brand-emerald/10" dir="rtl">
      {/* Background with Generated Pattern */}
      <div
        className="fixed inset-0 z-0 opacity-10 mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url('/Users/apple/.gemini/antigravity/brain/0e51dbf2-7a4d-40b5-9f54-4d4f25142f1d/islamic_geometric_pattern_1773882545168.png')`,
          backgroundSize: '400px',
        }}
      />

      {isComplete && <Confetti width={width} height={height} recycle={false} numberOfPieces={400} gravity={0.15} colors={['#064e3b', '#d4af37', '#fdfbf7', '#10b981']} />}

      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark text-white shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between relative z-10">
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
              <BookOpen className="w-8 h-8 text-brand-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">تحدي المتشابهات</h1>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-brand-gold/70">القرآن الكريم</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
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
              className="glass p-10 rounded-[3rem] max-w-md w-full shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-brand-emerald rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-emerald/20">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-black text-brand-emerald mb-4">أهلاً بك في تحدي المتشابهات</h2>
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        {view === 'admin' ? (
          adminToken ? (
            <AdminDashboard token={adminToken} onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )
        ) : challengesLoading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-12 h-12 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-brand-emerald font-black animate-pulse">يتم استظهار الآيات...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {showScores ? (
            <motion.div
              key="scores"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-10 rounded-[3rem] max-w-3xl mx-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-brand-emerald flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-brand-gold" />
                  لوحة المتصدرين العالمية
                </h2>
                <button
                  onClick={() => syncLeaderboard()}
                  disabled={isSyncing}
                  className={`p-3 rounded-2xl bg-brand-emerald/5 text-brand-emerald border border-brand-emerald/10 hover:bg-brand-emerald/10 transition-all ${isSyncing ? 'animate-spin' : ''}`}
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {isSyncing && leaderboard.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  <div className="w-10 h-10 border-4 border-brand-emerald border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">جاري جلب قائمة المتصدرين...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">كن أول من يسجل اسمه هنا</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((player, index) => (
                    <motion.div
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      key={player.name}
                      className={`flex justify-between items-center p-6 rounded-3xl border transition-all group ${player.name === playerName ? 'bg-brand-emerald/5 border-brand-emerald/20 shadow-lg' : 'bg-white/60 border-white hover:shadow-xl'}`}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-transform group-hover:rotate-12 ${index === 0 ? 'bg-brand-gold/10 text-brand-gold scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                          {index === 0 ? '👑' : index + 1}
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-800 text-xl block">{player.name}</span>
                          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">{player.points} نقطة</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-brand-gold/10 px-4 py-2 rounded-2xl border border-brand-gold/20">
                          <Trophy className="w-4 h-4 text-brand-gold" />
                          <span className="font-black text-2xl text-brand-emerald tabular-nums">{player.cups}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-10 max-w-6xl mx-auto py-10 px-4"
            >
              {/* Refined Header Section */}
              <div className="relative overflow-hidden glass p-8 md:p-12 rounded-[3.5rem] border-white/20 shadow-2xl bg-linear-to-br from-brand-emerald/10 via-white/50 to-brand-gold/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-emerald/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="text-right flex-1">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-brand-emerald/10 text-brand-emerald text-xs font-black uppercase tracking-widest mb-4">أهلاً بك مجدداً</div>
                    <h2 className="text-4xl md:text-5xl font-black text-brand-emerald mb-3">مرحباً بك يا {playerName}</h2>
                    <p className="text-slate-500 font-medium text-lg italic opacity-80">"وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ۚ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ"</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="glass bg-white/90 p-6 rounded-[2.5rem] border-brand-gold/20 shadow-xl flex flex-col items-center min-w-[140px] hover:scale-105 transition-transform">
                      <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center mb-3">
                        <Trophy className="w-7 h-7 text-brand-gold" />
                      </div>
                      <span className="text-3xl font-black text-brand-emerald tabular-nums">{cups}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">إجمالي الكؤوس</span>
                    </div>
                    <div className="glass bg-white/90 p-6 rounded-[2.5rem] border-brand-emerald/20 shadow-xl flex flex-col items-center min-w-[140px] hover:scale-105 transition-transform">
                      <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center mb-3">
                        <Sparkles className="w-7 h-7 text-brand-emerald" />
                      </div>
                      <span className="text-3xl font-black text-brand-emerald tabular-nums">{totalPoints}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">إجمالي النقاط</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Incomplete Challenge Bar */}
              {incompleteChallenge && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-brand-gold text-brand-emerald p-5 rounded-[2rem] flex items-center justify-between px-10 shadow-lg shadow-brand-gold/30 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
                      <ArrowRight className="w-6 h-6" />
                    </div>
                    <span className="font-black text-lg">لديك تحدي لم يكتمل بعد.. استمر في التقدم!</span>
                  </div>
                  <button
                    onClick={() => {
                      setChallengeMode(incompleteChallenge.mode);
                      if (incompleteChallenge.mode === 'normal') {
                        setCurrentChallengeIndex(incompleteChallenge.index);
                      }
                      setView('challenge');
                    }}
                    className="px-8 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-sm hover:bg-white hover:text-brand-emerald transition-all shadow-md active:scale-95"
                  >
                    متابعة الآن
                  </button>
                </motion.div>
              )}

              {/* SECTION: Challenges */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 px-6">
                  <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-brand-gold" />
                  </div>
                  <h3 className="text-2xl font-black text-brand-emerald">مسابقات التحدي</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {/* Daily Challenge Card */}
                  <motion.button
                    whileHover={{ y: -8, scale: 1.01 }}
                    onClick={handleStartDaily}
                    disabled={dailyCompleted}
                    className={`group relative p-10 rounded-[3.5rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between card-hover islamic-watermark border-2 ${dailyCompleted ? 'bg-slate-50 opacity-60 grayscale border-slate-100' : 'glass bg-linear-to-br from-amber-400/5 to-brand-gold/10 border-brand-gold/20 shadow-2xl hover:shadow-brand-gold/20'}`}
                  >
                    <div className="relative z-10">
                      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${dailyCompleted ? 'bg-slate-200' : 'bg-brand-gold shadow-brand-gold/30'}`}>
                        <Calendar className={`w-8 h-8 ${dailyCompleted ? 'text-slate-400' : 'text-brand-emerald'}`} />
                      </div>
                      <h2 className={`text-4xl font-black mb-4 ${dailyCompleted ? 'text-slate-400' : 'text-brand-emerald'}`}>التحدي اليومي</h2>
                      <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        {dailyCompleted ? 'لقد أتممت التحدي اليومي، نراك غداً بإذن الله' : 'اختبر حفظك في موضع واحد جديد كل يوم'}
                      </p>
                    </div>
                    {dailyCompleted ? (
                      <div className="mt-8 text-2xl font-black text-brand-emerald tabular-nums bg-white shadow-sm inline-block px-6 py-2 rounded-2xl mx-auto md:mx-0" dir="ltr">
                        {timeLeft}
                      </div>
                    ) : (
                      <div className="mt-8 flex items-center gap-3 text-brand-gold font-black group-hover:gap-5 transition-all">
                        <span>ابدأ التحدي اليوم</span>
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    )}
                  </motion.button>

                  {/* Normal Challenge Card */}
                  <motion.button
                    whileHover={{ y: -8, scale: 1.01 }}
                    onClick={handleStartNormal}
                    className="group relative p-10 rounded-[3.5rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between glass bg-linear-to-br from-brand-emerald/5 to-emerald-500/10 border-brand-emerald/20 shadow-2xl hover:shadow-brand-emerald/30 card-hover islamic-watermark border-2"
                  >
                    <div className="relative z-10">
                      <div className="w-16 h-16 rounded-3xl bg-brand-emerald flex items-center justify-center mb-6 shadow-xl shadow-brand-emerald/30">
                        <Zap className="w-8 h-8 text-brand-gold" />
                      </div>
                      <h2 className="text-4xl font-black mb-4 text-brand-emerald">تحدي المهارات</h2>
                      <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        مستويات عشوائية ومتعددة للمتشابهات في مختلف المواضع والآيات
                      </p>
                    </div>
                    <div className="mt-8 flex items-center gap-3 text-brand-emerald font-black group-hover:gap-5 transition-all">
                      <span>اختر الصعوبة وابدأ</span>
                      <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* SECTION: Islamic Library */}
              <div className="space-y-6">
                <div className="flex items-center gap-4 px-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-black text-brand-emerald">المكتبة والعلوم الشرعية</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Mushaf Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { setView('mushaf'); setSelectedSurahId(null); }}
                    className="group relative p-8 rounded-[2.5rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between glass border-blue-100 hover:border-blue-300 shadow-xl hover:shadow-blue-500/10 card-hover border-2"
                  >
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-600/40">
                        <BookOpen className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="text-3xl font-black mb-2 text-blue-900">المصحف الشريف</h2>
                      <p className="text-slate-500 font-medium text-sm leading-relaxed">تصفح القرآن الكريم كاملاً بالرسم العثماني</p>
                    </div>
                    <div className="mt-6 text-blue-600 font-black text-xs flex items-center gap-2">
                      <span>فتح المصحف</span>
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </motion.button>

                  {/* Adhkar Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { setView('adhkar'); setSelectedAdhkarCategoryId(null); }}
                    className="group relative p-8 rounded-[2.5rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between glass border-indigo-100 hover:border-indigo-300 shadow-xl hover:shadow-indigo-500/10 card-hover border-2"
                  >
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/40">
                        <Sun className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="text-3xl font-black mb-2 text-indigo-900">أذكار المسلم</h2>
                      <p className="text-slate-500 font-medium text-sm leading-relaxed">الأذكار المأثورة والورد اليومي للمؤمن</p>
                    </div>
                    <div className="mt-6 text-indigo-600 font-black text-xs flex items-center gap-2">
                      <span>تصفح الأذكار</span>
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </motion.button>

                  {/* Hadith Card */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => { setView('hadith'); setSelectedHadith(null); }}
                    className="group relative p-8 rounded-[2.5rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between glass border-teal-100 hover:border-teal-300 shadow-xl hover:shadow-teal-500/10 card-hover border-2"
                  >
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-teal-600/40">
                        <Quote className="w-7 h-7 text-white" />
                      </div>
                      <h2 className="text-3xl font-black mb-2 text-teal-900">الأربعون النووية</h2>
                      <p className="text-slate-500 font-medium text-sm leading-relaxed">شرح وتبسيط أحاديث الأربعون النووية</p>
                    </div>
                    <div className="mt-6 text-teal-600 font-black text-xs flex items-center gap-2">
                      <span>قراءة وشرح</span>
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Refined Motivational Footer */}
              <div className="mt-4 text-center glass-dark p-8 md:p-10 rounded-[3rem] border-white/10 shadow-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-linear-to-r from-brand-gold/15 via-transparent to-brand-gold/15 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-gold/5 rounded-full blur-3xl" />
                <Quote className="w-10 h-10 text-brand-gold/20 absolute top-6 right-6" />
                <p className="relative z-10 text-white font-quran text-2xl md:text-3xl leading-loose italic opacity-90 drop-shadow-sm">
                  "{motivationalQuote}"
                </p>
                <div className="mt-6 flex justify-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
                  <div className="w-10 h-px bg-brand-gold/20 self-center" />
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/40" />
                </div>
              </div>
            </motion.div>
          ) : view === 'difficulty' ? (
            <motion.div
              key="difficulty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-12 rounded-[4rem] max-w-2xl mx-auto shadow-2xl"
            >
              <h2 className="text-4xl font-black text-brand-emerald mb-10 flex items-center gap-4">
                <Settings className="w-10 h-10 text-brand-gold" />
                اختر مستوى التحدي
              </h2>
              <div className="grid gap-6">
                {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleSelectDifficulty(lvl)}
                    className={`group w-full text-right p-8 rounded-3xl border-2 transition-all duration-500 relative overflow-hidden ${difficulty === lvl ? 'border-brand-emerald bg-brand-emerald/5' : 'border-slate-100 hover:border-brand-gold/30 bg-white/50'}`}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <div className={`font-black text-2xl ${difficulty === lvl ? 'text-brand-emerald' : 'text-slate-700'}`}>
                          {lvl === 'easy' ? 'مبتدئ' : lvl === 'medium' ? 'متوسط' : 'خبير'}
                        </div>
                        <div className="text-slate-500 text-sm mt-2 leading-relaxed opacity-70 italic">
                          {lvl === 'easy' ? '3 آيات كحد أقصى • دقة مرنة في النطق' : lvl === 'medium' ? '5 آيات كحد أقصى • دقة متوازنة' : 'جميع الآيات المتشابهة • دقة عالية جداً'}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full transition-all ${difficulty === lvl ? 'bg-brand-emerald scale-150 shadow-[0_0_10px_rgba(6,78,59,0.5)]' : 'bg-slate-200'}`} />
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={handleBackToHome}
                className="w-full mt-10 py-5 rounded-3xl bg-slate-100 text-slate-500 font-black hover:bg-slate-200 transition-all active:scale-95"
              >
                رجوع للرئيسية
              </button>
            </motion.div>
          ) : challengeMode === 'daily' && dailyCompleted ? (
            <motion.div
              key="daily-done"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-12 rounded-[4rem] text-center max-w-2xl mx-auto border-brand-gold/20"
            >
              <div className="mb-8 relative inline-block">
                <div className="absolute inset-0 bg-brand-gold/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <CheckCircle className="w-24 h-24 text-brand-gold relative z-10" />
              </div>
              <h2 className="text-4xl font-black text-brand-emerald mb-4">أتممت تحديك اليومي!</h2>
              <p className="text-slate-500 mb-10 text-lg font-medium">بارك الله فيك، التحدي القادم ينتظرك في:</p>
              <div className="text-6xl font-black text-brand-emerald mb-12 tabular-nums tracking-tighter" dir="ltr">
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
              className={`w-full max-w-6xl mx-auto space-y-8 p-4 md:p-8 rounded-[3rem] transition-all duration-500 theme-transition ${librarySettings.darkMode ? 'lib-dark shadow-2xl shadow-black/50' : ''}`}
            >
              <LibrarySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={librarySettings}
                setSettings={setLibrarySettings}
                showReadingMode={true}
              />
              {!selectedSurahId && !selectedJuz && !isSearchSubmitted ? (
                <div className="space-y-10">
                  {/* Header & Search */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <h2 className="text-4xl md:text-5xl font-black text-brand-emerald flex items-center gap-4">
                      <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-brand-gold" />
                      {librarySettings.readingMode === 'page' ? `الصفحة ${currentPage}` : 'المصحف الشريف'}
                    </h2>
                    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (searchQuery.trim()) {
                            setIsSearchSubmitted(true);
                          }
                        }}
                        className="flex items-center gap-2 w-full md:w-96"
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
                            className="w-full pr-12 pl-6 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 transition-all font-bold"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-8 py-4 bg-brand-emerald text-white rounded-2xl font-black hover:bg-brand-emerald/90 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                        >
                          بحث
                        </button>
                      </form>
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-4 rounded-2xl bg-white border border-slate-100 text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/5 transition-all shadow-sm flex items-center justify-center"
                        title="إعدادات المصحف"
                      >
                        <Settings className="w-6 h-6" />
                      </button>
                      <button
                        onClick={handleBackToHome}
                        className="px-6 md:px-8 py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 transition-all text-sm md:text-base whitespace-nowrap"
                      >
                        رجوع
                      </button>
                    </div>
                  </div>

                  {/* Juz' Curtain Selector */}
                  <div className="bg-white/50 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setIsJuzMenuOpen(!isJuzMenuOpen)}
                      className="w-full flex items-center justify-between p-6 hover:bg-white/50 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isJuzMenuOpen ? 'bg-brand-emerald text-white' : 'bg-brand-emerald/5 text-brand-emerald'}`}>
                          <ListFilter className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <h3 className="font-black text-slate-800 tracking-tight text-lg">تصفح بالأجزاء (1-30)</h3>
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
                            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-3">
                              {Array.from({ length: 30 }).map((_, i) => (
                                <button
                                  key={i + 1}
                                  onClick={() => {
                                    setSelectedJuz(i + 1);
                                    setIsJuzMenuOpen(false);
                                    if (librarySettings.readingMode === 'page') {
                                      setCurrentPage(juzStartPages[i + 1] || 1);
                                      setIsPageModeActive(true);
                                    }
                                  }}
                                  className="aspect-square rounded-2xl bg-white border border-slate-100 text-slate-600 font-extrabold flex flex-col items-center justify-center hover:bg-brand-emerald hover:text-white hover:border-brand-emerald transition-all shadow-sm hover:shadow-brand-emerald/20 hover:-translate-y-1"
                                >
                                  <span className="text-[10px] opacity-50 uppercase mb-0.5">جزء</span>
                                  <span className="text-lg tabular-nums">{i + 1}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {librarySettings.readingMode === 'page' && !isPageModeActive ? (
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

                      <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {quranData.map((surah: any) => (
                          <motion.button
                            key={surah.id}
                            whileHover={{ scale: 1.03, y: -5 }}
                            onClick={() => {
                              setCurrentPage(surahStartPages[surah.id] || 1);
                              setIsPageModeActive(true);
                            }}
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
                    </div>
                  ) : librarySettings.readingMode === 'page' && isPageModeActive ? (
                    <div className="space-y-12 pb-20">
                      <div className="flex items-center justify-between glass p-6 rounded-[2.5rem] border border-white/80 shadow-xl max-w-4xl mx-auto">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-brand-emerald hover:text-white transition-all disabled:opacity-30"
                        >
                          <ChevronRight className="w-5 h-5" />
                          السابقة
                        </button>
                        <form onSubmit={handlePageJump} className="flex flex-col items-center group">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-400 font-quran">صفحة</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={pageInput}
                              onChange={(e) => {
                                const val = convertArabicNumbersToEnglish(e.target.value);
                                setPageInput(val);
                                const num = parseInt(val);
                                if (!isNaN(num) && num >= 1 && num <= 604) {
                                  setCurrentPage(num);
                                }
                              }}
                              onBlur={() => setPageInput(currentPage.toString())}
                              className="w-16 py-1 px-2 rounded-xl bg-brand-emerald/5 border-2 border-brand-emerald/10 text-center text-2xl font-black text-brand-emerald focus:outline-none focus:border-brand-emerald/30 transition-all tabular-nums"
                            />
                          </div>
                          <button
                            onClick={() => setIsPageModeActive(false)}
                            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-brand-emerald transition-colors mt-1"
                          >
                            العودة للفهرس
                          </button>
                        </form>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(604, prev + 1))}
                          disabled={currentPage === 604}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-brand-emerald hover:text-white transition-all disabled:opacity-30"
                        >
                          التالية
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="mushaf-page-container islamic-watermark">
                        {/* Traditional Header */}
                        <div className="flex justify-between items-center px-12 pt-8 text-brand-gold font-bold text-lg border-b border-brand-gold/10 pb-4">
                          <div className="flex items-center gap-2">
                            <span className="opacity-50 text-sm">الجزء</span>
                            <span>{currentJuz}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="opacity-50 text-sm">سورة</span>
                            <span>{currentSurahName}</span>
                          </div>
                        </div>

                        <div className="mushaf-page-frame">
                          <div className="flex flex-wrap justify-center gap-x-2 gap-y-12 leading-[2.8] text-center w-full" dir="rtl">
                            {pageVerses.map((verse, idx) => {
                              const isNewSurah = idx === 0 || verse.surahId !== pageVerses[idx - 1].surahId;
                              return (
                                <React.Fragment key={idx}>
                                  {isNewSurah && (
                                    <div className="w-full flex flex-col items-center gap-6 my-12">
                                      <div className="h-px w-full bg-linear-to-r from-transparent via-brand-gold/30 to-transparent" />
                                      <div className="px-10 py-3 rounded-full bg-brand-gold/5 border border-brand-gold/20 text-brand-gold font-black text-xl quran-text">
                                        سورة {verse.surahName}
                                      </div>
                                      <div className="h-px w-full bg-linear-to-r from-transparent via-brand-gold/30 to-transparent" />
                                    </div>
                                  )}
                                  <div className="inline-block relative group">
                                    <span
                                      style={{ fontSize: `${librarySettings.fontSize}px` }}
                                      className="quran-text text-slate-800 hover:text-brand-emerald transition-colors cursor-pointer select-text"
                                    >
                                      {verse.text}
                                    </span>
                                    <span className="verse-marker-traditional">
                                      {verse.id}
                                    </span>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* Traditional Page Number Footer */}
                        <div className="mushaf-footer-page tabular-nums">
                          {currentPage}
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
                        <h2 className="text-3xl font-black text-brand-emerald">نتائج البحث</h2>
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
                            <p className="text-3xl quran-text text-slate-800 leading-relaxed text-center group-hover:text-brand-emerald transition-colors">
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
                        <h2 className="text-3xl font-black text-brand-emerald">الجزء {selectedJuz}</h2>
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

                  <div className="glass p-8 md:p-12 rounded-[4rem] border border-white/50 shadow-2xl space-y-12 bg-white/40 backdrop-blur-3xl">
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-14 leading-[3.5] text-center" dir="rtl">
                      {juzVerses.map((verse, idx) => {
                        // Show Surah name if it's the first verse of a Surah in this Juz'
                        const isNewSurah = idx === 0 || verse.surahId !== juzVerses[idx - 1].surahId;
                        return (
                          <React.Fragment key={idx}>
                            {isNewSurah && (
                              <div className="w-full flex items-center gap-6 my-10">
                                <div className="h-px flex-1 bg-linear-to-r from-transparent to-brand-emerald/20" />
                                <div className="px-8 py-3 rounded-full bg-brand-emerald/5 border border-brand-emerald/10 text-brand-emerald font-black text-xl quran-text">
                                  سورة {verse.surahName}
                                </div>
                                <div className="h-px flex-1 bg-linear-to-l from-transparent to-brand-emerald/20" />
                              </div>
                            )}
                            <div className="inline-block relative group">
                              <span
                                style={{ fontSize: `${librarySettings.fontSize}px` }}
                                className="quran-text text-slate-800 hover:text-brand-emerald transition-colors cursor-pointer select-text leading-[1.8]"
                              >
                                {verse.text}
                              </span>
                              <span className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-brand-gold/30 text-brand-gold text-[10px] md:text-xs font-black mx-4 tabular-nums group-hover:border-brand-emerald group-hover:scale-110 transition-all align-middle">
                                {verse.id}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}
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

                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-10 md:gap-y-14 leading-[2.5] md:leading-[3.5] text-center" dir="rtl">
                      {quranData.find(s => s.id === selectedSurahId)?.verses.map((verse: any) => (
                        <div key={verse.id} className="inline-block relative group">
                          <span
                            style={{ fontSize: `${librarySettings.fontSize}px` }}
                            className="quran-text text-slate-800 hover:text-brand-emerald transition-colors cursor-pointer select-text leading-[1.8]"
                          >
                            {verse.text}
                          </span>
                          <span className="inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-brand-gold/30 text-brand-gold text-[10px] md:text-xs font-black mx-4 tabular-nums group-hover:border-brand-emerald group-hover:scale-110 transition-all align-middle">
                            {verse.id}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-20 text-center">
                      <button
                        onClick={() => {
                          setSelectedSurahId(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-12 py-5 rounded-3xl bg-brand-emerald text-white font-black shadow-2xl shadow-brand-emerald/30 hover:-translate-y-1 transition-all active:scale-95"
                      >
                        إكمال القراءة .. العودة للفهرس
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
              className={`w-full max-w-5xl mx-auto space-y-12 transition-all duration-500 theme-transition ${librarySettings.darkMode ? 'lib-dark shadow-2xl shadow-black/50' : ''}`}
            >
              {/* Adhkar Header */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-emerald flex items-center justify-center text-brand-gold shadow-lg">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-brand-emerald">أذكار المسلم</h2>
                    <p className="text-slate-400 font-bold text-sm mt-1">حصن المسلم اليومي المستحب</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  {selectedAdhkarCategoryId && (
                    <button
                      onClick={() => setSelectedAdhkarCategoryId(null)}
                      className="px-6 py-3 rounded-2xl bg-white text-brand-emerald font-bold border border-brand-emerald/20 hover:bg-brand-emerald/5 transition-all"
                    >
                      تغيير التصنيف
                    </button>
                  )}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Object.values(adhkarData).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedAdhkarCategoryId(cat.id);
                    }}
                    className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border transition-all duration-300 ${selectedAdhkarCategoryId === cat.id
                      ? 'bg-brand-emerald text-white border-brand-emerald shadow-xl -translate-y-1'
                      : 'bg-white text-slate-400 border-white/50 hover:border-brand-emerald/30 hover:text-brand-emerald shadow-sm'}`}
                  >
                    <div className={`p-3 rounded-2xl ${selectedAdhkarCategoryId === cat.id ? 'bg-white/20' : 'bg-slate-50'}`}>
                      {cat.icon === 'Sun' && <Sun className="w-6 h-6" />}
                      {cat.icon === 'Moon' && <Moon className="w-6 h-6" />}
                      {cat.icon === 'Mosque' && <Compass className="w-6 h-6" />}
                      {cat.icon === 'Home' && <Home className="w-6 h-6" />}
                      {cat.icon === 'Plane' && <Plane className="w-6 h-6" />}
                    </div>
                    <span className="font-black text-sm rtl">{cat.title}</span>
                  </button>
                ))}
              </div>

              {/* Dhikr List */}
              {selectedAdhkarCategoryId && (
                <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4 px-4">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest leading-none">
                      {adhkarData[selectedAdhkarCategoryId].title}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  {adhkarData[selectedAdhkarCategoryId].items.map((dhikr) => (
                    <motion.div
                      key={dhikr.id}
                      layout
                      className={`glass p-8 md:p-10 rounded-[3rem] border border-white/50 relative overflow-hidden transition-all duration-500 cursor-pointer ${adhkarProgress[dhikr.id] === 0 ? 'opacity-60 grayscale' : 'hover:shadow-2xl active:scale-[0.98]'}`}
                      onClick={() => {
                        if (adhkarProgress[dhikr.id] === 0) return;
                        const currentCount = adhkarProgress[dhikr.id] ?? dhikr.count;
                        setAdhkarProgress(prev => ({ ...prev, [dhikr.id]: Math.max(0, currentCount - 1) }));
                        if (window.navigator.vibrate) window.navigator.vibrate(50);
                      }}
                    >
                      {/* Progress Bar Background */}
                      <motion.div
                        className="absolute bottom-0 right-0 h-1.5 bg-brand-gold/20"
                        initial={{ width: '100%' }}
                        animate={{ width: `${((adhkarProgress[dhikr.id] ?? dhikr.count) / dhikr.count) * 100}%` }}
                      />

                      <div className="flex items-start justify-between gap-10 relative z-10">
                        <div className="flex-1 space-y-6">
                          <p
                            className="quran-text text-slate-800 leading-[1.8] md:leading-relaxed"
                            style={{ fontSize: `${librarySettings.fontSize}px` }}
                          >
                            {dhikr.text}
                          </p>
                          {(dhikr.description || dhikr.reference) && (
                            <div className="flex flex-wrap items-center gap-4">
                              {dhikr.description && (
                                <p className="px-4 py-1.5 rounded-full bg-brand-emerald/5 text-xs font-bold text-brand-emerald italic">
                                  {dhikr.description}
                                </p>
                              )}
                              {dhikr.reference && (
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-md">
                                  {dhikr.reference}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-4">
                          <motion.div
                            key={adhkarProgress[dhikr.id] ?? dhikr.count}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`w-24 h-24 rounded-[2rem] flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ${adhkarProgress[dhikr.id] === 0 ? 'bg-green-500 text-white shadow-green-200 rotate-12 scale-110' : 'bg-white text-slate-800'}`}
                          >
                            {adhkarProgress[dhikr.id] === 0 ? (
                              <CheckCircle className="w-10 h-10" />
                            ) : (
                              <>
                                <span className="text-3xl font-black tabular-nums">{adhkarProgress[dhikr.id] ?? dhikr.count}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">تكرار</span>
                              </>
                            )}
                          </motion.div>
                          <div className={`text-[10px] font-black transition-all ${adhkarProgress[dhikr.id] === 0 ? 'text-green-600' : 'text-slate-400 opacity-50'}`}>
                            {adhkarProgress[dhikr.id] === 0 ? 'تم بنجاح' : 'اضغط للعد'}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

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
              className="w-full max-w-5xl mx-auto space-y-12"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-lg">
                    <Quote className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-teal-900 font-quran">الأربعون النووية</h2>
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {HADITHS.map((hadith) => (
                  <motion.button
                    key={hadith.id}
                    whileHover={{ scale: 1.02, y: -5 }}
                    onClick={() => setSelectedHadith(hadith)}
                    className="glass p-8 rounded-[2.5rem] border border-white/50 text-right flex flex-col gap-4 hover:shadow-2xl transition-all group relative overflow-hidden text-right items-start"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-teal-500/10 group-hover:bg-teal-500 transition-colors" />
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 font-black group-hover:bg-teal-600 group-hover:text-white transition-colors">
                      {hadith.id}
                    </div>
                    <div className="flex-1 w-full text-right">
                      <div className="text-xl font-black text-slate-800 font-quran line-clamp-2">{hadith.title}</div>
                      <p className="text-slate-500 font-medium text-sm mt-3 line-clamp-3 leading-loose">
                        {hadith.hadith.split('\n').filter(l => l.trim()).slice(1, 4).join(' ')}...
                      </p>
                    </div>
                    <div className="w-full h-px bg-slate-50 my-2" />
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">عرض الحديث وشرحه</span>
                      <ChevronLeft className="w-4 h-4 text-teal-400 group-hover:translate-x-[-4px] transition-transform" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div key="game" className="space-y-10">
              {/* Keyword Card */}
              <motion.div
                layout
                className="glass relative p-12 rounded-[4rem] text-center overflow-hidden border-brand-emerald/10 shadow-2xl"
              >
                <div className="absolute top-0 inset-x-0 h-2 bg-linear-to-r from-transparent via-brand-gold/40 to-transparent" />

                {challengeMode === 'daily' && (
                  <div className="absolute top-8 right-8 bg-brand-gold text-brand-emerald text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg">
                    يوميات الحفاظ
                  </div>
                )}

                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] mb-6">افتتح بالقول</h2>
                <motion.p
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  key={KEYWORD}
                  className="text-5xl font-black text-brand-emerald leading-relaxed quran-text"
                >
                  "{KEYWORD} ..."
                </motion.p>

                <div className="flex justify-center gap-4 mt-10">
                  <button
                    onClick={handleExplain}
                    className="group flex items-center gap-3 px-8 py-4 bg-brand-emerald text-white rounded-3xl text-sm font-black hover:bg-brand-emerald/90 transition-all shadow-xl hover:shadow-brand-emerald/20"
                  >
                    <Sparkles className="w-5 h-5 text-brand-gold group-hover:rotate-12 transition-transform" />
                    شرح المتشابهات بالذكاء الاصطناعي
                  </button>

                  {challengeMode === 'normal' && (
                    <button
                      onClick={handleSkip}
                      className="group flex items-center gap-3 px-8 py-4 bg-white/80 text-slate-500 rounded-3xl text-sm font-black hover:bg-white transition-all shadow-xl border border-slate-100"
                    >
                      <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                      تخطي السؤال
                    </button>
                  )}
                </div>
              </motion.div>

              {/* AI Explanation Modal */}
              <AnimatePresence>
                {showExplanation && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -20, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="glass bg-brand-emerald/5 border-brand-emerald/10 rounded-[3rem] p-10 relative">
                      <button
                        onClick={() => setShowExplanation(false)}
                        className="absolute top-6 left-6 p-2 text-slate-400 hover:text-brand-emerald transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                      <h3 className="text-xl font-black text-brand-emerald mb-6 flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-brand-gold" />
                        نور المتشابهات
                      </h3>
                      {isExplaining ? (
                        <div className="flex items-center gap-4 text-brand-emerald py-10">
                          <div className="w-6 h-6 border-4 border-brand-gold border-t-transparent rounded-full animate-spin" />
                          <span className="font-bold animate-pulse">يتم استجلاء المعاني...</span>
                        </div>
                      ) : (
                        <div className="prose prose-emerald prose-lg rtl:prose-reverse max-w-none text-slate-700 leading-loose quran-text">
                          <ReactMarkdown>{explanationText || ''}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls & Progress */}
              <div className="glass p-8 rounded-[3rem] flex flex-col lg:flex-row items-center justify-between gap-10 border-white/80">
                <div className="flex items-center gap-6">
                  {!hasRecognition ? (
                    <div className="bg-red-50 text-red-600 px-6 py-4 rounded-2xl border border-red-100 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      <span className="font-bold text-sm">التطبيق يتطلب متصفح Chrome لتفعيل ميزة التعرف على الصوت</span>
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className={`absolute inset-0 bg-brand-emerald/20 blur-2xl rounded-full transition-all duration-500 group-hover:scale-110 ${isListening ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
                      <button
                        onClick={isListening ? stopListening : startListening}
                        className={`relative flex items-center gap-4 px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-2xl ${isListening
                          ? 'bg-red-500 text-white shadow-red-200'
                          : 'bg-brand-emerald text-white shadow-brand-emerald/20 hover:bg-brand-emerald/90'
                          }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-6 h-6 animate-bounce" />
                            إيقاف التلاوة
                          </>
                        ) : (
                          <>
                            <Mic className="w-6 h-6 group-hover:rotate-6 transition-transform" />
                            ابدأ التلاوة الكريمة
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full max-w-xl">
                  <div className="flex justify-between items-end mb-4 px-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">إنجازك</span>
                      <span className="text-2xl font-black text-brand-emerald">{matchedIds.size} / {targetVerses.length} <span className="text-sm font-bold text-slate-400">آية</span></span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold">النقاط</span>
                      <span className="text-3xl font-black text-brand-gold tabular-nums">{score}</span>
                    </div>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-2xl overflow-hidden p-1 border border-white shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 50 }}
                      className="h-full bg-linear-to-r from-brand-emerald to-emerald-400 rounded-xl shadow-lg relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-linear-to-r from-white/20 to-transparent skew-x-12 -translate-x-full animate-[shimmer_2s_infinite]" />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Transcript Debug */}
              <AnimatePresence>
                {isListening && transcript && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-8 glass bg-brand-gold/5 border-brand-gold/10 rounded-3xl text-slate-700 text-center quran-text text-xl italic"
                  >
                    "{transcript}"
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Message */}
              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="p-10 glass bg-brand-emerald text-white rounded-[3rem] text-center shadow-[0_30px_60px_-15px_rgba(6,78,59,0.4)] border-white/20 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <Trophy className="w-20 h-20 mb-6 text-brand-gold mx-auto drop-shadow-lg" />
                    <h3 className="text-4xl font-black mb-4">فتح الله عليك!</h3>
                    <p className="mb-10 text-emerald-100 text-xl font-medium">أتقنت جميع المتشابهات في هذا الموضع ببراعة بارك الله فيك.</p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
                            handleNextChallenge();
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

              {/* Verses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {targetVerses.map((verse, index) => (
                  <VerseCard
                    key={verse.id}
                    verse={verse}
                    keyword={KEYWORD}
                    isMatched={matchedIds.has(verse.id)}
                    isRevealed={revealedIds.has(verse.id)}
                    hints={hintLevels[verse.id] || 0}
                    onReveal={handleReveal}
                    onHint={handleHint}
                    index={index}
                    keywordWordCount={keywordWordCount}
                    distinguishingWordCount={distinguishingWordCounts[verse.id] || 0}
                    wordStates={wordStates[verse.id] || {}}
                  />
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
        )}
      </main>

      {view === 'home' && (
        <footer className="max-w-4xl mx-auto px-6 pb-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass p-5 rounded-[2rem] border border-white/50 text-center shadow-lg hover:shadow-xl transition-all group"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="bg-brand-emerald/5 p-2 rounded-xl group-hover:scale-110 transition-transform duration-500">
                <Sparkles className="w-4 h-4 text-brand-gold" />
              </div>
              <div className="space-y-1">
                <p className="text-brand-emerald font-black text-base tracking-tight">
                  قام بإنشاء هذا التطبيق <span className="text-brand-gold">علاء الدين الحجي</span>
                </p>
                <p className="text-brand-emerald font-black text-base tracking-tight">
                  صاحب فكرة التطبيق<span className="text-brand-gold"> الاخ عمر سمير طبش</span>
                </p>
                <p className="text-slate-500 font-bold text-xs leading-relaxed">
                  لا تنسونا من دعواكم، هذا التطبيق صدقة عنا وعن والدينا وأحبائنا
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
              className={`p-8 md:p-12 rounded-[3.5rem] max-w-4xl w-full max-h-[85vh] overflow-y-auto overflow-x-hidden shadow-2xl transition-all duration-500 theme-transition relative ${librarySettings.darkMode ? 'lib-dark' : 'glass border-white/20'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedHadith(null)}
                className="absolute top-8 left-8 p-3 rounded-2xl bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all z-20"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="relative z-10 space-y-12 pb-10" dir="rtl">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-600/30">
                    <Quote className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-4xl font-black text-teal-900 font-quran">{selectedHadith.title}</h2>
                  <div className="h-1.5 w-24 bg-teal-500/20 rounded-full mx-auto" />
                </div>

                <div className="space-y-8">
                  <div className="glass bg-white/40 p-10 rounded-[2.5rem] border border-white shadow-premium">
                    <h3 className="text-sm font-black text-teal-600 uppercase tracking-[0.3em] mb-6 opacity-60">نص الحديث الشريف</h3>
                    <p
                      className="text-3xl md:text-4xl quran-text text-slate-800 leading-[2] md:leading-relaxed text-center font-bold"
                      style={{ fontSize: `${librarySettings.fontSize}px` }}
                    >
                      {selectedHadith.hadith.split('\n').filter(l => l.trim()).slice(1).join('\n')}
                    </p>
                  </div>

                  <div className="glass bg-teal-50/30 p-10 rounded-[2.5rem] border-teal-100 shadow-premium">
                    <h3 className="text-sm font-black text-teal-600 uppercase tracking-[0.3em] mb-6 opacity-60">الشرح والفوائد</h3>
                    <div
                      className="text-xl font-medium text-slate-700 leading-loose prose prose-teal max-w-none whitespace-pre-wrap"
                      style={{ fontSize: `${librarySettings.fontSize * 0.7}px` }}
                    >
                      {selectedHadith.description}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-8">
                  <button
                    onClick={() => setSelectedHadith(null)}
                    className="px-12 py-5 bg-teal-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-all active:scale-95"
                  >
                    تمت القراءة
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
