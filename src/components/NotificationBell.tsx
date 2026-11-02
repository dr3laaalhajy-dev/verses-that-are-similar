import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Sparkles, Smartphone, CheckCheck, Clock, User } from 'lucide-react';
import { supabase } from '../services/supabase';
import { usePushNotifications } from '../hooks/usePushNotifications';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  sender_role?: string;
  sender_name?: string;
  created_at: string;
}

export interface NotificationBellProps {
  darkMode?: boolean;
  userId?: string | null;
  buttonClassName?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ darkMode, userId, buttonClassName }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastReadTime, setLastReadTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('last_read_notification_time');
    } catch {
      return null;
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch initial notifications
  const fetchNotifications = async () => {
    try {
      // 1. Try Supabase
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        setNotifications(data);
        calculateUnread(data);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.warn('[NotificationBell] Supabase fetch warn:', e);
    }

    // 2. Fallback to API route
    try {
      const res = await fetch('/api/notifications?limit=20');
      const data = await res.json();
      if (res.ok && data.notifications) {
        setNotifications(data.notifications);
        calculateUnread(data.notifications);
      }
    } catch (err) {
      console.warn('[NotificationBell] API fetch warn:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateUnread = (items: NotificationItem[]) => {
    try {
      const lastRead = localStorage.getItem('last_read_notification_time');
      setLastReadTime(lastRead);
      if (!lastRead) {
        setUnreadCount(items.length);
        return;
      }
      const lastReadDate = new Date(lastRead).getTime();
      const count = items.filter(n => new Date(n.created_at).getTime() > lastReadDate).length;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    try {
      const now = new Date().toISOString();
      localStorage.setItem('last_read_notification_time', now);
      setLastReadTime(now);
      setUnreadCount(0);
    } catch {}
  };

  const isItemUnread = (item: NotificationItem) => {
    try {
      if (!lastReadTime) return true;
      return new Date(item.created_at).getTime() > new Date(lastReadTime).getTime();
    } catch {
      return false;
    }
  };

  // Subscribe to Supabase Realtime updates
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
            return [newItem, ...prev];
          });

          setUnreadCount(prev => prev + 1);

          // Haptic feedback if available
          if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
            try {
              window.navigator.vibrate([100, 80, 100]);
            } catch {}
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
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3.5 transition-colors text-right relative group hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                        unread ? 'bg-green-50/30 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* الأيقونة/الصورة على اليمين */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                        unread
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400 border border-transparent'
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
                              title="غير مقروء"
                            />
                          )}
                          <h4 className="font-bold text-gray-800 dark:text-slate-100 text-xs sm:text-sm leading-snug">
                            {item.title}
                          </h4>
                        </div>

                        {/* نص الإشعار */}
                        <p className="text-sm text-gray-600 dark:text-slate-300 font-normal leading-relaxed">
                          {item.body}
                        </p>

                        {/* البيانات الوصفية في سطر واحد أسفل النص */}
                        <div className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-2 mt-2">
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

