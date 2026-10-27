import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Share2,
  Check,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Copy
} from 'lucide-react';

// Official-style multi-color Google Play triangle SVG icon
export const GooglePlayLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Left blue triangle */}
    <path
      d="M3.609 1.814L13.793 12 3.61 22.186A2.372 2.372 0 0 1 3 20.508V3.492c0-.648.219-1.246.609-1.678z"
      fill="#00D3FF"
    />
    {/* Right yellow triangle */}
    <path
      d="M17.332 8.461l-3.539 3.539 3.539 3.539 4.103-2.345a1.808 1.808 0 0 0 0-3.149l-4.103-2.584z"
      fill="#FFCE00"
    />
    {/* Top green triangle */}
    <path
      d="M3.609 1.814C3.992 1.39 4.57 1.134 5.223 1.503l12.109 6.958-3.539 3.539L3.609 1.814z"
      fill="#00F076"
    />
    {/* Bottom red triangle */}
    <path
      d="M13.793 12l3.539 3.539-12.109 6.958c-.653.369-1.231.113-1.614-.311L13.793 12z"
      fill="#FF3A44"
    />
  </svg>
);

// High-end Google Play Button for page bottoms / footers
interface GooglePlayButtonProps {
  status: 'idle' | 'loading' | 'pending' | 'approved' | 'rejected' | 'error';
  onClick: () => void;
  className?: string;
}

export const GooglePlayButton: React.FC<GooglePlayButtonProps> = ({
  status,
  onClick,
  className = ''
}) => {
  const isApproved = status === 'approved';
  const isPending = status === 'pending';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative overflow-hidden flex items-center gap-3.5 px-5 py-3 sm:px-6 sm:py-3.5 rounded-2xl bg-slate-900/95 hover:bg-slate-900 text-white border transition-all duration-300 shadow-xl cursor-pointer ${
        isApproved
          ? 'border-emerald-500/70 shadow-emerald-950/40 hover:border-emerald-400'
          : isPending
          ? 'border-amber-500/60 shadow-amber-950/30 hover:border-amber-400'
          : 'border-slate-700/80 hover:border-emerald-500/50 shadow-slate-950/50'
      } ${className}`}
    >
      {/* Subtle ambient gradient sheen */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

      {/* Google Play Logo */}
      <div className="relative shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800/80 border border-white/10 group-hover:border-white/20 transition-colors shadow-inner">
        <GooglePlayLogo className="w-5 h-5 sm:w-6 sm:h-6" />
        {isApproved && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
        {isPending && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
        )}
      </div>

      {/* Text Labels */}
      <div className="flex flex-col text-right">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] sm:text-xs font-bold ${
              isApproved
                ? 'text-emerald-400'
                : isPending
                ? 'text-amber-400'
                : 'text-slate-300'
            }`}
          >
            {isApproved
              ? 'تم القبول بنجاح ✓'
              : isPending
              ? 'طلبك قيد المراجعة ⏳'
              : 'احصل عليه من'}
          </span>
          {isPending && (
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/30">
              تحديث تلقائي
            </span>
          )}
        </div>
        <span className="text-sm sm:text-base font-black text-white tracking-wide leading-tight group-hover:text-brand-gold transition-colors">
          {isApproved ? 'تثبيت من Google Play' : isPending ? 'متابعة حالة الطلب' : 'Google Play'}
        </span>
      </div>

      {/* Trailing badge / status indicator */}
      <div className="mr-auto shrink-0 pr-1">
        {isApproved ? (
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
            <Check className="w-3.5 h-3.5" />
          </div>
        ) : isPending ? (
          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
        ) : (
          <span className="text-[10px] font-black bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded-full border border-brand-gold/30 whitespace-nowrap hidden sm:inline-block">
            تجريبي
          </span>
        )}
      </div>
    </motion.button>
  );
};

// Modal Component
interface GooglePlayTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  testerEmail: string;
  setTesterEmail: (email: string) => void;
  testerStatus: 'idle' | 'loading' | 'pending' | 'approved' | 'rejected' | 'error';
  testerMessage: string;
  internalTestLink: string;
  onRegister: (e: React.FormEvent) => Promise<void>;
  onReset: () => void;
  onOpenDirectApk: () => void;
  onShareApp: () => void;
  shareCopied: boolean;
  isCheckingSavedStatus?: boolean;
}

