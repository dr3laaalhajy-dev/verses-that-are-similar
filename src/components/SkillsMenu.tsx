import React from 'react';
import { motion } from 'framer-motion';
import { Mic, CheckCircle, BookOpen, ArrowRight, Zap, Sparkles, Trophy } from 'lucide-react';

interface SkillsMenuProps {
  onBack: () => void;
  onSelectMode: (mode: 'audio' | 'complete' | 'surah') => void;
  title?: string;
  subtitle?: string;
}

const SkillsMenu: React.FC<SkillsMenuProps> = ({ onBack, onSelectMode, title = 'تحدي المهارات', subtitle = 'اختر نمط اللعب الذي تفضله لتبدأ الرحلة' }) => {
  const modes = [
    {
      id: 'audio' as const,
      title: 'التحدي الصوتي',
      description: 'اقرأ الآية الكريمة بصوتك وتحقق من ضبطك للمتشابهات من خلال التلاوة المباشرة',
      icon: <Mic className="w-8 h-8" />,
      color: 'bg-brand-emerald',
      lightColor: 'bg-brand-emerald/10',
      textColor: 'text-brand-emerald',
      hoverBorder: 'hover:border-brand-emerald/30'
    },
    {
      id: 'complete' as const,
      title: 'تحدي إكمال الآية',
      description: 'اختبر قوة حفظك من خلال اختيار التكملة الصحيحة للآيات المتشابهة من بين عدة خيارات',
      icon: <CheckCircle className="w-8 h-8" />,
      color: 'bg-brand-gold',
      lightColor: 'bg-brand-gold/10',
      textColor: 'text-brand-gold',
      hoverBorder: 'hover:border-brand-gold/30'
    },
    {
      id: 'surah' as const,
      title: 'تحديد اسم السورة',
      description: 'تحدَّ نفسك في معرفة السور التي وردت فيها هذه الآيات المتشابهة بدقة عالية',
      icon: <BookOpen className="w-8 h-8" />,
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-600/10',
      textColor: 'text-indigo-600',
      hoverBorder: 'hover:border-indigo-300/30'
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12" dir="rtl">
      {/* Header */}
      <motion.div
        // @ts-ignore
        initial={{ opacity: 0, y: -20 }}
        // @ts-ignore
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-16 gap-6"
      >
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-[2rem] bg-brand-emerald/10 flex items-center justify-center text-brand-emerald shadow-sm">
            <Zap className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">{title}</h1>
            <p className="text-slate-400 font-bold mt-1 text-sm md:text-base">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-100 text-slate-600 font-black hover:bg-slate-50 transition-all shadow-sm active:scale-95 group text-sm md:text-base"
        >
          <span>العودة للرئيسية</span>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>

      {/* Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            // @ts-ignore
            initial={{ opacity: 0, y: 30 }}
            // @ts-ignore
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.15 }}
            // @ts-ignore
            whileHover={{ y: -12, scale: 1.02 }}
            onClick={() => onSelectMode(mode.id)}
            className={`group relative p-6 md:p-10 rounded-3xl md:rounded-[3.5rem] bg-white border border-slate-100 text-right flex flex-col justify-between min-h-[auto] md:min-h-[400px] shadow-sm hover:shadow-2xl transition-all overflow-hidden ${mode.hoverBorder}`}
          >
            {/* Background Decor */}
            <div className={`absolute top-0 right-0 w-40 h-40 ${mode.lightColor} rounded-bl-full -mr-20 -mt-20 transition-transform duration-700 group-hover:scale-150`} />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-700 pointer-events-none">
              <div className="absolute inset-0 bg-islamic-pattern opacity-10" />
            </div>

            <div className="relative z-10">
              <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-[2.2rem] ${mode.lightColor} ${mode.textColor} flex items-center justify-center mb-6 md:mb-10 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                {React.cloneElement(mode.icon as React.ReactElement, { className: 'w-6 h-6 md:w-8 md:h-8' })}
              </div>
              <h2 className={`text-xl md:text-3xl font-black ${mode.textColor} mb-3 md:mb-6 leading-tight`}>{mode.title}</h2>
              <p className="text-slate-500 font-bold text-sm md:text-lg leading-relaxed">{mode.description}</p>
            </div>

            <div className="relative z-10 mt-6 md:mt-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${mode.color} animate-pulse`} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">نمط جديد</span>
              </div>
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${mode.color} text-white flex items-center justify-center transform translate-x-6 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 shadow-xl`}>
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Footer Quote/Card */}
      <motion.div
        // @ts-ignore
        initial={{ opacity: 0 }}
        // @ts-ignore
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-10 md:mt-20 p-6 md:p-10 rounded-2xl md:rounded-[3rem] bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden group"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-islamic-pattern" />

          <div className="flex items-center gap-4 md:gap-8 relative z-10">
            <div className="w-12 h-12 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-700">
              <Trophy className="w-6 h-6 md:w-10 md:h-10 text-brand-gold" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg md:text-2xl font-black">طور مهاراتك في ضبط المتشابهات</h3>
              <p className="text-slate-400 font-bold text-sm md:text-lg">كل نمط صُمم ليختبر حفظك من زاوية معرفية مختلفة</p>
            </div>
          </div>

        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl border border-white/10 relative z-10">
          <Sparkles className="w-5 h-5 md:w-6 h-6 text-brand-gold animate-pulse" />
          <span className="font-black text-sm md:text-lg">قريباً: تحديات واسئلة جديدة </span>
        </div>
      </motion.div>
    </div>
  );
};

export default SkillsMenu;
