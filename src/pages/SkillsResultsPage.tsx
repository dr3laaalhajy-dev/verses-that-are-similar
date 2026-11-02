import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, History, XCircle, CheckCircle } from 'lucide-react';
import { View } from '../types/challenges';
import { normalizeArabicText } from '../utils/arabic';

export interface SkillsResultsPageProps {
  sessionCorrect: number;
  sessionWrong: number;
  skillsType: any;
  totalPoints: number;
  cups: number;
  sessionMistakes: any[];
  showMistakes: boolean;
  setShowMistakes: (show: boolean) => void;
  setView: (view: View) => void;
}

export const SkillsResultsPage: React.FC<SkillsResultsPageProps> = ({
  sessionCorrect,
  sessionWrong,
  skillsType,
  totalPoints,
  cups,
  sessionMistakes,
  showMistakes,
  setShowMistakes,
  setView
}) => {
  return (
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
              <div className="space-y-4 md:space-y-6 max-h-[60vh] md:max-h-[600px] overflow-y-auto px-1 sm:px-2">
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
  );
};

export default SkillsResultsPage;
