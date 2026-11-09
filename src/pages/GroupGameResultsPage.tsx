import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Sparkles, RotateCcw } from 'lucide-react';
import { View } from '../types/challenges';
import WhoAmIGame from '../components/WhoAmIGame';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../services/supabase';

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

  // Calculate sorted rankings for rewards and UI
  const sortedPlayers = React.useMemo(() => {
    return (room?.participants || [])
      .map((p: any) => {
        const prog = room?.playersProgress?.[p.id] || {};
        const totalQ = room?.questionCount || 1;
        const isAbandoned = Boolean(
          prog.isAbandoned ||
          prog.status === 'abandoned' ||
          prog.isResigned ||
          prog.isDisqualified ||
          prog.hasLeft
        );
        const correctCount = isAbandoned ? 0 : (prog.correctCount || 0);
        const accuracy = isAbandoned ? 0 : (prog.accuracy ?? Math.round((correctCount / totalQ) * 100));
        const score = isAbandoned ? 0 : (prog.finalTotalScore ?? prog.score ?? 0);
        const basePoints = isAbandoned ? 0 : (prog.basePoints ?? (correctCount * 1));
        const bonusPoints = isAbandoned ? 0 : (prog.bonusPoints || 0);
        const speedBonusCount = isAbandoned ? 0 : (prog.speedBonusCount || 0);
        const completionBonus = isAbandoned ? 0 : (prog.completionBonus || 0);
        const accuracyBonus = isAbandoned ? 0 : (prog.accuracyBonus || 0);
        const isFinished = !isAbandoned && !!prog.finishTime;

        return {
          ...p,
          isAbandoned,
          finishTime: prog.finishTime,
          score,
          basePoints,
          bonusPoints,
          speedBonusCount,
          completionBonus,
          accuracyBonus,
          correctCount,
          accuracy,
          isFinished
        };
      })
      .sort((a: any, b: any) => {
        if (a.isAbandoned !== b.isAbandoned) return a.isAbandoned ? 1 : -1;
        if (b.score !== a.score) return b.score - a.score;
        return (a.finishTime || Infinity) - (b.finishTime || Infinity);
      });
  }, [room?.participants, room?.playersProgress, room?.questionCount]);

  const totalPlayers = sortedPlayers.length;
  const isEligibleForBonus = totalPlayers > 5; // الغرفة مؤهلة للبونص فقط إذا كان فيها 6 لاعبين أو أكثر

  // Smart Verification for Daily Mystery Gift & Rank-based Rewards sync
  useEffect(() => {
    if (room?.status === 'FINISHED' || room?.status === 'completed') {
      app?.recordDailyGiftRoomMatch?.();

      if (room?.id) {
        const sessionKey = `group_rewards_applied_${room.id}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, 'true');

          const myIndex = sortedPlayers.findIndex((p: any) =>
            (playerName && p.name === playerName) ||
            (playerUsername && p.username === playerUsername) ||
            (p.id && String(p.id) === String(app?.playerId))
          );

          if (myIndex !== -1 && !sortedPlayers[myIndex].isAbandoned) {
            let earnedTrophy = 0;
            let bonusPoints = 0;

            if (myIndex === 0) {
              earnedTrophy = 1; // الكأس للمركز الأول دائماً
              if (isEligibleForBonus) bonusPoints = 50;
            } else if (myIndex === 1 && isEligibleForBonus) {
              bonusPoints = 30;
            } else if (myIndex === 2 && isEligibleForBonus) {
              bonusPoints = 15;
            }

            if (earnedTrophy > 0 && typeof app?.setCups === 'function') {
              app.setCups((prev: number) => {
                const updated = (prev || 0) + earnedTrophy;
                localStorage.setItem('quran_total_cups', updated.toString());
                localStorage.setItem('quran_cups', updated.toString());
                return updated;
              });
            }
            if (bonusPoints > 0 && typeof app?.setTotalPoints === 'function') {
              app.setTotalPoints((prev: number) => {
                const updated = (prev || 0) + bonusPoints;
                localStorage.setItem('quran_points', updated.toString());
                return updated;
              });
            }
          }

          app?.syncLeaderboard?.();
        }
      }
    }
  }, [room?.status, room?.id, app, playerName, playerUsername, sortedPlayers, isEligibleForBonus]);

  // Rematch / Play Again States
  const [playAgainUsers, setPlayAgainUsers] = useState<any[]>(() => {
    return room?.playAgainUsers || room?.playersProgress?.__rematch?.playAgainUsers || [];
  });
  const [nextRoomId, setNextRoomId] = useState<string | null>(() => {
    return room?.nextRoomId || room?.playersProgress?.__rematch?.nextRoomId || null;
  });
  const [isRematchLoading, setIsRematchLoading] = useState(false);

  // Sync state if room prop updates with rematch info
  useEffect(() => {
    const list = room?.playAgainUsers || room?.playersProgress?.__rematch?.playAgainUsers;
    if (Array.isArray(list) && list.length > 0) {
      setPlayAgainUsers(list);
    }
    const nId = room?.nextRoomId || room?.playersProgress?.__rematch?.nextRoomId;
    if (nId) {
      setNextRoomId(nId);
    }
  }, [room?.playAgainUsers, room?.playersProgress, room?.nextRoomId]);

  // Realtime Listener for Rematch and Play Again updates
  useEffect(() => {
    if (!room?.id) return;

    const channelName = `room_sync_${room.id}`;
    const channel = supabase.channel(channelName);

    const handleRematchEvent = (payload: any) => {
      const data = payload?.payload || payload;
      if (data?.playAgainUsers) {
        setPlayAgainUsers(data.playAgainUsers);
      }
      if (data?.nextRoomId) {
        setNextRoomId(data.nextRoomId);
      }
    };

    channel
      .on('broadcast', { event: 'play_again_updated' }, handleRematchEvent)
      .on('broadcast', { event: 'rematch_created' }, handleRematchEvent)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload: any) => {
        const newDoc = payload?.new;
        if (newDoc) {
          const rematchInfo = newDoc.playersProgress?.__rematch || {};
          if (newDoc.playAgainUsers || rematchInfo.playAgainUsers) {
            setPlayAgainUsers(newDoc.playAgainUsers || rematchInfo.playAgainUsers);
          }
          if (newDoc.nextRoomId || rematchInfo.nextRoomId) {
            setNextRoomId(newDoc.nextRoomId || rematchInfo.nextRoomId);
          }
        }
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [room?.id]);

  const isCurrentUserInPlayAgain = playAgainUsers.some(
    (u: any) =>
      (playerName && u.name === playerName) ||
      (playerUsername && u.username === playerUsername) ||
      (app?.playerId && String(u.id) === String(app.playerId))
  );

  const handlePlayAgain = async () => {
    if (isRematchLoading || !room?.id) return;
    setIsRematchLoading(true);

    try {
      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rematch',
          roomId: room.id,
          playerId: app?.playerId || playerUsername || playerName,
          playerName: playerName || playerUsername
        })
      });
      const data = await res.json();
      if (data && data.success && data.room) {
        setRoom(data.room);
        localStorage.setItem('activeRoomId', String(data.room.id));
        setView('group_waiting');
      }
    } catch (err) {
      console.error('Error starting rematch:', err);
    } finally {
      setIsRematchLoading(false);
    }
  };

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
            leaderId={String(room?.player1Id || room?.hostUsername || room?.hostName || '')}
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
        {room?.status === 'FINISHED' || room?.status === 'completed' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass p-6 md:p-8 rounded-3xl text-center border-brand-gold/20 shadow-xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-brand-gold/5 animate-pulse" />
            <div className="relative z-10">
              <Trophy className="w-14 h-14 md:w-16 md:h-16 text-brand-gold mx-auto mb-4 drop-shadow-md" />
              <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-3">اكتمل السباق!</h2>

              <div className="max-w-lg mx-auto space-y-3 mb-6 text-right">
                {sortedPlayers.map((p: any, idx: number) => {
                  let rankBonus = 0;
                  if (!p.isAbandoned && isEligibleForBonus) {
                    if (idx === 0) rankBonus = 50;
                    else if (idx === 1) rankBonus = 30;
                    else if (idx === 2) rankBonus = 15;
                  }
                  const finalTotalPoints = p.score + rankBonus;

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={`flex flex-col gap-2 p-3.5 md:p-4 rounded-2xl border transition-all ${
                          p.isAbandoned
                            ? 'bg-red-50/50 border-red-200/60 opacity-80'
                            : idx === 0
                              ? 'bg-gradient-to-r from-amber-50 to-orange-50/60 border-amber-300 shadow-md ring-2 ring-amber-400/20'
                              : 'bg-white border-slate-200/80 shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                              p.isAbandoned
                                ? 'bg-red-100 text-red-600 font-bold text-xs'
                                : idx === 0 ? 'bg-amber-500 text-white shadow-xs' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.isAbandoned ? '✕' : idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                                {p.name} {(p.name === playerName || (p.username && p.username === playerUsername)) && '(أنت)'}
                                {idx === 0 && !p.isAbandoned && (
                                  <span className="text-amber-500" title="الفائز بالمركز الأول">🏆</span>
                                )}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                {p.isAbandoned ? (
                                  <span className="text-red-500 font-black">مستبعد (انسحب من التحدي)</span>
                                ) : (
                                  <>
                                    <span>{p.correctCount}/{room?.questionCount || 0} صحيحة</span>
                                    <span>•</span>
                                    <span className={`font-black ${p.accuracy >= 90 ? 'text-emerald-600' : p.accuracy >= 70 ? 'text-amber-600' : 'text-slate-500'}`}>
                                      دقة {p.accuracy}%
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-left flex flex-col items-end">
                            <span className={`text-sm md:text-base font-black px-2.5 py-0.5 rounded-lg border ${
                              p.isAbandoned
                                ? 'text-red-500 bg-red-100/50 border-red-200'
                                : idx === 0
                                  ? 'text-amber-800 bg-amber-100/80 border-amber-300 shadow-xs'
                                  : idx === 1
                                    ? 'text-slate-800 bg-slate-100 border-slate-300'
                                    : idx === 2
                                      ? 'text-amber-900 bg-amber-100/60 border-amber-200'
                                      : 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/20'
                            }`}>
                              {finalTotalPoints} نقطة
                            </span>
                            {!p.isAbandoned && (
                              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                                الأساسية: {p.score} {rankBonus > 0 && <span className="text-amber-600 font-black"> • بونص المركز: +{rankBonus}</span>}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bonus Badges Breakdown / Disqualification Notice */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px] font-black">
                          {p.isAbandoned ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md flex items-center gap-1 border border-red-200 shadow-xs">
                              <span>🚫 حرمان تام من الجوائز (0 كؤوس و 0 نقاط)</span>
                            </span>
                          ) : (
                            <>
                              {/* Trophy badge ONLY for 1st place */}
                              {idx === 0 && (
                                <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-amber-300 shadow-xs font-black">
                                  <Trophy className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                                  <span>+1 كأس الفوز 🏆</span>
                                </span>
                              )}

                              {/* Rank Bonus Badge for Top 3 (Only if room has > 5 players) */}
                              {isEligibleForBonus && (
                                <>
                                  {idx === 0 && (
                                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-300 shadow-xs">
                                      <span>🥇 +50 نقطة بونص المركز الأول</span>
                                    </span>
                                  )}
                                  {idx === 1 && (
                                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-300 shadow-xs">
                                      <span>🥈 +30 نقطة بونص المركز الثاني</span>
                                    </span>
                                  )}
                                  {idx === 2 && (
                                    <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200 shadow-xs">
                                      <span>🥉 +15 نقطة بونص المركز الثالث</span>
                                    </span>
                                  )}
                                </>
                              )}
                            {p.bonusPoints > 0 && (
                              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-300 shadow-xs">
                                <span>🎁 +{p.bonusPoints} بونص سور إضافية</span>
                              </span>
                            )}
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
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Anti-Farming UI Notice when players count is 5 or less */}
              {!isEligibleForBonus && (
                <div className="max-w-lg mx-auto mb-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-400/25 text-xs text-amber-800 dark:text-amber-200 font-bold flex items-center justify-center gap-2 text-center">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>التحديات التي تضم أكثر من 5 لاعبين تمنح نقاطاً إضافية للمراكز الأولى!</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                  {/* Rematch / Play Again Button */}
                  <button
                    onClick={handlePlayAgain}
                    disabled={isRematchLoading}
                    className={`w-full sm:w-auto flex-1 px-6 py-3.5 rounded-2xl font-black text-sm md:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
                      isRematchLoading
                        ? 'bg-emerald-700/60 text-white cursor-wait opacity-80'
                        : nextRoomId && !isCurrentUserInPlayAgain
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white ring-2 ring-amber-300 animate-pulse'
                          : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-105 text-white'
                    }`}
                  >
                    <RotateCcw className={`w-4 h-4 md:w-5 md:h-5 ${isRematchLoading ? 'animate-spin' : ''}`} />
                    <span>
                      {isRematchLoading
                        ? 'جاري تجهيز الغرفة...'
                        : nextRoomId && !isCurrentUserInPlayAgain
                          ? 'انضم للتحدي الجديد 🚀'
                          : isCurrentUserInPlayAgain
                            ? 'الانتقال للغرفة الجديدة 🔄'
                            : 'العب مرة أخرى 🔄'}
                    </span>
                  </button>

                  {/* Return Home Button */}
                  <button
                    onClick={() => {
                      setRoom(null);
                      localStorage.removeItem('activeRoomId');
                      setView('home');
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-sm md:text-base shadow-xs transition-all cursor-pointer"
                  >
                    العودة للرئيسية
                  </button>
                </div>

                {/* Avatars Row of Ready Players */}
                {playAgainUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 font-bold"
                  >
                    {/* Avatars Stack */}
                    <div className="flex items-center -space-x-1.5 space-x-reverse">
                      {playAgainUsers.slice(0, 5).map((u: any, i: number) => {
                        const initial = (u.name || 'ل').trim().charAt(0);
                        return (
                          <div
                            key={u.id || i}
                            className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-white text-white text-[10px] font-black flex items-center justify-center shadow-xs"
                            title={u.name}
                          >
                            {initial}
                          </div>
                        );
                      })}
                    </div>

                    <span>
                      {playAgainUsers.length === 1
                        ? `${playAgainUsers[0].name} مستعد للعب مرة أخرى!`
                        : playAgainUsers.length === 2
                          ? `${playAgainUsers[0].name} و ${playAgainUsers[1].name} مستعدان للعب!`
                          : `${playAgainUsers[0].name} و ${playAgainUsers[1].name} و ${playAgainUsers.length - 2} آخرين مستعدون للعب! 🔥`}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center p-5 md:p-6 bg-slate-50 min-h-[45vh] rounded-2xl md:rounded-3xl">
            <h2 className="text-2xl md:text-3xl font-black text-brand-emerald mb-2">أنهيت التحدي! 🎉</h2>
            <p className="text-slate-500 font-bold mb-6 text-xs md:text-sm">راقب نتائج أصدقائك مباشرة...</p>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              {/* قائمة اللاعبين الحية */}
              {(room?.participants || [])
                .map((p: any) => {
                  const prog = room?.playersProgress?.[p.id] || {};
                  const isAbandoned = Boolean(
                    prog.isAbandoned ||
                    prog.status === 'abandoned' ||
                    prog.isResigned ||
                    prog.isDisqualified ||
                    prog.hasLeft
                  );
                  return {
                    ...p,
                    isAbandoned,
                    score: isAbandoned ? 0 : (prog.score || 0),
                    hasFinished: !isAbandoned && !!prog.finishTime
                  };
                })
                .sort((a: any, b: any) => {
                  if (a.isAbandoned !== b.isAbandoned) return a.isAbandoned ? 1 : -1;
                  return b.score - a.score;
                })
                .map((player: any, index: number) => {
                  const isMe = (player.name === playerName || (player.username && player.username === playerUsername));
                  return (
                    <div key={player.id} className={`flex items-center justify-between p-3.5 border-b border-slate-50 last:border-0 ${isMe ? 'bg-emerald-50/50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-300 w-5 text-sm">{player.isAbandoned ? '✕' : index + 1}</span>
                        <span className={`font-black text-sm ${player.isAbandoned ? 'text-slate-400 line-through' : isMe ? 'text-brand-emerald' : 'text-slate-700'}`}>
                          {player.name} {isMe && '(أنت)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`font-black tabular-nums text-sm ${player.isAbandoned ? 'text-slate-400' : 'text-brand-emerald'}`}>
                          {player.score} نقطة
                        </span>
                        {/* حالة اللاعب: انسحب أم أنهى أم لا يزال في التحدي */}
                        {player.isAbandoned ? (
                          <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-md font-black">انسحب (مستبعد)</span>
                        ) : player.hasFinished ? (
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

