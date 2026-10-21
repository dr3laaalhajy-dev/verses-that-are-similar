import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Smartphone,
  RefreshCw,
  FolderDown,
  Sparkles,
  ShieldCheck,
  WifiOff,
  AlertTriangle,
  ChevronLeft,
  ArrowRight,
  Info,
  Check
} from 'lucide-react';

interface AppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  apkUrl?: string;
}

export const AppDownloadModal: React.FC<AppDownloadModalProps> = ({
  isOpen,
  onClose,
  apkUrl = 'https://github.com/dr3laaalhajy-dev/verses-that-are-similar/releases/download/v1.0.0/Mutashabihat.apk'
}) => {
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWarningDrawer, setShowWarningDrawer] = useState(false);
  const [openedDownloadsToast, setOpenedDownloadsToast] = useState(false);
  const progressTimerRef = useRef<any>(null);

  // Trigger download only once when starting
  const triggerDownloadOnce = () => {
    try {
      const link = document.createElement('a');
      link.href = apkUrl;
      link.setAttribute('download', 'Mutashabihat.apk');
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(apkUrl, '_blank');
    }
  };

  const startDownloadFlow = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    setProgress(0);
    setIsCompleted(false);
    setOpenedDownloadsToast(false);

    // Trigger download once
    triggerDownloadOnce();

    let current = 0;
    progressTimerRef.current = setInterval(() => {
      current += Math.random() * 12 + 8;
      if (current >= 100) {
        current = 100;
        setProgress(100);
        setIsCompleted(true);
        clearInterval(progressTimerRef.current);
      } else {
        setProgress(Math.floor(current));
      }
    }, 150);
  };

  useEffect(() => {
    if (isOpen) {
      startDownloadFlow();
      setShowWarningDrawer(false);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      setProgress(0);
      setIsCompleted(false);
      setShowWarningDrawer(false);
      setOpenedDownloadsToast(false);
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isOpen]);

  // Handle opening Android Downloads manager / folder directly
  const handleOpenDownloads = () => {
    setOpenedDownloadsToast(true);

    const isAndroid = /android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      // 1. Direct intent for Android Downloads app
      try {
        window.location.href = 'intent://#Intent;action=android.intent.action.VIEW_DOWNLOADS;end;';
      } catch {
        // Fallback
      }

      // 2. Secondary fallback for different manufacturer file managers (Samsung, Xiaomi, etc.)
      setTimeout(() => {
        try {
          window.location.href = 'content://downloads/my_downloads';
        } catch {
          // ignore
        }
      }, 400);
    } else {
      // Desktop / other
      try {
        window.open('chrome://downloads/', '_blank');
      } catch {
        // ignore
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-4" dir="rtl">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-emerald-100/80 p-6 sm:p-7 text-center my-auto overflow-hidden max-h-[92vh] flex flex-col justify-between"
          >
            {/* Top Islamic Accent Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-brand-gold to-emerald-600" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors z-10"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Scrollable Modal Content */}
            <div className="overflow-y-auto pt-2">
              {/* App Icon */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-brand-gold/30 p-1.5 shadow-md mx-auto mb-3 flex items-center justify-center relative">
                <img
                  src="/logo.png"
                  alt="شعار المتشابهات"
                  className="w-full h-full object-contain rounded-2xl"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-emerald text-white border-2 border-white flex items-center justify-center shadow-xs">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* App Title & Subtitle */}
              <h3 className="text-xl sm:text-2xl font-black text-brand-emerald tracking-tight mb-1">
                تطبيق المتشابهات القرآنية
              </h3>
              <p className="text-xs text-slate-500 font-bold mb-4">
                الإصدار v1.0.0 • للأندرويد (APK) • أوفلاين بالكامل
              </p>

              {/* Badges */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-full text-xs font-bold">
                  <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بدون إنترنت</span>
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-full text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>آمن ومجاني 100%</span>
                </span>
              </div>

              {/* Progress Card */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 mb-4 text-right">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-black">اكتمل التنزيل بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                        <span>جاري تنزيل ملف التطبيق (APK)...</span>
                      </>
                    )}
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-brand-emerald">
                    {progress}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-500 to-brand-gold transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 font-bold">
                  <span>الملف: Mutashabihat.apk</span>
                  <span>الحجم: 28.5 ميغابايت</span>
                </div>
              </div>

              {/* Toast when Open Downloads clicked */}
              {openedDownloadsToast && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 mb-4 text-xs text-emerald-900 font-bold text-right flex items-start gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span>تم فتح مسار التنزيلات في هاتفك.</span>
                    <span className="block font-medium text-emerald-700 mt-0.5">
                      إذا لم يفتح مجلد التنزيلات تلقائياً، اسحب شريط الإشعارات من أعلى هاتفك واضغط على ملف <strong className="font-mono text-emerald-950">Mutashabihat.apk</strong> للبدء بالتثبيت.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Security Warning Curtain Toggle Button (البرداية) */}
              <button
                type="button"
                onClick={() => setShowWarningDrawer(true)}
                className="w-full p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/80 hover:from-amber-100 hover:to-orange-100 border border-amber-200/90 rounded-2xl text-right flex items-center justify-between gap-3 text-amber-900 transition-all cursor-pointer shadow-xs group mb-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-700 shadow-inner">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div>
                    <span className="block text-xs font-black text-amber-950">
                      هل ظهر لك تحذير "التطبيق غير معروف أو غير آمن"؟
                    </span>
                    <span className="block text-[11px] text-amber-700 font-medium">
                      اضغط هنا لمشاهدة خطوات السماح بالتثبيت (آمن 100%)
                    </span>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-amber-600 group-hover:-translate-x-1 transition-transform shrink-0" />
              </button>
            </div>

            {/* Bottom Primary Actions */}
            <div className="pt-2 flex flex-col gap-2">
              {isCompleted ? (
                <button
                  type="button"
                  onClick={handleOpenDownloads}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-brand-emerald to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-900/15 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FolderDown className="w-5 h-5 text-brand-gold" />
                  <span>فتح التنزيلات لتثبيت التطبيق</span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3.5 px-6 bg-slate-100 text-slate-400 font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>جاري التحميل... يرجى الانتظار</span>
                </button>
              )}

              {/* Subtle Re-download in case it didn't trigger */}
              {isCompleted && (
                <button
                  type="button"
                  onClick={startDownloadFlow}
                  className="text-xs text-slate-400 hover:text-emerald-700 font-bold py-1 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>لم يبدأ التحميل في هاتفك؟ اضغط لإعادة المحاولة</span>
                </button>
              )}
            </div>

            {/* ========================================================= */}
            {/* THE "برداية" (CURTAIN / DRAWER) FOR SECURITY WARNING STEPS  */}
            {/* ========================================================= */}
            <AnimatePresence>
              {showWarningDrawer && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                  className="absolute inset-0 bg-white rounded-3xl md:rounded-[2.5rem] z-30 p-5 sm:p-6 flex flex-col text-right shadow-2xl overflow-hidden"
                >
                  {/* Top drag handle / indicator */}
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />

                  {/* Header of Curtain */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-150 mb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-slate-800">
                          حل تحذير أمان أندرويد (Play Protect)
                        </h4>
                        <p className="text-[11px] text-slate-400 font-bold">
                          خطوات سريعة وسهلة لتخطي التحذير وتثبيت التطبيق
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowWarningDrawer(false)}
                      className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                      title="إغلاق البرداية"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Content inside Curtain */}
                  <div className="overflow-y-auto space-y-3 pr-1 text-slate-700 text-xs">
                    {/* Security Notice Card */}
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2 text-emerald-900 leading-relaxed font-medium">
                      <Sparkles className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-emerald-950 mb-0.5">
                          تطبيق المتشابهات آمن 100% وخالٍ تماماً من الإعلانات
                        </strong>
                        يظهر هذا التحذير الروتيني من نظام أندرويد لحماية المستخدم عند تثبيت أي تطبيق بصيغة APK من خارج متجر Google Play الرسمي.
                      </div>
                    </div>

                    {/* Step 1: Play Protect Block */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-right">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                          1
                        </span>
                        <strong className="text-xs font-black text-slate-800">
                          إذا ظهر: «تم حظر التطبيق بواسطة Play Protect»
                        </strong>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed mr-7">
                        اضغط على عبارة <strong className="text-amber-800 bg-amber-100 px-1 py-0.5 rounded">«مزيد من التفاصيل» (More details)</strong> أسفل التحذير، ثم اختر <strong className="text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">«التثبيت على أي حال» (Install anyway)</strong>.
                      </p>
                    </div>

                    {/* Step 2: Unknown Sources Permission */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-right">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                          2
                        </span>
                        <strong className="text-xs font-black text-slate-800">
                          إذا طُلب: «تثبيت تطبيقات غير معروفة»
                        </strong>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed mr-7">
                        اضغط على <strong className="text-slate-800 bg-slate-200 px-1 py-0.5 rounded">«الإعدادات» (Settings)</strong>، ثم فعّل خيار <strong className="text-emerald-800 bg-emerald-100 px-1 py-0.5 rounded">«السماح بتثبيت التطبيقات من هذا المصدر»</strong>. ثم اضغط رجوع واختر <strong className="text-emerald-800 font-black">«تثبيت» (Install)</strong>.
                      </p>
                    </div>

                    {/* Step 3: Enjoy */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-right">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-brand-emerald text-white font-black text-[11px] flex items-center justify-center shrink-0">
                          3
                        </span>
                        <strong className="text-xs font-black text-slate-800">
                          تشغيل التطبيق فوراً
                        </strong>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed mr-7">
                        اضغط <strong>«فتح» (Open)</strong> واستمتع باللعبة والمصحف كاملاً بدون الحاجة للإنترنت!
                      </p>
                    </div>
                  </div>

                  {/* Curtain Bottom Action */}
                  <div className="pt-3 border-t border-slate-150 mt-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowWarningDrawer(false)}
                      className="w-full py-3 bg-brand-emerald hover:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-brand-gold" />
                      <span>فهمت الخطوات، متابعة التثبيت</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
