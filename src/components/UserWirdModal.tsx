import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, X, Check, Bell, Sparkles, CheckCircle2,
  Calendar, ArrowLeft, Loader2, Bookmark, Flame, AlertCircle
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { pageBoundaries } from '../services/PageRepository';
import { ALL_QURAN_SURAHS, getJuzsForSurah } from '../services/JuzRepository';
import { usePushNotifications } from '../hooks/usePushNotifications';

export interface UserWirdModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  currentPageNumber?: number;
  onNavigateToPage?: (page: number) => void;
}

export const UserWirdModal: React.FC<UserWirdModalProps> = ({
  isOpen,
  onClose,
  userId,
  currentPageNumber = 1,
  onNavigateToPage
}) => {
  const activeUserId = userId || localStorage.getItem('player_name') || localStorage.getItem('quran_player_name') || 'guest_user';

  const [pagesPerDay, setPagesPerDay] = useState<number>(4);
  const [currentPage, setCurrentPage] = useState<number>(currentPageNumber || 1);
  const [notificationTime, setNotificationTime] = useState<string>('08:00');
  const [isActive, setIsActive] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { permission, requestPermissionAndRegister } = usePushNotifications(activeUserId);

  // Load existing configuration on mount / open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const loadWird = async () => {
      try {
        // 1. Try local storage first
        const localData = localStorage.getItem(`user_wird_${activeUserId}`);
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (parsed && isMounted) {
              setPagesPerDay(parsed.pages_per_day || 4);
              setCurrentPage(parsed.current_page || currentPageNumber || 1);
              setNotificationTime(parsed.notification_time || '08:00');
              setIsActive(parsed.is_active !== undefined ? parsed.is_active : true);
            }
          } catch {}
        }

        // 2. Fetch from Supabase
        const { data, error } = await supabase
          .from('user_wird')
          .select('*')
          .eq('user_id', activeUserId)
          .maybeSingle();

        if (!error && data && isMounted) {
          setPagesPerDay(data.pages_per_day || 4);
          setCurrentPage(data.current_page || 1);
          setNotificationTime(data.notification_time || '08:00');
          setIsActive(data.is_active !== undefined ? data.is_active : true);
          localStorage.setItem(`user_wird_${activeUserId}`, JSON.stringify(data));
        } else {
          // Fallback to API
          const res = await fetch(`/api/wird?userId=${encodeURIComponent(activeUserId)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.wird && isMounted) {
              setPagesPerDay(json.wird.pages_per_day || 4);
              setCurrentPage(json.wird.current_page || 1);
              setNotificationTime(json.wird.notification_time || '08:00');
              setIsActive(json.wird.is_active !== undefined ? json.wird.is_active : true);
            }
          }
        }
      } catch (err) {
        console.warn('[UserWirdModal] Load error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadWird();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeUserId, currentPageNumber]);

  // Find Surah and Juz for current page
  const pageDetails = React.useMemo(() => {
    const pageNum = Math.max(1, Math.min(604, currentPage));
    let surahId = 1;
    for (let i = pageBoundaries.length - 1; i >= 0; i--) {
      if (pageNum >= pageBoundaries[i].page) {
        surahId = pageBoundaries[i].startSurah;
        break;
      }
    }
    const surahObj = ALL_QURAN_SURAHS.find((s) => s.id === surahId);
    const surahName = surahObj ? surahObj.name : 'الفاتحة';
    const juzNumber = Math.min(30, Math.floor((pageNum - 1) / 20) + 1);

    return { surahName, juzNumber };
  }, [currentPage]);

  // Estimated Khatma Completion Days
  const estimatedDays = Math.ceil(604 / Math.max(1, pagesPerDay));
  const estimatedMonths = (estimatedDays / 30).toFixed(1);

  // Handle Save
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const payload = {
      user_id: activeUserId,
      pages_per_day: pagesPerDay,
      current_page: currentPage,
      notification_time: notificationTime,
      is_active: isActive
    };

    // Save locally
    try {
      localStorage.setItem(`user_wird_${activeUserId}`, JSON.stringify(payload));
    } catch {}

    try {
      // 1. Save in Supabase
      const { error: sbErr } = await supabase
        .from('user_wird')
        .upsert(payload, { onConflict: 'user_id' });

      if (sbErr) {
        console.warn('[UserWirdModal] Supabase save warning:', sbErr.message);
      }

      // 2. Also sync with Server API
      await fetch('/api/wird', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});

      // 3. Sync device token if permission is already granted
      if (isActive && permission === 'granted') {
        requestPermissionAndRegister().catch(() => {});
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('[UserWirdModal] Save error:', err);
      setErrorMessage(err.message || 'فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartReadingNow = () => {
    if (onNavigateToPage) {
      onNavigateToPage(currentPage);
    }
    onClose();
  };

  // Body scroll lock
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

  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-emerald to-teal-700 text-brand-gold flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <BookOpen className="w-5 h-5 text-brand-gold" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>الورد القرآني المخصص</span>
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                </h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">
                  حدد مقدار قراءتك اليومية ووقت تذكيرك الذكي
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-bold text-sm">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-emerald" />
              <span>جاري تحميل إعدادات الورد...</span>
            </div>
          ) : (
            <div className="space-y-5 pt-4">
              {/* Alert / Notification Feedback */}
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2.5 text-xs font-black"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم حفظ إعدادات وردك اليومي بنجاح! سيصلك تذكير في الموعد المحدد.</span>
                </motion.div>
              )}

              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2.5 text-xs font-black"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {/* 1. Toggle Active */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                      تفعيل التذكير اليومي
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400">
                      إرسال إشعار فوري وتوجيهك لصفحة الورد مباشرة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    isActive ? 'bg-brand-emerald justify-start' : 'bg-slate-300 dark:bg-slate-700 justify-end'
                  }`}
                >
                  <motion.div
                    layout
                    className="w-4 h-4 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>

              {/* 2. Pages Per Day */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>مقدار الورد اليومي (عدد الصفحات)</span>
                  <span className="text-[11px] font-black text-brand-emerald">
                    {pagesPerDay} {pagesPerDay === 1 ? 'صفحة' : pagesPerDay === 2 ? 'صفحتان (ورقة)' : 'صفحات'}
                  </span>
                </label>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'ورقة (2)', count: 2 },
                    { label: 'حزب (4)', count: 4 },
                    { label: 'نصف جزء (10)', count: 10 },
                    { label: 'جزء (20)', count: 20 }
                  ].map((preset) => (
                    <button
                      key={preset.count}
                      type="button"
                      onClick={() => setPagesPerDay(preset.count)}
                      className={`py-2 px-1 text-[11px] font-black rounded-xl border transition-all cursor-pointer ${
                        pagesPerDay === preset.count
                          ? 'bg-brand-emerald text-white border-brand-emerald shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Slider / Counter */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={pagesPerDay}
                    onChange={(e) => setPagesPerDay(Number(e.target.value))}
                    className="w-full accent-brand-emerald cursor-pointer"
                  />
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={pagesPerDay}
                    onChange={(e) => setPagesPerDay(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    className="w-16 px-2.5 py-1.5 text-center font-black text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Completion Forecast Banner */}
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-[11px] font-bold text-amber-900 dark:text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>تختم المصحف كاملاً خلال:</span>
                  </span>
                  <span className="font-black text-xs">
                    {estimatedDays} يوماً (قرابة {estimatedMonths} شهر) 🌟
                  </span>
                </div>
              </div>

              {/* 3. Starting Page / Current Page */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>الصفحة التي ستبدأ منها (الصفحة الحالية)</span>
                  <span className="text-[11px] font-bold text-slate-400">
                    سورة {pageDetails.surahName} • الجزء {pageDetails.juzNumber}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Bookmark className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={1}
                      max={604}
                      value={currentPage}
                      onChange={(e) => setCurrentPage(Math.max(1, Math.min(604, Number(e.target.value) || 1)))}
                      className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-brand-emerald font-black text-sm text-slate-800 dark:text-slate-100 transition-all"
                      placeholder="رقم الصفحة (1 - 604)"
                    />
                  </div>
                  {currentPageNumber > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage(currentPageNumber)}
                      className="px-3 py-2.5 rounded-2xl border border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/40 text-brand-emerald font-black text-xs hover:bg-emerald-100 transition-colors whitespace-nowrap cursor-pointer"
                      title="استخدام الصفحة المفتوحة حالياً في المصحف"
                    >
                      صفحتي الحالية ({currentPageNumber})
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Notification Time */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>وقت التذكير اليومي</span>
                  <span className="text-[11px] font-bold text-slate-400">
                    بتوقيت جهازك
                  </span>
                </label>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'الفجر 06:00', time: '06:00' },
                    { label: 'الضحى 10:00', time: '10:00' },
                    { label: 'العصر 16:30', time: '16:30' },
                    { label: 'المساء 21:00', time: '21:00' }
                  ].map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setNotificationTime(preset.time)}
                      className={`py-2 px-1 text-[11px] font-black rounded-xl border transition-all cursor-pointer ${
                        notificationTime === preset.time
                          ? 'bg-brand-emerald text-white border-brand-emerald shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="time"
                    value={notificationTime}
                    onChange={(e) => setNotificationTime(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800 focus:bg-white focus:outline-none focus:border-brand-emerald font-black text-sm text-slate-800 dark:text-slate-100 transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Browser Permission Alert if not granted */}
              {permission !== 'granted' && isActive && (
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
                    <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>يجب تفعيل إذن الإشعارات بالجهاز لاستقبال التذكير.</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestPermissionAndRegister}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-black text-[11px] hover:bg-blue-700 transition-all shrink-0 cursor-pointer"
                  >
                    تفعيل الآن
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-brand-emerald to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ إعدادات الورد</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStartReadingNow}
                  className="w-full sm:w-auto py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-brand-gold" />
                  <span>قراءة الورد الآن</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null;
};

export default UserWirdModal;

