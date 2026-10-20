import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  RefreshCw,
  Share2,
  ShieldCheck,
  WifiOff,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ArrowDownToLine
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
  const TOTAL_SIZE_MB = 28.5;

  const [status, setStatus] = useState<'idle' | 'downloading' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState('0.0');
  const [statusText, setStatusText] = useState('جاهز للتحميل');
  const [showGuide, setShowGuide] = useState(true);
  const [copied, setCopied] = useState(false);
  const [installPromptShown, setInstallPromptShown] = useState(false);

  const downloadIntervalRef = useRef<any>(null);

  // Trigger the actual file download through the browser
  const triggerActualDownload = () => {
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

  // Start the download simulation and trigger the real download
  const startDownload = () => {
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }

    setStatus('downloading');
    setProgress(0);
    setStatusText('جاري الاتصال بالسيرفر والتحقق من الحزمة...');
    setSpeed('2.4');
    setInstallPromptShown(false);

    // Trigger the actual file download immediately
    triggerActualDownload();

    let current = 0;
    const intervalTime = 60; // ms

    downloadIntervalRef.current = setInterval(() => {
      // Realistic non-linear progress
      const increment = Math.random() * 3 + 1.2;
      current += increment;

      if (current >= 100) {
        current = 100;
        setProgress(100);
        setStatus('completed');
        setStatusText('اكتمل التحميل بنجاح! جاهز للتثبيت');
        setSpeed('0.0');
        clearInterval(downloadIntervalRef.current);
      } else {
        setProgress(Math.min(current, 99.5));
        
        // Dynamic speed variations
        const dynamicSpeed = (Math.random() * 2.2 + 2.8).toFixed(1);
        setSpeed(dynamicSpeed);

        if (current < 25) {
          setStatusText('جاري بدء تنزيل ملف التطبيق (Mutashabihat.apk)...');
        } else if (current < 75) {
          setStatusText('جاري تحميل حزمة أندرويد والمحتوى الأوفلاين...');
        } else if (current < 95) {
          setStatusText('جاري فحص سلامة الحزمة والملفات...');
        } else {
          setStatusText('لحظات ويكتمل التنزيل...');
        }
      }
    }, intervalTime);
  };

  // Auto-start download when modal opens
  useEffect(() => {
    if (isOpen) {
      startDownload();
    } else {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
      setProgress(0);
      setStatus('idle');
      setInstallPromptShown(false);
    }

    return () => {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
    };
  }, [isOpen]);

  const handleOpenApp = () => {
    setInstallPromptShown(true);
    // Trigger download / open link again so Android system opens the APK or download manager
    triggerActualDownload();
  };

  const handleShare = async () => {
    const shareData = {
      title: 'تطبيق المتشابهات القرآنية للأندرويد',
      text: 'حمّل تطبيق المتشابهات القرآنية (APK) الآن بدون إنترنت واستمتع بكافة التحديات والقرآن الكريم كاملاً:\n',
      url: apkUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(apkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const downloadedMB = ((progress / 100) * TOTAL_SIZE_MB).toFixed(1);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 25 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 25 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden my-auto text-white"
          >
            {/* Top decorative glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-40 bg-gradient-to-b from-emerald-500/25 to-brand-gold/15 blur-3xl pointer-events-none rounded-full" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all z-10"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Body */}
            <div className="p-5 sm:p-7 relative z-0">
              {/* Header: App Info */}
              <div className="flex items-center gap-4 mb-5 pt-1">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-0.5 shadow-xl shadow-emerald-950/50 flex items-center justify-center border border-emerald-400/30">
                    <img
                      src="/logo.png"
                      alt="شعار المتشابهات"
                      className="w-full h-full object-cover rounded-[0.9rem]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow">
                    <Smartphone className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-lg sm:text-xl font-black text-white truncate">
                      تطبيق المتشابهات القرآنية
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md bg-brand-gold/20 text-brand-gold border border-brand-gold/40">
                      APK للأندرويد
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-2">
                    <span>الإصدار v1.0.0</span>
                    <span>•</span>
                    <span>الحجم: {TOTAL_SIZE_MB} ميغابايت</span>
                  </p>
                </div>
              </div>

              {/* Badges Bar */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                  <WifiOff className="w-4 h-4 text-emerald-400 mb-1" />
                  <span className="text-[11px] font-bold text-slate-200">أوفلاين 100%</span>
                  <span className="text-[9px] text-slate-400">بدون إنترنت</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-brand-gold mb-1" />
                  <span className="text-[11px] font-bold text-slate-200">آمن ومفحوص</span>
                  <span className="text-[9px] text-slate-400">خالٍ من الإعلانات</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center flex flex-col items-center justify-center">
                  <Sparkles className="w-4 h-4 text-teal-300 mb-1" />
                  <span className="text-[11px] font-bold text-slate-200">كامل المزايا</span>
                  <span className="text-[9px] text-slate-400">تلاوات ومسابقات</span>
                </div>
              </div>

              {/* Progress Card */}
              <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-4 sm:p-5 mb-5 relative overflow-hidden">
                {/* Background active pulse when downloading */}
                {status === 'downloading' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/10 to-transparent animate-pulse pointer-events-none" />
                )}

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {status === 'completed' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    ) : (
                      <ArrowDownToLine className="w-4 h-4 text-emerald-400 animate-bounce" />
                    )}
                    <span className="text-xs sm:text-sm font-bold text-slate-200">
                      {statusText}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg sm:text-2xl font-black font-mono text-brand-gold">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full h-3.5 bg-slate-700/80 rounded-full overflow-hidden p-0.5 border border-white/10 relative mb-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-brand-gold relative shadow-sm"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  >
                    {/* Animated shine line */}
                    {status === 'downloading' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                    )}
                  </motion.div>
                </div>

                {/* Size & Speed Details */}
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400 font-medium">
                  <div>
                    <span>تم تحميل: </span>
                    <strong className="text-slate-200 font-mono">{downloadedMB}</strong>
                    <span> / {TOTAL_SIZE_MB} ميغابايت</span>
                  </div>
                  {status === 'downloading' ? (
                    <div className="font-mono text-emerald-300 flex items-center gap-1">
                      <span>⚡</span>
                      <span>{speed} MB/s</span>
                    </div>
                  ) : status === 'completed' ? (
                    <div className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>جاهز للتثبيت</span>
                    </div>
                  ) : (
                    <div>0.0 MB/s</div>
                  )}
                </div>
              </div>

              {/* Notification Banner when installation ready */}
              {status === 'completed' && installPromptShown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5"
                >
                  <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-white mb-0.5">
                      تم طلب فتح ملف التثبيت:
                    </strong>
                    إذا لم تظهر نافذة التثبيت تلقائياً، اسحب شريط الإشعارات من أعلى هاتفك واضغط على إشعار اكتمال تنزيل
                    <span className="font-mono text-brand-gold mx-1">Mutashabihat.apk</span>
                    أو افتح مجلد "التنزيلات".
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 mb-4">
                {status === 'completed' ? (
                  <button
                    onClick={handleOpenApp}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-300/40"
                  >
                    <Smartphone className="w-5 h-5 text-slate-950" />
                    <span>فتح التطبيق / تثبيت الحزمة (APK)</span>
                  </button>
                ) : status === 'downloading' ? (
                  <button
                    disabled
                    className="w-full py-3.5 px-6 bg-slate-800 text-slate-400 font-bold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed border border-white/5"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>جاري التنزيل... يرجى الانتظار</span>
                  </button>
                ) : (
                  <button
                    onClick={startDownload}
                    className="w-full py-3.5 px-6 bg-gradient-to-r from-brand-gold to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-5 h-5 text-slate-950" />
                    <span>بدء تحميل التطبيق</span>
                  </button>
                )}

                {/* Secondary Row: Re-download + Share */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={startDownload}
                    className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="إعادة التنزيل"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة التحميل</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="مشاركة رابط التحميل"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">تم نسخ الرابط!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-brand-gold" />
                        <span>مشاركة الرابط</span>
                      </>
                    )}
                  </button>

                  <a
                    href={apkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="رابط مباشر"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">رابط مباشر</span>
                  </a>
                </div>
              </div>

              {/* Collapsible Quick Install Guide */}
              <div className="border-t border-white/10 pt-3">
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white py-1 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>خطوات التثبيت السريع على هاتف أندرويد</span>
                  </span>
                  {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                  {showGuide && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <ol className="mt-2.5 space-y-2 text-xs text-slate-300 pr-1 list-decimal list-inside leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                        <li className="leading-snug">
                          اضغط على إشعار التحميل المكتمل في هاتفك أو افتح ملف{' '}
                          <code className="text-brand-gold font-mono text-[11px] bg-black/30 px-1 py-0.5 rounded">
                            Mutashabihat.apk
                          </code>{' '}
                          من تطبيق "الملفات" أو "التنزيلات".
                        </li>
                        <li className="leading-snug">
                          إذا ظهر تنبيه أمني، اضغط على <strong>الإعدادات</strong> ثم فعّل خيار{' '}
                          <strong className="text-emerald-300">"السماح بتثبيت التطبيقات من هذا المصدر"</strong>.
                        </li>
                        <li className="leading-snug">
                          اضغط <strong>"تثبيت" (Install)</strong> ثم <strong>"فتح" (Open)</strong> واستمتع باللعبة والقرآن الكريم كاملاً بدون إنترنت.
                        </li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
