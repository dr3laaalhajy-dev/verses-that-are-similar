import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronLeft, Book as BookIcon } from 'lucide-react';
import { alabbadBook, Chapter } from '../data/alabbadBook';

interface BookReaderProps {
  onBack: () => void;
  darkMode?: boolean;
}

const BookReader: React.FC<BookReaderProps> = ({ onBack, darkMode = false }) => {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-1 sm:px-3 md:px-6 py-4 md:py-8 pb-36 sm:pb-48" dir="rtl">
      <AnimatePresence mode="wait">
        {!selectedChapter ? (
          <motion.div
            key="index"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-6 md:space-y-10"
          >
            {/* Header */}
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md p-6 rounded-3xl border shadow-sm transition-colors ${
              darkMode
                ? 'bg-slate-900/90 border-slate-800'
                : 'bg-white/90 border-slate-200/80'
            }`}>
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald shadow-sm">
                  <BookIcon className="w-6 h-6 md:w-8 md:h-8 text-brand-gold" />
                </div>
                <div className="flex flex-col text-right">
                  <h1 className={`text-xl md:text-3xl font-black tracking-tight leading-tight ${
                    darkMode ? 'text-emerald-400' : 'text-brand-emerald'
                  }`}>كتاب آيات متشابهات الألفاظ</h1>
                  <p className={`font-bold text-xs md:text-sm mt-0.5 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>للشيخ عبد المحسن بن حمد العباد البدر</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className={`w-full md:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-white font-black text-xs md:text-sm transition-all shadow-md active:scale-95 group ${
                  darkMode
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-brand-emerald hover:bg-emerald-700'
                }`}
              >
                <span>العودة للرئيسية</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>

            {/* Main Grid of Chapters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {alabbadBook.map((chapter, index) => (
                <motion.button
                  key={chapter.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  whileHover={{ y: -3, scale: 1.01 }}
                  onClick={() => setSelectedChapter(chapter)}
                  className={`group p-5 md:p-7 rounded-2xl md:rounded-3xl border-2 shadow-md hover:shadow-xl transition-all text-right flex items-center justify-between gap-4 ${
                    darkMode
                      ? 'bg-slate-800/90 border-slate-700 hover:border-emerald-500 text-slate-100'
                      : 'bg-[#fcfaf5] border-brand-gold/20 hover:border-brand-emerald text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 ${
                      darkMode
                        ? 'bg-emerald-950/60 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white'
                        : 'bg-brand-emerald/10 text-brand-emerald group-hover:bg-brand-emerald group-hover:text-white'
                    }`}>
                      <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <h2 className={`text-sm md:text-xl font-black transition-colors leading-snug ${
                      darkMode
                        ? 'text-slate-100 group-hover:text-emerald-400'
                        : 'text-slate-800 group-hover:text-brand-emerald'
                    }`}>
                      {chapter.title}
                    </h2>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-brand-emerald group-hover:-translate-x-1 transition-all shrink-0" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chapter"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-4 md:space-y-6"
          >
            {/* Navigation & Chapter Title Bar */}
            <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md p-4 px-6 rounded-2xl border shadow-sm transition-colors ${
              darkMode
                ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                : 'bg-white/90 border-slate-200/80 text-slate-800'
            }`}>
              <button
                onClick={() => setSelectedChapter(null)}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs transition-all active:scale-95 ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-emerald-600 border border-slate-700'
                    : 'bg-brand-emerald hover:bg-emerald-700'
                }`}
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة لفهرس الكتاب</span>
              </button>
              <h2 className={`text-base md:text-xl font-black text-center leading-snug ${
                darkMode ? 'text-slate-100' : 'text-slate-800'
              }`}>{selectedChapter.title}</h2>
            </div>

            {/* Authentic Book Spread Page Container with Full Justified Text */}
            <div className={`w-full rounded-2xl md:rounded-[2.5rem] p-5 sm:p-8 md:p-12 shadow-2xl border-2 min-h-[70vh] relative overflow-hidden transition-colors ${
              darkMode
                ? 'bg-slate-900/95 border-slate-800'
                : 'bg-[#fcfaf5] border-brand-gold/30'
            }`}>
              {/* Decorative Inner Gold Book Border */}
              <div className={`hidden md:block absolute inset-3 rounded-[2rem] border pointer-events-none ${
                darkMode ? 'border-emerald-500/20' : 'border-brand-gold/20'
              }`} />

              {/* Book Content Paragraphs - Continuous Text Filling Lines to Borders */}
              <div className="w-full text-right space-y-5 md:space-y-7 relative z-10" dir="rtl">
                {selectedChapter.content
                  .split(/\n\s*\n/)
                  .filter(paragraph => paragraph.trim().length > 0)
                  .map((paragraphBlock, i) => {
                    const cleanBlock = paragraphBlock.replace(/^-{3,}/, '').trim();
                    if (!cleanBlock) return null;

                    const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
                    
                    const isShortHeading = lines.length === 1 && (
                      lines[0].startsWith('القسم') || 
                      lines[0].startsWith('سورة') || 
                      lines[0].startsWith('فصل') || 
                      lines[0].startsWith('المقدمة') ||
                      lines[0].length < 35
                    );

                    if (isShortHeading) {
                      return (
                        <h3
                          key={i}
                          className={`border-t-2 border-b-2 py-3 my-6 font-black text-lg md:text-2xl text-center rounded-xl ${
                            darkMode
                              ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40'
                              : 'border-brand-gold/30 text-brand-emerald bg-brand-emerald/5'
                          }`}
                        >
                          {lines.join(' ')}
                        </h3>
                      );
                    }

                    const fullParagraphText = lines.join(' ');

                    return (
                      <p
                        key={i}
                        className={`font-bold text-base sm:text-lg md:text-xl leading-relaxed md:leading-loose text-justify w-full tracking-normal ${
                          darkMode ? 'text-slate-100' : 'text-slate-900'
                        }`}
                        style={{
                          textAlign: 'justify',
                          textJustify: 'inter-word',
                          textAlignLast: 'right',
                        }}
                      >
                        {fullParagraphText}
                      </p>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookReader;

