import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';
import { View } from '../types/challenges';
import WhoAmIGame from '../components/WhoAmIGame';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { useApp } from '../contexts/AppContext';

export interface GroupGameResultsPageProps {
  room: any;
  playerUsername: string | null;
  playerName: string | null;
  setRoom: (room: any) => void;
  setView: (view: View) => void;
  onCancelRoom?: () => void;
  onWithdraw?: () => void;
}

export const GroupGameResultsPage: React.FC<GroupGameResultsPageProps> = ({
  room,
  playerUsername,
  playerName,
  setRoom,
  setView,
  onCancelRoom,
  onWithdraw
}) => {
  const app = useApp();

  // Smart Verification for Daily Mystery Gift: Record completed match when game finishes
  useEffect(() => {
    if (room?.status === 'FINISHED') {
      app?.recordDailyGiftRoomMatch?.();
    }
  }, [room?.status, app]);
  if (room?.gameMode === 'WHO_AM_I') {
    return (
      <motion.div
        key="group_who_am_i"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="w-full max-w-2xl mx-auto py-4 sm:py-6 px-3 sm:px-4 min-h-[60vh]"
      >
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-100 shadow-xl p-4 sm:p-6 text-slate-800">
          <WhoAmIGame
            roomId={room.id}
            currentUser={{ id: String(playerUsername || playerName), name: playerName || 'لاعب' }}
            isLeader={Boolean(
              (room?.player1Id && (room.player1Id === playerUsername || room.player1Id === playerName || (room.player1 && (room.player1.name === playerName || room.player1.username === playerUsername)))) ||
              (room?.hostName && playerName && room.hostName === playerName) ||
              (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase())
            )}
            players={(room.participants || []).map((p: any) => ({
              id: String(p.username || p.name || p.id),
              name: p.name || p.username || 'لاعب'
            }))}
            category={room.categoryFilter || room.category || 'الصحابة'}
            categoriesConfig={Array.isArray(room.surahFilters) && room.surahFilters.length > 0 && room.surahFilters[0]?.category ? room.surahFilters : (room.categories_config || undefined)}
            totalRounds={room.questionCount || 10}
            onExit={() => {
              setRoom(null);
              setView('home');
            }}
            onCancelRoom={onCancelRoom}
            onWithdraw={onWithdraw}
          />
        </div>
      </motion.div>
    );
  }

  return (
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
                    const basePoints = prog.basePoints ?? (correctCount * 1);
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

      {/* Live Reactions in Group Game Results / Waiting Screen */}
      {room && (
        <LiveReactionsOverlay
          roomId={room.id}
          playerId={playerUsername || playerName || undefined}
          playerName={playerName || undefined}
          incomingReaction={room.lastReaction || room.playersProgress?.__lastReaction}
        />
      )}
    </motion.div>
  );
};

export default GroupGameResultsPage;

