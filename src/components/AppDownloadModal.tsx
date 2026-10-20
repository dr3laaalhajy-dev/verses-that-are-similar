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
  WifiOff
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
  const [downloadTriggered, setDownloadTriggered] = useState(false);
  const progressTimerRef = useRef<any>(null);

  // Trigger download only once
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

    // Trigger download once
    triggerDownloadOnce();
    setDownloadTriggered(true);

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
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      setProgress(0);
      setIsCompleted(false);
      setDownloadTriggered(false);
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [isOpen]);

  // When user clicks the primary action when completed, close modal and show notification
  const handleOpenOrFinish = () => {
    onClose();
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
            className="relative w-full max-w-md bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-emerald-100/80 p-6 sm:p-8 text-center my-auto overflow-hidden"
          >
            {/* Top Islamic Accent Line */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-600 via-brand-gold to-emerald-600" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* App Icon */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-brand-gold/30 p-1.5 shadow-md mx-auto mb-3.5 flex items-center justify-center relative">
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
            <p className="text-xs text-slate-500 font-bold mb-5">
              الإصدار v1.0.0 • للأندرويد (APK) • أوفلاين بالكامل
            </p>

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-full text-xs font-bold">
                <WifiOff className="w-3.5 h-3.5 text-emerald-600" />
                <span>بدون إنترنت</span>
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-full text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>آمن ومجاني 100%</span>
              </span>
            </div>

            {/* Progress Section */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 mb-5 text-right">
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

            {/* Instructions upon completion */}
            {isCompleted ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 mb-5 text-right">
                <h4 className="text-xs font-black text-emerald-900 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                  <span>خطوات تثبيت وتشغيل التطبيق:</span>
                </h4>
                <ol className="text-xs text-emerald-800/90 font-medium space-y-1 list-decimal list-inside pr-1 leading-relaxed">
                  <li>افتح إشعار التحميل في هاتفك أو مجلد <strong>التنزيلات (Downloads)</strong>.</li>
                  <li>اضغط على ملف <strong className="font-mono text-emerald-950">Mutashabihat.apk</strong>.</li>
                  <li>اضغط <strong>"تثبيت"</strong> ثم <strong>"فتح"</strong> واستمتع باللعبة.</li>
                </ol>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              {isCompleted ? (
                <button
                  onClick={handleOpenOrFinish}
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

              {/* Only show single subtle re-download option if completed */}
              {isCompleted && (
                <button
                  onClick={startDownloadFlow}
                  className="text-xs text-slate-400 hover:text-emerald-700 font-bold py-1 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>لم يبدأ التحميل في هاتفك؟ اضغط لإعادة المحاولة</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
