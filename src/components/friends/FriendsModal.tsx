import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, UserPlus, UserCheck, X, Check, Copy, Flame,
  Trophy, Star, Clock, AlertCircle, Loader2, CheckCircle2, UserX
} from 'lucide-react';
import { friendsRealtimeService } from '../../services/friendsRealtimeService';

export interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: {
    id?: number;
    name?: string | null;
    username?: string | null;
    uniquePlayerId?: string | null;
  } | null;
  onOpenPlayerProfile: (player: any) => void;
  onInviteFriendToRoom?: (friend: any) => void;
  isInRoomLobby?: boolean;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  currentPlayer,
  onOpenPlayerProfile,
  onInviteFriendToRoom,
  isInRoomLobby = false
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);
  const [copiedMyId, setCopiedMyId] = useState(false);
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(new Set());

  // Listen to realtime presence
  useEffect(() => {
    const unsubscribe = friendsRealtimeService.onPresenceChange((keys) => {
      setOnlineKeys(new Set(keys));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const isPlayerOnline = (player: any) => {
    return friendsRealtimeService.isPlayerOnline(player);
  };

  // Fetch friends & requests
  const fetchFriendsData = useCallback(async () => {
    if (!currentPlayer) return;
    setIsLoadingData(true);
    try {
      const viewerParam = currentPlayer.uniquePlayerId || currentPlayer.username || currentPlayer.name || currentPlayer.id;
      const res = await fetch(`/api/friends?action=list&viewerId=${encodeURIComponent(String(viewerParam))}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data.friends || []);
        setIncomingRequests(data.incomingRequests || []);
      }
    } catch (e) {
      console.error('Error fetching friends list:', e);
    } finally {
      setIsLoadingData(false);
    }
  }, [currentPlayer]);

  useEffect(() => {
    if (isOpen) {
      fetchFriendsData();
    }
  }, [isOpen, fetchFriendsData]);

  // Handle Search
  const handleSearch = async (queryText: string) => {
    setSearchQuery(queryText);
    const trimmed = queryText.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const viewerParam = currentPlayer?.uniquePlayerId || currentPlayer?.username || currentPlayer?.name || '';
      const res = await fetch(`/api/friends?action=search&q=${encodeURIComponent(trimmed)}&viewerId=${encodeURIComponent(String(viewerParam))}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('Error searching players:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Send friend request from search card
  const handleSendRequest = async (target: any) => {
    if (!currentPlayer) return;
    setActionLoadingId(target.id);
    try {
      const requesterId = currentPlayer.uniquePlayerId || currentPlayer.username || currentPlayer.name;
      const targetId = target.uniquePlayerId || target.username || target.name || target.id;

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
        // Optimistically update the button state
        setSearchResults(prev =>
          prev.map(p => p.id === target.id ? { ...p, status: data.status || 'PENDING_SENT' } : p)
        );
        fetchFriendsData();
      }
    } catch (e) {
      console.error('Error sending friend request:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Respond to request (accept / decline)
  const handleRespondRequest = async (request: any, response: 'ACCEPT' | 'DECLINE') => {
    if (!currentPlayer) return;
    setActionLoadingId(request.friendshipId || request.id);
    try {
      const viewerId = currentPlayer.uniquePlayerId || currentPlayer.username || currentPlayer.name;
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond-request',
          viewerId,
          friendshipId: request.friendshipId,
          requesterId: request.id,
          response
        })
      });
      if (res.ok) {
        setIncomingRequests(prev => prev.filter(r => (r.friendshipId || r.id) !== (request.friendshipId || request.id)));
        if (response === 'ACCEPT') {
          fetchFriendsData();
        }
      }
    } catch (e) {
      console.error('Error responding to friend request:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyMyId = () => {
    if (currentPlayer?.uniquePlayerId) {
      navigator.clipboard.writeText(currentPlayer.uniquePlayerId);
      setCopiedMyId(true);
      setTimeout(() => setCopiedMyId(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#151518] rounded-3xl shadow-2xl border border-amber-200/40 dark:border-amber-500/20 overflow-hidden flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-800/10 via-amber-500/5 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-right">
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                  نظام الأصدقاء والتحديات
                </h3>
                {currentPlayer?.uniquePlayerId && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-400 font-bold">معرّفك:</span>
                    <button
                      onClick={handleCopyMyId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 text-amber-800 dark:text-amber-200 font-mono font-black text-xs hover:bg-amber-100 transition-all cursor-pointer"
                    >
                      <span>{currentPlayer.uniquePlayerId}</span>
                      {copiedMyId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-amber-600" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 sm:p-4 pb-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="ابحث بالمعرّف الفريد (مثال: MT-1A2B) أو الاسم..."
                className="w-full pr-10 pl-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin absolute left-3.5 top-3" />
              )}
              {searchQuery && !isSearching && (
                <button
                  onClick={() => handleSearch('')}
                  className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center absolute left-3 top-2.5 cursor-pointer text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tabs: "أصدقائي" and "الطلبات الواردة" */}
          <div className="flex items-center px-4 border-b border-slate-150 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('friends')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'friends'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span>أصدقائي</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                {friendsList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'requests'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span>الطلبات الواردة</span>
              {incomingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-black animate-pulse">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[220px]">
            {/* 1. If actively searching, show search results */}
            {searchQuery.trim().length > 0 ? (
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-2">نتائج البحث ({searchResults.length})</div>
                {searchResults.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-bold">
                    لم يتم العثور على لاعبين مطابقين للبحث
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((player) => {
                      const isOnline = isPlayerOnline(player);
                      const isActioning = actionLoadingId === player.id;
                      return (
                        <div
                          key={player.id}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 flex items-center justify-between gap-2.5 shadow-xs hover:border-emerald-300 transition-all"
                        >
                          {/* Player info (clickable to open profile) */}
                          <div
                            onClick={() => onOpenPlayerProfile(player)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                {(player.name || 'ل').charAt(0).toUpperCase()}
                              </div>
                              {/* Online Presence Indicator */}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={isOnline ? '🟢 متصل الآن' : 'غير متصل'}
                              />
                            </div>

                            <div className="text-right min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                                  {player.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-0.5">
                                {player.uniquePlayerId && (
                                  <span className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                                    {player.uniquePlayerId}
                                  </span>
                                )}
                                <span>⭐️ {player.points || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0">
                            {player.status === 'ACCEPTED' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>صديق</span>
                              </span>
                            ) : player.status === 'PENDING_SENT' ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-black border border-amber-200">
                                <span>تم الإرسال ✓</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(player)}
                                disabled={isActioning}
                                className="px-3 py-1.5 bg-brand-emerald hover:bg-brand-emerald/90 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              >
                                {isActioning ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="w-3.5 h-3.5" />
                                )}
                                <span>إضافة صديق</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'friends' ? (
              // 2. Friends Tab
              <div>
                {isLoadingData ? (
                  <div className="py-10 text-center">
                    <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-bold">جاري تحميل قائمة الأصدقاء...</p>
                  </div>
                ) : friendsList.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs sm:text-sm text-slate-400 font-bold">لا يوجد لديك أصدقاء مضافون بعد</p>
                    <p className="text-[11px] text-slate-400">استخدم شريط البحث أعلاه بالمعرّف الفريد أو الاسم لإضافة أصدقائك!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendsList.map((friend) => {
                      const isOnline = isPlayerOnline(friend);
                      return (
                        <div
                          key={friend.id}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 flex items-center justify-between gap-2.5 shadow-xs hover:border-emerald-300 transition-all"
                        >
                          {/* Info (clickable to view profile) */}
                          <div
                            onClick={() => onOpenPlayerProfile(friend)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                {(friend.name || 'ل').charAt(0).toUpperCase()}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={isOnline ? '🟢 متصل الآن' : 'غير متصل'}
                              />
                            </div>

                            <div className="text-right min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                                  {friend.name}
                                </span>
                                {isOnline && (
                                  <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md">
                                    متصل
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-0.5">
                                {friend.uniquePlayerId && (
                                  <span className="font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                                    {friend.uniquePlayerId}
                                  </span>
                                )}
                                <span>⭐️ {friend.points || 0}</span>
                                <span>🔥 {friend.streak || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Button: In Waiting Lobby -> Invite to Room, otherwise View Profile */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isInRoomLobby && onInviteFriendToRoom && (
                              <button
                                onClick={() => onInviteFriendToRoom(friend)}
                                disabled={!isOnline}
                                title={isOnline ? 'دعوة للغرفة' : 'اللاعب غير متصل حالياً'}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer ${
                                  isOnline
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                              >
                                {isOnline ? 'دعوة للتحدي' : 'غير متصل'}
                              </button>
                            )}
                            <button
                              onClick={() => onOpenPlayerProfile(friend)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              الملف الشخصي
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              // 3. Incoming Requests Tab
              <div>
                {incomingRequests.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs sm:text-sm text-slate-400 font-bold">لا توجد طلبات صداقة واردة جديدة</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incomingRequests.map((req) => {
                      const isActioning = actionLoadingId === (req.friendshipId || req.id);
                      return (
                        <div
                          key={req.friendshipId || req.id}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 flex items-center justify-between gap-2.5 shadow-xs"
                        >
                          <div
                            onClick={() => onOpenPlayerProfile(req)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                              {(req.name || 'ل').charAt(0).toUpperCase()}
                            </div>
                            <div className="text-right min-w-0">
                              <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate block">
                                {req.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {req.uniquePlayerId || `@${req.username}`}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            <button
                              onClick={() => handleRespondRequest(req, 'ACCEPT')}
                              disabled={isActioning}
                              className="px-3 py-1.5 bg-brand-emerald hover:bg-brand-emerald/90 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                            >
                              {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              <span>قبول</span>
                            </button>
                            <button
                              onClick={() => handleRespondRequest(req, 'DECLINE')}
                              disabled={isActioning}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              رفض
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FriendsModal;

