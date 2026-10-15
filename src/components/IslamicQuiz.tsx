import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, ChevronLeft, CheckCircle2, XCircle, Loader2, Award, Sparkles, Lock, Play, ChevronRight, Flame } from 'lucide-react';
import { quizQuestions, Question } from '../data/quizQuestionsData';
import CertificateGenerator from './CertificateGenerator';


const getStorageKey = (category: string | null) => `quran_quiz_progress_${category || 'general'}`;

const IslamicQuiz: React.FC<{
  onBack?: () => void,
  onWin?: () => void,
  onShowCertificate?: (category: 'seerah' | 'general' | 'quran') => void,
  claimedCategories?: string[]
}> = ({ onBack, onWin, onShowCertificate, claimedCategories = [] }) => {
  const [gameStatus, setGameStatus] = useState<'categories' | 'difficulty' | 'levels' | 'playing' | 'result'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [unlockedLevels, setUnlockedLevels] = useState({ easy: 1, hard: 1 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  // Load progress when category changes
  useEffect(() => {
    if (!selectedCategory) return;

    const key = getStorageKey(selectedCategory);
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.easy && parsed.hard) {
          setUnlockedLevels(parsed);
        }
      } catch (e) {
        console.error('Error loading quiz progress');
        setUnlockedLevels({ easy: 1, hard: 1 });
      }
    } else {
      setUnlockedLevels({ easy: 1, hard: 1 });
    }
  }, [selectedCategory]);

  // Sync state to storage helper
  const syncProgress = (newProgress: { easy: number, hard: number }) => {
    if (!selectedCategory) return;
    localStorage.setItem(getStorageKey(selectedCategory), JSON.stringify(newProgress));
  };

  const handleDifficultySelect = (selectedLevel: 'easy' | 'hard') => {
    setDifficulty(selectedLevel);
    setGameStatus('levels');
  };

  const handleStartCategoryQuiz = (category: string) => {
    setDifficulty(null);
    const catQuestions = quizQuestions.filter(q => q.category === category);
    setQuestions(catQuestions);
    setGameStatus('playing');
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
  };

  const handleStartGroup = (groupNum: number) => {
    let groupQuestions: Question[] = [];

    if (selectedCategory === 'general') {
      if (!difficulty) return;
      const allFiltered = quizQuestions.filter(q => (q.category || 'general') === 'general' && q.difficulty === difficulty);
      groupQuestions = allFiltered.slice((groupNum - 1) * 20, groupNum * 20);
    } else if (selectedCategory === 'seerah') {
      const allFiltered = quizQuestions.filter(q => q.category === 'seerah');
      groupQuestions = allFiltered.slice((groupNum - 1) * 20, groupNum * 20);
    }

    if (groupQuestions.length === 0) return;

    setQuestions(groupQuestions);
    setSelectedGroup(groupNum);
    setGameStatus('playing');
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
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
        // Final score calculation for immediate unlock logic
        const finalScore = isCorrect ? score + 1 : score;

        const isGeneral = selectedCategory === 'general';
        const isSeerah = selectedCategory === 'seerah';

        if ((isGeneral || isSeerah) && finalScore >= 12) {
          const progressKey = (isSeerah) ? 'easy' : (difficulty as 'easy' | 'hard');
          const maxGroups = isSeerah ? 3 : 5;
          const currentMaxUnlocked = unlockedLevels[progressKey] || 1;

          // If they just won the last group, set progress to maxGroups + 1
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

          // Trigger streak update on win
          if (onWin) onWin();
        }
        setGameStatus('result');
        setIsAnimating(false);
      }
    }, 1500);
  };

  const restartQuiz = () => {
    if (selectedCategory === 'general' || selectedCategory === 'seerah') {
      setGameStatus('levels');
    } else if (selectedCategory) {
      handleStartCategoryQuiz(selectedCategory);
    }
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
  };

  if (gameStatus === 'categories') {
    const categories = [
      { id: 'general', title: 'أسئلة عامة', icon: '/icons/general.png' },
      { id: 'seerah', title: 'السيرة النبوية', icon: '/icons/seerah.png' },
    ];

    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center" dir="rtl">
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
            <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">حدد الموضوع الذي تود البدء به</p>

            <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
              {categories.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.02, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (cat.id === 'general') {
                      setGameStatus('difficulty');
                    } else if (cat.id === 'seerah') {
                      setGameStatus('levels');
                    } else {
                      handleStartCategoryQuiz(cat.id);
                    }
                  }}
                  className="group p-4 md:p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 hover:border-emerald-500 hover:bg-white transition-all text-center flex flex-col items-center gap-2.5 shadow-md w-36 sm:w-44"
                >
                  <img src={cat.icon} alt={cat.title} className="w-12 h-12 object-contain mb-1 drop-shadow-xs" />
                  <div>
                    <h3 className="text-base md:text-lg font-black text-slate-800">{cat.title}</h3>
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

  if (gameStatus === 'difficulty') {
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


  if (gameStatus === 'levels') {
    const isSeerah = selectedCategory === 'seerah';
    const isGeneral = selectedCategory === 'general';
    const progress = (isSeerah) ? unlockedLevels.easy : (difficulty ? unlockedLevels[difficulty] : 1);
    const totalGroups = isSeerah ? 3 : 5;
    const isAllCompleted = progress > totalGroups;

    return (
      <div className="max-w-md mx-auto px-4 py-4 md:py-6 text-center" dir="rtl">
        <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-1">اختر المجموعة</h2>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase ${isSeerah ? 'bg-amber-100 text-amber-700' : (difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 text-white')}`}>
            {isSeerah ? '🕌 السيرة' : (difficulty === 'easy' ? '🌱 سهل' : '🔥 صعب')}
          </span>
          <span className="text-slate-400 font-bold text-xs">• {progress} من {totalGroups} مجموعات مفتوحة</span>
        </div>

        {/* Certificate Reward Button - Only shown when all levels are unlocked */}
        <AnimatePresence>
          {isAllCompleted && !claimedCategories.includes(selectedCategory || 'general') && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-4"
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

        <div className="grid grid-cols-1 gap-2.5 max-w-sm mx-auto">
          {Array.from({ length: totalGroups }).map((_, i) => {
            const num = i + 1;
            const isLocked = num > progress;
            return (
              <motion.button
                key={num}
                disabled={isLocked}
                whileHover={!isLocked ? { scale: 1.01, x: -3 } : {}}
                whileTap={!isLocked ? { scale: 0.99 } : {}}
                onClick={() => handleStartGroup(num)}
                className={`relative flex items-center justify-between p-3.5 md:p-4 rounded-2xl border-2 transition-all ${isLocked
                  ? 'bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed'
                  : 'bg-white border-slate-100 hover:border-emerald-500 hover:shadow-md shadow-xs'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base ${isLocked ? 'bg-slate-200 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    {num}
                  </div>
                  <div className="text-right">
                    <h3 className={`font-black text-sm md:text-base ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>المجموعة {num}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">20 سؤالاً إسلامياً</p>
                  </div>
                </div>
                {isLocked ? (
                  <Lock className="w-4 h-4 text-slate-300" />
                ) : (
                  <Play className="w-4 h-4 text-emerald-500 fill-emerald-500" />
                )}
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

  if (gameStatus === 'result') {
    const isGeneral = selectedCategory === 'general';
    const isSeerah = selectedCategory === 'seerah';
    const percentage = (score / questions.length) * 100;
    const isPassed = (isGeneral || isSeerah) ? score >= 12 : true;
    const maxGroupsForCurrent = isSeerah ? 3 : 5;
    const canUnlockNext = (isGeneral || isSeerah) && selectedGroup < maxGroupsForCurrent && score >= 12;

    let message = "";
    if (isGeneral || isSeerah) {
      message = score >= 12
        ? "أحسنت! لقد اجتزت هذه المرحلة بنجاح وتم فتح المجموعة التالية 🔓"
        : "للأسف، لقد أخطأت في أكثر من 8 أسئلة. يجب عليك إعادة الاختبار والحصول على 12 درجة على الأقل لفتح المرحلة التالية 🔒";
      if (percentage === 100) message = "ما شاء الله! إجابة مثالية وتم فتح المرحلة التالية 🔓";
    } else {
      message = percentage >= 80 ? "أداء ممتاز! استمر في طلب العلم" : "أحسنت، واصل التعلم والمراجعة لتثبيت المعلومات";
      if (percentage === 100) message = "ما شاء الله! إجابة مثالية، بارك الله في علمك";
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 text-center islamic-watermark overflow-hidden relative"
      >
        <div className="relative z-10">
          {percentage >= 60 ? (
            <Trophy className="w-20 h-20 text-brand-gold mx-auto mb-6 drop-shadow-lg" />
          ) : (
            <Award className="w-20 h-20 text-emerald-500 mx-auto mb-6 drop-shadow-lg" />
          )}

          <h2 className={`text-3xl font-black mb-2 text-slate-800`}>
            {percentage >= 60 ? 'اكتمل التحدي!' : 'انتهى الاختبار'}
          </h2>

          <div className="flex gap-2 justify-center mb-6">
            <span className={`px-3 py-1 rounded-lg text-xs font-black ${isSeerah ? 'bg-amber-100 text-amber-700' : (isGeneral ? (difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 text-white') : 'bg-amber-100 text-amber-700')}`}>
              {isSeerah ? 'قسم السيرة' : (isGeneral ? (difficulty === 'easy' ? 'المستوى السهل' : 'المستوى الصعب') : 'اختبار القسم')}
            </span>
            {(isGeneral || isSeerah) && <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-black">المجموعة {selectedGroup}</span>}
          </div>

          <div className={`text-6xl font-black mb-4 tabular-nums ${percentage >= 60 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {score}/{questions.length}
          </div>
          <p className="text-lg text-slate-600 font-bold mb-8 leading-relaxed">{message}</p>

          {isPassed && selectedGroup === maxGroupsForCurrent && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 p-8 rounded-[3rem] bg-linear-to-br from-emerald-500 to-teal-700 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="relative z-10">
                < Award className="w-12 h-12 mx-auto mb-4 text-emerald-200" />
                <h3 className="text-2xl font-black mb-2">مبارك! أتممت التحدي كاملاً</h3>
                <p className="text-emerald-50 font-bold mb-6 text-sm">لقد حصلت على وسام {isSeerah ? 'السيرة النبوية' : 'المعلومات العامة'} المتميز!</p>

                <button
                  onClick={() => {
                    if (onShowCertificate) onShowCertificate(selectedCategory as any);
                  }}
                  className="w-full py-4 bg-white text-emerald-700 rounded-2xl font-black text-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Award className="w-5 h-5" />
                  <span>{claimedCategories.includes(selectedCategory || 'general') ? 'عرض وسام التميز' : 'إصدار شهادة الإنجاز'}</span>
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col gap-3 mt-8">
            {isPassed && canUnlockNext && (
              <button
                onClick={() => handleStartGroup(selectedGroup + 1)}
                className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
              >
                <span>المجموعة التالية</span>
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            )}

            {(isGeneral || isSeerah) && !isPassed && (
              <button
                onClick={() => handleStartGroup(selectedGroup)}
                className="flex items-center justify-center gap-2 py-4 bg-red-600 text-white rounded-2xl font-black text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-200"
              >
                <RotateCcw className="w-5 h-5" />
                <span>إعادة المحاولة الآن</span>
              </button>
            )}

            <button
              onClick={() => restartQuiz()}
              className="flex items-center justify-center gap-2 py-4 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              <span>إعادة الاختبار</span>
            </button>

            <button
              onClick={() => {
                if (isGeneral || isSeerah) setGameStatus('levels');
                else setGameStatus('categories');
              }}
              className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
            >
              <span>{(isGeneral || isSeerah) ? 'العودة للمجموعات' : 'العودة للأقسام'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-xl mx-auto px-3 py-2 md:py-3" dir="rtl">
      {/* Header & Progress */}
      <div className="mb-3 md:mb-4">
        <div className="flex justify-between items-center mb-2 md:mb-3">
          <button
            onClick={() => {
              if (selectedCategory === 'general' || selectedCategory === 'seerah') setGameStatus('levels');
              else setGameStatus('categories');
            }}
            className="flex items-center gap-1.5 text-slate-400 font-bold hover:text-emerald-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            <span className="text-xs">{(selectedCategory === 'general' || selectedCategory === 'seerah') ? 'المجموعات' : 'الأقسام'}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 text-white'}`}>
              المجموعة {selectedGroup}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">التقدم</span>
            <span className="text-base font-black text-emerald-600 tabular-nums">السؤال {currentIndex + 1} <span className="text-slate-300 text-xs">من {questions.length}</span></span>
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
              <span className="font-bold text-slate-400 text-xs">تحدي المعلومات الإسلامية</span>
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
          onClick={() => {
            if (selectedCategory === 'general' || selectedCategory === 'seerah') setGameStatus('levels');
            else setGameStatus('categories');
          }}
          className="flex items-center gap-1.5 text-slate-400 font-bold hover:text-emerald-600 transition-colors text-xs md:text-sm"
        >
          <RotateCcw className="w-4 h-4 rotate-180" />
          <span>{(selectedCategory === 'general' || selectedCategory === 'seerah') ? 'تغيير المجموعة' : 'تغيير القسم'}</span>
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

      {/* Start Challenge Modal removed for direct transition */}
    </div>
  );
};

export default IslamicQuiz;
