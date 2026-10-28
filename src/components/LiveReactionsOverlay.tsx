import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export type ReactionType = 'hurry' | 'forgive' | 'knowledge' | 'royal' | 'crescent' | 'spirit';

export interface FloatingReactionInstance {
  id: string;
  type: ReactionType;
  textLine1: string;
  textLine2: string;
  senderName: string;
  startX: number; // percentage (25% to 75%)
}

export interface ReactionActionDef {
  id: string;
  type: ReactionType;
  title: string;
  textLine1: string;
  textLine2: string;
  icon: string;
  color: string;
  badgeBg: string;
}

export const REACTION_ACTIONS: ReactionActionDef[] = [
  // 1. استعجال (من selected_gameplay_reactions.html)
  {
    id: 'act_hurry',
    type: 'hurry',
    title: 'أسرع بارك الله فيك',
    textLine1: 'أسرع',
    textLine2: 'بارك الله فيك',
    icon: '⏳',
    color: '#ef4444',
    badgeBg: 'bg-red-500/10 text-red-300 border-red-500/40 hover:bg-red-500/20'
  },
  // 2. مواساة / عتاب لطيف (من selected_gameplay_reactions.html)
  {
    id: 'act_forgive',
    type: 'forgive',
    title: 'سامحك الله',
    textLine1: 'سامحك',
    textLine2: 'الله',
    icon: '🍂',
    color: '#94a3b8',
    badgeBg: 'bg-slate-500/15 text-slate-300 border-slate-500/40 hover:bg-slate-500/25'
  },
  // 3. تشجيع علمي (من selected_gameplay_reactions.html)
  {
    id: 'act_knowledge',
    type: 'knowledge',
    title: 'زادك الله علماً',
    textLine1: 'زادك الله',
    textLine2: 'علماً',
    icon: '📖',
    color: '#38bdf8',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-400/40 hover:bg-sky-500/20'
  },
  // 4. الظهور الملكي الذهبي (من premium_islamic_reactions.html)
  {
    id: 'act_royal',
    type: 'royal',
    title: 'ما شاء الله تبارك الله',
    textLine1: 'ما شاء الله',
    textLine2: 'تبارك الله',
    icon: '✨',
    color: '#D4AF37',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-400/40 hover:bg-amber-500/20'
  },
  // 5. صعود الهلال المضيء (من premium_islamic_reactions.html)
  {
    id: 'act_crescent',
    type: 'crescent',
    title: 'أحسن الله إليك',
    textLine1: 'أحسن الله',
    textLine2: 'إليك',
    icon: '🌙',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/20'
  },
  // 6. النبض الروحاني (من premium_islamic_reactions.html)
  {
    id: 'act_spirit',
    type: 'spirit',
    title: 'جزاك الله خيراً',
    textLine1: 'جزاك الله',
    textLine2: 'خيراً',
    icon: '💫',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/40 hover:bg-cyan-500/20'
  }
];

interface LiveReactionsOverlayProps {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  incomingReaction?: {
    type?: ReactionType;
    emoji?: string;
    textLine1?: string;
    textLine2?: string;
    senderName?: string;
    senderId?: string;
    timestamp?: number;
  } | null;
  onSendReaction?: (payload: any) => void;
  showBar?: boolean;
}

