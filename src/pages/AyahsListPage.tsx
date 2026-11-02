import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, CheckCircle, ListFilter, Trophy } from 'lucide-react';
import { View, Difficulty } from '../types/challenges';

export interface AyahsListPageProps {
  setView: (view: View) => void;
  activeListTab: 'available' | 'completed';
  setActiveListTab: (tab: 'available' | 'completed') => void;
  challenges: any[];
  completedChallengeIds: Set<any>;
  setCurrentChallengeIndex: (index: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setIncompleteChallenge: (info: any) => void;
}

export const AyahsListPage: React.FC<AyahsListPageProps> = ({
  setView,
  activeListTab,
  setActiveListTab,
  challenges,
  completedChallengeIds,
  setCurrentChallengeIndex,
  setDifficulty,
  setIncompleteChallenge
}) => {
  return (
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
  );
};

export default AyahsListPage;

