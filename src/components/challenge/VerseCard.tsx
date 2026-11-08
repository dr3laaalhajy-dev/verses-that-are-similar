import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, BookOpen, Lightbulb, Check, Copy } from 'lucide-react';
import { renderQuranText } from '../../utils/quranUtils';
import { VerseCardProps } from '../../types/challenges';

export const VerseCard = memo(({ verse, keyword, isMatched, index, keywordWordCount, wordStates }: VerseCardProps) => {
  const [copied, setCopied] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);

  // Auto-reveal when matched
  useEffect(() => {
    if (isMatched) {
      setIsRevealed(true);
      setHintLevel(1);
    }
  }, [isMatched]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(verse.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHint = () => {
    if (isMatched) return;
    setHintLevel(prev => prev + 1);
  };

  const renderHighlightedVerse = () => {
    const words = (verse?.text || '').split(' ').filter(Boolean);
    // If we're hinting text (level 2+), show 25% more words per level after the keyword
    const visibleWordsCount = hintLevel >= 2
      ? keywordWordCount + Math.floor((words.length - keywordWordCount) * ((hintLevel - 1) * 0.25))
      : words.length;

    return (
      <p className={`quran-text quran-mushaf-layout text-right mb-1 md:mb-2 ${isMatched ? 'text-brand-emerald font-bold' : 'text-slate-600'}`}>
        {words.map((word, wIdx) => {
          const isKeyword = wIdx < keywordWordCount;
          const isVisible = isRevealed || wIdx < visibleWordsCount;

          if (!isVisible) return null;

          const wordIdx = wIdx - keywordWordCount;
          const status = wordIdx >= 0 ? wordStates[wordIdx] : 'correct';

          let colorClass = isKeyword ? 'text-brand-emerald/70' : 'text-brand-emerald';
          if (status === 'skipped') {
            colorClass = 'text-red-500 font-bold';
          } else if (!isMatched && status !== 'correct') {
            colorClass = 'text-slate-400';
          }

          return (
            <span
              key={wIdx}
              className={`transition-all duration-500 mx-0.5 ${colorClass}`}
            >
              {renderQuranText(word)}{' '}
            </span>
          );
        })}
        {!isRevealed && hintLevel >= 2 && visibleWordsCount < words.length && (
          <span className="text-slate-300 animate-pulse">...</span>
        )}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`relative p-1.5 md:p-6 rounded-xl md:rounded-3xl border md:border-2 transition-all duration-700 flex flex-col justify-between overflow-hidden group card-hover islamic-watermark ${isMatched
        ? 'glass bg-white/90 border-brand-emerald shadow-lg'
        : 'glass bg-white/40 border-white/50 hover:border-brand-gold/30'
        }`}
    >
      {isMatched && (
        <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-brand-emerald/5 rounded-bl-full -mr-12 -mt-12 md:-mr-16 md:-mt-16 transition-transform group-hover:scale-110" />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-10"
      >
        <div className="flex items-start gap-2 md:gap-4 mb-1 md:mb-2">
          {isMatched && (
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              className="bg-brand-emerald/10 p-0.5 md:p-1 rounded-full"
            >
              <CheckCircle className="w-4 h-4 md:w-6 md:h-6 text-brand-emerald" />
            </motion.div>
          )}
          <div className="flex-1 flex flex-col items-center">
            {isRevealed || hintLevel >= 2 ? (
              <div
                className={!isRevealed ? "cursor-pointer hover:opacity-80 transition-opacity w-full text-center" : "w-full text-center"}
                onClick={() => !isRevealed && setIsRevealed(true)}
              >
                {renderHighlightedVerse()}
              </div>
            ) : (
              <button
                onClick={() => setIsRevealed(true)}
                className="w-full flex flex-col items-center justify-center gap-1 group/reveal transition-all py-4"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-1 group-hover/reveal:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-500">آية مخفية</h3>
                <span className="text-slate-400 font-bold text-xs">انقر للإظهار</span>
                <div className="mt-1 px-3 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-black border border-red-100">
                  (يخصم 10 نقاط)
                </div>
              </button>
            )}

            {!isRevealed && (
              <button
                onClick={handleHint}
                className="mt-4 px-6 py-2 bg-white border border-brand-gold/20 rounded-full shadow-sm flex items-center gap-2 hover:bg-brand-gold/5 transition-all text-brand-gold font-bold text-sm"
              >
                <Lightbulb className="w-4 h-4" />
                <span>تلميح</span>
              </button>
            )}
          </div>
        </div>

        {(isRevealed || hintLevel >= 1) && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50">
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${isMatched ? 'text-brand-emerald bg-brand-emerald/10' : 'text-slate-500 bg-slate-100'}`}>
              <span>
                {verse.surah.includes('،') ? '' : 'سورة '} {verse.surah}
              </span> • آية {verse.number}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-brand-emerald hover:bg-brand-emerald/5 rounded-xl transition-all flex items-center gap-2"
              title="نسخ الآية"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'تم' : 'نسخ'}</span>
              {copied ? <Check className="w-3 h-3 text-brand-emerald" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

export default VerseCard;

