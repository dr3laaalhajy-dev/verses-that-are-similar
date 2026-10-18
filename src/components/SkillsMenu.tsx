import React from 'react';
import { motion } from 'framer-motion';
import { Mic, CheckCircle, BookOpen, ArrowRight, Zap, Sparkles, Trophy } from 'lucide-react';

interface SkillsMenuProps {
  onBack: () => void;
  onSelectMode: (mode: 'audio' | 'complete' | 'surah') => void;
  title?: string;
  subtitle?: string;
  hideAudio?: boolean;
  hideComplete?: boolean;
  hideSurah?: boolean;
}

const SkillsMenu: React.FC<SkillsMenuProps> = ({ 
  onBack, 
  onSelectMode, 
  title = 'تحدي المهارات', 
  subtitle = 'اختر نمط التحدي الذي تفضله لتبدأ الرحلة',
  hideAudio = false,
  hideComplete = false,
  hideSurah = false
}) => {
  const allModes = [
    {
      id: 'audio' as const,
      hidden: hideAudio,
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
      hidden: hideComplete,
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
      hidden: hideSurah,
      title: 'تحديد اسم السورة',
      description: 'تحدَّ نفسك في معرفة السور التي وردت فيها هذه الآيات المتشابهة بدقة عالية',
      icon: <BookOpen className="w-8 h-8" />,
      color: 'bg-indigo-600',
      lightColor: 'bg-indigo-600/10',
      textColor: 'text-indigo-600',
      hoverBorder: 'hover:border-indigo-300/30'
    },
  ];

  const modes = allModes.filter(m => !m.hidden);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-8" dir="rtl">
      {/* Header */}
      <motion.div
        // @ts-ignore
        initial={{ opacity: 0, y: -20 }}
        // @ts-ignore
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-center justify-between mb-4 md:mb-8 gap-4"
      >
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald shadow-xs">
            <Zap className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{title}</h1>
            <p className="text-slate-400 font-bold text-xs md:text-sm">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-xl bg-white border border-slate-100 text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-xs active:scale-95 text-xs md:text-sm"
        >
          <span>العودة للرئيسية</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>

      {/* Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            // @ts-ignore
            initial={{ opacity: 0, y: 20 }}
            // @ts-ignore
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            // @ts-ignore
            whileHover={{ y: -6, scale: 1.01 }}
            onClick={() => onSelectMode(mode.id)}
            className={`group relative p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white border border-slate-100 text-right flex flex-col justify-between min-h-[auto] md:min-h-[220px] shadow-sm hover:shadow-xl transition-all overflow-hidden ${mode.hoverBorder}`}
          >
            {/* Background Decor */}
            <div className={`absolute top-0 right-0 w-28 h-28 ${mode.lightColor} rounded-bl-full -mr-14 -mt-14 transition-transform duration-700 group-hover:scale-125`} />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-700 pointer-events-none">
              <div className="absolute inset-0 bg-islamic-pattern opacity-10" />
            </div>

            <div className="relative z-10">
              <div className={`w-11 h-11 md:w-13 md:h-13 rounded-xl md:rounded-2xl ${mode.lightColor} ${mode.textColor} flex items-center justify-center mb-3 md:mb-4 shadow-xs group-hover:scale-105 transition-transform duration-300`}>
                {React.cloneElement(mode.icon as React.ReactElement<any>, { className: 'w-5 h-5 md:w-6 md:h-6' })}
              </div>
              <h2 className={`text-base md:text-lg font-black ${mode.textColor} mb-1.5 md:mb-2 leading-tight`}>{mode.title}</h2>
              <p className="text-slate-500 font-bold text-xs md:text-sm leading-relaxed">{mode.description}</p>
            </div>

            <div className="relative z-10 mt-4 md:mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${mode.color} animate-pulse`} />
                <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider">نمط جديد</span>
              </div>
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl ${mode.color} text-white flex items-center justify-center transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 shadow-md`}>
                <ArrowRight className="w-4 h-4 rotate-180" />
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
        transition={{ delay: 0.4 }}
        className="mt-6 md:mt-8 p-4 md:p-5 rounded-2xl bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden group shadow-md"
      >
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-islamic-pattern" />

        <div className="flex items-center gap-3 md:gap-4 relative z-10">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
            <Trophy className="w-5 h-5 md:w-6 md:h-6 text-brand-gold" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm md:text-base font-black">طور مهاراتك في ضبط المتشابهات</h3>
            <p className="text-slate-400 font-bold text-xs md:text-sm">كل نمط صُمم ليختبر حفظك من زاوية معرفية مختلفة</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 relative z-10">
          <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
          <span className="font-bold text-xs md:text-sm">قريباً: تحديات وأسئلة جديدة</span>
        </div>
      </motion.div>
    </div>
  );
};

export default SkillsMenu;
