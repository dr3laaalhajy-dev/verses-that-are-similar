import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Sparkles, Smartphone, CheckCheck, Clock, User, ChevronLeft } from 'lucide-react';
import { supabase } from '../services/supabase';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useApp } from '../contexts/AppContext';
import { router } from '../services/router';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  target_url?: string | null;
  action_url?: string | null;
  route?: string | null;
  type?: string | null;
  sender_role?: string;
  sender_name?: string;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

/**
 * Helper to dynamically extract or infer the destination route from notification fields or content.
 * Handles specific Adhkar destinations (Morning / Evening / etc.) even if the notification only had generic '/adhkar' or no route.
 */
export const getNotificationTargetRoute = (item: NotificationItem): string | null => {
  // 1. Direct explicit fields from database or metadata
  const explicitRoute =
    item.route ||
    item.action_url ||
    item.target_url ||
    item.metadata?.route ||
    item.metadata?.action_url ||
    item.metadata?.target_url ||
    null;

  const titleText = (item.title || '').trim();
  const bodyText = (item.body || '').trim();
  const typeText = (item.type || item.metadata?.type || '').trim();
  const fullContent = `${titleText} ${bodyText} ${typeText}`.toLowerCase();

  // If an explicit route exists
  if (explicitRoute && typeof explicitRoute === 'string' && explicitRoute.trim()) {
    const trimmed = explicitRoute.trim();

    // Check external URL
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // If explicit route already targets a specific sub-adhkar category:
    if (
      trimmed.includes('/morning') ||
      trimmed.includes('/evening') ||
      trimmed.includes('category=') ||
      trimmed.includes('type=')
    ) {
      return trimmed;
    }

    // If explicit route is a generic adhkar route (/adhkar, /library/adhkar, etc.)
    // Inspect title/body to determine whether it's Morning or Evening Adhkar
    if (
      trimmed === '/adhkar' ||
      trimmed === '/library/adhkar' ||
      trimmed === 'adhkar' ||
      trimmed === '/adhkar/' ||
      trimmed === '/library/adhkar/'
    ) {
      if (fullContent.includes('صباح') || fullContent.includes('morning')) {
        return '/library/adhkar/morning';
      }
      if (fullContent.includes('مساء') || fullContent.includes('evening')) {
        return '/library/adhkar/evening';
      }
      if (fullContent.includes('نوم') || fullContent.includes('sleep')) {
        return '/library/adhkar/hisn_2';
      }
      if (fullContent.includes('استيقاظ') || fullContent.includes('waking')) {
        return '/library/adhkar/hisn_3';
      }
      if (fullContent.includes('بعد الصلاة') || fullContent.includes('الصلاة')) {
        return '/library/adhkar/hisn_27';
      }
      return '/library/adhkar';
    }

    return trimmed;
  }

  // 2. If no explicit route field in database, infer from title and content
  if (fullContent.includes('أذكار الصباح') || fullContent.includes('اذكار الصباح') || (fullContent.includes('صباح') && fullContent.includes('أذكار'))) {
    return '/library/adhkar/morning';
  }
  if (fullContent.includes('أذكار المساء') || fullContent.includes('اذكار المساء') || (fullContent.includes('مساء') && fullContent.includes('أذكار'))) {
    return '/library/adhkar/evening';
  }
  if (fullContent.includes('أذكار النوم') || fullContent.includes('اذكار النوم')) {
    return '/library/adhkar/hisn_2';
  }
  if (fullContent.includes('أذكار الاستيقاظ') || fullContent.includes('اذكار الاستيقاظ')) {
    return '/library/adhkar/hisn_3';
  }
  if (fullContent.includes('أذكار بعد الصلاة') || fullContent.includes('أذكار الصلاة')) {
    return '/library/adhkar/hisn_27';
  }
  if (fullContent.includes('أذكار') || fullContent.includes('اذكار') || fullContent.includes('حصن المسلم')) {
    return '/library/adhkar';
  }
  if (fullContent.includes('مصحف') || fullContent.includes('القرآن الكريم') || fullContent.includes('سورة')) {
    return '/mushaf';
  }
  if (fullContent.includes('حديث') || fullContent.includes('أحاديث') || fullContent.includes('النووية')) {
    return '/hadith';
  }
  if (fullContent.includes('متصدرين') || fullContent.includes('لوحة الشرف') || fullContent.includes('الترتيب')) {
    return '/leaderboard';
  }

  return null;
};

export interface NotificationBellProps {
  darkMode?: boolean;
  userId?: string | null;
  buttonClassName?: string;
}

