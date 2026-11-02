import React from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag, Users, Lock, Globe, Loader2, Trash2, ArrowRight, LogOut
} from 'lucide-react';
import { View } from '../types/challenges';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';

export interface GroupWaitingPageProps {
  room: any;
  setShowCosmeticStore: (show: boolean) => void;
  playerUsername: string | null;
  playerName: string | null;
  equippedTitle?: string;
  equippedNameColor?: string;
  handleStartRoomV1: () => void;
  v1IsStartingRoom: boolean;
  handleCancelRoomByHost: () => void;
  setView: (view: View) => void;
  setRoom: (room: any) => void;
  setIsResignModalOpen?: (open: boolean) => void;
}

export const GroupWaitingPage: React.FC<GroupWaitingPageProps> = ({
  room,
  setShowCosmeticStore,
  playerUsername,
  playerName,
  equippedTitle,
  equippedNameColor,
  handleStartRoomV1,
  v1IsStartingRoom,
  handleCancelRoomByHost,
  setView,
  setRoom,
  setIsResignModalOpen
}) => {
  return (
    <motion.div
      key="group_waiting"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-lg mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 min-h-screen pb-36 sm:pb-40"
    >
      <div className="glass p-4 sm:p-6 md:p-8 rounded-3xl border-orange-100 shadow-xl text-center relative flex flex-col">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            type="button"
            onClick={() => setShowCosmeticStore(true)}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>متجر التميز</span>
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="text-right">
              <h2 className="text-lg sm:text-2xl font-black text-slate-800">قاعة الانتظار</h2>
              <p className="text-slate-400 font-bold text-xs sm:text-sm">انتظار انضمام بقية المتسابقين...</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-md animate-pulse shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 sm:p-5 rounded-2xl mb-4 sm:mb-6 border border-slate-100 shadow-inner text-right space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm md:text-base font-black text-slate-800 truncate">{room?.name || 'غرفة التحدي'}</span>
            {room?.isPrivate ? (
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-600 rounded-full text-xs font-black flex items-center gap-1 border border-amber-500/20 shrink-0">
                <Lock className="w-3 h-3" />
                <span>غرفة خاصة</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black flex items-center gap-1 border border-emerald-500/20 shrink-0">
                <Globe className="w-3 h-3" />
                <span>غرفة عامة</span>
              </span>
            )}
          </div>
          {room?.isPrivate && room?.password && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
              <span className="text-slate-500 font-bold">كلمة المرور:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-amber-700 bg-amber-100/70 px-2.5 py-0.5 rounded-lg text-sm">{room.password}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(room.password);
                    console.log('SUCCESS: تم نسخ كلمة المرور');
                  }}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-bold underline cursor-pointer"
                >
                  نسخ
                </button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400 font-bold pt-1 flex items-center gap-1.5 justify-end">
            <span>الغرفة ظاهرة في قائمة الغرف المتاحة ليتمكن الجميع من الدخول</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs md:text-sm font-black text-slate-800">المتسابقون ({room?.participants?.length || 1})</span>
            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {(room?.participants || []).map((p: any, i: number) => {
              const isMe = p?.id === (playerUsername || playerName) || p?.name === playerName;
              const titleToDisplay = isMe ? (equippedTitle || p?.equippedTitle) : p?.equippedTitle;
              const nameColorToDisplay = isMe ? (equippedNameColor || p?.equippedNameColor) : p?.equippedNameColor;
              return (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={p?.id || i}
                  className="flex items-center gap-2 sm:gap-2.5 p-2.5 sm:p-3 bg-white rounded-xl border border-slate-100 shadow-xs min-w-0"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xs shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {titleToDisplay && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 shrink-0">
                          {titleToDisplay}
                        </span>
                      )}
                      <span
                        className="font-bold text-slate-700 text-xs sm:text-sm truncate"
                        style={nameColorToDisplay ? { color: nameColorToDisplay } : undefined}
                      >
                        {p?.name || 'لاعب'}
                      </span>
                    </div>
                  </div>
                  {p?.id === room?.player1Id && <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded shrink-0">المنشئ</span>}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Fixed / Sticky Action Controls at bottom */}
        <div className="sticky bottom-2 sm:bottom-4 z-30 pt-3 pb-1 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 sm:p-3.5 space-y-2 mt-4">
          {(
            room?.player1?.name === playerName ||
            (room?.player1?.username && playerUsername && room.player1.username.toLowerCase() === playerUsername.toLowerCase()) ||
            (room?.hostName && playerName && room.hostName === playerName) ||
            (room?.hostUsername && playerUsername && room.hostUsername.toLowerCase() === playerUsername.toLowerCase())
          ) ? (
            <div className="space-y-2 sm:space-y-2.5">
              <button
                onClick={handleStartRoomV1}
                disabled={v1IsStartingRoom || (room?.participants?.length || 0) < 2}
                className={`w-full py-3 sm:py-3.5 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${(room?.participants?.length || 0) < 2
                  ? 'bg-slate-400 opacity-50 cursor-not-allowed'
                  : v1IsStartingRoom ? 'bg-orange-400' : 'bg-brand-emerald hover:bg-brand-emerald/90'
                  }`}
              >
                {v1IsStartingRoom && <Loader2 className="w-5 h-5 animate-spin" />}
                {v1IsStartingRoom ? 'جاري التحميل...' : 'ابدأ التحدي الآن'}
              </button>

              <button
                type="button"
                onClick={handleCancelRoomByHost}
                className="w-full py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
                <span>إلغاء الغرفة وحذفها ✕</span>
              </button>

              <button
                type="button"
                onClick={() => setView('group_join')}
                className="w-full py-2 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لقائمة الغرف (ستظل الغرفة متاحة)</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (setIsResignModalOpen) {
                  setIsResignModalOpen(true);
                } else if (room?.id) {
                  fetch('/api/1v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'resign',
                      roomId: room.id,
                      playerId: playerUsername || playerName
                    })
                  }).catch(() => {});
                  setRoom(null);
                  setView('group_join');
                }
              }}
              className="w-full py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span>الانسحاب من قاعة الانتظار</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Reactions Bar & Floating Animations Overlay */}
      <LiveReactionsOverlay
        roomId={room?.id || undefined}
        playerId={playerUsername || playerName || undefined}
        playerName={playerName || undefined}
        incomingReaction={room?.lastReaction || room?.playersProgress?.__lastReaction}
      />
    </motion.div>
  );
};

export default GroupWaitingPage;

