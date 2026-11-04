import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, X, Play, ShieldAlert, Sparkles } from 'lucide-react';
import type { RoomInvitePayload } from '../../services/friendsRealtimeService';

export interface RoomInviteModalProps {
  invite: RoomInvitePayload | null;
  onAccept: (invite: RoomInvitePayload) => void;
  onDecline: () => void;
}

export const RoomInviteModal: React.FC<RoomInviteModalProps> = ({
  invite,
  onAccept,
  onDecline
}) => {
  if (!invite) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#151518] rounded-3xl shadow-2xl border-2 border-amber-400/50 dark:border-amber-500/30 overflow-hidden text-center p-5 sm:p-6 space-y-4"
        >
          {/* Animated Glow Icon */}
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg transform -rotate-3">
              <Swords className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/60">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>دعوة لتحدٍ مباشر</span>
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 pt-1">
              اللاعب <span className="text-brand-emerald">{invite.hostName}</span> يدعوك لتحدٍ جماعي!
            </h3>
            <p className="text-xs text-slate-400 font-bold">
              {invite.roomName || 'غرفة التنافس القرآني'}
            </p>
          </div>

          {/* Room Details Badge */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-150 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span>نوع التحدي:</span>
              <span className="font-black text-slate-900 dark:text-white">
                {invite.gameMode === 'COMPLETION' ? 'إكمال الآيات' : invite.gameMode === 'SURAH' ? 'تحدي السور' : 'المتشابهات القرآنية'}
              </span>
            </div>
            {invite.roomCode && (
              <div className="flex items-center justify-between font-bold text-[11px] text-slate-400">
                <span>رمز الغرفة:</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-300">
                  {invite.roomCode}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onAccept(invite)}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>قبول التحدي</span>
            </button>

            <button
              onClick={onDecline}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            >
              <span>تجاهل</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RoomInviteModal;
