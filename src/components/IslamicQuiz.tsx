import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, ChevronLeft, CheckCircle2, XCircle, Award, Sparkles, Lock, Play, ChevronRight, Eye, ExternalLink, ArrowRight } from 'lucide-react';
import { quizQuestions } from '../data/quizQuestionsData';
import { islamicCategoriesData, islamicCategoriesList, CategoryQuestion } from '../data/islamicCategories';
import CertificateGenerator from './CertificateGenerator';

const getStorageKey = (category: string | null) => `quran_quiz_progress_${category || 'general'}`;

const IslamicQuiz: React.FC<{
  onBack?: () => void,
  onWin?: () => void,
  onShowCertificate?: (category: 'seerah' | 'general') => void,
  claimedCategories?: string[]
}> = ({ onBack, onWin, onShowCertificate, claimedCategories = [] }) => {
  const [gameStatus, setGameStatus] = useState<'categories' | 'difficulty' | 'levels' | 'playing' | 'result' | 'review'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevelNum, setSelectedLevelNum] = useState<1 | 2 | 3>(1);
  const [questions, setQuestions] = useState<CategoryQuestion[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [unlockedLevels, setUnlockedLevels] = useState<{ easy: number; hard: number }>({ easy: 1, hard: 1 });
  const [completedTopics, setCompletedTopics] = useState<Record<number, number[]>>({ 1: [], 2: [], 3: [] });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  // Check if selected category is one of the new Islamic categories from IslamicQuizAPI
  const isCustomCategory = !!(selectedCategory && selectedCategory in islamicCategoriesData);
  const customCatData = isCustomCategory ? islamicCategoriesData[selectedCategory!] : null;
  const isSeerah = selectedCategory === 'seerah';
  const isGeneral = selectedCategory === 'general';

  // Total topics/groups for selected category
  const totalGroups = isCustomCategory && customCatData
    ? customCatData.topics.length
    : (isSeerah ? 3 : 5);

  // Load progress when category changes
  useEffect(() => {
    if (!selectedCategory) return;

    if (isCustomCategory) {
      const key = `quran_quiz_topics_${selectedCategory}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setCompletedTopics({
            1: Array.isArray(parsed[1]) ? parsed[1] : [],
            2: Array.isArray(parsed[2]) ? parsed[2] : [],
            3: Array.isArray(parsed[3]) ? parsed[3] : [],
          });
        } catch {
          setCompletedTopics({ 1: [], 2: [], 3: [] });
        }
      } else {
        setCompletedTopics({ 1: [], 2: [], 3: [] });
      }
    } else {
      const key = getStorageKey(selectedCategory);
      const saved = localStorage.getItem(key);

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.easy && parsed.hard) {
            setUnlockedLevels(parsed);
          }
        } catch {
          setUnlockedLevels({ easy: 1, hard: 1 });
        }
      } else {
        setUnlockedLevels({ easy: 1, hard: 1 });
      }
    }
  }, [selectedCategory, isCustomCategory]);

  // Sync state to storage helper
  const syncProgress = (newProgress: { easy: number, hard: number }) => {
    if (!selectedCategory) return;
    localStorage.setItem(getStorageKey(selectedCategory), JSON.stringify(newProgress));
  };

  const syncCustomTopics = (newTopics: Record<number, number[]>) => {
    if (!selectedCategory) return;
    localStorage.setItem(`quran_quiz_topics_${selectedCategory}`, JSON.stringify(newTopics));
  };

  // Level unlock conditions for custom categories:
  // Level 1: Always unlocked
  // Level 2: Unlocked only if ALL topics in Level 1 are completed
  // Level 3: Unlocked only if ALL topics in Level 2 are completed
  const isLvl1Completed = isCustomCategory && (completedTopics[1]?.length || 0) >= totalGroups;
  const isLvl2Completed = isCustomCategory && (completedTopics[2]?.length || 0) >= totalGroups;
  const isLvl3Completed = isCustomCategory && (completedTopics[3]?.length || 0) >= totalGroups;

  const isLevelUnlocked = (lvl: 1 | 2 | 3): boolean => {
    if (lvl === 1) return true;
    if (lvl === 2) return isLvl1Completed;
    if (lvl === 3) return isLvl2Completed;
    return false;
  };

  const handleDifficultySelect = (selectedLevel: 'easy' | 'hard') => {
    setDifficulty(selectedLevel);
    setGameStatus('levels');
  };

  const handleCustomLevelSelect = (levelNum: 1 | 2 | 3) => {
    if (!isLevelUnlocked(levelNum)) return;
    setSelectedLevelNum(levelNum);
    setGameStatus('levels');
  };

  const getGroupQuestions = (groupNum: number): CategoryQuestion[] => {
    if (selectedCategory === 'general') {
      if (!difficulty) return [];
      const allFiltered = quizQuestions.filter(q => (q.category || 'general') === 'general' && q.difficulty === difficulty);
      return allFiltered.slice((groupNum - 1) * 20, groupNum * 20);
    } else if (selectedCategory === 'seerah') {
      const allFiltered = quizQuestions.filter(q => q.category === 'seerah');
      return allFiltered.slice((groupNum - 1) * 20, groupNum * 20);
    } else if (isCustomCategory && customCatData) {
      const topic = customCatData.topics[groupNum - 1];
      if (topic && topic.levels && topic.levels[selectedLevelNum]) {
        return topic.levels[selectedLevelNum];
      }
    }
    return [];
  };

  const getGroupName = (groupNum: number): string => {
    if (isCustomCategory && customCatData) {
      const topic = customCatData.topics[groupNum - 1];
      return topic ? topic.name : `الموضوع ${groupNum}`;
    }
    return `المجموعة ${groupNum}`;
  };

  // For General & Seerah linear progression
  const generalProgress = isSeerah ? unlockedLevels.easy : (difficulty ? unlockedLevels[difficulty] : 1);

  const handleStartGroup = (groupNum: number) => {
    if (!isCustomCategory) {
      if (groupNum < generalProgress) {
        handleReviewGroup(groupNum);
        return;
      }
    }

    const groupQuestions = getGroupQuestions(groupNum);
    if (groupQuestions.length === 0) return;

    setQuestions(groupQuestions);
    setSelectedGroup(groupNum);
    setGameStatus('playing');
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
  };

  const handleReviewGroup = (groupNum: number) => {
    const groupQuestions = getGroupQuestions(groupNum);
    if (groupQuestions.length === 0) return;

    setQuestions(groupQuestions);
    setSelectedGroup(groupNum);
    setGameStatus('review');
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer || isAnimating) return;

    setSelectedAnswer(option);
    const isCorrect = option === questions[currentIndex].answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setIsAnimating(true);
    setTimeout(() => {
      const isLastQuestion = currentIndex >= questions.length - 1;

      if (!isLastQuestion) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnimating(false);
      } else {
        const finalScore = isCorrect ? score + 1 : score;
        const isPassed = finalScore >= 12;

        if (isCustomCategory && isPassed) {
          const currentList = completedTopics[selectedLevelNum] || [];
          if (!currentList.includes(selectedGroup)) {
            const updatedList = [...currentList, selectedGroup];
            const updatedTopics = {
              ...completedTopics,
              [selectedLevelNum]: updatedList
            };
            setCompletedTopics(updatedTopics);
            syncCustomTopics(updatedTopics);
          }
          if (onWin) onWin();
        } else if ((isGeneral || isSeerah) && isPassed) {
          const progressKey = isSeerah ? 'easy' : (difficulty as 'easy' | 'hard');
          const maxGroups = isSeerah ? 3 : 5;
          const currentMaxUnlocked = unlockedLevels[progressKey] || 1;

          if (selectedGroup === maxGroups) {
            const updatedProgress = {
              ...unlockedLevels,
              [progressKey]: maxGroups + 1
            };
            setUnlockedLevels(updatedProgress);
            syncProgress(updatedProgress);
          } else if (selectedGroup === currentMaxUnlocked && currentMaxUnlocked < maxGroups) {
            const updatedProgress = {
              ...unlockedLevels,
              [progressKey]: currentMaxUnlocked + 1
            };
            setUnlockedLevels(updatedProgress);
            syncProgress(updatedProgress);
          }
          if (onWin) onWin();
        }

        setGameStatus('result');
        setIsAnimating(false);
      }
    }, 1500);
  };

  // 1. Categories Selection Screen
  if (gameStatus === 'categories') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 text-center" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 islamic-watermark relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-xs relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-100/50 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <Sparkles className="w-6 h-6 md:w-7 md:h-7 relative z-10" />
            </div>

            <h2 className="text-xl md:text-3xl font-black text-brand-emerald mb-1.5 tracking-tight">اختر قسم المسابقة</h2>
            <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">حدد المجال الإسلامي الذي تود التنافس واختبار معلوماتك فيه</p>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-4 mt-4">
              {islamicCategoriesList.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (cat.id === 'general') {
                      setGameStatus('difficulty');
                    } else if (cat.id === 'seerah') {
                      setGameStatus('levels');
                    } else {
                      setGameStatus('difficulty');
                    }
                  }}
                  className="group p-4 md:p-5 rounded-2xl bg-slate-50/70 border-2 border-slate-100 hover:border-emerald-500 hover:bg-white hover:shadow-lg hover:shadow-emerald-500/10 transition-all text-center flex flex-col items-center justify-between gap-2.5 shadow-sm min-h-[160px]"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center p-2.5 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-all shadow-xs">
                    <img src={cat.icon} alt={cat.title} className="w-full h-full object-contain drop-shadow-xs group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="w-full">
                    <h3 className="text-sm md:text-base font-black text-slate-800 group-hover:text-emerald-700 transition-colors mb-0.5 line-clamp-1">{cat.title}</h3>
                    <span className="text-[10px] md:text-[11px] font-bold text-emerald-600/80 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                      {cat.type === 'custom' ? `${cat.topicsCount} موضوعاً • 3 مستويات` : (cat.id === 'seerah' ? '3 مجموعات • 60 سؤالاً' : '5 مجموعات • 100 سؤال')}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {onBack && (
          <button
            onClick={onBack}
            className="mt-6 flex items-center gap-2 text-slate-400 font-bold hover:text-emerald-600 transition-colors mx-auto text-xs md:text-sm"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <span>للرجوع للقائمة الرئيسية</span>
          </button>
        )}

        {/* DEV TOOL: Only visible for Super Admin for testing */}
        {localStorage.getItem('is_super_admin') === 'true' && (
          <div className="mt-8">
            <button
              onClick={() => {
                setSelectedCategory('seerah');
                setShowCertificate(true);
              }}
              className="px-6 py-2 bg-orange-100 text-orange-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-200 hover:bg-orange-200 transition-all opacity-60 hover:opacity-100 shadow-sm"
            >
              🧪 زر المطور: تجربة الشهادة
            </button>
          </div>
        )}

        {/* Certificate Generator Modal Component for Testing */}
        <AnimatePresence>
          {showCertificate && (
            <CertificateGenerator
              category={selectedCategory || 'seerah'}
              onClose={() => setShowCertificate(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 2. Difficulty / Level Selection Screen
  if (gameStatus === 'difficulty') {
    if (isCustomCategory && customCatData) {
      const lvl1Count = completedTopics[1]?.length || 0;
      const lvl2Count = completedTopics[2]?.length || 0;
      const lvl3Count = completedTopics[3]?.length || 0;

      const levelsInfo: Array<{
        level: 1 | 2 | 3;
        title: string;
        subtitle: string;
        icon: string;
        isUnlocked: boolean;
        completedCount: number;
        lockReason?: string;
      }> = [
        {
          level: 1,
          title: 'المستوى الأول',
          subtitle: 'جميع الموضوعات مفتوحة • ميسر لترسيخ الأساسيات',
          icon: '🌱',
          isUnlocked: true,
          completedCount: lvl1Count
        },
        {
          level: 2,
          title: 'المستوى الثاني',
          subtitle: isLvl1Completed
            ? 'متوسط لاختبار الفهم وتوسيع الحصيلة العلمية'
            : `مغلق 🔒 (يتطلب إتمام جميع موضوعات المستوى الأول - متبقي ${totalGroups - lvl1Count})`,
          icon: '⚡',
          isUnlocked: isLvl1Completed,
          completedCount: lvl2Count,
          lockReason: `يجب إكمال جميع موضوعات المستوى الأول (${totalGroups} موضوعاً) لفتح هذا المستوى`
        },
        {
          level: 3,
          title: 'المستوى الثالث',
          subtitle: isLvl2Completed
            ? 'متقدم ومتعمق للمتقنين والباحثين عن التميز'
            : `مغلق 🔒 (يتطلب إتمام جميع موضوعات المستوى الثاني - متبقي ${totalGroups - lvl2Count})`,
          icon: '🔥',
          isUnlocked: isLvl2Completed,
          completedCount: lvl3Count,
          lockReason: `يجب إكمال جميع موضوعات المستوى الثاني (${totalGroups} موضوعاً) لفتح هذا المستوى`
        }
      ];

      return (
        <div className="max-w-lg mx-auto px-4 py-6 md:py-8 text-center" dir="rtl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 islamic-watermark relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 p-2 border border-emerald-100">
                <img src={customCatData.icon} alt={customCatData.title} className="w-8 h-8 object-contain" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1 tracking-tight">{customCatData.title}</h2>
              <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">
                اختر المستوى للبدء • يجب إتمام كل مستوى لفتح المستوى الذي يليه
              </p>

              <div className="flex flex-col gap-3.5">
                {levelsInfo.map((lvl) => {
                  const isDone = lvl.completedCount >= totalGroups;

                  if (!lvl.isUnlocked) {
                    return (
                      <div
                        key={lvl.level}
                        className="p-4 md:p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/70 text-right flex items-center justify-between gap-4 opacity-70 cursor-not-allowed select-none transition-all"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-3xl grayscale shrink-0">{lvl.icon}</span>
                          <div className="min-w-0 truncate">
                            <div className="flex items-center gap-2">
                              <h3 className="text-base md:text-lg font-black text-slate-500">{lvl.title}</h3>
                              <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                <Lock className="w-3 h-3" />
                                <span>مغلق</span>
                              </span>
                            </div>
                            <p className="text-xs font-bold text-amber-700/80 mt-1 truncate">{lvl.subtitle}</p>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <Lock className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                    );
                  }

                  let cardBg = "bg-emerald-50/70 hover:bg-emerald-50 border-emerald-200 hover:border-emerald-500 text-emerald-800";
                  if (lvl.level === 2) {
                    cardBg = "bg-amber-50/70 hover:bg-amber-50 border-amber-200 hover:border-amber-500 text-amber-800";
                  } else if (lvl.level === 3) {
                    cardBg = "bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-brand-gold text-white";
                  }

                  return (
                    <motion.button
                      key={lvl.level}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleCustomLevelSelect(lvl.level)}
                      className={`group p-4 md:p-5 rounded-2xl border-2 transition-all text-right flex items-center justify-between gap-4 shadow-sm ${cardBg}`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-3xl group-hover:scale-110 transition-transform shrink-0">{lvl.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-black">{lvl.title}</h3>
                            {isDone && (
                              <span className="text-[10px] font-black bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-md shrink-0">
                                مكتمل بالكامل ✓
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-bold mt-0.5 ${lvl.level === 3 ? 'text-white/70' : 'text-slate-500'}`}>{lvl.subtitle}</p>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-xl shadow-xs ${lvl.level === 3 ? 'bg-white/10 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                          {lvl.completedCount}/{totalGroups}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <button
            onClick={() => setGameStatus('categories')}
            className="mt-6 flex items-center gap-2 text-slate-400 font-bold hover:text-emerald-600 transition-colors mx-auto text-xs md:text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>العودة للأقسام</span>
          </button>
        </div>
      );
    }

    // General difficulty
    return (
      <div className="max-w-md mx-auto px-4 py-4 md:py-6 text-center" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-100 islamic-watermark relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1.5 tracking-tight">تحدي المراحل الإسلامية</h2>
            <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">اختر مستوى الصعوبة لبدء رحلتك العلمية</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <motion.button
                whileHover={{ scale: 1.02, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDifficultySelect('easy')}
                className="group p-5 md:p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-500 hover:bg-white transition-all text-center flex flex-col items-center gap-2 shadow-md"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">🌱</span>
                <div>
                  <h3 className="text-lg font-black text-emerald-700 mb-0.5">مستوى سهل</h3>
                  <p className="text-emerald-600/60 font-bold text-xs">معلومات إسلامية أساسية</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDifficultySelect('hard')}
                className="group p-5 md:p-6 rounded-2xl bg-slate-900 border-2 border-slate-800 hover:border-brand-gold hover:bg-slate-800 transition-all text-center flex flex-col items-center gap-2 shadow-md"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">🔥</span>
                <div>
                  <h3 className="text-lg font-black text-white mb-0.5">مستوى صعب</h3>
                  <p className="text-white/40 font-bold text-xs">معلومات دقيقة وتفصيلية</p>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>

        <button
          onClick={() => setGameStatus('categories')}
          className="mt-6 flex items-center gap-2 text-slate-400 font-bold hover:text-emerald-600 transition-colors mx-auto text-xs md:text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>العودة للأقسام</span>
        </button>
      </div>
    );
  }

  // 3. Topics / Levels Screen
  if (gameStatus === 'levels') {
    if (isCustomCategory && customCatData) {
      const currentCompletedList = completedTopics[selectedLevelNum] || [];
      const completedCount = currentCompletedList.length;
      const isLevelFinished = completedCount >= totalGroups;

      let levelBadge = '🌱 المستوى الأول (أساسي)';
      let levelColor = 'bg-emerald-100 text-emerald-800';
      if (selectedLevelNum === 2) {
        levelBadge = '⚡ المستوى الثاني (متوسط)';
        levelColor = 'bg-amber-100 text-amber-800';
      } else if (selectedLevelNum === 3) {
        levelBadge = '🔥 المستوى الثالث (متقدم)';
        levelColor = 'bg-slate-800 text-white';
      }

      const progressPercent = Math.round((completedCount / totalGroups) * 100);

      return (
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-6 text-center" dir="rtl">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1">{customCatData.title}</h2>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase ${levelColor}`}>
              {levelBadge}
            </span>
            <span className="text-slate-400 font-bold text-xs">
              • أتممت {completedCount} من {totalGroups} موضوعاً ({progressPercent}%)
            </span>
          </div>

          {/* Level Progress Bar */}
          <div className="max-w-md mx-auto w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Level Finished Banner */}
          {isLevelFinished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg text-center"
            >
              <h3 className="text-base font-black mb-1">🎉 مبارك! أتممت جميع موضوعات هذا المستوى بالكامل</h3>
              <p className="text-xs text-emerald-50 font-bold mb-3">
                {selectedLevelNum < 3
                  ? `تم فتح المستوى ${selectedLevelNum === 1 ? 'الثاني' : 'الثالث'} بنجاح! يمكنك الانتقال إليه الآن.`
                  : 'لقد أتممت كافة مستويات هذا القسم، بارك الله في علمك وحرصك!'}
              </p>
              {selectedLevelNum < 3 && (
                <button
                  onClick={() => handleCustomLevelSelect((selectedLevelNum + 1) as 1 | 2 | 3)}
                  className="px-5 py-2 bg-white text-emerald-700 font-black text-xs md:text-sm rounded-xl hover:bg-emerald-50 transition-all shadow-sm inline-flex items-center gap-2"
                >
                  <span>الانتقال للمستوى {selectedLevelNum === 1 ? 'الثاني ⚡' : 'الثالث 🔥'}</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              )}
            </motion.div>
          )}

          {/* Topics List: ALL open to play! */}
          <div className="grid grid-cols-1 gap-3 max-w-lg mx-auto">
            {customCatData.topics.map((topic, idx) => {
              const num = idx + 1;
              const isPassed = currentCompletedList.includes(num);

              if (isPassed) {
                return (
                  <div
                    key={num}
                    className="flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 shadow-xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base bg-emerald-100 text-emerald-700 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="text-right truncate">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm md:text-base text-slate-800 truncate">{topic.name}</h3>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                            تم الاجتياز ✓
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">20 سؤالاً • مكتملة بنجاح</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 mr-2">
                      <button
                        onClick={() => handleReviewGroup(num)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all text-xs font-black shadow-xs active:scale-95"
                        title="استعراض الأسئلة والإجابات"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الأسئلة</span>
                      </button>
                      <button
                        onClick={() => handleStartGroup(num)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all text-xs font-bold"
                        title="إعادة التدريب"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Open topic waiting to be played
              return (
                <motion.button
                  key={num}
                  whileHover={{ scale: 1.01, x: -3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleStartGroup(num)}
                  className="relative flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all text-right shadow-xs group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm bg-slate-100 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                      {num}
                    </div>
                    <div className="text-right truncate">
                      <h3 className="font-black text-sm md:text-base text-slate-800 truncate">{topic.name}</h3>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">20 سؤالاً • اضغط للبدء</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0 mr-2">
                    <span>ابدأ</span>
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button
            onClick={() => setGameStatus('difficulty')}
            className="mt-6 flex items-center gap-2 text-slate-400 font-bold hover:text-emerald-600 transition-colors mx-auto text-xs md:text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>تغيير المستوى</span>
          </button>
        </div>
      );
    }

    // General and Seerah Linear System
    const isAllCompleted = generalProgress > totalGroups;

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 md:py-6 text-center" dir="rtl">
        <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1">اختر المجموعة</h2>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase ${isSeerah ? 'bg-amber-100 text-amber-700' : (difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 text-white')}`}>
            {isSeerah ? '🕌 السيرة' : (difficulty === 'easy' ? '🌱 سهل' : '🔥 صعب')}
          </span>
          <span className="text-slate-400 font-bold text-xs">• {generalProgress} من {totalGroups} مجموعات مفتوحة</span>
        </div>

        {/* Certificate Reward Button - Only shown when all levels are unlocked */}
        <AnimatePresence>
          {isAllCompleted && !claimedCategories.includes(selectedCategory || 'general') && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-4 max-w-md mx-auto"
            >
              <button
                onClick={() => setShowCertificate(true)}
                className="group relative w-full p-0.5 rounded-2xl bg-linear-to-r from-brand-gold via-amber-400 to-brand-gold shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-[0.9rem] flex items-center justify-between gap-3 overflow-hidden">
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-black text-slate-800 leading-none mb-0.5">
                        {claimedCategories.includes(selectedCategory || 'general') ? 'عرض الوسام! 🎓' : 'مبارك الإتمام! 🎓'}
                      </h3>
                      <p className="text-[11px] text-amber-700 font-bold">
                        {claimedCategories.includes(selectedCategory || 'general') ? 'اضغط لاستعراض الوسام' : 'اضغط لاستلام الوسام'}
                      </p>
                    </div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-3 max-w-sm sm:max-w-md mx-auto">
          {Array.from({ length: totalGroups }).map((_, i) => {
            const num = i + 1;
            const isPassed = num < generalProgress;
            const isLocked = num > generalProgress;

            if (isPassed) {
              return (
                <div
                  key={num}
                  className="flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 shadow-xs transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm md:text-base text-slate-800">المجموعة {num}</h3>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                          تم الاجتياز ✓
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">20 سؤالاً • مكتملة بنجاح</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleReviewGroup(num)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all text-xs font-black shadow-xs active:scale-95 shrink-0"
                    title="استعراض الأسئلة والإجابات"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض الأسئلة</span>
                  </button>
                </div>
              );
            }

            if (isLocked) {
              return (
                <div
                  key={num}
                  className="flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/60 opacity-60 grayscale cursor-not-allowed transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base bg-slate-200 text-slate-400 shrink-0">
                      {num}
                    </div>
                    <div className="text-right">
                      <h3 className="font-black text-sm md:text-base text-slate-400">المجموعة {num}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">20 سؤالاً إسلامياً • مقفلة</p>
                    </div>
                  </div>
                  <Lock className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
              );
            }

            // Current Active Group
            return (
              <motion.button
                key={num}
                whileHover={{ scale: 1.01, x: -3 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleStartGroup(num)}
                className="relative flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 border-emerald-500 bg-white hover:bg-emerald-50/30 transition-all text-right shadow-md shadow-emerald-500/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base bg-emerald-600 text-white shadow-xs shrink-0">
                    {num}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm md:text-base text-slate-800">المجموعة {num}</h3>
                      <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md animate-pulse">
                        التحدي التالي
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">20 سؤالاً • اضغط للبدء</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                  <span>ابدأ</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
              </motion.button>
            );
          })}
        </div>

        <button
          onClick={() => {
            if (isSeerah) setGameStatus('categories');
            else setGameStatus('difficulty');
          }}
          className="mt-6 flex items-center gap-2 text-slate-400 font-bold hover:text-emerald-600 transition-colors mx-auto text-xs md:text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isSeerah ? 'العودة للأقسام' : 'تغيير مستوى الصعوبة'}</span>
        </button>

        {/* Certificate Generator Modal Component */}
        <AnimatePresence>
          {showCertificate && (
            <CertificateGenerator
              category={selectedCategory || 'general'}
              onClose={() => setShowCertificate(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 4. Result Screen
  if (gameStatus === 'result') {
    const percentage = (score / questions.length) * 100;
    const isPassed = score >= 12;

    let message = score >= 12
      ? "أحسنت! لقد اجتزت هذا الموضوع بنجاح وتم تسجيله في إنجازاتك 🔓"
      : "للأسف، لم تصل للحد الأدنى (12 من 20). أعد المحاولة لتثبيت المعلومات واجتياز الموضوع 🔒";
    if (percentage === 100) message = "ما شاء الله! إجابة مثالية وتم اجتياز الموضوع بنجاح تام 🌟";

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 text-center islamic-watermark overflow-hidden relative"
        dir="rtl"
      >
        <div className="relative z-10">
          {percentage >= 60 ? (
            <Trophy className="w-20 h-20 text-brand-gold mx-auto mb-6 drop-shadow-lg" />
          ) : (
            <Award className="w-20 h-20 text-emerald-500 mx-auto mb-6 drop-shadow-lg" />
          )}

          <h2 className="text-3xl font-black mb-2 text-slate-800">
            {percentage >= 60 ? 'اكتمل التحدي!' : 'انتهى الاختبار'}
          </h2>

          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800">
              {isCustomCategory && customCatData ? customCatData.title : (isSeerah ? 'السيرة النبوية' : 'الأسئلة العامة')}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-black">
              {getGroupName(selectedGroup)}
            </span>
          </div>

          <div className={`text-6xl font-black mb-4 tabular-nums ${percentage >= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {score}/{questions.length}
          </div>
          <p className="text-base text-slate-600 font-bold mb-8 leading-relaxed">{message}</p>

          <div className="flex flex-col gap-3 mt-4">
            {isPassed && (
              <button
                onClick={() => handleReviewGroup(selectedGroup)}
                className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-base hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
              >
                <Eye className="w-5 h-5" />
                <span>عرض أسئلة الموضوع وإجاباتها</span>
              </button>
            )}

            {!isPassed && (
              <button
                onClick={() => handleStartGroup(selectedGroup)}
                className="flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white rounded-2xl font-black text-base hover:bg-red-700 transition-all shadow-xl shadow-red-200"
              >
                <RotateCcw className="w-5 h-5" />
                <span>إعادة المحاولة الآن</span>
              </button>
            )}

            <button
              onClick={() => setGameStatus('levels')}
              className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-base hover:bg-slate-200 transition-all"
            >
              <span>العودة لقائمة الموضوعات</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // 5. Review Screen
  if (gameStatus === 'review') {
    const title = isCustomCategory && customCatData
      ? `${customCatData.title} (المستوى ${selectedLevelNum})`
      : (isSeerah ? 'السيرة النبوية' : `الأسئلة العامة (${difficulty === 'easy' ? 'المستوى السهل' : 'المستوى الصعب'})`);

    return (
      <div className="max-w-2xl mx-auto px-4 py-4 md:py-6" dir="rtl">
        {/* Header Bar */}
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-md border border-slate-100 mb-6 islamic-watermark">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  {title}
                </span>
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  تم الاجتياز ✓
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800">
                مراجعة: {getGroupName(selectedGroup)}
              </h2>
              <p className="text-xs md:text-sm text-slate-400 font-bold mt-1">
                استعراض كامل لجميع الأسئلة ({questions.length} سؤالاً) مع الإجابات المعتمدة والمصادر
              </p>
            </div>

            <button
              onClick={() => setGameStatus('levels')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-bold text-xs md:text-sm transition-all shrink-0"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
              <span>العودة للموضوعات</span>
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.4) }}
              className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-xs border border-slate-100 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-black text-xs">
                  السؤال {idx + 1} من {questions.length}
                </span>
                {q.link && (
                  <a
                    href={q.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                  >
                    <span>المصدر: الدرر السنية</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <h3 className="text-base md:text-lg font-black text-slate-800 leading-snug mb-4">
                {q.question}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const isCorrect = opt === q.answer;
                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-xl border-2 text-right font-bold text-xs sm:text-sm flex items-center justify-between transition-all ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                          : 'bg-slate-50/70 border-slate-100 text-slate-600'
                      }`}
                    >
                      <span className={isCorrect ? 'font-black text-emerald-950' : ''}>{opt}</span>
                      {isCorrect && (
                        <div className="flex items-center gap-1 shrink-0 text-emerald-600 mr-2">
                          <span className="text-[10px] font-black bg-emerald-200/60 px-1.5 py-0.5 rounded">صحيح</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 pb-8">
          <button
            onClick={() => setGameStatus('levels')}
            className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm md:text-base hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2 mx-auto"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
            <span>العودة للموضوعات</span>
          </button>
        </div>
      </div>
    );
  }

  // 6. Playing Quiz Screen
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-xl mx-auto px-3 py-2 md:py-3" dir="rtl">
      {/* Header & Progress */}
      <div className="mb-3 md:mb-4">
        <div className="flex justify-between items-center mb-2 md:mb-3">
          <button
            onClick={() => setGameStatus('levels')}
            className="flex items-center gap-1.5 text-slate-400 font-bold hover:text-emerald-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            <span className="text-xs">الموضوعات</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              {getGroupName(selectedGroup)}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">التقدم</span>
            <span className="text-base font-black text-emerald-600 tabular-nums">
              السؤال {currentIndex + 1} <span className="text-slate-300 text-xs">من {questions.length}</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">النقاط</span>
            <span className="text-base font-black text-brand-gold tabular-nums">{score}</span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl border border-slate-100 relative overflow-hidden card-hover islamic-watermark"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-slate-400 text-xs">
                {isCustomCategory && customCatData ? `${customCatData.title} • المستوى ${selectedLevelNum}` : 'تحدي المعلومات الإسلامية'}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-black text-slate-800 leading-snug mb-4">
              {currentQuestion.question}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-2.5">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedAnswer === option;
                const isCorrect = option === currentQuestion.answer;
                const isWrong = isSelected && !isCorrect;

                let btnClass = "bg-slate-50 border-slate-100 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50";
                if (selectedAnswer) {
                  if (isCorrect) btnClass = "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200";
                  else if (isWrong) btnClass = "bg-red-500 border-red-500 text-white shadow-md shadow-red-200";
                  else btnClass = "bg-slate-50 border-slate-100 text-slate-300 opacity-50";
                }

                return (
                  <button
                    key={idx}
                    disabled={!!selectedAnswer}
                    onClick={() => handleAnswerSelect(option)}
                    className={`group relative p-2.5 md:p-3 rounded-xl border-2 transition-all duration-200 text-right font-bold text-xs sm:text-sm md:text-base flex items-center justify-between ${btnClass}`}
                  >
                    <span>{option}</span>
                    {selectedAnswer && isCorrect && <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
                    {selectedAnswer && isWrong && <XCircle className="w-4 h-4 md:w-5 md:h-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 md:mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setGameStatus('levels')}
          className="flex items-center gap-1.5 text-slate-400 font-bold hover:text-emerald-600 transition-colors text-xs md:text-sm"
        >
          <RotateCcw className="w-4 h-4 rotate-180" />
          <span>تغيير الموضوع</span>
        </button>

        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs"
          >
            <span>للرجوع للقائمة الرئيسية</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default IslamicQuiz;
