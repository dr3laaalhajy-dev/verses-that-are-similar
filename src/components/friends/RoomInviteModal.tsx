import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, X, Play, Clock, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { friendsRealtimeService, type RoomInvitePayload } from '../../services/friendsRealtimeService';

export interface RoomInviteModalProps {
  invite: RoomInvitePayload | null;
  onAccept: (roomOrInvite: any) => void;
  onDecline: () => void;
  currentPlayer?: {
    id?: number;
    name?: string | null;
    username?: string | null;
    uniquePlayerId?: string | null;
  } | null;
}

export const RoomInviteModal: React.FC<RoomInviteModalProps> = ({
  invite,
  onAccept,
  onDecline,
  currentPlayer
}) => {
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const hasRespondedRef = useRef(false);

  // Requirement 1: 10-second timeout timer.
  // When 10s elapses without action, dismiss modal and send socket event 'invite_ignored' to the sender.
  useEffect(() => {
    if (!invite) return;
    setTimeLeft(10);
    hasRespondedRef.current = false;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!hasRespondedRef.current) {
            hasRespondedRef.current = true;
            handleTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [invite?.roomId, invite?.timestamp]);

  if (!invite) return null;

  const getSenderTarget = () => {
    return invite.senderTarget || invite.hostUsername || invite.hostName;
  };

  const getMyFriendId = () => {
    return currentPlayer?.id || currentPlayer?.uniquePlayerId || currentPlayer?.username || currentPlayer?.name || '';
  };

  const handleTimeout = async () => {
    const senderTarget = getSenderTarget();
    if (senderTarget) {
      friendsRealtimeService.sendInviteResponse(senderTarget, 'invite_ignored', {
        roomId: invite.roomId,
        friendId: getMyFriendId(),
        friendName: currentPlayer?.name || undefined
      }).catch(err => console.warn('Failed to send invite_ignored event:', err));
    }
    onDecline();
  };

  const handleDeclineClick = async () => {
    if (hasRespondedRef.current) return;
    hasRespondedRef.current = true;

    // Requirement 2: Declined event sent when user clicks 'إلغاء'
    const senderTarget = getSenderTarget();
    if (senderTarget) {
      friendsRealtimeService.sendInviteResponse(senderTarget, 'invite_declined', {
        roomId: invite.roomId,
        friendId: getMyFriendId(),
        friendName: currentPlayer?.name || undefined
      }).catch(err => console.warn('Failed to send invite_declined event:', err));
    }
    onDecline();
  };

  const handleAcceptInviteClick = async () => {
    if (hasRespondedRef.current) return;
    hasRespondedRef.current = true;

    setIsJoining(true);
    setErrorMessage(null);

    // Requirement 3: Send 'invite_accepted' event to the sender
    const senderTarget = getSenderTarget();
    if (senderTarget) {
      friendsRealtimeService.sendInviteResponse(senderTarget, 'invite_accepted', {
        roomId: invite.roomId,
        friendId: getMyFriendId(),
        friendName: currentPlayer?.name || undefined
      }).catch(err => console.warn('Failed to send invite_accepted event:', err));
    }

    try {
      const token = localStorage.getItem('quran_admin_token') || localStorage.getItem('quran_auth_token') || '';
      const pId = currentPlayer?.uniquePlayerId || currentPlayer?.username || currentPlayer?.name || localStorage.getItem('quran_unique_player_id') || localStorage.getItem('quran_player_username') || localStorage.getItem('quran_player_name') || '';
      const pName = currentPlayer?.name || localStorage.getItem('quran_player_name') || 'متسابق جديد';

      const res = await fetch('/api/1v1', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'join',
          roomId: invite.roomId,
          id: invite.roomId,
          player2Id: pId,
          playerName: pName,
          password: invite.password,
          isInvite: true,
          invitedUserId: pId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('غير مصرح لك بالدخول أو الدعوة غير صالحة');
        } else if (res.status === 404) {
          throw new Error('الغرفة غير موجودة');
        } else {
          throw new Error(data.message || data.error || 'تعذر الانضمام للغرفة');
        }
      }

      onAccept(data.room || data);
    } catch (err: any) {
      console.error('Error joining invited room:', err);
      hasRespondedRef.current = false;
      if (err?.message === 'Failed to fetch') {
        setErrorMessage('تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت');
      } else {
        setErrorMessage(err?.message || 'غير مصرح لك بالدخول أو الدعوة غير صالحة');
      }
    } finally {
      setIsJoining(false);
    }
  };

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

          {/* 10-Second Countdown Visual Bar & Timer Badge */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
              <span>مهلة الرد:</span>
              <span className="font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-700/50 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                <span>{timeLeft} ثوانٍ</span>
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${Math.max(0, (timeLeft / 10) * 100)}%` }}
              />
            </div>
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

          {/* Error message banner if join fails */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleAcceptInviteClick}
              disabled={isJoining}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isJoining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{isJoining ? 'جاري الانضمام...' : 'قبول التحدي'}</span>
            </button>

            <button
              onClick={handleDeclineClick}
              disabled={isJoining}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>إلغاء</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RoomInviteModal;