const STORAGE_KEY = 'read_notifications_map';

export type ReadTimestampsMap = Record<string, string>;

const getStoredReadMap = (): ReadTimestampsMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
    // Backward compatibility with previous array format:
    const oldRaw = localStorage.getItem('read_notification_ids');
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      if (Array.isArray(oldParsed)) {
        const migrated: ReadTimestampsMap = {};
        const past = new Date(0).toISOString();
        oldParsed.forEach((id: string) => {
          migrated[id] = past;
        });
        return migrated;
      }
    }
    return {};
  } catch {
    return {};
  }
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ darkMode, userId, buttonClassName }) => {
  const app = useApp();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [readMap, setReadMap] = useState<ReadTimestampsMap>(() => getStoredReadMap());
  const readMapRef = useRef<ReadTimestampsMap>(readMap);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    readMapRef.current = readMap;
  }, [readMap]);

  const { permission, requestPermissionAndRegister, isLoading: isFCMRegistering } = usePushNotifications(userId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  /**
   * Check whether an item is unread:
   * 1. If never marked as read in readMap -> unread.
   * 2. If updated_at is newer than the saved read timestamp -> unread (re-broadcast upon update).
   * 3. Otherwise -> read.
   */
  const isItemUnread = (item: NotificationItem, currentMap?: ReadTimestampsMap): boolean => {
    const map = currentMap || readMapRef.current;
    const readTimestamp = map[item.id];

    if (!readTimestamp) {
      return true;
    }

    const effectiveTime = item.updated_at
      ? new Date(item.updated_at).getTime()
      : new Date(item.created_at).getTime();
    const readTime = new Date(readTimestamp).getTime();

    return effectiveTime > readTime;
  };

  const calculateUnread = (items: NotificationItem[], currentMap?: ReadTimestampsMap) => {
    const map = currentMap || readMapRef.current;
    const count = items.filter(n => isItemUnread(n, map)).length;
    setUnreadCount(count);
  };

  // Fetch initial notifications
  const fetchNotifications = async () => {
    const stored = getStoredReadMap();

    // 1. Primary: Fetch from backend API (connected to Neon / Prisma notifications table)
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (res.ok) {
        const data = await res.json();
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(data.notifications);
          calculateUnread(data.notifications, stored);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('[NotificationBell] API fetch warn:', err);
    }

    // 2. Fallback: Try Supabase in case notifications table is present
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        setNotifications(data);
        calculateUnread(data, stored);
      }
    } catch (e) {
      // Fallback silently
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Individual Read & Deep Link: Click a notification to mark as read and navigate
  const closeModal = () => {
    setIsOpen(false);
  };

  const handleItemClick = (item: NotificationItem) => {
    // 1. Mark as read immediately
    if (isItemUnread(item)) {
      const nowIso = new Date().toISOString();
      setReadMap(prev => {
        const next = { ...prev, [item.id]: nowIso };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
          console.warn('[NotificationBell] Failed to save read map to LocalStorage:', e);
        }
        return next;
      });
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    // 2. Extract or infer dynamic destination route
    const target = getNotificationTargetRoute(item);

    // 3. Immediately close modal prior to navigation to prevent modal lingering over Adhkar/target view
    closeModal();

    if (!target) return;

    // Check external URL
    if (/^https?:\/\//i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    // Broadcast deep link event (e.g. for Mushaf listener or custom components)
    try {
      window.postMessage({ type: 'DEEP_LINK_NAVIGATE', url: target }, '*');
    } catch {}

    // Internal app navigation
    try {
      // Adhkar route with direct category targeting (Morning / Evening / etc.)
      if (target.includes('/adhkar') || target.includes('adhkar')) {
        let categoryId: string | null = null;
        if (target.includes('morning') || target.includes('sabah')) {
          categoryId = 'morning';
        } else if (target.includes('evening') || target.includes('masaa')) {
          categoryId = 'evening';
        } else if (target.includes('hisn_2') || target.includes('sleep')) {
          categoryId = 'hisn_2';
        } else if (target.includes('hisn_3') || target.includes('waking')) {
          categoryId = 'hisn_3';
        } else if (target.includes('hisn_27') || target.includes('prayer')) {
          categoryId = 'hisn_27';
        }

        if (categoryId && app.setSelectedAdhkarCategoryId) {
          app.setSelectedAdhkarCategoryId(categoryId);
        }
        if (app.setView) {
          app.setView('adhkar');
        }
        router.push(target);
        return;
      }

      // Mushaf route
      if (target.includes('/mushaf') || target.includes('page=')) {
        try {
          const urlObj = new URL(target, window.location.origin);
          const pageParam = urlObj.searchParams.get('page');
          if (pageParam && app.setCurrentPage) {
            const pageNum = parseInt(pageParam, 10);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
              app.setCurrentPage(pageNum);
            }
          }
        } catch {}
        if (app.setIsPageModeActive) app.setIsPageModeActive(true);
        if (app.setView) app.setView('mushaf');
        router.push(target);
        return;
      }

      // Other internal views
      const cleanPath = target.replace(/^\//, '').split('?')[0].split('#')[0];

      if (cleanPath === 'leaderboard' || cleanPath === 'scores') {
        if (app.setShowScores) app.setShowScores(true);
        router.push(target);
        return;
      }

      if (cleanPath === 'settings') {
        if (app.setView) app.setView('settings');
        else if (app.setShowSettings) app.setShowSettings(true);
        router.push(target);
        return;
      }

      if (app.setView) {
        app.setView(cleanPath as any);
      }
      router.push(target);
    } catch (err) {
      console.warn('[NotificationBell] Navigation error:', err);
    }
  };

  // 3. Mark All As Read: Mark all notifications as read at once & remove red dot
  const markAllAsRead = () => {
    if (notifications.length === 0 || unreadCount === 0) return;

    const nowIso = new Date().toISOString();
    setReadMap(prev => {
      const next = { ...prev };
      notifications.forEach(n => {
        next[n.id] = nowIso;
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('[NotificationBell] Failed to save read map to LocalStorage:', e);
      }
      return next;
    });

    // Red dot / badge on the main bell icon disappears immediately
    setUnreadCount(0);
  };

  // Subscribe to Supabase Realtime updates (INSERT, UPDATE, DELETE & broadcast)
  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel('realtime_public_notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('[NotificationBell] New Realtime notification received:', payload.new);
          const newItem = payload.new as NotificationItem;

          setNotifications(prev => {
            if (prev.some(n => n.id === newItem.id)) return prev;
            const nextList = [newItem, ...prev];
            calculateUnread(nextList, readMapRef.current);
            return nextList;
          });

          // Haptic feedback if available
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            try {
              window.navigator.vibrate([100, 80, 100]);
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('[NotificationBell] Notification updated via Realtime:', payload.new);
          const updated = payload.new as NotificationItem;
          if (updated?.id) {
            setNotifications(prev => {
              const nextList = prev.map(n => n.id === updated.id ? { ...n, ...updated } : n);
              // Recalculate unread with updated item's updated_at timestamp!
              calculateUnread(nextList, readMapRef.current);
              return nextList;
            });

            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
              try {
                window.navigator.vibrate([80, 50, 80]);
              } catch {}
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        (payload) => {
          console.log('[NotificationBell] Notification deleted via Realtime:', payload.old);
          const deletedId = (payload.old as { id: string })?.id;
          if (deletedId) {
            setNotifications(prev => {
              const nextList = prev.filter(n => n.id !== deletedId);
              calculateUnread(nextList, readMapRef.current);
              return nextList;
            });
          }
        }
      )
      .on(
        'broadcast',
        { event: 'NOTIFICATION_UPDATED' },
        (payload) => {
          const updated = payload.payload as NotificationItem;
          if (updated?.id) {
            setNotifications(prev => {
              const nextList = prev.map(n => n.id === updated.id ? { ...n, ...updated } : n);
              calculateUnread(nextList, readMapRef.current);
              return nextList;
            });

            if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
              try {
                window.navigator.vibrate([80, 50, 80]);
              } catch {}
            }
          }
        }
      )
      .on(
        'broadcast',
        { event: 'NOTIFICATION_DELETED' },
        (payload) => {
          const { id } = payload.payload as { id: string };
          if (id) {
            setNotifications(prev => {
              const nextList = prev.filter(n => n.id !== id);
              calculateUnread(nextList, readMapRef.current);
              return nextList;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[NotificationBell Realtime Channel Status]:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return 'الآن';
      if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
      if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
      return new Date(dateStr).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative inline-block z-50" ref={dropdownRef} dir="rtl">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className={buttonClassName || "relative h-10 px-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all text-xs sm:text-sm font-bold shadow-md hover:scale-105 active:scale-95 cursor-pointer"}
        title="التنبيهات والإشعارات"
        aria-label="التنبيهات"
      >
        <Bell className="w-4 h-4 text-white" />

        {/* Red Dot / Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-red-600 rounded-full border-2 border-emerald-900 shadow-md animate-pulse">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className={`absolute left-0 mt-2.5 w-[330px] sm:w-[400px] max-w-[92vw] rounded-2xl sm:rounded-3xl shadow-2xl border z-[999] overflow-hidden ${
              darkMode
                ? 'bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-xl'
                : 'bg-white border-gray-200 text-gray-800 backdrop-blur-xl'
            }`}
          >
            {/* 1. Header */}
            <div className={`px-4 py-3.5 border-b flex justify-between items-center gap-2 ${darkMode ? 'border-slate-800 bg-slate-800/40' : 'border-gray-100 bg-gray-50/70'}`}>
              {/* Right Side: Bell Icon & Title */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-brand-emerald dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100 leading-tight">التنبيهات</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">آخر المستجدات</span>
                </div>
              </div>

              {/* Left Side: Mark all as read & Close */}
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline transition-all cursor-pointer whitespace-nowrap"
                    title="تحديد الكل كمقروء"
                  >
                    تحديد الكل كمقروء
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="إغلاق النافذة"
                  aria-label="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FCM Push Permission Banner (if not granted) */}
            {permission !== 'granted' && (
              <div className="px-3.5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/15 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight truncate">تفعيل إشعارات الهاتف للتحديات الجديدة</span>
                </div>
                <button
                  type="button"
                  onClick={requestPermissionAndRegister}
                  disabled={isFCMRegistering}
                  className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isFCMRegistering ? 'جاري...' : 'تفعيل'}
                </button>
              </div>
            )}

            {/* 2. Notifications List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/80">
              {isLoading ? (
                <div className="py-12 text-center text-xs font-bold text-gray-400 dark:text-slate-500">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>جاري جلب التنبيهات...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-slate-500 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-gray-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-slate-300">لا توجد تنبيهات حالياً</p>
                  <span className="text-xs text-gray-400 mt-1 block">ستصلك أحدث المستجدات والتحديات هنا فور نشرها</span>
                </div>
              ) : (
                notifications.map((item) => {
                  const unread = isItemUnread(item);
                  const targetRoute = getNotificationTargetRoute(item);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-start gap-3 p-3.5 transition-all text-right relative group cursor-pointer active:scale-[0.99] ${
                        unread
                          ? 'bg-green-50/50 dark:bg-emerald-950/30 hover:bg-green-50/80 dark:hover:bg-emerald-950/50'
                          : 'bg-transparent hover:bg-gray-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* الأيقونة/الصورة على اليمين */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        unread
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs'
                          : 'bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500 border border-transparent'
                      }`}>
                        <Bell className="w-4 h-4" />
                      </div>

                      {/* المحتوى في المنتصف */}
                      <div className="flex-1 min-w-0">
                        {/* العنوان ونقطة الإشعار غير المقروء */}
                        <div className="flex items-center gap-1.5 mb-1">
                          {unread && (
                            <span
                              className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"
                              title="تنبيه غير مقروء"
                            />
                          )}
                          <h4
                            className={`text-xs sm:text-sm leading-snug ${
                              unread
                                ? 'font-bold text-gray-900 dark:text-slate-100'
                                : 'font-medium text-gray-500 dark:text-slate-400'
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>

                        {/* نص الإشعار */}
                        <p
                          className={`text-sm leading-relaxed ${
                            unread
                              ? 'font-medium text-gray-700 dark:text-slate-200'
                              : 'font-normal text-gray-500 dark:text-slate-500'
                          }`}
                        >
                          {item.body}
                        </p>

                        {/* البيانات الوصفية في سطر واحد أسفل النص */}
                        <div className="text-xs text-gray-400 dark:text-slate-500 flex items-center justify-between gap-2 mt-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400/80" />
                              <span>{formatRelativeTime(item.created_at)}</span>
                            </span>
                            {item.sender_name && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400/80" />
                                  <span>من: {item.sender_name}</span>
                                </span>
                              </>
                            )}
                          </div>

                          {targetRoute && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }}
                              className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 group-hover:-translate-x-1 transition-transform cursor-pointer"
                              title={`فتح: ${targetRoute}`}
                            >
                              <span>فتح</span>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 3. Footer */}
            <div className={`py-2 px-4 text-center text-[10px] text-gray-300 dark:text-slate-600 border-t ${darkMode ? 'border-slate-800/80' : 'border-gray-100'}`}>
              متصل لحظياً عبر Supabase
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;

