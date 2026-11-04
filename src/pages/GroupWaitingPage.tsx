import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Lock, Globe, Loader2, Trash2, ArrowRight, LogOut,
  UserPlus, ChevronDown, ChevronUp, Check, Swords, Sparkles, Clock, X
} from 'lucide-react';
import { View } from '../types/challenges';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { friendsRealtimeService } from '../services/friendsRealtimeService';
import { supabase } from '../services/supabase';
import { useApp } from '../contexts/AppContext';

export interface FriendInviteStateItem {
  status: 'idle' | 'sent' | 'declined' | 'accepted';
  cooldownRemaining?: number;
}

export interface GroupWaitingPageProps {
  room: any;
  setShowCosmeticStore?: (show: boolean) => void;
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
  playerUsername,
  playerName,
  equippedNameColor,
  handleStartRoomV1,
  v1IsStartingRoom,
  handleCancelRoomByHost,
  setView,
  setRoom,
  setIsResignModalOpen
}) => {
  const app = useApp();
  const [isInviteDropdownOpen, setIsInviteDropdownOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | number | null>(null);

  // Requirement 4: Sender State per friend ID (inviteStatuses[friendId]) tracking idle, sent (10s), declined (30s), accepted
  const [inviteStatuses, setInviteStatuses] = useState<Record<string | number, FriendInviteStateItem>>({});

  useEffect(() => {
    const unsub = friendsRealtimeService.onPresenceChange(() => {
      // triggers re-render when presence changes
    });
    return () => unsub();
  }, []);

  // Listen for real-time invite responses (invite_ignored, invite_declined, invite_accepted)
  useEffect(() => {
    const identifiers = [
      playerUsername,
      playerName,
      app?.uniquePlayerId,
      app?.playerId ? String(app.playerId) : null
    ].filter(Boolean) as string[];

    const unsubscribe = friendsRealtimeService.subscribeToInviteResponses(
      identifiers,
      (response) => {
        if (!response || !response.friendId) return;
        const fId = response.friendId;

        // Requirement 2: In case of ignore (10s timeout), reset invite button back to idle immediately
        if (response.event === 'invite_ignored') {
          setInviteStatuses(prev => ({
            ...prev,
            [fId]: { status: 'idle' as const }
          }));
        }
        // Requirement 2: In case of explicit decline, disable button, show 'تم الرفض' with 30s cooldown timer
        else if (response.event === 'invite_declined') {
          setInviteStatuses(prev => ({
            ...prev,
            [fId]: { status: 'declined' as const, cooldownRemaining: 30 }
          }));
        }
        // Requirement 3: In case of acceptance, immediately change button to 'تم القبول'
        else if (response.event === 'invite_accepted') {
          setInviteStatuses(prev => ({
            ...prev,
            [fId]: { status: 'accepted' as const }
          }));
        }
        // Requirement 1 & 2: When player leaves or withdraws from the room, reset invite button back to 'إرسال دعوة' (idle)
        else if (response.event === 'player_left') {
          setInviteStatuses(prev => {
            const next = { ...prev };
            delete next[fId];
            return next;
          });
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [playerUsername, playerName, app?.uniquePlayerId, app?.playerId]);

  // 1-second interval ticker managing cooldown timers per friend
  useEffect(() => {
    const timer = setInterval(() => {
      setInviteStatuses(prev => {
        let hasChanges = false;
        const next: Record<string | number, FriendInviteStateItem> = {};

        for (const [idKey, item] of Object.entries(prev)) {
          if (item.cooldownRemaining !== undefined && item.cooldownRemaining > 0) {
            hasChanges = true;
            const newRemaining = item.cooldownRemaining - 1;
            if (newRemaining <= 0) {
              // Cooldown expired: return to idle
              next[idKey] = { status: 'idle' as const };
            } else {
              next[idKey] = { ...item, cooldownRemaining: newRemaining };
            }
          } else {
            next[idKey] = item;
          }
        }

        return hasChanges ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Requirement 1 & 2: Listen to leave event from room reactions / socket channel directly to reset invite button
  useEffect(() => {
    if (!room?.id) return;

    // A) If room.lastReaction or room.playersProgress.__lastReaction is 'player_left'
    const lastReaction = (room as any)?.lastReaction || (room as any)?.playersProgress?.__lastReaction;
    if (lastReaction && (lastReaction.action === 'player_left' || lastReaction.type === 'LEAVE' || lastReaction.action === 'player_abandoned')) {
      const leftPlayerId = lastReaction.playerId;
      const leftPlayerName = lastReaction.playerName;

      // Find matching friend from friendsList
      const matchingFriend = friendsList.find(f =>
        (leftPlayerId && String(f.id) === String(leftPlayerId)) ||
        (leftPlayerName && f.name && f.name.trim().toLowerCase() === String(leftPlayerName).trim().toLowerCase()) ||
        (f.uniquePlayerId && leftPlayerId && String(f.uniquePlayerId).toUpperCase() === String(leftPlayerId).toUpperCase()) ||
        (f.username && leftPlayerId && f.username.toLowerCase().replace(/^@+/, '') === String(leftPlayerId).toLowerCase().replace(/^@+/, ''))
      );

      const targetKey = matchingFriend ? matchingFriend.id : leftPlayerId;
      if (targetKey) {
        setInviteStatuses(prev => {
          if (!prev[targetKey]) return prev;
          const next = { ...prev };
          delete next[targetKey];
          return next;
        });
      }
    }

    // B) Direct Supabase channel listener for `room_${room.id}` & `room_sync_${room.id}`
    const channelName = `room_sync_${room.id}`;
    const channel = supabase.channel(channelName);
    channel
      .on('broadcast', { event: 'player_left' }, ({ payload }) => {
        if (!payload) return;
        const leftId = payload.playerId || payload.friendId || payload.userId;
        const leftName = payload.playerName || payload.friendName || payload.name;
        const match = friendsList.find(f =>
          (leftId && String(f.id) === String(leftId)) ||
          (leftName && f.name && f.name.trim().toLowerCase() === String(leftName).trim().toLowerCase())
        );
        const target = match ? match.id : leftId;
        if (target) {
          setInviteStatuses(prev => {
            const next = { ...prev };
            delete next[target];
            return next;
          });
        }
      })
      .on('broadcast', { event: 'participant_removed' }, ({ payload }) => {
        if (!payload) return;
        const leftId = payload.playerId || payload.friendId || payload.userId;
        const leftName = payload.playerName || payload.friendName || payload.name;
        const match = friendsList.find(f =>
          (leftId && String(f.id) === String(leftId)) ||
          (leftName && f.name && f.name.trim().toLowerCase() === String(leftName).trim().toLowerCase())
        );
        const target = match ? match.id : leftId;
        if (target) {
          setInviteStatuses(prev => {
            const next = { ...prev };
            delete next[target];
            return next;
          });
        }
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) { }
    };
  }, [room?.id, (room as any)?.lastReaction, (room as any)?.playersProgress?.__lastReaction, friendsList]);

  const fetchFriends = useCallback(async (isInitial = false) => {
    if (isInitial || friendsList.length === 0) {
      setIsLoadingFriends(true);
    }
    try {
      const viewerParam = playerUsername || playerName || '';
      const res = await fetch(`/api/friends?action=list&viewerId=${encodeURIComponent(viewerParam)}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data.friends || []);
      }
    } catch (e) {
      console.error('Error fetching friends for invite:', e);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [playerUsername, playerName, friendsList.length]);

  useEffect(() => {
    fetchFriends(true);
  }, [playerUsername, playerName]);

  // Online friends who are not currently active in this room (Allow re-inviting abandoned/left players)
  const activeParticipants = (room?.participants || []).filter((p: any) => !p.isAbandoned && p.status !== 'abandoned' && !p.hasLeft);
  const participantsNames = activeParticipants.map((p: any) => (p?.name || '').trim().toLowerCase());
  const participantsUsernames = activeParticipants.map((p: any) => (p?.username || '').trim().toLowerCase().replace(/^@+/, ''));
  const participantsIds = activeParticipants.map((p: any) => String(p?.id || ''));

  const onlineFriends = friendsList.filter(f => {
    const isOnline = friendsRealtimeService.isPlayerOnline(f);
    const fName = (f.name || '').trim().toLowerCase();
    const fUser = (f.username || '').trim().toLowerCase().replace(/^@+/, '');
    const fId = String(f.id || '');
    const alreadyInRoom = participantsNames.includes(fName) || participantsUsernames.includes(fUser) || participantsIds.includes(fId);
    return isOnline && !alreadyInRoom;
  });

  const handleSendInvite = async (friend: any) => {
    const friendTarget = friend.uniquePlayerId || friend.username || friend.name;
    if (!friendTarget || !room?.id) return;

    setSendingInviteId(friend.id);
    try {
      const senderTarget = app?.uniquePlayerId || playerUsername || playerName || String(app?.playerId || '');
      await friendsRealtimeService.sendRoomInvite(friendTarget, {
        roomId: room.id,
        roomCode: room.code,
        roomName: room.name || 'غرفة التحدي',
        hostName: playerName || 'صديقك',
        hostUsername: playerUsername || undefined,
        senderTarget: senderTarget,
        senderId: app?.playerId,
        isPrivate: room.isPrivate,
        password: room.password,
        isInvite: true,
        invitedUserId: friend.id,
        gameMode: room.gameMode,
        timestamp: Date.now()
      });

      // Requirement 1 & 2: Set sent status with 10-second initial timeout timer
      setInviteStatuses(prev => ({
        ...prev,
        [friend.id]: { status: 'sent' as const, cooldownRemaining: 10 }
      }));
    } catch (e) {
      console.error('Failed to send room invite:', e);
    } finally {
      setSendingInviteId(null);
    }
  };
  return (
    <motion.div
      key="group_waiting"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-lg mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 min-h-screen pb-36 sm:pb-40"
    >
      <div className="glass p-4 sm:p-6 md:p-8 rounded-3xl border-orange-100 shadow-xl text-center relative flex flex-col">
        <div className="flex items-center justify-end mb-4 sm:mb-6">
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

        {/* Friends Invite Dropdown (Online friends exclusively) */}
        <div className="mb-4 sm:mb-6 text-right">
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent p-3 rounded-2xl border border-amber-200/50 dark:border-amber-700/40">
            <button
              type="button"
              onClick={() => setIsInviteDropdownOpen(!isInviteDropdownOpen)}
              className="w-full flex items-center justify-between text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {isInviteDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="text-[11px] font-bold">
                  {isInviteDropdownOpen ? 'إخفاء' : 'عرض الأصدقاء المتصلين'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{onlineFriends.length} متصل الآن</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-amber-600" />
                  <span>دعوة صديق للتحدي</span>
                </span>
              </div>
            </button>

            <AnimatePresence>
              {isInviteDropdownOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 overflow-hidden space-y-2"
                >
                  {isLoadingFriends ? (
                    <div className="py-4 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600 mx-auto mb-1" />
                      <p className="text-[11px] text-slate-400 font-bold">جاري البحث عن الأصدقاء المتصلين...</p>
                    </div>
                  ) : onlineFriends.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-slate-400 font-bold">
                      لا يوجد أصدقاء متصلون حالياً ⚪
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {onlineFriends.map((friend) => {
                        const fStatus = inviteStatuses[friend.id] || { status: 'idle' };
                        const isSending = sendingInviteId === friend.id;
                        const isIdle = fStatus.status === 'idle' && !isSending;
                        const isSent = fStatus.status === 'sent';
                        const isDeclined = fStatus.status === 'declined';
                        const isAccepted = fStatus.status === 'accepted';

                        return (
                          <div
                            key={friend.id}
                            className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 shadow-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-xs flex items-center justify-center">
                                  {(friend.name || 'ل').charAt(0).toUpperCase()}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-800" />
                              </div>
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                                {friend.name}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSendInvite(friend)}
                              disabled={!isIdle}
                              className={`px-3 py-1 rounded-lg text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1 ${
                                isAccepted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-default'
                                  : isDeclined
                                  ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400 cursor-not-allowed'
                                  : isSent
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 cursor-default'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                              }`}
                            >
                              {isSending ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>جاري الإرسال...</span>
                                </>
                              ) : isAccepted ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>تم القبول ✓</span>
                                </>
                              ) : isDeclined ? (
                                <>
                                  <X className="w-3 h-3 text-red-500" />
                                  <span>تم الرفض ({fStatus.cooldownRemaining || 30}ث)</span>
                                </>
                              ) : isSent ? (
                                <>
                                  <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                                  <span>تم الإرسال ({fStatus.cooldownRemaining || 10}ث)</span>
                                </>
                              ) : (
                                <>
                                  <Swords className="w-3 h-3" />
                                  <span>إرسال دعوة</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs md:text-sm font-black text-slate-800">المتسابقون ({room?.participants?.length || 1})</span>
            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {(room?.participants || []).map((p: any, i: number) => {
              const isMe = p?.id === (playerUsername || playerName) || p?.name === playerName;
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

