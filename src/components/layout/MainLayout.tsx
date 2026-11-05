import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Sun, Moon, Info, Lock, ArrowRight, BookOpen, LogOut, Trash2,
  UserPlus, Key, User, AtSign, ArrowLeft, LogIn, Home, Zap, Settings,
  ChevronRight, ChevronLeft, X, Users, ShieldCheck
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import DailyAyah from '../DailyAyah';
import { PullToRefresh } from '../PullToRefresh';
import QuranZoomViewer from '../QuranZoomViewer';
import { NotificationBell } from '../NotificationBell';
import { Link } from '../common/Link';
import { router } from '../../services/router';
import { supabase } from '../../services/supabase';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const app = useApp();

  // State to hold the count of pending incoming friend requests
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState<number>(() => app.pendingFriendRequestsCount || 0);

  // Sync state when updated via AppContext (e.g. from FriendsModal accept/reject actions)
  useEffect(() => {
    if (typeof app.pendingFriendRequestsCount === 'number') {
      setPendingFriendRequestsCount(app.pendingFriendRequestsCount);
    }
  }, [app.pendingFriendRequestsCount]);

  // Fetch pending friend requests from Supabase & backend API
  const fetchPendingFriendRequests = useCallback(async () => {
    // 2. حماية الاستعلام بشرط الجلسة والمستخدم (Session Check)
    const user = app.playerName || app.playerUsername || app.playerId;
    const session = user;
    if (!user || !session) {
      setPendingFriendRequestsCount(0);
      if (app.setPendingFriendRequestsCount) app.setPendingFriendRequestsCount(0);
      return;
    }

    const viewerId = app.playerId || app.uniquePlayerId || app.playerUsername || app.playerName;
    if (!viewerId) return;

    // 3. عزل الأخطاء (Safe Try-Catch)
    // 1. استعلام Supabase: التحقق من طلبات الصداقة المعلقة
    try {
      const { count, data, error } = await supabase
        .from('friendships')
        .select('*', { count: 'exact' })
        .or(`addresseeId.eq.${viewerId},receiver_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
        .in('status', ['pending', 'PENDING']);

      if (error) {
        // تسجيل الخطأ بهدوء في الكونسول دون رمي استثناء قد يعطل تسجيل الخروج أو باقي دوال التطبيق
        console.error('[Friendships] Supabase query error:', error.message || error);
      } else if (typeof count === 'number' || Array.isArray(data)) {
        const total = typeof count === 'number' ? count : (Array.isArray(data) ? (data as any[]).length : 0);
        setPendingFriendRequestsCount(total);
        if (app.setPendingFriendRequestsCount) app.setPendingFriendRequestsCount(total);
        return;
      }
    } catch (err) {
      console.error('[Friendships] Safe catch error:', err);
    }

    // 2. Primary / Fallback API: Fetch from backend API (/api/friends?action=list)
    try {
      const res = await fetch(`/api/friends?action=list&viewerId=${encodeURIComponent(String(viewerId))}`);
      if (res.ok) {
        const data = await res.json();
        const incoming = (data.incomingRequests || []).length;
        setPendingFriendRequestsCount(incoming);
        if (app.setPendingFriendRequestsCount) app.setPendingFriendRequestsCount(incoming);
      }
    } catch (e) {
      console.error('[Friendships] Safe catch - API fetch error:', e);
    }
  }, [app.playerId, app.uniquePlayerId, app.playerUsername, app.playerName, app.setPendingFriendRequestsCount]);

  useEffect(() => {
    if (!app.playerName) {
      setPendingFriendRequestsCount(0);
      return;
    }

    fetchPendingFriendRequests();

    // Subscribe to Supabase Realtime updates on 'friendships'
    let channel: any = null;
    try {
      channel = supabase
        .channel('realtime_friendships_badge')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          () => {
            fetchPendingFriendRequests();
          }
        )
        .on(
          'broadcast',
          { event: 'FRIEND_REQUEST_UPDATED' },
          () => {
            fetchPendingFriendRequests();
          }
        )
        .subscribe();
    } catch (err) {
      console.error('[Friendships] Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error('[Friendships] Remove channel error:', e);
        }
      }
    };
  }, [app.playerName, fetchPendingFriendRequests]);

  return (
    <>
      {/* Top Header */}
      {!app.isMushafFullscreen && (
        <header className="w-full sticky top-0 z-50 bg-[#064e3b]/90 dark:bg-obsidian-950/90 text-white dark:text-regalGold-100 shadow-xl border-b border-white/10 dark:border-regalGold-500/20 backdrop-blur-xl transition-colors duration-500 pt-[env(safe-area-inset-top,0px)]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 dark:bg-regalGold-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
          <div className="w-full max-w-full box-border px-3.5 sm:px-6 md:px-8 pl-[max(0.875rem,env(safe-area-inset-left))] pr-[max(0.875rem,env(safe-area-inset-right))] py-2 flex items-center justify-between gap-1.5 sm:gap-4 relative z-10">

            {/* Logo & Title */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              onClick={() => {
                app.setView('home');
                app.setShowScores(false);
                app.setShowSettings(false);
              }}
              className="flex items-center gap-1.5 sm:gap-3 shrink-0 cursor-pointer group"
              title="تطبيق متين"
            >
              <div className="bg-white dark:bg-obsidian-900 p-1 sm:p-1.5 rounded-xl md:rounded-2xl shadow-lg border border-white/60 dark:border-regalGold-500/30 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <img src="/logo.png" className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain" alt="شعار متين" />
              </div>
              <div className="flex flex-col justify-center select-none">
                <div className="flex items-center">
                  <img
                    src="/matin-title-light.png"
                    className="h-6 sm:h-7 md:h-8 w-auto object-contain drop-shadow-md"
                    alt="متين"
                  />
                </div>
                <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold tracking-[0.2em] text-brand-gold/90 dark:text-regalGold-400 leading-none mt-1 whitespace-nowrap">
                  لعلوم القرآن الكريم
                </p>
              </div>
            </motion.div>

            {/* Navigation Actions & Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-0.5">
              {/* About App Modal Trigger */}
              <button
                onClick={() => app.setShowAboutModal(true)}
                className="h-9 w-9 sm:h-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-obsidian-900/70 dark:hover:bg-obsidian-850 text-white dark:text-regalGold-200 border border-white/10 dark:border-regalGold-500/20 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                title="عن التطبيق"
                aria-label="عن التطبيق"
              >
                <Info className="w-4 h-4 text-white dark:text-regalGold-300" />
                <span className="hidden sm:inline">عن التطبيق</span>
              </button>

              {/* Dark Mode / Light Mode Toggle Button */}
              <button
                onClick={() => app.setLibrarySettings((prev: any) => ({ ...prev, darkMode: !prev.darkMode }))}
                className="h-9 w-9 sm:h-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-obsidian-900/70 dark:hover:bg-obsidian-850 text-white dark:text-regalGold-200 border border-white/10 dark:border-regalGold-500/20 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                title={app.librarySettings.darkMode ? 'التبديل إلى الوضع الفاتح (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
                aria-label="تبديل الوضع الداكن والفاتح"
              >
                {app.librarySettings.darkMode ? (
                  <Sun className="w-4 h-4 text-regalGold-400" />
                ) : (
                  <Moon className="w-4 h-4 text-white" />
                )}
                <span className="hidden sm:inline">
                  {app.librarySettings.darkMode ? 'فاتح' : 'داكن'}
                </span>
              </button>

              {/* In-App & Push Notification Bell */}
              <NotificationBell
                darkMode={app.librarySettings.darkMode}
                userId={app.playerUsername || app.playerName}
                buttonClassName="relative h-9 w-9 sm:h-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-obsidian-900/70 dark:hover:bg-obsidian-850 text-white dark:text-regalGold-200 border border-white/10 dark:border-regalGold-500/20 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              />

              {/* Friends & Challenge Invites System Button */}
              {app.playerName && (
                <button
                  type="button"
                  onClick={() => app.setIsFriendsModalOpen(true)}
                  className="relative h-9 w-9 sm:h-10 sm:w-auto px-0 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 dark:bg-obsidian-900/70 dark:hover:bg-obsidian-850 text-white dark:text-regalGold-200 border border-white/10 dark:border-regalGold-500/20 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  title="نظام الأصدقاء والتحديات"
                  aria-label="الأصدقاء"
                >
                  <Users className="w-4 h-4 text-brand-gold dark:text-regalGold-400" />
                  <span className="hidden sm:inline">الأصدقاء</span>

                  {/* Red Dot / Pending Requests Badge (Cloned from NotificationBell) */}
                  {pendingFriendRequestsCount > 0 && (
                    <span className="absolute -top-1 -left-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-red-600 rounded-full border-2 border-emerald-900 shadow-md animate-pulse">
                      {pendingFriendRequestsCount > 9 ? '+9' : pendingFriendRequestsCount}
                    </span>
                  )}
                </button>
              )}

              {app.playerName && (
                <div
                  onClick={() => {
                    app.setView('settings');
                    app.setShowScores(false);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2.5 pr-1.5 sm:pr-2.5 pl-1 sm:pl-1.5 border-r border-white/20 mr-0.5 sm:mr-1 shrink-0 cursor-pointer group"
                  title="ملفي الشخصي"
                >
                  <div className="relative shrink-0 flex items-center justify-center p-0.5">
                    <div className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 md:w-9 md:h-9 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-sm bg-gradient-to-br from-brand-emerald to-emerald-700 border-2 border-white/30 shadow-md group-hover:scale-105 transition-transform">
                      {(app.playerName || '').trim().charAt(0).toUpperCase()}
                    </div>
                    {app.isElite && (
                      app.safeAchievement === 'seerah' ? (
                        <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_seerah_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                      ) : app.safeAchievement === 'general' ? (
                        <div className="absolute -inset-1.5 rounded-full pointer-events-none z-20 bg-[url('/golden_general_achievement_frame.png')] bg-center bg-no-repeat bg-contain scale-110" />
                      ) : (
                        <div className={`absolute -inset-1 rounded-full pointer-events-none z-0 ${app.currentStyle.className}`} />
                      )
                    )}
                    {app.isElite && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-1 -left-1 z-30 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center bg-transparent drop-shadow-lg"
                        title={app.userAchievement}
                      >
                        {app.currentStyle.icon.startsWith('/') ? (
                          <img src={app.currentStyle.icon} className="w-full h-full object-contain" alt="Badge" />
                        ) : (
                          <div className="flex items-center justify-center bg-transparent text-white text-[8px] sm:text-[9px] drop-shadow-lg w-full h-full">
                            {app.currentStyle.icon}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                  <div className="hidden lg:flex flex-col text-right whitespace-nowrap">
                    <span className={`text-xs sm:text-sm font-black leading-none ${app.isElite ? `text-transparent bg-clip-text bg-gradient-to-r ${app.currentStyle.textColor}` : 'text-white'}`}>
                      {app.playerName}
                    </span>
                    <span className="text-[10px] font-bold text-brand-gold/80 mt-0.5">{app.totalPoints} نقطة</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Floating Back Button Directly Below Top Header Bar (view === 'mushaf' in index/guide mode) */}
      {app.view === 'mushaf' && !app.isMushafFullscreen && !app.isPageModeActive && (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-start items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            onClick={() => {
              app.setView('library');
              app.setIsPageModeActive(false);
              app.setSelectedSurahId(null);
              app.setSelectedJuz(null);
              app.setIsSearchSubmitted(false);
              app.resetTranscript();
              app.stopListening();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-emerald-200/60 dark:border-slate-700 shadow-sm hover:bg-emerald-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
            title="الرجوع للمكتبة"
          >
            <ArrowRight className="w-4 h-4 text-brand-gold group-hover:-translate-x-1 transition-transform" />
            <span className="text-emerald-800 dark:text-emerald-300 font-black">الرجوع للمكتبة</span>
          </button>

          {app.isPageModeActive && (
            <button
              onClick={() => {
                app.setIsPageModeActive(false);
                app.setIsSurahMenuOpen(false);
                app.setIsJuzMenuOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-md border border-amber-300/60 dark:border-slate-700 shadow-sm hover:bg-amber-50 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
              title="العودة لشاشة الدليل والمزايا"
            >
              <BookOpen className="w-4 h-4 text-brand-emerald group-hover:scale-110 transition-transform" />
              <span className="text-slate-700 dark:text-slate-200 font-black">دليل ومزايا المصحف</span>
            </button>
          )}
        </div>
      )}

      {/* Multiplayer Cancel / Resign Button if in a room */}
      {app.room && (app.view === 'challenge' || app.view === 'group_waiting' || app.view === 'group_game') && (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-3 pb-1 flex justify-end items-center">
          {app.isRoomLeader ? (
            <button
              type="button"
              onClick={() => app.setIsCancelRoomModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200/80 shadow-sm transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
              title="إلغاء الغرفة وحذفها"
            >
              <Trash2 className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
              <span>إلغاء الغرفة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => app.setIsResignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-200/80 shadow-sm transition-all text-xs sm:text-sm font-black active:scale-95 group cursor-pointer"
              title="الانسحاب من التحدي الجماعي"
            >
              <LogOut className="w-4 h-4 text-red-500 group-hover:rotate-180 transition-transform" />
              <span>الانسحاب من التحدي</span>
            </button>
          )}
        </div>
      )}

      {/* Daily Ayah Section (Below Header) - Only visible on Home Page */}
      {app.view === 'home' && !app.showScores && <DailyAyah />}

      {/* Auth Modal for New/Returning Player */}
      <AnimatePresence>
        {!app.playerName && app.view !== 'admin' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass p-6 sm:p-10 md:p-12 rounded-3xl md:rounded-[3.5rem] max-w-md w-full shadow-2xl text-center relative my-auto bg-white/95"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-emerald rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-xl shadow-brand-emerald/20 text-white">
                {app.playerAuthMode === 'register' ? (
                  <UserPlus className="w-8 h-8 md:w-10 md:h-10 text-white" />
                ) : (
                  <Key className="w-8 h-8 md:w-10 md:h-10 text-white" />
                )}
              </div>

              <h2 className="text-xl md:text-3xl font-black text-brand-emerald mb-2">
                {app.playerAuthMode === 'register' ? 'أهلاً بك في تطبيق متين' : 'تسجيل الدخول'}
              </h2>
              <p className="text-slate-500 font-bold text-xs md:text-sm mb-6">
                {app.playerAuthMode === 'register'
                  ? 'أنشئ حسابك لحفظ تقدمك والتنافس في لوحة المتصدرين'
                  : 'أدخل بيانات حسابك لمتابعة التحدي وحفظ نقاطك'}
              </p>

              {app.registrationError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-5 p-3.5 bg-red-50 text-red-600 rounded-2xl text-xs md:text-sm font-bold border border-red-100 text-center"
                >
                  {app.registrationError}
                </motion.div>
              )}

              <form onSubmit={app.handlePlayerAuth} className="space-y-4 text-right">
                {app.playerAuthMode === 'register' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand-emerald" />
                      <span>الاسم</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد محمد"
                      value={app.nameInput}
                      onChange={(e) => app.setNameInput(e.target.value)}
                      className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-brand-emerald" />
                      <span>{app.playerAuthMode === 'register' ? 'اسم المستخدم' : 'اسم المستخدم أو الاسم'}</span>
                    </span>
                    <span className="text-[9px] text-brand-emerald font-bold bg-brand-emerald/10 px-2 py-0.5 rounded-md">
                      تبدأ بـ @ تلقائياً
                    </span>
                  </label>
                  <div className="relative flex items-center bg-slate-50 border border-slate-200 focus-within:ring-2 focus-within:ring-brand-emerald/20 focus-within:border-brand-emerald rounded-2xl transition-all overflow-hidden">
                    <span className="pr-4 pl-1 text-brand-emerald font-black text-lg select-none shrink-0 pointer-events-none">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="username"
                      value={app.usernameInput}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/@/g, '').trim();
                        app.setUsernameInput(cleaned);
                      }}
                      className="w-full py-3.5 pr-1 pl-4 bg-transparent outline-none font-bold text-sm text-slate-800 text-right"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>كلمة المرور</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={app.passwordInput}
                    onChange={(e) => app.setPasswordInput(e.target.value)}
                    className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald/20 focus:border-brand-emerald transition-all font-bold text-sm text-slate-800"
                  />
                  {app.playerAuthMode === 'login' && (
                    <p className="text-[10px] text-slate-400 font-bold mr-1">
                      * كلمة المرور الافتراضية للحسابات السابقة: 1234
                    </p>
                  )}
                </div>

                <div className="pt-1 pb-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-right group">
                    <input
                      type="checkbox"
                      checked={app.hasAgreedToPrivacy}
                      onChange={(e) => {
                        app.setHasAgreedToPrivacy(e.target.checked);
                        if (app.registrationError && e.target.checked) {
                          app.setRegistrationError(null);
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald/30 cursor-pointer accent-emerald-600 shrink-0"
                    />
                    <span className="text-[11px] sm:text-xs text-slate-600 font-bold leading-relaxed">
                      أوافق على{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          app.setPrivacyModalInitialTab('privacy');
                          app.setShowPrivacyModal(true);
                        }}
                        className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                      >
                        سياسة الخصوصية
                      </button>
                      {' '}و{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          app.setPrivacyModalInitialTab('terms');
                          app.setShowPrivacyModal(true);
                        }}
                        className="text-brand-emerald hover:text-emerald-700 underline font-black inline cursor-pointer"
                      >
                        شروط الاستخدام
                      </button>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={app.isRegistering}
                  className="w-full py-4 mt-2 bg-brand-emerald text-white rounded-2xl font-black shadow-lg shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  {app.isRegistering ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : app.playerAuthMode === 'register' ? (
                    <>
                      <span>ابدأ التحدي</span>
                      <ArrowLeft className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول ومتابعة التحدي</span>
                      <LogIn className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                {app.playerAuthMode === 'register' ? (
                  <button
                    type="button"
                    onClick={() => {
                      app.setPlayerAuthMode('login');
                      app.setRegistrationError(null);
                    }}
                    className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1 cursor-pointer"
                  >
                    لدي حساب بالفعل؟ تسجيل الدخول
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      app.setPlayerAuthMode('register');
                      app.setRegistrationError(null);
                    }}
                    className="text-xs md:text-sm font-black text-brand-emerald hover:text-brand-emerald/80 hover:underline transition-colors py-1 cursor-pointer"
                  >
                    ليس لدي حساب، إنشاء حساب جديد
                  </button>
                )}
              </div>

              {/* رابط الدخول كأدمن (Admin Auth) */}
              <div className="mt-3 pt-3 border-t border-slate-100/80 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    router.push('/admin');
                    app.setView('admin');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:text-brand-emerald hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-brand-emerald transition-colors" />
                  <span>الدخول كأدمن (Admin Auth)</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content with PullToRefresh */}
      <PullToRefresh onRefresh={app.handlePullToRefresh}>
        <main className={`overflow-y-auto w-full ${app.view === 'mushaf'
          ? (app.isPageModeActive ? 'max-w-[96rem] px-0 sm:px-2 md:px-4 pt-1 sm:pt-2 md:pt-3 min-h-screen' : 'max-w-6xl px-3 sm:px-6 pt-1 sm:pt-2 md:pt-3 min-h-screen')
          : (app.view === 'challenge' || app.view === 'speed_challenge' || app.view === 'islamic_quiz' || app.view === 'group_game' || app.view === 'skills_count_selection' || app.view === 'skills_menu' || app.view === 'speed_menu')
            ? 'max-w-4xl px-3 sm:px-4 pt-1 sm:pt-2 md:pt-3 pb-8 md:pb-12 min-h-screen'
            : 'max-w-6xl px-3 sm:px-6 pt-4 sm:pt-6 md:pt-10 pb-20 min-h-screen'
        } mx-auto relative z-10`}>
          {children}
        </main>
      </PullToRefresh>

      {/* Fixed Bottom Navigation Bar - High Priority z-50 Layer */}
      {(!app.isMushafFullscreen || app.view !== 'mushaf') && (
        <nav className="fixed bottom-0 left-0 right-0 w-full z-50 bg-[#064e3b]/95 dark:bg-obsidian-950/95 border-t border-white/15 dark:border-regalGold-500/20 shadow-2xl backdrop-blur-2xl py-2 px-2 sm:px-6 transition-colors duration-500 select-none">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            {/* 1. الرئيسية */}
            <Link
              href="/"
              replace={true}
              prefetch={false}
              onPointerDown={() => {
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                router.refresh();
                app.setShowScores(false);
                app.setView('home');
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.refresh();
                router.replace('/');
                app.setShowScores(false);
                app.setView('home');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2 sm:px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                app.view === 'home' && !app.showScores
                  ? 'text-brand-gold dark:text-regalGold-300 bg-white/15 dark:bg-regalGold-500/15 dark:border dark:border-regalGold-500/30 scale-105 shadow-inner'
                  : 'text-white/70 dark:text-regalGold-200/60 hover:text-white dark:hover:text-regalGold-200 hover:bg-white/5 dark:hover:bg-regalGold-500/10'
              }`}
              title="الرئيسية"
            >
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الرئيسية</span>
            </Link>

            {/* 2. التحديات */}
            <Link
              href="/challenges"
              replace={true}
              prefetch={false}
              onPointerDown={() => {
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                router.refresh();
                app.setShowScores(false);
                app.setView('challenges');
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.refresh();
                router.replace('/challenges');
                app.setShowScores(false);
                app.setView('challenges');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2 sm:px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                app.view === 'challenges' && !app.showScores
                  ? 'text-brand-gold dark:text-regalGold-300 bg-white/15 dark:bg-regalGold-500/15 dark:border dark:border-regalGold-500/30 scale-105 shadow-inner'
                  : 'text-white/70 dark:text-regalGold-200/60 hover:text-white dark:hover:text-regalGold-200 hover:bg-white/5 dark:hover:bg-regalGold-500/10'
              }`}
              title="التحديات"
            >
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">التحديات</span>
            </Link>

            {/* 3. المتصدرين (نقلت من الشريط العلوي لتحفيز التنافس) */}
            <Link
              href="/scores"
              replace={true}
              prefetch={false}
              onPointerDown={() => {
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                router.refresh();
                app.setShowScores(true);
                app.setView('home');
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.refresh();
                router.replace('/scores');
                app.setShowScores(true);
                app.setView('home');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2 sm:px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                app.showScores
                  ? 'text-brand-gold dark:text-regalGold-300 bg-white/15 dark:bg-regalGold-500/15 dark:border dark:border-regalGold-500/30 scale-105 shadow-inner font-black'
                  : 'text-white/70 dark:text-regalGold-200/60 hover:text-white dark:hover:text-regalGold-200 hover:bg-white/5 dark:hover:bg-regalGold-500/10'
              }`}
              title="لوحة المتصدرين"
            >
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-brand-gold dark:text-regalGold-400" />
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">المتصدرين</span>
            </Link>

            {/* 4. المكتبة */}
            <Link
              href="/library"
              replace={true}
              prefetch={false}
              onPointerDown={() => {
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                router.refresh();
                app.setShowScores(false);
                app.setView('library');
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.refresh();
                router.replace('/library');
                app.setShowScores(false);
                app.setView('library');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2 sm:px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                !app.showScores && (app.view === 'library' || app.view === 'mushaf' || app.view === 'adhkar' || app.view === 'hadith' || app.view === 'book' || app.view === 'encyclopedia' || app.view === 'islamic_videos')
                  ? 'text-brand-gold dark:text-regalGold-300 bg-white/15 dark:bg-regalGold-500/15 dark:border dark:border-regalGold-500/30 scale-105 shadow-inner'
                  : 'text-white/70 dark:text-regalGold-200/60 hover:text-white dark:hover:text-regalGold-200 hover:bg-white/5 dark:hover:bg-regalGold-500/10'
              }`}
              title="المكتبة والعلوم الشرعية"
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">المكتبة</span>
            </Link>

            {/* 5. الإعدادات */}
            <Link
              href="/settings"
              replace={true}
              prefetch={false}
              onPointerDown={() => {
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                router.refresh();
                app.setShowScores(false);
                app.setView('settings');
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.refresh();
                router.replace('/settings');
                app.setShowScores(false);
                app.setView('settings');
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2 sm:px-3 rounded-2xl transition-all duration-300 cursor-pointer ${
                app.view === 'settings' && !app.showScores
                  ? 'text-brand-gold dark:text-regalGold-300 bg-white/15 dark:bg-regalGold-500/15 dark:border dark:border-regalGold-500/30 scale-105 shadow-inner'
                  : 'text-white/70 dark:text-regalGold-200/60 hover:text-white dark:hover:text-regalGold-200 hover:bg-white/5 dark:hover:bg-regalGold-500/10'
              }`}
              title="الإعدادات"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">الإعدادات</span>
            </Link>
          </div>
        </nav>
      )}

      {/* Fullscreen Mushaf Mode Overlay */}
      <AnimatePresence>
        {app.view === 'mushaf' && app.isMushafFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={app.toggleFullscreenControls}
            className="fixed inset-0 z-[100] w-screen h-screen flex flex-col justify-between overflow-hidden select-none cursor-pointer"
            style={{
              backgroundColor: app.librarySettings.darkMode ? '#0B132B' : '#fcfaf5',
              color: app.librarySettings.darkMode ? '#e2e8f0' : '#1e293b',
              backgroundImage: app.librarySettings.darkMode
                ? 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, rgba(11, 19, 43, 0.98) 85%)'
                : 'radial-gradient(circle at center, rgba(217, 119, 6, 0.05) 0%, #fcfaf5 85%)',
            }}
          >
            {/* Floating Top Controls: Exit 'X' Button on Corner & Page Info */}
            <AnimatePresence>
              {app.areFullscreenControlsVisible && (
                <>
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 left-3 sm:top-5 sm:left-5 z-50 pointer-events-auto"
                  >
                    <button
                      onClick={app.exitMushafFullscreen}
                      className="p-2.5 sm:p-3 rounded-2xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all active:scale-95 flex items-center gap-2 group cursor-pointer"
                      title="خروج من ملء الشاشة (Esc)"
                      aria-label="خروج من ملء الشاشة"
                    >
                      <X className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:rotate-90 transition-transform duration-200" />
                      <span className="text-xs sm:text-sm font-black hidden sm:inline text-white/90">خروج</span>
                    </button>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 pointer-events-auto"
                  >
                    <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-black/60 text-white backdrop-blur-xl border border-white/20 shadow-2xl text-xs sm:text-sm font-black flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-gold" />
                      <span>المصحف الشريف</span>
                      <span className="text-white/40">•</span>
                      <span className="text-brand-gold">صفحة {app.currentPage}</span>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Main Fullscreen Quran Page View with Pinch-to-Zoom & Free 2D Pan */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden p-0 sm:p-2">
              <QuranZoomViewer
                pageNumber={app.currentPage}
                darkMode={app.librarySettings.darkMode}
                isFullscreen={true}
                onPageTurn={(dir) => {
                  app.setPageTurnDirection(dir);
                  if (dir === 'next') {
                    app.setCurrentPage((prev: number) => Math.min(604, prev + 1));
                  } else {
                    app.setCurrentPage((prev: number) => Math.max(1, prev - 1));
                  }
                  app.resetFullscreenControlsTimer();
                }}
                onTap={() => {
                  if (app.selectedAyah) {
                    app.setSelectedAyah(null);
                  } else {
                    app.toggleFullscreenControls();
                  }
                }}
                onInteraction={app.resetFullscreenControlsTimer}
                pageTurnDirection={app.pageTurnDirection}
                selectedAyah={app.selectedAyah}
                onSelectAyah={(s, a) => {
                  app.setSelectedAyah({ surah: s, ayah: a });
                  app.resetFullscreenControlsTimer();
                }}
              />
            </div>

            {/* Bottom Floating Navigation Arrows & Page Jump */}
            <AnimatePresence>
              {app.areFullscreenControlsVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 25 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    app.resetFullscreenControlsTimer();
                  }}
                  className="absolute bottom-4 sm:bottom-6 inset-x-0 flex justify-center items-center pointer-events-none z-50 px-4"
                >
                  <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-2xl border border-white/20 shadow-2xl transition-all">
                    <button
                      onClick={() => {
                        if (app.currentPage > 1) {
                          app.setPageTurnDirection('prev');
                          app.setCurrentPage((prev: number) => Math.max(1, prev - 1));
                          app.resetFullscreenControlsTimer();
                        }
                      }}
                      disabled={app.currentPage === 1}
                      className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                      title="الصفحة السابقة"
                      aria-label="الصفحة السابقة"
                    >
                      <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    <div className="flex items-center gap-1.5 px-2 text-white font-black text-xs sm:text-sm select-none">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={app.currentPage}
                        onClick={(e) => {
                          e.stopPropagation();
                          app.resetFullscreenControlsTimer();
                        }}
                        onChange={(e) => {
                          app.resetFullscreenControlsTimer();
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          if (val === '') return;
                          const num = parseInt(val);
                          if (num >= 1 && num <= 604) {
                            app.setCurrentPage(num);
                          }
                        }}
                        className="w-10 sm:w-12 bg-white/10 border border-white/20 rounded-lg text-center text-xs sm:text-sm font-black text-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold py-0.5"
                      />
                      <span className="text-white/40">/</span>
                      <span className="text-white/70">604</span>
                    </div>

                    <button
                      onClick={() => {
                        if (app.currentPage < 604) {
                          app.setPageTurnDirection('next');
                          app.setCurrentPage((prev: number) => Math.min(604, prev + 1));
                          app.resetFullscreenControlsTimer();
                        }
                      }}
                      disabled={app.currentPage === 604}
                      className="p-2 sm:p-2.5 rounded-full text-white hover:text-brand-gold disabled:opacity-30 disabled:hover:text-white transition-all active:scale-90"
                      title="الصفحة التالية"
                      aria-label="الصفحة التالية"
                    >
                      <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

