import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileText, X, ExternalLink, Check } from 'lucide-react';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfUse } from './TermsOfUse';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  // Synchronize active tab whenever modal opens or initialTab prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-slate-50 rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-brand-gold" />
              </div>
              <div className="text-right">
                <h3 className="text-lg sm:text-xl font-black">
                  {activeTab === 'privacy' ? 'سياسة الخصوصية' : 'شروط وأحكام الاستخدام'}
                </h3>
                <p className="text-xs text-emerald-100 font-semibold mt-0.5">
                  تطبيق متين - رفيقك في ضبط المتشابهات القرآنية
                </p>
              </div>
            </div>

            {/* Tab switch */}
            <div className="grid grid-cols-2 gap-2 mt-4 bg-black/20 p-1.5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('privacy')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'privacy'
                    ? 'bg-white text-emerald-900 shadow-md scale-[1.01]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>سياسة الخصوصية</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('terms')}
                className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'terms'
                    ? 'bg-white text-emerald-900 shadow-md scale-[1.01]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>شروط الاستخدام</span>
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-right custom-scrollbar flex-1 bg-slate-50">
            {activeTab === 'privacy' ? <PrivacyPolicy /> : <TermsOfUse />}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-slate-500 hover:text-brand-emerald flex items-center gap-1.5 transition-colors order-2 sm:order-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح الصفحة الكاملة (للمتصفح / Google Play)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-xs sm:text-sm shadow-md hover:bg-brand-emerald/90 transition-all active:scale-95 flex items-center justify-center gap-2 order-1 sm:order-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>فهمت وموافق</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  ) : null;
};

export default PrivacyModal;