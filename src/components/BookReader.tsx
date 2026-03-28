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
    <div className="max-w-4xl mx-auto px-6 py-12" dir="rtl">
      <AnimatePresence mode="wait">
        {!selectedChapter ? (
          <motion.div
            key="index"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-10"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm">
                  <BookIcon className="w-8 h-8" />
                </div>
                <div className="flex flex-col text-right">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">مكتبة المتشابهات</h1>
                  <p className="text-slate-400 font-bold mt-1">آيات متشابهات الألفاظ في القرآن الكريم</p>
                  <p className="text-slate-400 font-bold mt-1">للشيخ عبد المحسن بن حمد العباد البدر</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-slate-100 text-slate-600 font-black hover:bg-slate-50 transition-all shadow-sm active:scale-95 group"
              >
                <span>العودة للرئيسية</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {alabbadBook.map((chapter, index) => (
                <motion.button
                  key={chapter.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  onClick={() => setSelectedChapter(chapter)}
                  className="group p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl hover:shadow-2xl hover:border-indigo-200 transition-all text-right flex flex-col justify-between min-h-[160px]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <ChevronLeft className="w-5 h-5 text-indigo-300 group-hover:text-indigo-600 group-hover:-translate-x-2 transition-all opacity-0 group-hover:opacity-100" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
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
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedChapter(null)}
                className="flex items-center gap-2 text-indigo-600 font-black hover:gap-4 transition-all"
              >
                <ArrowRight className="w-6 h-6" />
                <span>العودة للفهرس</span>
              </button>
              <h2 className="text-2xl font-black text-slate-800">{selectedChapter.title}</h2>
            </div>

            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-50 min-h-[60vh]">
              <div className="prose prose-indigo prose-xl max-w-none text-right" dir="rtl">
                {selectedChapter.content.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('---') ? 'border-t border-slate-100 pt-8 mt-8' : ''}>
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
