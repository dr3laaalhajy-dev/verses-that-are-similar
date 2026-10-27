import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, ExternalLink, Globe, Sparkles } from 'lucide-react';

interface EncyclopediaProps {
  onBack: () => void;
  darkMode?: boolean;
}

const Encyclopedia: React.FC<EncyclopediaProps> = ({ onBack, darkMode = false }) => {
  return (
    <div className={`flex flex-col min-h-screen overflow-hidden font-inter pb-32 sm:pb-40 transition-colors ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`} dir="rtl">
      {/* Elegant Header */}
      <motion.header 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className={`flex items-center justify-between px-6 py-4 border-b shadow-sm z-30 shrink-0 transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`group flex items-center gap-2 p-1.5 md:p-2 pr-3 md:pr-4 rounded-xl transition-all border ${
              darkMode 
                ? 'hover:bg-slate-800 text-slate-200 hover:text-indigo-400 border-transparent hover:border-slate-700'
                : 'hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border-transparent hover:border-indigo-100'
            }`}
          >
            <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
            <span className="font-black text-xs md:text-sm hidden sm:inline">العودة</span>
          </button>
          <div className={`h-6 md:h-8 w-px mx-1 md:mx-2 hidden sm:block ${
            darkMode ? 'bg-slate-800' : 'bg-slate-200'
          }`} />
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Globe className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className={`text-sm md:text-xl font-black leading-tight ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>موسوعة المتشابهات</h1>
              <p className={`text-[9px] md:text-xs font-bold opacity-80 ${
                darkMode ? 'text-indigo-400' : 'text-indigo-600'
              }`}>المصدر الخارجي المعتمد</p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-slate-400 font-bold text-sm">
          <ExternalLink className="w-4 h-4" />
          <span className="ltr:font-sans">quranpedia.net</span>
        </div>
      </motion.header>

      {/* Fallback View Area */}
      <main className={`flex-1 w-full flex items-center justify-center p-4 md:p-6 relative overflow-hidden transition-colors ${
        darkMode ? 'bg-linear-to-b from-slate-900 to-slate-950' : 'bg-linear-to-b from-white to-slate-50'
      }`}>
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-islamic-pattern" />
        <div className="absolute -top-24 -right-24 w-64 md:w-96 h-64 md:h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 md:w-96 h-64 md:h-96 bg-brand-emerald/5 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-xl w-full text-center space-y-6 md:space-y-8 relative z-10"
        >
          {/* Centered Icon & Branding */}
          <div className="flex flex-col items-center gap-4 md:gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-110 animate-pulse" />
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] md:rounded-[2.5rem] bg-linear-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-2xl relative">
                <BookOpen className="w-10 h-10 md:w-12 md:h-12" />
              </div>
            </div>
            <div className="space-y-2 md:space-y-3 px-4">
              <h2 className={`text-xl md:text-4xl font-black tracking-tight leading-snug ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>موسوعة القرآن الكريم للمتشابهات</h2>
              <div className={`flex items-center justify-center gap-2 font-black text-[10px] md:text-sm uppercase tracking-widest ${
                darkMode ? 'text-emerald-400' : 'text-brand-emerald'
              }`}>
                <Sparkles className="w-3 md:w-4 h-3 md:h-4 text-brand-gold" />
                <span>محتوى مميز من QuranPedia</span>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div className={`p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border shadow-sm transition-colors ${
            darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/85 border-slate-200/80'
          }`}>
             <p className={`font-bold text-sm md:text-lg leading-relaxed ${
               darkMode ? 'text-slate-200' : 'text-slate-600'
             }`}>
               هذا المحتوى مقدم من موقع خارجي (QuranPedia). للحفاظ على تجربة الاستخدام وضمان أفضل عرض للمحتوى، سيتم فتح الموسوعة في نافذة جديدة بمتصفحك.
             </p>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => window.open('https://quranpedia.net/mutashabihat', '_blank', 'location=no')}
              className="group flex items-center gap-3 md:gap-4 px-8 md:px-12 py-4 md:py-6 bg-linear-to-r from-indigo-600 to-indigo-700 text-white rounded-[1.5rem] md:rounded-[2rem] font-black text-lg md:text-xl shadow-2xl hover:shadow-indigo-500/20 hover:scale-[1.02] transition-all active:scale-95 cursor-pointer"
            >
              <Globe className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform" />
              <span>تصفح الموسوعة الآن</span>
            </button>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">تصفح المصدر من خلال المتصفح الداخلي</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Encyclopedia;
