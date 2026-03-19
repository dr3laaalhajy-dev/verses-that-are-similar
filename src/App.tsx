import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Mic, MicOff, CheckCircle, BookOpen, Trophy, Lightbulb, Settings, Calendar, Sparkles, X, Copy, Check } from 'lucide-react';
import { searchAyahsByStart, Ayah as Verse } from './services/QuranRepository';
import { normalizeArabicText } from './utils/arabic';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import Confetti from 'react-confetti';

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

const CHALLENGES = [
  "يَا أَيُّهَا الَّذِينَ آمَنُوا لَا",
  "يَسْأَلُونَكَ عَنِ",
  "وَمِنْهُمْ مَنْ",
  "يَا أَيُّهَا النَّاسُ اتَّقُوا",
  "سَبَّحَ لِلَّهِ",
  "وَمَا أَرْسَلْنَا مِنْ قَبْلِكَ",
  "إِنَّ الَّذِينَ كَفَرُوا",
  "وَلَقَدْ أَرْسَلْنَا",
  "وَمَا أَرْسَلْنَا فِي قَرْيَةٍ",
  "إِنَّ فِي ذَلِكَ لَآيَةً",
  "وَلَقَدْ آتَيْنَا مُوسَى",
  "يَا بَنِي إِسْرَائِيلَ اذْكُرُوا",
  "وَإِذْ قَالَ مُوسَى لِقَوْمِهِ",
  "قُلْ يَا أَيُّهَا النَّاسُ",
  "وَمَنْ أَظْلَمُ مِمَّنِ",
  "ذَلِكَ بِمَا قَدَّمَتْ أَيْدِيكُمْ",
  "وَمَا كَانَ رَبُّكَ",
  "أَلَمْ تَرَ إِلَى الَّذِينَ",
  "وَإِذَا قِيلَ لَهُمْ",
  "إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ",
];

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
}

