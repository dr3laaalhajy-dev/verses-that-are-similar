import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Lock, Globe, Loader2, Trash2, ArrowRight, LogOut,
  UserPlus, ChevronDown, ChevronUp, Check, Swords, Sparkles, Clock, X, UserX,
  Info, Settings, BookOpen, Layers, Zap, Hash
} from 'lucide-react';
import { View } from '../types/challenges';
import { LiveReactionsOverlay } from '../components/LiveReactionsOverlay';
import { friendsRealtimeService } from '../services/friendsRealtimeService';
import { supabase } from '../services/supabase';
import { useApp, toast } from '../contexts/AppContext';

export interface FriendInviteStateItem {
  status: 'idle' | 'sent' | 'declined' | 'accepted';
  cooldownRemaining?: number;
  dnd?: boolean;
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
  const [kickingPlayerId, setKickingPlayerId] = useState<string | number | null>(null);

  // Resilient determination of creator/host status that persists across re-renders
  const currentMyId = String(app?.playerId || localStorage.getItem('quran_player_id') || '');
  const currentMyUser = String(playerUsername || localStorage.getItem('quran_player_username') || '').toLowerCase().replace(/^@+/, '');
  const currentMyName = String(playerName || localStorage.getItem('quran_player_name') || '').trim().toLowerCase();
  const currentMyUnique = String(app?.uniquePlayerId || localStorage.getItem('quran_unique_player_id') || '').toUpperCase();

  const creatorId = String(room?.creator_id || room?.player1Id || room?.player1_id || room?.hostId || room?.host_id || room?.player1?.id || '');
  const creatorUser = String(room?.player1?.username || room?.hostUsername || room?.creator_username || '').toLowerCase().replace(/^@+/, '');
  const creatorName = String(room?.player1?.name || room?.hostName || room?.creator_name || '').trim().toLowerCase();

  const isCreator = Boolean(
    (creatorId && currentMyId && creatorId === currentMyId) ||
    (creatorUser && currentMyUser && creatorUser === currentMyUser) ||
    (creatorName && currentMyName && creatorName === currentMyName) ||
    (creatorId && (creatorId === currentMyUser || creatorId === currentMyName || creatorId === currentMyUnique)) ||
    (room?.isHost === true) ||
    (room?.id && sessionStorage.getItem(`is_creator_${room.id}`) === 'true')
  );

  // Room Info & Edit Modals State
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [editedName, setEditedName] = useState('');
  const [editedTopic, setEditedTopic] = useState('');
  const [editedQuestionCount, setEditedQuestionCount] = useState(5);
  const [editedTimePerQuestion, setEditedTimePerQuestion] = useState(0);
  const [editedTransitionMode, setEditedTransitionMode] = useState('SYNC');
  const [editedGameMode, setEditedGameMode] = useState('STANDARD');

  // Synchronize room settings into edit form state
  useEffect(() => {
    if (room) {
      setEditedName(room.name || 'غرفة التحدي');
      setEditedTopic(room.categoryFilter || room.category || '');
      setEditedQuestionCount(Number(room.questionCount) || 5);
      setEditedTimePerQuestion(Number(room.timePerQuestion) || 0);
      setEditedTransitionMode(room.transitionMode || 'SYNC');
      setEditedGameMode(room.gameMode || 'STANDARD');
    }
  }, [room?.id, room?.name, room?.categoryFilter, room?.questionCount, room?.timePerQuestion, room?.transitionMode, room?.gameMode]);

  const formatGameModeName = (mode: string) => {
    switch (String(mode || '').toUpperCase()) {
      case 'COMPLETION':
      case 'COMPLETE':
        return 'إكمال الآية الكريمة';
      case 'SURAH':
        return 'تحديد اسم السورة';
      case 'AUDIO':
        return 'تحدي التلاوة الصوتية';
      case 'WHO_AM_I':
        return 'تحدي من أنا؟';
      case 'ISLAMIC':
        return 'معلومات إسلامية عامة';
      case 'STANDARD':
      default:
        return 'تحدي المتشابهات (اختيار متعدد)';
    }
  };

