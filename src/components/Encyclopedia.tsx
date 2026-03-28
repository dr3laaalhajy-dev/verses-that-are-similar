import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, ExternalLink, Globe, Sparkles } from 'lucide-react';

interface EncyclopediaProps {
  onBack: () => void;
}

const Encyclopedia: React.FC<EncyclopediaProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-inter" dir="rtl">
      {/* Elegant Header */}
      <motion.header 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 p-2 pr-4 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
          >
            <ArrowRight className="w-6 h-6" />
            <span className="font-black text-sm hidden sm:inline">العودة للشاشة الرئيسية</span>
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-800">موسوعة المتشابهات</h1>
              <p className="text-[10px] md:text-xs font-bold text-indigo-600">المصدر الخارجي المعتمد</p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-slate-400 font-bold text-sm">
          <ExternalLink className="w-4 h-4" />
          <span className="ltr:font-sans">quranpedia.net</span>
        </div>
      </motion.header>

      {/* Fallback View Area */}
      <main className="flex-1 w-full bg-linear-to-b from-white to-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-islamic-pattern" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-brand-emerald/5 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-xl w-full text-center space-y-8 relative z-10"
        >
          {/* Centered Icon & Branding */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-110 animate-pulse" />
              <div className="w-24 h-24 rounded-[2.5rem] bg-linear-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-2xl relative">
                <BookOpen className="w-12 h-12" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">موسوعة القرآن الكريم للمتشابهات</h2>
              <div className="flex items-center justify-center gap-2 text-brand-emerald font-black text-sm uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-brand-gold" />
                <span>محتوى مميز من QuranPedia</span>
              </div>
            </div>
          </div>

          {/* Explanation Text */}
          <div className="glass bg-white/60 p-8 rounded-[2.5rem] border border-white shadow-sm">
             <p className="text-slate-600 font-bold text-lg leading-relaxed">
               هذا المحتوى مقدم من موقع خارجي (QuranPedia). للحفاظ على تجربة الاستخدام وضمان أفضل عرض للمحتوى، سيتم فتح الموسوعة في نافذة جديدة بمتصفحك.
             </p>
          </div>

          {/* Call to Action */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => window.open('https://quranpedia.net/mutashabihat', '_blank', 'location=no')}
              className="group flex items-center gap-4 px-12 py-6 bg-linear-to-r from-indigo-600 to-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-2xl hover:shadow-indigo-500/20 hover:scale-[1.02] transition-all active:scale-95 cursor-pointer"
            >
              <Globe className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              <span>تصفح الموسوعة الآن</span>
            </button>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">تصفح المصدر من خلال المتصفح الداخلي</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Encyclopedia;
