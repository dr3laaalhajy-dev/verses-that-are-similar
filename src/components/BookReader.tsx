import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, ChevronLeft, Book as BookIcon } from 'lucide-react';
import { alabbadBook, Chapter } from '../data/alabbadBook';

interface BookReaderProps {
  onBack: () => void;
}

const BookReader: React.FC<BookReaderProps> = ({ onBack }) => {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12" dir="rtl">
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[2rem] bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm">
                  <BookIcon className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="flex flex-col text-right">
                  <h1 className="text-xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">مكتبة المتشابهات</h1>
                  <p className="text-slate-400 font-bold text-[10px] md:text-base mt-0.5">آيات متشابهات الألفاظ في القرآن الكريم</p>
                  <p className="text-slate-400 font-bold text-[10px] md:text-base mt-0.5">للشيخ عبد المحسن بن حمد العباد البدر</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="w-full md:w-auto flex items-center justify-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl bg-white border border-slate-100 text-slate-600 font-black text-sm md:text-base hover:bg-slate-50 transition-all shadow-sm active:scale-95 group"
              >
                <span>العودة للرئيسية</span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {alabbadBook.map((chapter, index) => (
                <motion.button
                  key={chapter.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  onClick={() => setSelectedChapter(chapter)}
                  className="group p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] bg-white border border-slate-100 shadow-lg hover:shadow-2xl hover:border-indigo-200 transition-all text-right flex flex-col justify-between min-h-[100px] md:min-h-[160px]"
                >
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                      <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-indigo-300 group-hover:text-indigo-600 group-hover:-translate-x-2 transition-all opacity-0 md:opacity-0 group-hover:opacity-100" />
                  </div>
                  <h2 className="text-base md:text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight leading-snug">
                    {chapter.title}
                  </h2>
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
            className="space-y-6 md:space-y-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <button
                onClick={() => setSelectedChapter(null)}
                className="w-full md:w-auto flex items-center justify-center gap-2 text-indigo-600 font-black hover:gap-4 transition-all"
              >
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                <span>العودة للفهرس</span>
              </button>
              <h2 className="text-lg md:text-2xl font-black text-slate-800 text-center leading-snug">{selectedChapter.title}</h2>
            </div>

            <div className="bg-white rounded-2xl md:rounded-[3rem] p-5 md:p-12 shadow-xl border border-slate-50 min-h-[60vh]">
              <div className="prose prose-indigo prose-sm md:prose-xl max-w-none text-right" dir="rtl">
                {selectedChapter.content.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('---') ? 'border-t border-slate-100 pt-6 md:pt-8 mt-6 md:mt-8' : 'leading-relaxed md:leading-loose'}>
                    {line.replace('---', '')}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookReader;
