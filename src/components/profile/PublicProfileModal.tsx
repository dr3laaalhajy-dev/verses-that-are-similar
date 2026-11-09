import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, UserPlus, UserCheck, Award, BookOpen, Flame, Trophy,
  Star, Copy, Check, Shield, Sparkles, UserMinus, Loader2, CheckCircle2, Lock
} from 'lucide-react';
import { CertificateModal } from '../CertificateModal';
import { CompletedAchievement } from '../../services/milestoneProgressService';
import { useAchievements } from '../../hooks/useAchievements';

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
  const [selectedCertificate, setSelectedCertificate] = useState<any>(null);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  // تحديد ما إذا كان الملف المعروض هو حساب المستخدم الحالي نفسه
  const isSelf = Boolean(
    profileData?.isSelf ||
    (currentViewer?.username && targetPlayer?.username && currentViewer.username.toLowerCase() === targetPlayer.username.toLowerCase()) ||
    (currentViewer?.uniquePlayerId && targetPlayer?.uniquePlayerId && currentViewer.uniquePlayerId.toLowerCase() === targetPlayer.uniquePlayerId.toLowerCase()) ||
    (currentViewer?.id && targetPlayer?.id && currentViewer.id === targetPlayer.id)
  );

  // استخدام Hook الإنجازات الموحد (Single Source of Truth) المشترك بين الإعدادات والملف الشخصي
  const {
    completedAchievements: earnedCertificates,
    loading: achievementsLoading,
    refresh: refreshAchievements
  } = useAchievements(
    isOpen && targetPlayer
      ? {
          userId: targetPlayer.id,
          username: targetPlayer.username,
          playerName: targetPlayer.name,
          uniquePlayerId: targetPlayer.uniquePlayerId,
          isSelf
        }
      : null
  );

  const fetchProfile = async () => {
    if (!targetPlayer) return;
    setLoading(true);
    setError(null);

    try {
      const targetParam = targetPlayer.id || targetPlayer.uniquePlayerId || targetPlayer.username || targetPlayer.name;
      const viewerParam = currentViewer?.id || currentViewer?.uniquePlayerId || currentViewer?.username || currentViewer?.name || '';

      if (!targetParam) {
        throw new Error('بيانات اللاعب غير متوفرة');
      }

      const res = await fetch(`/api/friends?action=profile&targetId=${encodeURIComponent(String(targetParam))}&viewerId=${encodeURIComponent(String(viewerParam))}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      } else {
        console.warn('[PublicProfileModal] Profile API returned non-OK status, falling back to basic player data.');
        setProfileData({
          player: {
            id: targetPlayer.id,
            name: targetPlayer.name || 'لاعب',
            username: targetPlayer.username || null,
            uniquePlayerId: targetPlayer.uniquePlayerId || null,
            points: (targetPlayer as any).points || 0,
            cups: (targetPlayer as any).cups || 0,
            streak: (targetPlayer as any).streak || 0,
            activeFrame: (targetPlayer as any).activeFrame || null,
            equippedNameColor: (targetPlayer as any).equippedNameColor || null,
            seerahCompleted: (targetPlayer as any).seerahCompleted || false,
            generalCompleted: (targetPlayer as any).generalCompleted || false,
            quranCompleted: (targetPlayer as any).quranCompleted || false,
            createdAt: (targetPlayer as any).createdAt || (targetPlayer as any).since || new Date().toISOString()
          },
          wird: null,
          friendshipStatus: (targetPlayer as any).status || 'ACCEPTED',
          isSelf: false
        });
      }
    } catch (err: any) {
      console.warn('Error fetching public profile, utilizing targetPlayer fallback:', err);
      // Fallback gracefully to targetPlayer data so modal never breaks
      setProfileData({
        player: {
          id: targetPlayer.id,
          name: targetPlayer.name || 'لاعب',
          username: targetPlayer.username || null,
          uniquePlayerId: targetPlayer.uniquePlayerId || null,
          points: (targetPlayer as any).points || 0,
          cups: (targetPlayer as any).cups || 0,
          streak: (targetPlayer as any).streak || 0,
          activeFrame: (targetPlayer as any).activeFrame || null,
          equippedNameColor: (targetPlayer as any).equippedNameColor || null,
          seerahCompleted: (targetPlayer as any).seerahCompleted || false,
          generalCompleted: (targetPlayer as any).generalCompleted || false,
          quranCompleted: (targetPlayer as any).quranCompleted || false,
          createdAt: (targetPlayer as any).createdAt || (targetPlayer as any).since || new Date().toISOString()
        },
        wird: null,
        friendshipStatus: (targetPlayer as any).status || 'ACCEPTED',
        isSelf: false
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && targetPlayer) {
      fetchProfile();
      refreshAchievements();
    } else {
      setProfileData(null);
      setSelectedCertificate(null);
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
  const activeFrame = player?.activeFrame;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-[#151518] rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* 1. Header Banner (Separated colored header without overflow-hidden) */}
          <div className="relative h-28 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-4 sm:p-5 flex items-start justify-between shrink-0 overflow-visible">
            <div className="flex items-center gap-2 text-white/95 font-bold text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>الملف الشخصي للاعب</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Avatar & Identity Area (Positioned directly after the green header, with relative & z-10 and negative margin to overlap halfway) */}
          <div className="relative z-10 -mt-14 sm:-mt-16 flex flex-col items-center text-center px-4 shrink-0">
            {/* Perfectly centered circular avatar with thick white border & soft shadow */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center mb-2">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white font-black text-3xl sm:text-4xl flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md relative overflow-hidden">
                {player?.avatarUrl || player?.image ? (
                  <img
                    src={player.avatarUrl || player.image}
                    alt={player?.name || 'صورة اللاعب'}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{(player?.name || 'ل').charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Achievement Frame Overlay (Scaled to fit without clipping) */}
              {activeFrame === 'seerah' ? (
                <div className="absolute inset-0 rounded-full pointer-events-none bg-[url('/golden_seerah_achievement_frame.webp')] bg-center bg-no-repeat bg-contain scale-110 drop-shadow-md" />
              ) : activeFrame === 'general' ? (
                <div className="absolute inset-0 rounded-full pointer-events-none bg-[url('/golden_general_achievement_frame.webp')] bg-center bg-no-repeat bg-contain scale-110 drop-shadow-md" />
              ) : null}
            </div>

            {/* Player Name: Bold and Dark */}
            <h3
              className="text-2xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1.5"
              style={player?.equippedNameColor ? { color: player.equippedNameColor } : undefined}
            >
              {player?.name || 'لاعب'}
            </h3>

            {/* Unique ID Badge: Pale gold pill badge below the name, cleanly formatted */}
            {player?.uniquePlayerId && (
              <button
                type="button"
                onClick={handleCopyId}
                title="انقر لنسخ المعرّف"
                className="inline-flex items-center gap-1.5 px-3 py-1 mt-1.5 rounded-full bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 font-mono font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer shadow-2xs group"
              >
                <span className="tracking-wide">ID: {player.uniquePlayerId}</span>
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                )}
              </button>
            )}
          </div>

          {/* 3. Main Scrollable Body Content */}
          <div className="p-4 sm:p-5 pt-3 overflow-y-auto space-y-4 flex-1">

            {loading ? (
              <div className="py-10 text-center">
                <Loader2 className="w-8 h-8 border-brand-emerald animate-spin mx-auto text-emerald-600 mb-2" />
                <p className="text-xs text-slate-400 font-bold">جاري تحميل إحصائيات اللاعب...</p>
              </div>
            ) : error && !player ? (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 text-xs rounded-xl text-center font-bold">
                {error}
              </div>
            ) : (
              <>
                {/* 3. Stats Grid: 3 columns, soft backgrounds, prominent large numbers, word & icon underneath */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-center">
                  {/* Points Card */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-orange-50/90 dark:bg-orange-950/30 flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
                    <span className="text-2xl sm:text-3xl font-extrabold text-orange-950 dark:text-orange-200 font-mono leading-none">
                      {player?.points || 0}
                    </span>
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-orange-700/90 dark:text-orange-300/90 mt-1.5">
                      <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500/20" />
                      <span>النقاط</span>
                    </div>
                  </div>

                  {/* Cups Card */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-yellow-50/90 dark:bg-yellow-950/30 flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
                    <span className="text-2xl sm:text-3xl font-extrabold text-yellow-950 dark:text-yellow-200 font-mono leading-none">
                      {player?.cups || 0}
                    </span>
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-yellow-700/90 dark:text-yellow-300/90 mt-1.5">
                      <Trophy className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600/20" />
                      <span>الكؤوس</span>
                    </div>
                  </div>

                  {/* Streak / Flame Card */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/30 flex flex-col items-center justify-center transition-all hover:scale-[1.02]">
                    <span className="text-2xl sm:text-3xl font-extrabold text-rose-950 dark:text-rose-200 font-mono leading-none">
                      {player?.streak || 0}
                    </span>
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-rose-700/90 dark:text-rose-300/90 mt-1.5">
                      <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500/20" />
                      <span>الشعلة</span>
                    </div>
                  </div>
                </div>

                {/* 4. قسم شهادات وإنجازات اللاعب (Player's Certificates & Achievements) */}
                <div className="bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-slate-200">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>شهادات وإنجازات اللاعب</span>
                    </div>
                    {earnedCertificates.length > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {earnedCertificates.length} معتمدة 🏆
                      </span>
                    )}
                  </div>

                  {earnedCertificates.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {earnedCertificates.map((cert) => (
                        <button
                          key={cert.id}
                          type="button"
                          onClick={() => setSelectedCertificate(cert)}
                          className="p-2.5 rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/70 to-amber-100/40 dark:from-amber-950/30 dark:to-slate-900/40 hover:border-amber-400 text-slate-800 dark:text-slate-200 transition-all duration-200 text-right flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer group"
                          title="اضغط لعرض الشهادة بالحجم الكامل والتحميل"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/50 shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
                              {cert.icon || '📜'}
                            </span>
                            <div className="min-w-0">
                              <div className="font-black text-[11px] leading-tight text-slate-900 dark:text-slate-100 truncate">
                                {cert.title}
                              </div>
                              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>مُجاز ومُعتمد رسمياً</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-black font-mono text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-lg shrink-0 border border-amber-300/60">
                            {cert.score || '100%'}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/30">
                      <Lock className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        لم يحصل اللاعب على شهادات معتمدة بعد
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        تُمنح تلقائياً فور إتمام أي من المسابقات القرآنية بنسبة 100%
                      </p>
                    </div>
                  )}
                </div>

                {/* Quran Wird Progress Card */}
                <div className="bg-white dark:bg-slate-900/80 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-slate-200">
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span>الورد القرآني وختمة التلاوة</span>
                    </div>
                    {wird?.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60">
                        ورد نشط
                      </span>
                    )}
                  </div>

                  {wird?.hasWird ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300">
                        <span>السورة الحالية: <strong className="font-black text-emerald-700 dark:text-emerald-400">{wird.currentSurah}</strong></span>
                        <span className="text-[11px] text-gray-400">الصفحة {wird.currentPage} من 604</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${wird.completionPercentage}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                        <span>نسبة الإنجاز في الختمة</span>
                        <span className="font-extrabold text-gray-800 dark:text-slate-200 font-mono">{wird.completionPercentage}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-bold py-1">
                      اللاعب لم يقم بتفعيل الورد القرآني بعد
                    </p>
                  )}
                </div>

                {/* Friendship Action Buttons: Proportional, responsive & balanced */}
                <div className="pt-1">
                  {isSelf ? (
                    <div className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 rounded-xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>هذا حسابك الشخصي</span>
                    </div>
                  ) : friendshipStatus === 'ACCEPTED' ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>أنتم أصدقاء</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFriend}
                        disabled={actionLoading}
                        title="إلغاء الصداقة"
                        className="p-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer shrink-0"
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
                        type="button"
                        onClick={() => handleRespondRequest('ACCEPT')}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>قبول الصداقة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondRequest('DECLINE')}
                        disabled={actionLoading}
                        className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendFriendRequest}
                      disabled={actionLoading}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
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

        {/* النافذة المنبثقة المستقلة لعرض الشهادة بكامل فخامتها (CertificateModal) */}
        {selectedCertificate && (
          <CertificateModal
            isOpen={Boolean(selectedCertificate)}
            onClose={() => setSelectedCertificate(null)}
            playerName={player?.name || targetPlayer?.name || 'فارس القرآن'}
            challengeName={selectedCertificate.title}
            score={selectedCertificate.score || '100%'}
            surahOrJuz={selectedCertificate.scope}
            certificateId={selectedCertificate.serial}
          />
        )}
      </div>
    </AnimatePresence>
  );
};

export default PublicProfileModal;