export const GooglePlayTesterModal: React.FC<GooglePlayTesterModalProps> = ({
  isOpen,
  onClose,
  testerEmail,
  setTesterEmail,
  testerStatus,
  testerMessage,
  internalTestLink,
  onRegister,
  onReset,
  onOpenDirectApk,
  onShareApp,
  shareCopied,
  isCheckingSavedStatus = false
}) => {
  const isApproved = testerStatus === 'approved';
  const isPending = testerStatus === 'pending';
  const isLoading = testerStatus === 'loading';
  const [copiedLinkSuccess, setCopiedLinkSuccess] = useState(false);

  const handleCopyTestLink = () => {
    try {
      navigator.clipboard.writeText(internalTestLink);
      setCopiedLinkSuccess(true);
      setTimeout(() => setCopiedLinkSuccess(false), 3000);
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-emerald-500/30 p-6 sm:p-8 my-auto overflow-hidden z-10"
          >
            {/* Ambient Background Lights */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-gold/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header: Close Button & App Info */}
            <div className="relative z-10 flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-800/90 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/50">
                  <GooglePlayLogo className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg sm:text-xl text-white">
                      تطبيق «متين» على Google Play
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-brand-gold/20 text-brand-gold text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full border border-brand-gold/40">
                      نسخة تجريبية 1.0.1
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      المسار التجريبي المغلق
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-white/10 shrink-0 cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Interactive Body */}
            <div className="relative z-10 flex flex-col gap-5">
              {/* STATE 1: APPROVED */}
              {isApproved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col gap-4 text-right"
                >
                  {/* Success Status Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-right flex items-start gap-3.5 shadow-inner">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 mt-0.5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-black text-base text-emerald-300">
                        تهانينا! بريدك الإلكتروني معتمد كمختبر رسمي
                      </h4>
                      <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1 leading-relaxed">
                        تم تسجيل بريدك{' '}
                        <span className="font-bold text-white underline decoration-emerald-400">
                          {testerEmail}
                        </span>{' '}
                        بنجاح في نظام Google Play. يرجى اتباع التعليمات الهامة أدناه لقبول الاختبار وتثبيت التطبيق.
                      </p>
                    </div>
                  </div>

                  {/* CRITICAL WARNING & INSTRUCTIONS BOX */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/15 border-2 border-amber-400/50 shadow-lg text-right space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-black text-sm sm:text-base border-b border-amber-500/20 pb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                      <span>تنبيه وإرشادات هامة جداً للتحميل (Google Play)</span>
                    </div>

                    <div className="space-y-3 text-xs sm:text-[13px] text-amber-100 font-medium leading-relaxed">
                      {/* Step 1 */}
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          1
                        </span>
                        <div>
                          <strong className="text-white font-black block text-xs sm:text-sm">تسجيل الدخول بنفس الإيميل:</strong>
                          <span className="text-amber-100/90">
                            عند فتح رابط Google Play، <strong className="text-amber-300 underline font-black">يجب إجبارياً</strong> تسجيل الدخول في المتصفح بنفس الإيميل المسجل (<span className="text-white font-bold" dir="ltr">{testerEmail}</span>). إذا فتحت برابط أو حساب آخر، سيظهر لك متجر جوجل أن التطبيق غير متاح لهذا الحساب!
                          </span>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          2
                        </span>
                        <div>
                          <strong className="text-white font-black block text-xs sm:text-sm">الضغط على زر قبول الدعوة (Become a tester):</strong>
                          <span className="text-amber-100/90">
                            داخل صفحة الرابط، اضغط على الزر المكتوب عليه: <strong className="text-white font-black">«القبول كـ مختبر / Become a tester»</strong> لتفعيل حسابك في متجر Play.
                          </span>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          3
                        </span>
                        <div>
                          <strong className="text-white font-black block text-xs sm:text-sm">تنزيل التطبيق من متجر Google Play:</strong>
                          <span className="text-amber-100/90">
                            افتح متجر Google Play على هاتفك بنفس الحساب (<span className="text-white font-bold" dir="ltr">{testerEmail}</span>)، واضغط على رابط التنزيل لتثبيت التطبيق ومتابعة التحديثات تلقائياً.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA: Open in Google Play */}
                  <a
                    href={internalTestLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 rounded-2xl font-black text-sm sm:text-base shadow-xl shadow-emerald-950/60 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-center"
                  >
                    <GooglePlayLogo className="w-5 h-5 shrink-0" />
                    <span>قبول الاختبار وتثبيت التطبيق من Google Play</span>
                    <ExternalLink className="w-4 h-4 text-slate-950 shrink-0" />
                  </a>

                  {/* Copy Link Button */}
                  <button
                    type="button"
                    onClick={handleCopyTestLink}
                    className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    {copiedLinkSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-black">تم نسخ رابط قبول الاختبار بنجاح ✓</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-brand-gold shrink-0" />
                        <span>نسخ رابط الاختبار المباشر (لفتحه في متصفح حسابك)</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center pt-1">
                    <button
                      type="button"
                      onClick={onReset}
                      className="text-xs text-slate-400 hover:text-emerald-300 underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      تسجيل بريد إلكتروني آخر
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE 2: PENDING (Automatic real-time polling) */}
              {isPending && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col gap-4 text-right"
                >
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 shadow-inner">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
                      <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-black text-base text-amber-300">
                          طلبك قيد المراجعة حالياً
                        </h4>
                        <span className="flex items-center gap-1.5 text-[10px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          <span>تحديث تلقائي</span>
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-amber-100/90 font-medium mt-1 leading-relaxed">
                        تم تسجيل بريدك{' '}
                        <span className="font-bold text-white underline decoration-amber-400">
                          {testerEmail}
                        </span>{' '}
                        بنجاح وهو الآن بانتظار اعتماد الإدارة في وحدة تحكم Google Play.
                      </p>
                    </div>
                  </div>

                  {/* Realtime Auto-Check Status Indicator */}
                  <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <RefreshCw
                        className={`w-4 h-4 text-emerald-400 ${
                          isCheckingSavedStatus ? 'animate-spin' : 'animate-spin'
                        }`}
                        style={{ animationDuration: '3s' }}
                      />
                      <span>يتم التحقق تلقائياً من حالة القبول في الخلفية...</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      مباشر
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    💡 لا حاجة للضغط على أي زر؛ بمجرد أن تعتمد الإدارة طلبك، ستتحول هذه الشاشة فوراً وبشكل تلقائي لتمكين التثبيت المباشر.
                  </p>

                  <div className="flex items-center justify-center pt-1">
                    <button
                      type="button"
                      onClick={onReset}
                      className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors cursor-pointer"
                    >
                      تغيير البريد الإلكتروني
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE 3: IDLE / FORM / ERROR */}
              {!isApproved && !isPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-4 text-right"
                >
                  <div className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed bg-slate-800/50 p-4 rounded-2xl border border-white/5 space-y-2.5">
                    <p>
                      يسعدنا انضمامك لقائمة مختبري تطبيق «متين» على متجر Google Play! نظراً لسياسات المتجر للمسار التجريبي، يتطلب التنزيل إضافة بريدك الإلكتروني (Gmail) أولاً في قائمة المختبرين.
                    </p>
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 font-bold flex items-start gap-2.5 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-white font-black">تنبيه هام:</strong> يرجى التأكد من كتابة نفس بريد Gmail الذي تستخدمه في متجر Google Play على هاتفك، لتتمكن لاحقاً من قبول الاختبار وتنزيل التطبيق من المتجر دون مشاكل.
                      </span>
                    </div>
                  </div>

                  <form onSubmit={onRegister} className="flex flex-col gap-3">
                    <div className="relative">
                      <Mail className="w-5 h-5 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="email"
                        value={testerEmail}
                        onChange={(e) => setTesterEmail(e.target.value)}
                        placeholder="أدخل بريدك الإلكتروني (Gmail)..."
                        className="w-full bg-slate-950/80 border border-emerald-500/40 focus:border-brand-gold rounded-2xl py-3 pr-11 pl-4 text-sm text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner"
                        dir="ltr"
                        autoFocus
                        required
                      />
                    </div>

                    {testerMessage && testerStatus === 'error' && (
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-300 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        <span>{testerMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 px-6 bg-gradient-to-r from-brand-gold via-amber-500 to-brand-gold hover:from-amber-400 hover:to-brand-gold disabled:opacity-50 text-slate-950 rounded-2xl font-black text-sm sm:text-base shadow-xl shadow-amber-950/40 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                          <span>جاري إرسال الطلب...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-slate-950" />
                          <span>إرسال طلب الانضمام للتجربة</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* Secondary Actions / Fallback APK */}
              <div className="mt-3 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span>أو يمكنك أيضاً:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDirectApk();
                    }}
                    className="text-brand-gold hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل ملف APK المباشر</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onShareApp}
                  className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="مشاركة رابط التطبيق"
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">تم نسخ رابط التطبيق</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>مشاركة التطبيق</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