export const LiveReactionsOverlay: React.FC<LiveReactionsOverlayProps> = ({
  roomId,
  playerId,
  playerName,
  incomingReaction,
  onSendReaction,
  showBar = true
}) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionInstance[]>([]);
  const [lastHandledTime, setLastHandledTime] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Cooldown countdown timer (10-second limit between reactions)
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Trigger floating reaction on incoming reaction from room (from other players)
  useEffect(() => {
    if (!incomingReaction || !incomingReaction.timestamp) return;

    if (incomingReaction.timestamp > lastHandledTime) {
      setLastHandledTime(incomingReaction.timestamp);

      // Avoid duplicating if sender already saw it locally
      const isMyReaction = incomingReaction.senderId && (incomingReaction.senderId === playerId || incomingReaction.senderId === playerName);
      if (!isMyReaction) {
        triggerReactionInstance({
          type: (incomingReaction.type as ReactionType) || 'royal',
          textLine1: incomingReaction.textLine1 || '',
          textLine2: incomingReaction.textLine2 || '',
          senderName: incomingReaction.senderName || 'متسابق'
        });
      }
    }
  }, [incomingReaction, lastHandledTime, playerId, playerName]);

  const triggerReactionInstance = (data: {
    type: ReactionType;
    textLine1: string;
    textLine2: string;
    senderName: string;
  }) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const startX = 25 + Math.random() * 50; // 25% to 75%

    setFloatingReactions(prev => [
      ...prev.slice(-10),
      {
        id,
        type: data.type,
        textLine1: data.textLine1,
        textLine2: data.textLine2,
        senderName: data.senderName,
        startX
      }
    ]);

    // Auto remove after animation completes (3 seconds)
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  const handleSendAction = async (action: ReactionActionDef) => {
    if (cooldownSeconds > 0) return;
    setCooldownSeconds(10); // Start 10s cooldown timer

    // 1. Immediately trigger on sender screen
    triggerReactionInstance({
      type: action.type,
      textLine1: action.textLine1,
      textLine2: action.textLine2,
      senderName: playerName || 'أنت'
    });

    const payload = {
      action: 'reaction',
      roomId,
      playerId: playerId || playerName,
      playerName: playerName || 'متسابق',
      type: action.type,
      textLine1: action.textLine1,
      textLine2: action.textLine2
    };

    if (onSendReaction) onSendReaction(payload);

    // 2. Broadcast to room
    if (roomId) {
      try {
        await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('Reaction send error:', err);
      }
    }
  };

  const portalContent = typeof document !== 'undefined' && floatingReactions.length > 0 ? (
    createPortal(
      <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{
                opacity: 0,
                scale: 0.6,
                y: 0,
                x: 0,
                filter: 'blur(3px)'
              }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.6, 1.15, 1, 1, 0.9],
                y: [0, -140, -300, -480, -680],
                x: [0, 15, -15, 10, 0],
                filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(2px)']
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                duration: 2.8,
                ease: 'easeOut',
                times: [0, 0.15, 0.45, 0.75, 1]
              }}
              style={{
                position: 'absolute',
                bottom: '90px',
                left: `${reaction.startX}%`,
                transform: 'translateX(-50%)'
              }}
              className="flex flex-col items-center justify-center filter drop-shadow-2xl"
            >
              {/* 1. استعجال (أسرع بارك الله فيك) - اهتزاز وساعة رملية دوارة */}
              {reaction.type === 'hurry' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{
                      rotate: [0, 0, 180, 180, 180],
                      scale: [1, 1, 1.25, 1, 1],
                      y: [10, 0, 0, 0, -10]
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute text-4xl sm:text-5xl pointer-events-none select-none"
                    style={{ filter: 'drop-shadow(0 0 15px #ef4444)' }}
                  >
                    ⏳
                  </motion.div>
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap mt-8"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#ef4444',
                      textShadow: '0 0 25px #ef4444, 0 0 10px #000'
                    }}
                  >
                    <div>{reaction.textLine1 || 'أسرع'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'بارك الله فيك'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-red-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-red-500/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 2. مواساة / عتاب لطيف (سامحك الله) - ورقة خريفية متساقطة وتلاشٍ هادئ */}
              {reaction.type === 'forgive' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{
                      x: [-20, 20, -10],
                      y: [-25, 10, 35],
                      rotate: [-20, 45, 90],
                      opacity: [0, 1, 0.8, 0]
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute text-3xl sm:text-4xl pointer-events-none select-none"
                  >
                    🍂
                  </motion.div>
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#cbd5e1',
                      textShadow: '0 0 18px #94a3b8, 0 0 5px #000'
                    }}
                  >
                    <div>{reaction.textLine1 || 'سامحك'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'الله'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-slate-300 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-slate-500/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 3. تشجيع علمي (زادك الله علماً) - كتاب منير مشع */}
              {reaction.type === 'knowledge' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{
                      y: [10, -25, -25, -40],
                      scale: [0.6, 1.3, 1.15, 0.8],
                      opacity: [0, 0.85, 0.6, 0]
                    }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute text-4xl sm:text-5xl pointer-events-none select-none z-0"
                    style={{ filter: 'drop-shadow(0 0 25px #38bdf8)' }}
                  >
                    📖
                  </motion.div>
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#38bdf8',
                      textShadow: '0 0 30px rgba(56,189,248,0.9), 0 0 10px #000'
                    }}
                  >
                    <div>{reaction.textLine1 || 'زادك الله'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'علماً'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-sky-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-sky-400/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 4. الزخرفة الذهبية الملكية (ما شاء الله تبارك الله) */}
              {reaction.type === 'royal' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 border-dashed border-[#D4AF37]/80 pointer-events-none"
                    style={{
                      boxShadow: '0 0 25px rgba(212, 175, 55, 0.35), inset 0 0 15px rgba(212, 175, 55, 0.2)'
                    }}
                  />
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#D4AF37',
                      textShadow: '0 0 20px #D4AF37, 0 0 40px rgba(212, 175, 55, 0.8)'
                    }}
                  >
                    <div>{reaction.textLine1 || 'ما شاء الله'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'تبارك الله'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-amber-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-[#D4AF37]/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 5. صعود الهلال المضيء (أحسن الله إليك) */}
              {reaction.type === 'crescent' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{
                      rotate: [-20, 20, -20],
                      scale: [0.95, 1.25, 0.95]
                    }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full pointer-events-none"
                    style={{
                      boxShadow: '-16px 16px 0 0 rgba(16, 185, 129, 0.5)',
                      filter: 'drop-shadow(0 0 18px #10b981)'
                    }}
                  />
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#10b981',
                      textShadow: '0 0 20px #10b981, 0 0 40px rgba(16, 185, 129, 0.8)'
                    }}
                  >
                    <div>{reaction.textLine1 || 'أحسن الله'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'إليك'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-emerald-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-emerald-400/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 6. النبض الروحاني (جزاك الله خيراً) */}
              {reaction.type === 'spirit' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  <motion.div
                    animate={{ scale: [0.6, 1.8], opacity: [0.8, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(6, 182, 212, 0.45) 0%, transparent 70%)',
                      boxShadow: '0 0 35px rgba(6, 182, 212, 0.35)'
                    }}
                  />
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#06b6d4',
                      textShadow: '0 0 25px #06b6d4, 0 0 12px #ffffff'
                    }}
                  >
                    <div>{reaction.textLine1 || 'جزاك الله'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'خيراً'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-cyan-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-cyan-400/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>,
      document.body
    )
  ) : null;

  return (
    <>
      {/* Portal: Floating Animated Emojis Overlay on document.body */}
      {portalContent}

      {/* Bottom Horizontal Reactions Bar */}
      {showBar && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl sm:rounded-full bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md border border-slate-700/80 shadow-2xl pointer-events-auto max-w-full mx-auto my-2.5 transition-all">
          {/* 10-Second Cooldown Indicator Pill */}
          {cooldownSeconds > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-black animate-pulse select-none">
              <span>⏳</span>
              <span>متاح بعد {cooldownSeconds}ث</span>
            </div>
          )}

          {/* Meaningful Gameplay & Islamic Reaction Buttons */}
          <div className="flex items-center flex-wrap justify-center gap-1.5 sm:gap-2">
            {REACTION_ACTIONS.map(action => (
              <motion.button
                key={action.id}
                whileHover={cooldownSeconds > 0 ? {} : { scale: 1.05 }}
                whileTap={cooldownSeconds > 0 ? {} : { scale: 0.95 }}
                disabled={cooldownSeconds > 0}
                onClick={() => handleSendAction(action)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-black transition-all shadow-xs ${
                  cooldownSeconds > 0
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-400 border-slate-700'
                    : `${action.badgeBg} cursor-pointer`
                }`}
                title={cooldownSeconds > 0 ? `يرجى الانتظار ${cooldownSeconds} ثوانٍ` : action.title}
              >
                <span>{action.icon}</span>
                <span className="whitespace-nowrap" style={{ fontFamily: "'Aref Ruqaa', 'Amiri', serif" }}>
                  {action.title}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
