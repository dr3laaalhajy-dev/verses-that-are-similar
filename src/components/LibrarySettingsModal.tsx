import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Moon, Sun } from 'lucide-react';

export interface LibrarySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    darkMode?: boolean;
    [key: string]: any;
  };
  setSettings: (settings: any) => void;
  showReadingMode?: boolean;
}

export const LibrarySettingsModal: React.FC<LibrarySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  showReadingMode = false
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/20 theme-transition ${settings.darkMode ? 'mushaf-dark border-white/5' : ''}`}
          >
            <div className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">إعدادات القراءة</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8 text-right" dir="rtl">
                {/* Dark Mode */}
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${settings.darkMode ? 'bg-indigo-500 text-white' : 'bg-brand-gold/10 text-brand-gold'}`}>
                      {settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800">الوضع الداكن</h4>
                      <p className="text-xs text-slate-400 font-bold">قراءة مريحة للعين في الليل</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 relative ${settings.darkMode ? 'bg-brand-emerald' : 'bg-slate-300'}`}
                    dir="ltr"
                  >
                    <motion.div
                      animate={{ x: settings.darkMode ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="w-6 h-6 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-slate-800 transition-all shadow-xl active:scale-95"
              >
                حفظ التغييرات
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LibrarySettingsModal;