const VerseCard = memo(({ verse, keyword, isMatched, isRevealed, hints, onReveal, onHint, index, keywordWordCount, distinguishingWordCount }: VerseCardProps) => {
  const showText = isMatched || isRevealed;
  const [copied, setCopied] = useState(false);

  const getHintText = () => {
    const normalizedVerse = normalizeArabicText(verse.text);
    const normalizedKeyword = normalizeArabicText(keyword);
    const uniquePart = normalizedVerse.replace(normalizedKeyword, '').trim();
    const uniqueWords = uniquePart.split(' ').filter(Boolean);
    
    if (hints === 0 || uniqueWords.length === 0) return null;
    
    const wordsToShow = Math.min(hints * 2, uniqueWords.length);
    return `${keyword} ${uniqueWords.slice(0, wordsToShow).join(' ')} ...`;
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
    const part1 = words.slice(0, keywordWordCount).join(' ');
    const part2 = words.slice(keywordWordCount, keywordWordCount + distinguishingWordCount).join(' ');
    const part3 = words.slice(keywordWordCount + distinguishingWordCount).join(' ');

    return (
      <p className={`text-2xl quran-text leading-loose mb-4 ${isMatched ? 'text-brand-emerald font-bold' : 'text-slate-600'}`}>
        {part1}{' '}
        {part2 && <span className="text-brand-gold border-b-2 border-brand-gold/30 transition-colors bg-brand-gold/5 px-1 rounded">{part2}</span>}{' '}
        {part3}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`relative p-8 rounded-3xl border-2 transition-all duration-700 flex flex-col justify-between overflow-hidden group ${
        isMatched
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

export default function App() {
  const [view, setView] = useState<'home' | 'difficulty' | 'challenge'>('home');
  const [challengeMode, setChallengeMode] = useState<'daily' | 'normal'>('normal');
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [dailyCompleted, setDailyCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  
  const dailyChallengeIndex = useMemo(() => {
    // Use current date to pick a daily challenge
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / 86400000);
    return daysSinceEpoch % CHALLENGES.length;
  }, []);

  const KEYWORD = challengeMode === 'daily' ? CHALLENGES[dailyChallengeIndex] : CHALLENGES[currentChallengeIndex];
  
  const [allTargetVerses, setAllTargetVerses] = useState<Verse[]>([]);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [hintLevels, setHintLevels] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  
  // AI Explanation State
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  
  const { width, height } = useWindowSize();
  
  const { isListening, transcript, startListening, stopListening, resetTranscript, hasRecognition } = useSpeechRecognition();

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const savedDaily = localStorage.getItem('quran_daily_completed');
    if (savedDaily === todayStr) {
      setDailyCompleted(true);
    } else {
      setDailyCompleted(false);
    }
  }, []);

  const handleStartDaily = () => {
    if (dailyCompleted) return;
    setChallengeMode('daily');
    setView('challenge');
  };

  const handleStartNormal = () => {
    setChallengeMode('normal');
    setView('difficulty');
  };

  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem('quran_game_difficulty', diff);
    setView('challenge');
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
    if (challengeMode === 'daily') return; // Cannot skip daily? Or maybe you can. Let's allow it for normal.
    setCurrentChallengeIndex((prev) => (prev + 1) % CHALLENGES.length);
    resetTranscript();
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

  const saveScore = (challenge: string, newScore: number) => {
    setBestScores(prev => {
      const updated = { ...prev };
      const key = challengeMode === 'daily' ? `[يومي] ${challenge}` : challenge;
      if (!updated[key] || newScore > updated[key]) {
        updated[key] = newScore;
        localStorage.setItem('quran_game_scores', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleDifficultyChange = (newDiff: Difficulty) => {
    setDifficulty(newDiff);
    localStorage.setItem('quran_game_difficulty', newDiff);
    setShowSettings(false);
  };

  useEffect(() => {
    // تحميل الآيات عند بدء التطبيق أو تغيير التحدي
    setAllTargetVerses(searchAyahsByStart(KEYWORD));
    setMatchedIds(new Set());
    setRevealedIds(new Set());
    setHintLevels({});
    setScore(0);
    setExplanationText(null);
    setShowExplanation(false);
    resetTranscript();
  }, [KEYWORD, resetTranscript]);

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

      // Require at least 2 words if available, to avoid matching too early on a single common word
      wordsNeeded = Math.max(wordsNeeded, Math.min(2, uniqueWords.length));
      const distinguishingWords = uniqueWords.slice(0, wordsNeeded);
      
      const distMatch = getBestSubsequenceMatch(transcriptWords, distinguishingWords);
      const fullMatch = getBestSubsequenceMatch(transcriptWords, uniqueWords);
      
      const distRatio = distMatch.matches / distinguishingWords.length;
      const fullRatio = fullMatch.matches / uniqueWords.length;
      
      // Score formula:
      // 1. High weight on distinguishing words ratio
      // 2. Medium weight on full words ratio
      // 3. Bonus for consecutive matches
      // 4. Bonus for total matched words (prioritizes longer verses if ratios are similar)
      const score = (distRatio * 100) + (fullRatio * 50) + (fullMatch.consecutiveMatches * 5) + fullMatch.matches;
      
      // Adjust required ratio based on difficulty
      let requiredDistRatio = distinguishingWords.length <= 2 ? 1.0 : 0.8;
      let requiredFullRatio = 0.8;
      
      if (difficulty === 'easy') {
        requiredDistRatio = distinguishingWords.length <= 2 ? 0.8 : 0.6;
        requiredFullRatio = 0.6;
      } else if (difficulty === 'hard') {
        requiredDistRatio = 1.0;
        requiredFullRatio = 0.9;
      }
      
      if (distRatio >= requiredDistRatio || fullRatio >= requiredFullRatio) {
        candidates.push({ verse, score, distRatio, fullRatio });
      }
    });

    if (candidates.length > 0) {
      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);
      
      const best = candidates[0];
      let isMatch = false;
      
      if (candidates.length === 1) {
        isMatch = true;
      } else {
        const secondBest = candidates[1];
        // If the best is strictly better than the second best in score, and has a good distRatio
        if (best.score > secondBest.score + 10) {
          isMatch = true;
        } else if (best.distRatio === 1 && secondBest.distRatio < 1) {
          isMatch = true;
        }
      }
      
      if (isMatch) {
        setMatchedIds(prev => {
          const newSet = new Set(prev);
          newSet.add(best.verse.id);
          return newSet;
        });
        // Less points if hints were used
        const hintsUsed = hintLevels[best.verse.id] || 0;
        const pointsEarned = Math.max(2, 10 - (hintsUsed * 2));
        setScore(prev => prev + pointsEarned);
      }
    }
  }, [transcript, targetVerses, matchedIds, KEYWORD, difficulty, hintLevels]);

  const handleNextChallenge = () => {
    saveScore(KEYWORD, score);
    if (window.confirm('هل أنت مستعد للتحدي التالي؟')) {
      setChallengeMode('normal');
      setCurrentChallengeIndex((prev) => (prev + 1) % CHALLENGES.length);
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

  const handleExplain = async () => {
    setShowExplanation(true);
    if (explanationText) return;
    
    setIsExplaining(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || '' });
      
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
              <h1 className="text-2xl font-black tracking-tight text-white">لعبة المتشابهات</h1>
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-brand-gold/70">القرآن الكريم</p>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleBackToHome}
              className="px-4 py-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2"
              title="العودة للرئيسية"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>

            <button 
              onClick={() => {
                setChallengeMode('daily');
                setShowScores(false);
                setShowSettings(false);
                setView('challenge');
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all text-sm font-bold shadow-lg ${challengeMode === 'daily' ? 'bg-brand-gold text-brand-emerald' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              title="التحدي اليومي"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">التحدي اليومي</span>
            </button>
            
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-2xl transition-all shadow-lg ${showSettings ? 'bg-brand-gold text-brand-emerald' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              title="الإعدادات"
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => {
                if (!showScores && isComplete) saveScore(KEYWORD, score);
                setShowScores(!showScores);
                setShowSettings(false);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl transition-all text-sm font-bold shadow-lg ${showScores ? 'bg-brand-gold text-brand-emerald' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">{showScores ? 'العودة' : 'المتصدرين'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <AnimatePresence mode="wait">
          {showScores ? (
            <motion.div 
              key="scores"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-10 rounded-[3rem] max-w-3xl mx-auto"
            >
              <h2 className="text-3xl font-black text-brand-emerald mb-10 flex items-center gap-3">
                <Trophy className="w-8 h-8 text-brand-gold" />
                سجل الأبطال
              </h2>
              {Object.keys(bestScores).length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                  <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">كن أول من يسجل اسمه هنا</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(Object.entries(bestScores) as [string, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([challenge, bestScore], index) => (
                    <motion.div 
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.05 }}
                      key={challenge} 
                      className="flex justify-between items-center p-6 bg-white/60 rounded-3xl border border-white hover:shadow-xl transition-all group"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-transform group-hover:rotate-12 ${index === 0 ? 'bg-brand-gold/10 text-brand-gold scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-slate-800 text-lg quran-text">"{challenge} ..."</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-2xl text-brand-emerald">{bestScore}</span>
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">نقطة</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : view === 'home' ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto py-10"
            >
              {/* Daily Challenge Card */}
              <motion.button
                whileHover={{ y: -10 }}
                onClick={handleStartDaily}
                disabled={dailyCompleted}
                className={`group relative p-10 rounded-[4rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between ${dailyCompleted ? 'bg-slate-100 opacity-60 grayscale cursor-not-allowed border-slate-200' : 'glass bg-linear-to-br from-amber-400/10 to-brand-gold/20 border-brand-gold/30 shadow-2xl hover:shadow-brand-gold/20'}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-brand-gold/5 rounded-br-full -ml-16 -mt-16 group-hover:scale-150 transition-transform" />
                <div className="relative z-10">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${dailyCompleted ? 'bg-slate-300' : 'bg-brand-gold shadow-brand-gold/40'}`}>
                    <Calendar className={`w-8 h-8 ${dailyCompleted ? 'text-slate-500' : 'text-brand-emerald'}`} />
                  </div>
                  <h2 className={`text-4xl font-black mb-4 ${dailyCompleted ? 'text-slate-500' : 'text-brand-emerald'}`}>التحدي اليومي</h2>
                  <p className="text-slate-500 font-medium text-lg leading-relaxed">
                    {dailyCompleted ? 'لقد أتممت وردك اليومي، نراك غداً بإذن الله' : 'اختبر حفظك في موضع واحد جديد كل يوم'}
                  </p>
                </div>
                {dailyCompleted && (
                  <div className="mt-8 text-2xl font-black text-brand-emerald tabular-nums" dir="ltr">
                    {timeLeft}
                  </div>
                )}
                {!dailyCompleted && (
                  <div className="mt-8 flex items-center gap-3 text-brand-gold font-black group-hover:gap-5 transition-all">
                    <span>ابدأ الآن</span>
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                )}
              </motion.button>

              {/* Main Challenge Card */}
              <motion.button
                whileHover={{ y: -10 }}
                onClick={handleStartNormal}
                className="group relative p-10 rounded-[4rem] text-right overflow-hidden transition-all duration-500 flex flex-col justify-between glass bg-linear-to-br from-brand-emerald/10 to-emerald-500/20 border-brand-emerald/30 shadow-2xl hover:shadow-brand-emerald/20"
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-brand-emerald/5 rounded-br-full -ml-16 -mt-16 group-hover:scale-150 transition-transform" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-3xl bg-brand-emerald flex items-center justify-center mb-6 shadow-xl shadow-brand-emerald/40">
                    <Trophy className="w-8 h-8 text-brand-gold" />
                  </div>
                  <h2 className="text-4xl font-black mb-4 text-brand-emerald">دخول التحدي</h2>
                  <p className="text-slate-500 font-medium text-lg leading-relaxed">
                    تحديات عشوائية ومتعددة للمتشابهات في مختلف المواضع
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-3 text-brand-emerald font-black group-hover:gap-5 transition-all">
                  <span>اختر الصعوبة</span>
                  <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                </div>
              </motion.button>
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
              <h2 className="text-4xl font-black text-brand-emerald mb-4">أتممت وردك اليومي!</h2>
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
                        className={`relative flex items-center gap-4 px-10 py-5 rounded-3xl font-black text-lg transition-all active:scale-95 shadow-2xl ${
                          isListening
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
                    <p className="mb-10 text-emerald-100 text-xl font-medium">أتقنت جميع المتشابهات في هذا الموضع ببراعة.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      {challengeMode === 'daily' ? (
                        <button
                          onClick={() => {
                            saveScore(KEYWORD, score);
                            const todayStr = new Date().toISOString().split('T')[0];
                            localStorage.setItem('quran_daily_completed', todayStr);
                            setDailyCompleted(true);
                          }}
                          className="px-10 py-5 bg-brand-gold text-brand-emerald rounded-3xl font-black text-lg hover:bg-white transition-all shadow-xl"
                        >
                          إنهاء التحدي اليومي
                        </button>
                      ) : (
                        <button
                          onClick={handleNextChallenge}
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
                  />
                ))}
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Styled scrollbar & custom animations for the shimmers */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #fdfbf7; }
        ::-webkit-scrollbar-thumb { background: #064e3b20; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #064e3b40; }
        ::selection { background: #d4af3730; color: #064e3b; }
      `}} />
    </div>
  );
}
