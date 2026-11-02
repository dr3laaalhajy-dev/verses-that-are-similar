import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Sparkles, Smartphone, CheckCheck } from 'lucide-react';
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
      localStorage.setItem('last_read_notification_time', new Date().toISOString());
      setUnreadCount(0);
    } catch {}
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
    <div className="relative inline-block" ref={dropdownRef} dir="rtl">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markAllAsRead();
          }
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
            className={`absolute left-0 mt-2.5 w-[320px] sm:w-[380px] max-w-[92vw] rounded-3xl shadow-2xl border z-[999] overflow-hidden ${
              darkMode
                ? 'bg-slate-900/95 border-slate-800 text-slate-100 backdrop-blur-xl'
                : 'bg-white/95 border-slate-200 text-slate-800 backdrop-blur-xl'
            }`}
          >
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between gap-2 ${darkMode ? 'border-slate-800 bg-slate-800/40' : 'border-slate-100 bg-slate-50/70'}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-current">التنبيهات</h3>
                  <span className="text-[10px] font-bold text-slate-400">آخر المستجدات والتحديات</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 p-1 flex items-center gap-1 cursor-pointer"
                    title="تحديد الكل كمقروء"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>قراءة الكل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FCM Push Permission Banner (if not granted) */}
            {permission !== 'granted' && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 text-amber-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="text-[11px] font-bold leading-tight">تفعيل تنبيهات الهاتف عند إضافة تحديات</span>
                </div>
                <button
                  type="button"
                  onClick={requestPermissionAndRegister}
                  disabled={isFCMRegistering}
                  className="px-2.5 py-1 text-[10px] font-black bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isFCMRegistering ? 'جاري...' : 'تفعيل'}
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>جاري جلب التنبيهات...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 px-4">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold">لا توجد تنبيهات جديدة حالياً</p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">ستصلك هنا أحدث المسابقات والتنبيهات فور نشرها</span>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-right relative group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">
                        {item.title}
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0 whitespace-nowrap">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                      {item.body}
                    </p>
                    {item.sender_name && (
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                        من: {item.sender_name}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className={`p-2.5 text-center text-[10px] font-bold text-slate-400 border-t ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              متصل لحظياً عبر Supabase Realtime • FCM
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;

