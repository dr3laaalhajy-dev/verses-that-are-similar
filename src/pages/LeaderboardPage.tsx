import React from "react";
import { motion } from "framer-motion";
import { Trophy, ShoppingBag, RotateCcw, Users, Sparkles } from "lucide-react";

export interface LeaderboardPageProps {
  setShowCosmeticStore: (show: boolean) => void;
  syncLeaderboard: () => void;
  isSyncing: boolean;
  totalUsersCount: number;
  leaderboard: any[];
  playerName: string | null;
  userLeaderboardRank: number | null;
  streak: number;
  userAchievement: any;
  achievementStyles: any;
  equippedNameColor?: string;
  equippedTitle?: string;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  setShowCosmeticStore,
  syncLeaderboard,
  isSyncing,
  totalUsersCount,
  leaderboard,
  playerName,
  userLeaderboardRank,
  streak,
  userAchievement,
  achievementStyles,
  equippedNameColor,
  equippedTitle
}) => {
  return (
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
                          onClick={() => setShowCosmeticStore(true)}
                          title="متجر التميز والمظهر"
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">متجر التميز</span>
                          <span className="sm:hidden">المتجر</span>
                        </button>
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

                      {/* 3 Metrics Legend: Star ⭐️, Trophy 🏆, Streak 🔥 */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60 text-amber-800 dark:text-amber-200">
                          <span>⭐️</span>
                          <span>النقاط</span>
                        </span>
                        <span className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-950/40 px-2 py-0.5 rounded-md border border-yellow-200/60 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-200">
                          <span>🏆</span>
                          <span>الكؤوس</span>
                        </span>
                        <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200/60 dark:border-orange-800/60 text-orange-800 dark:text-orange-200">
                          <span>🔥</span>
                          <span>الشعلات</span>
                        </span>
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

                          const playerTotalPoints = player.totalPoints ?? player.points ?? 0;
                          const playerTrophies = player.trophiesCount ?? player.cups ?? 0;
                          const playerStreak = player.streakCount ?? player.streak ?? (isCurrentPlayer ? streak : 0);

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
                                    <span
                                      className={`font-black text-xs sm:text-sm leading-tight truncate ${
                                        isPlayerElite && !(isCurrentPlayer ? equippedNameColor : player.equippedNameColor)
                                          ? `text-transparent bg-clip-text bg-gradient-to-r ${style.textColor}`
                                          : 'text-slate-800 dark:text-slate-100'
                                      }`}
                                      style={(isCurrentPlayer ? equippedNameColor : player.equippedNameColor) ? { color: (isCurrentPlayer ? equippedNameColor : player.equippedNameColor) } : undefined}
                                    >
                                      {player.name}
                                    </span>
                                    {(isCurrentPlayer ? (equippedTitle || player.equippedTitle || player.selectedTitle || player.title) : (player.equippedTitle || player.selectedTitle || player.title)) && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                                        {isCurrentPlayer ? (equippedTitle || player.equippedTitle || player.selectedTitle || player.title) : (player.equippedTitle || player.selectedTitle || player.title)}
                                      </span>
                                    )}
                                    {isCurrentPlayer && (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-600 text-white shadow-xs">
                                        أنت
                                      </span>
                                    )}
                                  </div>
                                  {player.username && (
                                    <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                      @{player.username.replace(/^@+/, '')}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* The 3 Real Metrics: Stars/Points ⭐️, Trophies 🏆, Streaks 🔥 */}
                              <div className="shrink-0 flex items-center gap-1 sm:gap-2 pr-1">
                                {/* 1. Total Points (⭐️) */}
                                <div
                                  title="النقاط الإجمالية"
                                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 shadow-xs"
                                >
                                  <span className="text-xs sm:text-sm leading-none">⭐️</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerTotalPoints}
                                  </span>
                                </div>

                                {/* 2. Trophies Count (🏆) */}
                                <div
                                  title="عدد الكؤوس من التحديات الجماعية"
                                  className={`flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl border transition-all shadow-xs ${
                                    isRank1
                                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 border-amber-400 font-black'
                                      : 'bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200/80 dark:border-yellow-800/60 text-yellow-800 dark:text-yellow-200'
                                  }`}
                                >
                                  <span className="text-xs sm:text-sm leading-none">🏆</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerTrophies}
                                  </span>
                                </div>

                                {/* 3. Streak Count (🔥) */}
                                <div
                                  title="عدد الشعلات / أيام الدخول المتتالية"
                                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60 text-orange-800 dark:text-orange-200 shadow-xs"
                                >
                                  <span className="text-xs sm:text-sm leading-none">🔥</span>
                                  <span className="font-black text-xs sm:text-sm tabular-nums">
                                    {playerStreak}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
  );
};

export default LeaderboardPage;
