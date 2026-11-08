import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, History, XCircle, CheckCircle, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { View } from '../types/challenges';
import { normalizeArabicText, normalizeSurahName } from '../utils/arabic';
import { ChallengeCertificate } from '../components/ChallengeCertificate';

export interface SkillsResultsPageProps {
  sessionCorrect: number;
  sessionScore?: number;
  sessionWrong: number;
  skillsType: any;
  totalPoints: number;
  cups: number;
  sessionMistakes?: any[];
  showMistakes?: boolean;
  setShowMistakes?: (show: boolean) => void;
  setView: (view: View) => void;
}

export const SkillsResultsPage: React.FC<SkillsResultsPageProps> = ({
  sessionCorrect = 0,
  sessionScore,
  sessionWrong = 0,
  skillsType,
  totalPoints = 0,
  cups = 0,
  sessionMistakes = [],
  showMistakes: externalShowMistakes,
  setShowMistakes: externalSetShowMistakes,
  setView
}) => {
  // 1. Resilient internal state for details toggle
  const [showDetails, setShowDetails] = React.useState<boolean>(Boolean(externalShowMistakes));
  const [showCertificateModal, setShowCertificateModal] = React.useState<boolean>(false);

  // Sync with prop when external state changes
  React.useEffect(() => {
    if (externalShowMistakes !== undefined) {
      setShowDetails(Boolean(externalShowMistakes));
    }
  }, [externalShowMistakes]);

  // Body scroll lock when certificate modal is open
  React.useEffect(() => {
    if (showCertificateModal) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [showCertificateModal]);

  // Active state: prioritize prop if passed, otherwise use local state
  const isDetailsOpen = externalShowMistakes !== undefined ? externalShowMistakes : showDetails;

  const handleToggleDetails = () => {
    const nextState = !isDetailsOpen;
    setShowDetails(nextState);
    if (typeof externalSetShowMistakes === 'function') {
      try {
        externalSetShowMistakes(nextState);
      } catch (err) {
        console.warn('[SkillsResultsPage] Error in externalSetShowMistakes:', err);
      }
    }
  };

  const mistakesList = Array.isArray(sessionMistakes) ? sessionMistakes : [];
  const hasAnswers = mistakesList.length > 0 || (sessionCorrect + sessionWrong > 0);

  // Unified scoring: accurately reflect points from sessionScore or pointsEarned per question
  const earnedPoints = typeof sessionScore === 'number' && sessionScore > 0
    ? sessionScore
    : (mistakesList.length > 0
        ? mistakesList.reduce((acc, m) => acc + (m.pointsEarned ?? (m.isFullyCorrect ? 1 : 0)), 0)
        : sessionCorrect * 1);

  // Real-time total balance: ensures total balance incorporates newly earned points and matches the database
  const [liveTotalPoints, setLiveTotalPoints] = React.useState<number>(() => {
    return Math.max(Number(totalPoints || 0), earnedPoints);
  });

  React.useEffect(() => {
    setLiveTotalPoints(prev => Math.max(prev, Number(totalPoints || 0), earnedPoints));
  }, [totalPoints, earnedPoints]);

  React.useEffect(() => {
    // Live query to fetch actual points from Supabase database
    const pName = localStorage.getItem('quran_player_name');
    const pUsername = localStorage.getItem('quran_player_username');
    const pId = localStorage.getItem('quran_player_id');
    const params = new URLSearchParams();
    if (pId) params.append('playerId', pId);
    if (pUsername) params.append('username', pUsername);
    if (pName) params.append('name', pName);

    if (pId || pUsername || pName) {
      fetch(`/api/player-score?${params.toString()}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(player => {
          if (player && typeof player.points === 'number') {
            const dbPoints = player.points;
            setLiveTotalPoints(prev => Math.max(prev, dbPoints, earnedPoints));
            try {
              localStorage.setItem('quran_total_points', String(dbPoints));
            } catch (_) {}
          }
        })
        .catch(err => console.warn('[SkillsResultsPage] Error syncing live balance from DB:', err));
    }
  }, [earnedPoints]);

  const displayTotalPoints = Math.max(liveTotalPoints, earnedPoints);

  // شرط استحقاق الشهادة للإنجازات الكبرى فقط (Milestone Condition)
  const totalQuestions = sessionCorrect + sessionWrong;
  const isMajorMilestone = totalQuestions >= 100 || (totalQuestions >= 20 && sessionWrong === 0);
  const milestoneChallengeName = totalQuestions >= 100
    ? `إتمام 100 سؤال في ${skillsType === 'surah' ? 'تحدي تحديد اسم السورة' : 'تحدي إكمال الآية الكريمة'}`
    : `ختم جولة متقنة بدرجة امتياز في ${skillsType === 'surah' ? 'تحدي تحديد اسم السورة' : 'تحدي إكمال الآية الكريمة'}`;

  return (
    <motion.div
      key="skills_results"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto py-12 md:py-20 px-4 sm:px-6 relative z-10"
    >
      <div className="glass p-6 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] text-center border-white/50 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-brand-emerald via-brand-gold to-brand-emerald" />

        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-brand-gold" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2">اكتمل التحدي!</h2>
        <h2 className="text-2xl sm:text-3xl font-black text-brand-gold mb-2">بارك الله فيك</h2>

        <p className="text-slate-500 font-bold mb-8 sm:mb-10 text-sm sm:text-base">إليك ملخص أدائك في هذا التحدي</p>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="bg-brand-emerald/5 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-brand-emerald/10">
            <span className="text-3xl sm:text-4xl font-black text-brand-emerald block mb-1">{sessionCorrect}</span>
            <span className="text-slate-500 font-bold text-xs sm:text-sm">{skillsType === 'surah' ? 'سورة صحيحة' : 'إجابة صحيحة'}</span>
          </div>
          <div className="bg-red-50 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-red-100">
            <span className="text-3xl sm:text-4xl font-black text-red-600 block mb-1">{sessionWrong}</span>
            <span className="text-slate-500 font-bold text-xs sm:text-sm">{skillsType === 'surah' ? 'سورة خاطئة' : 'إجابة خاطئة'}</span>
          </div>
        </div>

        {/* Points and cups summary badge */}
        <div className="mb-8 sm:mb-10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-linear-to-r from-brand-emerald/10 via-amber-500/10 to-brand-emerald/10 border border-brand-gold/30 flex items-center justify-around gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-gold shrink-0" />
            <span className="text-slate-600 font-bold text-xs sm:text-sm">النقاط المكتسبة:</span>
            <span className="text-brand-emerald font-black text-lg sm:text-xl">
              +{earnedPoints} {earnedPoints === 1 ? 'نقطة' : earnedPoints === 2 ? 'نقطتان' : (earnedPoints >= 3 && earnedPoints <= 10) ? 'نقاط' : 'نقطة'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
            <span className="text-slate-600 font-bold text-xs sm:text-sm">إجمالي رصيدك:</span>
            <span className="text-slate-800 font-black text-sm sm:text-base">{displayTotalPoints} نقطة • {cups} كأس</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4 relative z-20">
          {/* إظهار زر استلام الشهادة فقط عند تحقق شرط الإنجاز الكبير */}
          {isMajorMilestone && (
            <motion.button
              type="button"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setShowCertificateModal(true)}
              className="w-full py-4 sm:py-5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg shadow-xl shadow-amber-500/25 hover:from-amber-600 hover:to-amber-800 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Award className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>مبارك! استلم شهادة الإنجاز الرسمي 📜</span>
            </motion.button>
          )}

          {hasAnswers && (
            <button
              type="button"
              onClick={handleToggleDetails}
              className="w-full py-4 sm:py-5 bg-slate-800 text-white rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg shadow-xl hover:bg-slate-900 active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <History className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>{isDetailsOpen ? 'إخفاء التفاصيل' : 'عرض تفاصيل الإجابات'}</span>
              {isDetailsOpen ? (
                <ChevronUp className="w-5 h-5 opacity-70" />
              ) : (
                <ChevronDown className="w-5 h-5 opacity-70" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setView('home')}
            className="w-full py-4 sm:py-5 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            العودة للرئيسية
          </button>
        </div>

        <AnimatePresence>
          {isDetailsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-slate-200/80 text-right overflow-hidden relative z-20"
            >
              <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-4 sm:mb-6 flex items-center justify-between">
                <span>مراجعة الإجابات:</span>
                <span className="text-xs font-bold text-slate-400 font-mono">
                  {mistakesList.length} {mistakesList.length === 1 ? 'سؤال' : 'أسئلة'}
                </span>
              </h3>

              {mistakesList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-brand-emerald/5 border border-brand-emerald/10 text-center">
                  <CheckCircle className="w-8 h-8 text-brand-emerald mx-auto mb-2" />
                  <p className="text-sm font-black text-brand-emerald">
                    ما شاء الله! جميع إجاباتك كانت صحيحة، لا توجد أخطاء مسجلة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6 max-h-[60vh] md:max-h-[600px] overflow-y-auto px-1 sm:px-2">
                  {mistakesList.map((m: any, i: number) => {
                    if (!m) return null;
                    const isFullyCorrect = Boolean(m.isFullyCorrect);
                    const keywordText = m.keyword || m.text || m.challenge?.keyword || m.challenge?.verseText || m.challenge?.text || "";
                    const correctList = Array.isArray(m.correctSurahsList) ? m.correctSurahsList : [];
                    const userInputsList = Array.isArray(m.userInputs) ? m.userInputs : [];

                    return (
                      <div
                        key={i}
                        className={`p-3.5 md:p-6 rounded-xl md:rounded-2xl border transition-all text-right ${
                          isFullyCorrect
                            ? 'bg-emerald-50/40 border-emerald-200/70 shadow-xs'
                            : 'bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2 md:mb-4 gap-2 md:gap-4">
                          <p className="quran-text text-sm md:text-xl text-slate-800 leading-loose flex-1 text-right font-medium">
                            {keywordText}
                          </p>
                          <div
                            className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                              isFullyCorrect
                                ? 'bg-brand-emerald text-white'
                                : 'bg-brand-gold/20 text-brand-emerald border border-brand-gold/40'
                            }`}
                          >
                            <span>{m.pointsEarned ?? (isFullyCorrect ? 1 : 0)}</span>
                            <span>/</span>
                            <span>{m.totalPossible || 1}</span>
                          </div>
                        </div>

                        {m.type === 'AUDIO_MISS' ? (
                          <div className="mt-4 p-4 rounded-xl bg-red-50/50 border border-red-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black text-slate-500">نتيجة التلاوة:</span>
                              <span className="text-lg font-black text-red-600 tabular-nums">
                                {m.matchedCount || 0} / {m.totalPossible || 1}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-red-500">
                              تم التعرف على {m.matchedCount || 0} آيات، وفاتك {m.missedCount || 0} آيات بسبب ضيق الوقت.
                            </p>
                          </div>
                        ) : m.type === 'SURAH' || correctList.length > 0 ? (
                          <div className="flex flex-col gap-2.5 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-200/60">
                            {/* ما أدخله المستخدم */}
                            <div
                              className={`flex items-start gap-2 p-2.5 rounded-xl border ${
                                isFullyCorrect
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                  : 'bg-red-50/70 border-red-100 text-red-700'
                              }`}
                            >
                              {isFullyCorrect ? (
                                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                              )}
                              <div className="flex-1 text-right">
                                <span className="text-slate-500 font-semibold block text-[11px] mb-1">
                                  ما اخترته/أدخلته أنت:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {userInputsList.length > 0 && userInputsList.some((u: any) => typeof u === 'string' ? u.trim() : Boolean(u)) ? (
                                    userInputsList.map((input: any, uIdx: number) => {
                                      const inputStr = typeof input === 'string' ? input.trim() : String(input || '');
                                      const isMatch = correctList.some((c: any) => {
                                        const cStr = typeof c === 'string' ? c.trim() : String(c || '');
                                        return normalizeSurahName(cStr) === normalizeSurahName(inputStr);
                                      });
                                      return (
                                        <span
                                          key={uIdx}
                                          className={`px-2.5 py-0.5 rounded-md text-xs font-black border ${
                                            isMatch
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : 'bg-red-100 text-red-800 border-red-300'
                                          }`}
                                        >
                                          {inputStr || "(فارغ)"} {isMatch ? '✓' : '✗'}
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
                            <div className="flex items-start gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 text-right">
                              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              <div className="text-right">
                                <span className="text-slate-500 font-semibold block text-[11px] mb-1">
                                  الإجابات الصحيحة (أسماء السور):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {correctList.map((s: any, sIdx: number) => {
                                    const sStr = typeof s === 'string' ? s : String(s || '');
                                    return (
                                      <span
                                        key={sIdx}
                                        className="px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      >
                                        {sStr}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5 text-xs sm:text-sm mt-3 pt-3 border-t border-slate-200/60 text-right">
                            {/* إجابة المستخدم */}
                            <div
                              className={`flex items-start gap-2 p-2.5 rounded-xl border text-right ${
                                isFullyCorrect
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                  : 'bg-red-50/70 border-red-100 text-red-700'
                              }`}
                            >
                              {isFullyCorrect ? (
                                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                              )}
                              <div className="text-right">
                                <span className="text-slate-500 font-semibold block text-[11px] mb-0.5">
                                  إجابتك التي اخترتها:
                                </span>
                                <span className={`quran-text text-sm sm:text-base font-black ${isFullyCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
                                  {m.userAnswer || "لم يتم اختيار إجابة"}
                                </span>
                              </div>
                            </div>

                            {/* الإجابة الصحيحة لتكملة الآية */}
                            <div className="flex items-start gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 text-emerald-800 text-right">
                              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              <div className="text-right">
                                <span className="text-slate-500 font-semibold block text-[11px] mb-0.5">
                                  الإجابة الصحيحة (تكملة الآية):
                                </span>
                                <span className="quran-text text-sm sm:text-base font-black text-emerald-800">
                                  {m.correctAnswer || m.correctText || m.challenge?.correctText || m.challenge?.options?.find((o: any) => o?.isCorrect)?.text || "غير متوفر"}
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
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* نافذة شهادة الإنجاز المنبثقة */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCertificateModal && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
              onClick={() => setShowCertificateModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto flex flex-col items-center"
              >
                <ChallengeCertificate
                  playerName={localStorage.getItem('quran_user_triple_name') || localStorage.getItem('quran_player_name') || 'فارس القرآن'}
                  challengeName={milestoneChallengeName}
                  score={`${sessionCorrect} من ${sessionCorrect + sessionWrong}`}
                  surahOrJuz="ضبط المتشابهات القرآنية"
                  onClose={() => setShowCertificateModal(false)}
                  showControls={true}
                  allowNameEdit={true}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
};

export default SkillsResultsPage;
