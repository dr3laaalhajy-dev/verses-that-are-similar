import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isAlert?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  isAlert = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[3.5rem] shadow-3xl overflow-hidden border border-white/20 p-10 text-center"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-8 left-8 p-2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Icon */}
            <div className="w-20 h-20 bg-brand-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-gold/5">
              <AlertCircle className="w-10 h-10 text-brand-gold" />
            </div>

            {/* Content */}
            <h2 className="text-3xl font-black text-brand-emerald mb-4 font-quran tracking-tight">
              {title}
            </h2>
            <p className="text-slate-500 font-bold mb-10 leading-relaxed text-lg px-2">
              {message}
            </p>

            {/* Actions */}
            <div className={`flex ${isAlert ? 'justify-center' : 'flex-row-reverse gap-4'}`}>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`${isAlert ? 'px-16' : 'flex-1'} py-4 bg-brand-emerald text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-emerald/20 hover:bg-brand-emerald/90 transition-all active:scale-95`}
              >
                حسناً
              </button>
              {!isAlert && (
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-lg border border-slate-100 hover:bg-slate-100 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
