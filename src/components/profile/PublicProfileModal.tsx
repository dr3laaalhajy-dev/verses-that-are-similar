import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, UserPlus, UserCheck, Award, BookOpen, Flame, Trophy,
  Star, Copy, Check, Shield, Sparkles, UserMinus, Loader2, CheckCircle2
} from 'lucide-react';

export interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlayer: {
    id?: number;
    name?: string;
    username?: string | null;
    uniquePlayerId?: string | null;
  } | null;
  currentViewer: {
    id?: number;
    name?: string | null;
    username?: string | null;
    uniquePlayerId?: string | null;
  } | null;
  onFriendshipStatusChange?: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  isOpen,
  onClose,
  targetPlayer,
  currentViewer,
  onFriendshipStatusChange
}) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!targetPlayer) return;
    setLoading(true);
    setError(null);
    try {
      const targetParam = targetPlayer.uniquePlayerId || targetPlayer.username || targetPlayer.name || targetPlayer.id;
      const viewerParam = currentViewer?.uniquePlayerId || currentViewer?.username || currentViewer?.name || currentViewer?.id || '';

      const res = await fetch(`/api/friends?action=profile&targetId=${encodeURIComponent(String(targetParam))}&viewerId=${encodeURIComponent(String(viewerParam))}`);
      if (!res.ok) {
        throw new Error('فشل جلب بيانات الملف الشخصي');
      }
      const data = await res.json();
      setProfileData(data);
    } catch (err: any) {
      console.error('Error fetching public profile:', err);
      setError(err.message || 'حدث خطأ في تحميل الملف الشخصي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && targetPlayer) {
      fetchProfile();
    } else {
      setProfileData(null);
    }
  }, [isOpen, targetPlayer]);

  const handleCopyId = () => {
    const idToCopy = profileData?.player?.uniquePlayerId || targetPlayer?.uniquePlayerId;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!currentViewer || !profileData?.player) return;
    setActionLoading(true);
    try {
      const requesterId = currentViewer.uniquePlayerId || currentViewer.username || currentViewer.name;
      const targetId = profileData.player.uniquePlayerId || profileData.player.username || profileData.player.name;

      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-request',
          requesterId,
          targetId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileData((prev: any) => ({
          ...prev,
          friendshipStatus: data.status || 'PENDING_SENT'
        }));
        if (onFriendshipStatusChange) onFriendshipStatusChange();
      }
    } catch (e) {
      console.error('Error sending friend request:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondRequest = async (response: 'ACCEPT' | 'DECLINE') => {
    if (!currentViewer || !profileData?.player) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond-request',
          viewerId: currentViewer.uniquePlayerId || currentViewer.username || currentViewer.name,
          friendshipId: profileData.friendshipId,
          requesterId: profileData.player.id,
          response
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProfileData((prev: any) => ({
          ...prev,
          friendshipStatus: data.status || (response === 'ACCEPT' ? 'ACCEPTED' : 'NONE')
        }));
        if (onFriendshipStatusChange) onFriendshipStatusChange();
      }
    } catch (e) {
      console.error('Error responding to friend request:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!currentViewer || !profileData?.player) return;
    if (!confirm('هل أنت متأكد من رغبتك في إزالة الصداقة؟')) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-friend',
          viewerId: currentViewer.uniquePlayerId || currentViewer.username || currentViewer.name,
          friendId: profileData.player.id
        })
      });
      if (res.ok) {
        setProfileData((prev: any) => ({
          ...prev,
          friendshipStatus: 'NONE'
        }));
        if (onFriendshipStatusChange) onFriendshipStatusChange();
      }
    } catch (e) {
      console.error('Error removing friend:', e);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const player = profileData?.player || targetPlayer;
  const wird = profileData?.wird;
  const friendshipStatus = profileData?.friendshipStatus || 'NONE';
  const isSelf = profileData?.isSelf;

  const hasSeerah = player?.seerahCompleted;
  const hasGeneral = player?.generalCompleted;
  const hasQuran = player?.quranCompleted;
  const activeFrame = player?.activeFrame;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-[#151518] rounded-3xl shadow-2xl border border-amber-200/40 dark:border-amber-500/20 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header Banner */}
          <div className="relative h-24 bg-gradient-to-r from-emerald-800 via-emerald-600 to-amber-700 p-4 flex items-start justify-between">
            <div className="flex items-center gap-2 text-white/90 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>الملف الشخصي للاعب</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Main Body */}
          <div className="p-4 sm:p-5 pt-0 overflow-y-auto space-y-4">
            {/* Avatar & Identifiers Card */}
            <div className="relative -mt-12 flex flex-col items-center text-center">
              {/* Avatar with Frame */}
              <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center mb-2">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800">
                  {(player?.name || 'ل').charAt(0).toUpperCase()}
                </div>

                {/* Achievement Frame Overlay */}
                {activeFrame === 'seerah' ? (
                  <div className="absolute inset-0 rounded-full pointer-events-none bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110 drop-shadow-md" />
                ) : activeFrame === 'general' ? (
                  <div className="absolute inset-0 rounded-full pointer-events-none bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110 drop-shadow-md" />
                ) : null}
              </div>

              {/* Player Name */}
              <h3
                className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5"
                style={player?.equippedNameColor ? { color: player.equippedNameColor } : undefined}
              >
                {player?.name || 'لاعب'}
              </h3>

              {/* Username & Unique Player ID */}
              <div className="flex items-center gap-2 mt-1 flex-wrap justify-center text-xs">
                {player?.username && (
                  <span className="text-slate-400 dark:text-slate-400 font-bold">
                    @{player.username.replace(/^@+/, '')}
                  </span>
                )}

                {player?.uniquePlayerId && (
                  <button
                    onClick={handleCopyId}
                    title="انقر لنسخ المعرّف"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 text-amber-800 dark:text-amber-200 font-mono font-black text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer"
                  >
                    <span>{player.uniquePlayerId}</span>
                    {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-amber-600" />}
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center">
                <Loader2 className="w-8 h-8 border-brand-emerald animate-spin mx-auto text-emerald-600 mb-2" />
                <p className="text-xs text-slate-400 font-bold">جاري تحميل إحصائيات اللاعب...</p>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 text-xs rounded-xl text-center font-bold">
                {error}
              </div>
            ) : (
              <>
                {/* 3 Core Stats Cards */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="flex items-center justify-center gap-1 text-amber-600 text-xs font-black mb-1">
                      <Star className="w-3.5 h-3.5" />
                      <span>النقاط</span>
                    </div>
                    <span className="text-base sm:text-lg font-black text-amber-800 dark:text-amber-200">
                      {player?.points || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200/60 dark:border-yellow-800/40">
                    <div className="flex items-center justify-center gap-1 text-yellow-600 text-xs font-black mb-1">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>الكؤوس</span>
                    </div>
                    <span className="text-base sm:text-lg font-black text-yellow-800 dark:text-yellow-200">
                      {player?.cups || 0}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-800/40">
                    <div className="flex items-center justify-center gap-1 text-orange-600 text-xs font-black mb-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>الشعلة</span>
                    </div>
                    <span className="text-base sm:text-lg font-black text-orange-800 dark:text-orange-200">
                      {player?.streak || 0} يوم
                    </span>
                  </div>
                </div>

                {/* Islamic Achievements Section */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                    <Award className="w-4 h-4 text-brand-gold" />
                    <span>الأوسمة والشهادات المكتسبة</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Seerah Certificate */}
                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      hasSeerah
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                        : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-60'
                    }`}>
                      <span className="text-base">{hasSeerah ? '📜' : '🔒'}</span>
                      <div className="text-right">
                        <div className="font-black text-[11px] leading-tight">شهادة السيرة</div>
                        <div className="text-[9px] font-bold">{hasSeerah ? 'مكتملة ومُجازة' : 'لم تُنجز بعد'}</div>
                      </div>
                    </div>

                    {/* General Certificate */}
                    <div className={`p-2 rounded-xl border flex items-center gap-2 ${
                      hasGeneral
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                        : 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-60'
                    }`}>
                      <span className="text-base">{hasGeneral ? '🏆' : '🔒'}</span>
                      <div className="text-right">
                        <div className="font-black text-[11px] leading-tight">الثقافة العامة</div>
                        <div className="text-[9px] font-bold">{hasGeneral ? 'مكتملة ومُجازة' : 'لم تُنجز بعد'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quran Wird Progress Section */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span>الورد القرآني وختمة التلاوة</span>
                    </div>
                    {wird?.isActive && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ورد نشط
                      </span>
                    )}
                  </div>

                  {wird?.hasWird ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>السورة الحالية: <strong className="font-black text-emerald-700 dark:text-emerald-400">{wird.currentSurah}</strong></span>
                        <span className="text-[11px] text-slate-400">الصفحة {wird.currentPage} من 604</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${wird.completionPercentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>نسبة الإنجاز في الختمة</span>
                        <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{wird.completionPercentage}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-bold py-1">
                      اللاعب لم يقم بتفعيل الورد القرآني بعد
                    </p>
                  )}
                </div>

                {/* Friendship Interactive Actions */}
                <div className="pt-1">
                  {isSelf ? (
                    <div className="w-full py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>هذا حسابك الشخصي</span>
                    </div>
                  ) : friendshipStatus === 'ACCEPTED' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>أنتم أصدقاء</span>
                      </div>
                      <button
                        onClick={handleRemoveFriend}
                        disabled={actionLoading}
                        title="إلغاء الصداقة"
                        className="p-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : friendshipStatus === 'PENDING_SENT' ? (
                    <div className="w-full py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-center text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5">
                      <span>تم إرسال طلب الصداقة ⏳</span>
                    </div>
                  ) : friendshipStatus === 'PENDING_RECEIVED' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRespondRequest('ACCEPT')}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>قبول طلب الصداقة</span>
                      </button>
                      <button
                        onClick={() => handleRespondRequest('DECLINE')}
                        disabled={actionLoading}
                        className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleSendFriendRequest}
                      disabled={actionLoading}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      <span>إضافة كصديق</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PublicProfileModal;