  const handleSaveRoomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room?.id || !isCreator) return;

    setIsSavingSettings(true);
    try {
      const updatePayload: any = {
        name: editedName.trim() || 'غرفة التحدي',
        categoryFilter: editedTopic.trim(),
        questionCount: Number(editedQuestionCount) || 5,
        timePerQuestion: Number(editedTimePerQuestion) || 0,
        transitionMode: editedTransitionMode || 'SYNC',
        gameMode: editedGameMode || 'STANDARD'
      };

      const { error } = await supabase
        .from('rooms')
        .update(updatePayload)
        .eq('id', room.id);

      if (error) {
        console.error('Failed to update room settings:', error);
        toast.error('فشل حفظ الإعدادات: ' + error.message);
        return;
      }

      // Optimistic local update without dropping connection
      setRoom((prev: any) => prev ? {
        ...prev,
        ...updatePayload
      } : prev);

      // Broadcast update on room channel so all participants receive it immediately
      try {
        const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:room_sync_${room.id}`);
        if (existingChannel && existingChannel.state === 'joined') {
          existingChannel.send({
            type: 'broadcast',
            event: 'room_settings_updated',
            payload: updatePayload
          }).catch(() => {});
        }
      } catch (_) {}

      toast.success('تم تحديث إعدادات الغرفة بنجاح');
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Error saving room settings:', err);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Requirement 2: Function to kick player from room and invalidate invitation
  const handleKickPlayer = async (targetPlayer: any) => {
    if (!room?.id || !targetPlayer) return;
    const confirmKick = window.confirm(`هل أنت متأكد من طرد اللاعب "${targetPlayer.name || 'اللاعب'}" من الغرفة؟`);
    if (!confirmKick) return;

    setKickingPlayerId(targetPlayer.id);
    try {
      // Send numeric playerId first (most reliable), then username/name as fallbacks
      // The server findPlayer() supports all three formats
      const myHostId =
        app?.playerId != null ? app.playerId :
        app?.uniquePlayerId || playerUsername || playerName;

      const res = await fetch('/api/1v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kick-player',
          roomId: room.id,
          hostId: myHostId,
          targetPlayerId: targetPlayer.id,
          targetPlayerName: targetPlayer.name
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`تم طرد ${targetPlayer.name || 'اللاعب'} من الغرفة بنجاح`);
        if (data.room) {
          setRoom(data.room);
        } else {
          setRoom((prev: any) => ({
            ...prev,
            participants: (prev?.participants || []).filter((p: any) => String(p.id) !== String(targetPlayer.id) && p.name !== targetPlayer.name)
          }));
        }
      } else {
        toast.error(data.error || data.message || 'فشل طرد اللاعب');
      }
    } catch (e: any) {
      console.error('Error kicking player:', e);
      toast.error('حدث خطأ أثناء محاولة طرد اللاعب');
    } finally {
      setKickingPlayerId(null);
    }
  };

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
        // Requirement 2: In case of explicit decline, check doNotDisturb.
        // If true: disable button for 300s (5m) and show 'لا يمكن الإزعاج حالياً'. If false: 30s.
        else if (response.event === 'invite_declined') {
          const isDnd = Boolean(response.doNotDisturb);
          setInviteStatuses(prev => ({
            ...prev,
            [fId]: {
              status: 'declined' as const,
              cooldownRemaining: isDnd ? 300 : 30,
              dnd: isDnd
            }
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

    // B) Direct Supabase channel listener for `room_sync_${room.id}`
    const channelName = `room_sync_${room.id}`;
    const roomChannel = supabase.channel(channelName);

    // Helper: given a new rooms row, rebuild the participants array by merging
    // existing participants with any new player IDs found in playersProgress.
    const syncParticipants = async (newRoomRow: any, prevParticipants: any[]) => {
      const prog: Record<string, any> = newRoomRow?.playersProgress || {};
      const kickedList: string[] = Array.isArray(prog.__kicked) ? prog.__kicked : [];

      // Collect numeric player IDs from playersProgress keys (skip meta keys like __kicked)
      const progIds = Object.keys(prog)
        .filter(k => !k.startsWith('__'))
        .map(k => parseInt(k))
        .filter(n => !isNaN(n) && n > 0);

      // Always include player1Id
      if (newRoomRow?.player1Id && !progIds.includes(Number(newRoomRow.player1Id))) {
        progIds.push(Number(newRoomRow.player1Id));
      }

      // Find IDs not yet in the participants list
      const existingIds = new Set(prevParticipants.map((p: any) => Number(p.id)));
      const missingIds = progIds.filter(id => !existingIds.has(id));

      let newEntries: any[] = [];
      if (missingIds.length > 0) {
        try {
          const { data } = await supabase
            .from('players')
            .select('id, name, username, uniquePlayerId, activeFrame, seerahCompleted, generalCompleted')
            .in('id', missingIds);
          newEntries = (data || []).map((p: any) => ({
            ...p,
            isOnline: true,
            status: 'joined',
            score: prog[String(p.id)]?.score || 0
          }));
        } catch (_) {}
      }

      // Remove kicked players and merge new ones
      const merged = [
        ...prevParticipants.filter((p: any) => {
          const pIdStr = String(p.id);
          const pName = String(p.name || '').trim().toLowerCase();
          const pUser = String(p.username || '').trim().toLowerCase().replace(/^@+/, '');
          return !kickedList.includes(pIdStr) && !kickedList.includes(pName) && !kickedList.includes(pUser);
        }),
        ...newEntries
      ];

      // Deduplicate by id
      const seen = new Set<number>();
      return merged.filter((p: any) => {
        const n = Number(p.id);
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });
    };

    roomChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, async (payload: any) => {
        if (!payload?.new) return;
        const newRow = payload.new;

        // We need current participants — capture via a ref snapshot before async work
        setRoom((prev: any) => {
          // Schedule async update: fetch missing players then apply
          (async () => {
            const updatedParticipants = await syncParticipants(newRow, prev?.participants || []);
            setRoom((p: any) => p ? {
              ...p,
              ...newRow,
              player1: p?.player1 || newRow.player1,
              participants: updatedParticipants
            } : p);
          })();
          // Synchronous interim update: merge room fields, keep existing participants
          return prev ? {
            ...prev,
            ...newRow,
            player1: prev?.player1 || newRow.player1,
            participants: prev?.participants || []
          } : prev;
        });
      })
      .on('broadcast', { event: 'room_settings_updated' }, ({ payload }) => {
        if (!payload) return;
        setRoom((prev: any) => prev ? {
          ...prev,
          ...payload
        } : prev);
        toast.info('قام المنشئ بتحديث إعدادات الغرفة');
      })
      .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
        // A player accepted invite and joined — add them to participants immediately
        if (!payload) return;
        const joinedId   = payload.playerId   || payload.userId;
        const joinedName = payload.playerName || payload.name;
        if (!joinedId && !joinedName) return;

        setRoom((prev: any) => {
          if (!prev) return prev;
          const existing = (prev.participants || []).some((p: any) =>
            (joinedId   && String(p.id) === String(joinedId)) ||
            (joinedName && p.name && p.name.trim().toLowerCase() === String(joinedName).trim().toLowerCase())
          );
          if (existing) return prev;
          const newParticipant = {
            id: joinedId,
            name: joinedName || payload.name || 'متسابق',
            username: payload.playerUsername || payload.username || null,
            isOnline: true,
            status: 'joined',
            score: 0
          };
          return { ...prev, participants: [...(prev.participants || []), newParticipant] };
        });

        // Reset invite status so button returns to idle
        const match = friendsList.find(f =>
          (joinedId   && String(f.id) === String(joinedId)) ||
          (joinedName && f.name && f.name.trim().toLowerCase() === String(joinedName).trim().toLowerCase())
        );
        const target = match ? match.id : joinedId;
        if (target) {
          setInviteStatuses(prev => {
            const next = { ...prev };
            delete next[target];
            return next;
          });
        }
      })
      .on('broadcast', { event: 'player_left' }, ({ payload }) => {
        if (!payload) return;
        const leftId = payload.playerId || payload.friendId || payload.userId;
        const leftName = payload.playerName || payload.friendName || payload.name;

        // Remove from participants immediately on leave
        if (leftId || leftName) {
          setRoom((prev: any) => {
            if (!prev) return prev;
            const updatedParts = (prev.participants || []).filter((p: any) =>
              !(leftId   && String(p.id) === String(leftId)) &&
              !(leftName && p.name && p.name.trim().toLowerCase() === String(leftName).trim().toLowerCase())
            );
            return { ...prev, participants: updatedParts };
          });
        }

        const match = friendsList.find(f =>
          (leftId   && String(f.id) === String(leftId)) ||
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
      .on('broadcast', { event: 'player_kicked' }, ({ payload }) => {
        if (!payload) return;
        const myIds = [
          String(app?.playerId || ''),
          String(playerUsername || '').toLowerCase().replace(/^@+/, ''),
          String(playerName || '').trim().toLowerCase(),
          String(app?.uniquePlayerId || '').toUpperCase()
        ].filter(Boolean);

        const kickedTargets = [
          String(payload.playerId || ''),
          String(payload.targetPlayerId || ''),
          String(payload.playerUsername || '').toLowerCase().replace(/^@+/, ''),
          String(payload.playerName || '').trim().toLowerCase()
        ].filter(Boolean);

        const amIKicked = myIds.some(id => kickedTargets.includes(id));
        if (amIKicked) {
          toast.error('تم إخراجك من الغرفة من قِبل المنشئ');
          setRoom(null);
          localStorage.removeItem('activeRoomId');
          setView('home');
          return;
        }

        // Another player was kicked: update participants list immediately
        setRoom((prev: any) => {
          if (!prev) return prev;
          const updatedParts = (prev.participants || []).filter((p: any) =>
            !kickedTargets.includes(String(p.id)) &&
            !kickedTargets.includes(String(p.name || '').trim().toLowerCase()) &&
            !kickedTargets.includes(String(p.username || '').trim().toLowerCase().replace(/^@+/, ''))
          );
          return { ...prev, participants: updatedParts };
        });

        // Reset invite status for kicked player if in friends list
        const match = friendsList.find(f =>
          (payload.playerId && String(f.id) === String(payload.playerId)) ||
          (payload.playerName && f.name && f.name.trim().toLowerCase() === String(payload.playerName).trim().toLowerCase())
        );
        if (match) {
          setInviteStatuses(prev => {
            const next = { ...prev };
            delete next[match.id];
            return next;
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[GroupWaitingPage] تم الاتصال بالغرفة بنجاح: ${channelName}`);
        }
      });

    return () => {
      try {
        if (roomChannel) {
          supabase.removeChannel(roomChannel);
        }
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
      const senderId = app?.playerId || playerUsername || playerName || '';
      const receiverId = friend.id || friend.uniquePlayerId || friend.username;

      // Backend enforcement: Check if receiver enabled Do Not Disturb (429 status)
      // Also triggers pardon logic if the receiver was previously kicked from this room
      try {
        const checkRes = await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-invite',
            senderId: String(senderId),
            receiverId: String(receiverId),
            roomId: room.id  // allows backend to pardon kicked player if host re-invites
          })
        });

        if (checkRes.status === 429) {
          const errData = await checkRes.json();
          const rem = errData.cooldownRemaining || 300;
          setInviteStatuses(prev => ({
            ...prev,
            [friend.id]: {
              status: 'declined',
              cooldownRemaining: rem,
              dnd: true
            }
          }));
          return;
        }
      } catch (checkErr) {
        console.warn('Could not verify DND status with backend:', checkErr);
      }

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

        <div className="bg-slate-50 p-3.5 sm:p-5 rounded-2xl mb-4 sm:mb-6 border border-slate-100 shadow-inner text-right space-y-2.5">
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

          {/* Action buttons: Room Details & Edit Settings */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsInfoModalOpen(true)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              title="عرض معلومات وتفاصيل الغرفة"
            >
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>تفاصيل الغرفة</span>
            </button>

            {isCreator && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="تعديل إعدادات ونوع التحدي للغرفة"
              >
                <Settings className="w-3.5 h-3.5 text-amber-600" />
                <span>تعديل الإعدادات</span>
              </button>
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
                                  <span>
                                    {fStatus.dnd
                                      ? `لا يمكن الإزعاج حالياً (${fStatus.cooldownRemaining || 300}ث)`
                                      : `تم الرفض (${fStatus.cooldownRemaining || 30}ث)`}
                                  </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {(room?.participants || []).map((p: any, i: number) => {
              const isMe = p?.id === (playerUsername || playerName) || p?.name === playerName || String(p?.id) === currentMyId || (p?.username && currentMyUser && p.username.toLowerCase().replace(/^@+/, '') === currentMyUser);
              const nameColorToDisplay = isMe ? (equippedNameColor || p?.equippedNameColor) : p?.equippedNameColor;
              const isThisPlayerCreator = String(p?.id) === creatorId || (p?.name && creatorName && p.name.trim().toLowerCase() === creatorName) || p?.id === room?.player1Id;

              return (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={p?.id || i}
                  className="flex items-center justify-between gap-2 p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-xs min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0 text-right flex-1">
                      <span
                        className="font-bold text-slate-700 dark:text-slate-100 text-xs sm:text-sm truncate block"
                        style={nameColorToDisplay ? { color: nameColorToDisplay } : undefined}
                      >
                        {p?.name || 'لاعب'} {isMe && '(أنت)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isThisPlayerCreator ? (
                      <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded shrink-0">المنشئ</span>
                    ) : (
                      isCreator && !isMe && (
                        <button
                          type="button"
                          onClick={() => handleKickPlayer(p)}
                          disabled={kickingPlayerId === p?.id}
                          title="طرد اللاعب من الغرفة"
                          className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all active:scale-95 flex items-center gap-1 text-[11px] font-black cursor-pointer shrink-0"
                        >
                          {kickingPlayerId === p?.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-red-600" />
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5 text-red-500" />
                              <span>طرد</span>
                            </>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Fixed / Sticky Action Controls at bottom */}
        <div className="sticky bottom-2 sm:bottom-4 z-30 pt-3 pb-1 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 sm:p-3.5 space-y-2 mt-4">
          {isCreator ? (
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

      {/* Room Details Modal (For All Players) */}
      <AnimatePresence>
        {isInfoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-100 text-right space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">تفاصيل الغرفة</h3>
                    <p className="text-[11px] text-slate-400 font-bold">إعدادات وقواعد التحدي الحالي</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInfoModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">اسم الغرفة:</span>
                  <span className="font-black text-slate-800">{room?.name || 'غرفة التحدي'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">رمز الدخول (Code):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-sm">{room?.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (room?.code) navigator.clipboard.writeText(room.code);
                        toast.success('تم نسخ رمز الغرفة');
                      }}
                      className="text-[11px] text-amber-600 font-bold underline cursor-pointer"
                    >
                      نسخ
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">نوع التحدي:</span>
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {formatGameModeName(room?.gameMode)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">التصنيف / الفئة:</span>
                  <span className="font-black text-slate-800">
                    {room?.categoryFilter || room?.category || 'جميع التصنيفات العامة'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">عدد الأسئلة:</span>
                  <span className="font-black text-slate-800">{room?.questionCount || 5} أسئلة</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">الوقت لكل سؤال:</span>
                  <span className="font-black text-slate-800">
                    {room?.timePerQuestion && Number(room.timePerQuestion) > 0 ? `${room.timePerQuestion} ثانية` : 'بدون وقت محدد (مفتوح)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">نمط الانتقال:</span>
                  <span className="font-black text-slate-800">
                    {room?.transitionMode === 'ASYNC' ? 'سباق فردي سريع (ASYNC)' : 'تزامن جماعي (SYNC)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">نوع الغرفة:</span>
                  <span className="font-black text-slate-800">
                    {room?.isPrivate ? 'غرفة خاصة برمز سري 🔒' : 'غرفة عامة مفتوحة للجميع 🌐'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-bold">منشئ الغرفة:</span>
                  <span className="font-black text-slate-800">{room?.player1?.name || room?.hostName || 'المنشئ'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Room Settings Modal (For Creator Only) */}
      <AnimatePresence>
        {isEditModalOpen && isCreator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-100 text-right space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">تعديل إعدادات الغرفة</h3>
                    <p className="text-[11px] text-slate-400 font-bold">تحديث فوري لجميع المتسابقين في القاعة</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingSettings}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRoomSettings} className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم الغرفة:</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="اسم الغرفة..."
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none font-bold text-slate-800 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع التحدي:</label>
                  <select
                    value={editedGameMode}
                    onChange={(e) => setEditedGameMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald outline-none font-bold text-slate-800 bg-white text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="STANDARD">تحدي المتشابهات (اختيار متعدد)</option>
                    <option value="COMPLETION">إكمال الآية الكريمة</option>
                    <option value="SURAH">تحديد اسم السورة</option>
                    <option value="AUDIO">تحدي التلاوة الصوتية</option>
                    <option value="WHO_AM_I">تحدي من أنا؟</option>
                    <option value="ISLAMIC">معلومات إسلامية عامة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">التصنيف / الفئة (Topic):</label>
                  <input
                    type="text"
                    value={editedTopic}
                    onChange={(e) => setEditedTopic(e.target.value)}
                    placeholder="مثال: سورة البقرة، جزء عم، الصحابة..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald outline-none font-bold text-slate-800 text-xs sm:text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-bold">اتركه فارغاً لاختيار أسئلة عشوائية من جميع الأقسام</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">عدد الأسئلة:</label>
                    <select
                      value={editedQuestionCount}
                      onChange={(e) => setEditedQuestionCount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald outline-none font-bold text-slate-800 bg-white text-xs sm:text-sm cursor-pointer"
                    >
                      <option value={3}>3 أسئلة</option>
                      <option value={5}>5 أسئلة</option>
                      <option value={10}>10 أسئلة</option>
                      <option value={15}>15 سؤالاً</option>
                      <option value={20}>20 سؤالاً</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">وقت السؤال:</label>
                    <select
                      value={editedTimePerQuestion}
                      onChange={(e) => setEditedTimePerQuestion(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald outline-none font-bold text-slate-800 bg-white text-xs sm:text-sm cursor-pointer"
                    >
                      <option value={0}>بدون وقت (مفتوح)</option>
                      <option value={10}>10 ثوانٍ</option>
                      <option value={15}>15 ثانية</option>
                      <option value={20}>20 ثانية</option>
                      <option value={30}>30 ثانية</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">نمط الانتقال:</label>
                  <select
                    value={editedTransitionMode}
                    onChange={(e) => setEditedTransitionMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-brand-emerald outline-none font-bold text-slate-800 bg-white text-xs sm:text-sm cursor-pointer"
                  >
                    <option value="SYNC">تزامن جماعي (جميع اللاعبين ينتقلون معاً)</option>
                    <option value="ASYNC">سباق فردي سريع (كل لاعب ينهي بسرعة)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="flex-1 py-2.5 rounded-xl bg-brand-emerald hover:bg-brand-emerald/90 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>حفظ التعديلات</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isSavingSettings}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GroupWaitingPage;

