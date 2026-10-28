import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export type ReactionType = 'royal' | 'crescent' | 'spirit' | 'emoji';

export interface FloatingReactionInstance {
  id: string;
  type: ReactionType;
  emoji?: string;
  textLine1?: string;
  textLine2?: string;
  senderName: string;
  startX: number; // percentage (25% to 75%)
}

export interface IslamicActionDef {
  id: string;
  type: ReactionType;
  title: string;
  textLine1: string;
  textLine2: string;
  icon: string;
  color: string;
  badgeBg: string;
}

export const ISLAMIC_ACTIONS: IslamicActionDef[] = [
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
  {
    id: 'act_spirit',
    type: 'spirit',
    title: 'جزاك الله خيراً',
    textLine1: 'جزاك الله',
    textLine2: 'خيراً',
    icon: '💫',
    color: '#38bdf8',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-400/40 hover:bg-sky-500/20'
  }
];

export const QUICK_EMOJIS = ['👏', '🎉', '⚡', '⏱️'];

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
          type: incomingReaction.type || 'emoji',
          emoji: incomingReaction.emoji,
          textLine1: incomingReaction.textLine1,
          textLine2: incomingReaction.textLine2,
          senderName: incomingReaction.senderName || 'متسابق'
        });
      }
    }
  }, [incomingReaction, lastHandledTime, playerId, playerName]);

  const triggerReactionInstance = (data: {
    type: ReactionType;
    emoji?: string;
    textLine1?: string;
    textLine2?: string;
    senderName: string;
  }) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const startX = 30 + Math.random() * 40; // 30% to 70%

    setFloatingReactions(prev => [
      ...prev.slice(-12),
      {
        id,
        type: data.type,
        emoji: data.emoji,
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

  const handleSendAction = async (action: IslamicActionDef) => {
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

  const handleSendEmoji = async (emoji: string) => {
    if (cooldownSeconds > 0) return;
    setCooldownSeconds(10); // Start 10s cooldown timer

    // 1. Immediately trigger on sender screen
    triggerReactionInstance({
      type: 'emoji',
      emoji,
      senderName: playerName || 'أنت'
    });

    const payload = {
      action: 'reaction',
      roomId,
      playerId: playerId || playerName,
      playerName: playerName || 'متسابق',
      type: 'emoji',
      emoji
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
                filter: 'blur(4px)'
              }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.6, 1.15, 1, 1, 0.9],
                y: [0, -140, -300, -480, -680],
                x: [0, 20, -20, 15, 0],
                filter: ['blur(4px)', 'blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(2px)']
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
              {/* 1. الزخرفة الذهبية الملكية (Royal Gold Reveal) */}
              {reaction.type === 'royal' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  {/* Rotating Dashed Gold Ring */}
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

              {/* 2. صعود الهلال المضيء (Glowing Crescent) */}
              {reaction.type === 'crescent' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  {/* Glowing Floating Crescent */}
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

              {/* 3. النبض الروحاني (Spiritual Pulse) */}
              {reaction.type === 'spirit' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8">
                  {/* Radial Expanding Waves */}
                  <motion.div
                    animate={{ scale: [0.6, 1.8], opacity: [0.8, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, transparent 70%)',
                      boxShadow: '0 0 35px rgba(56, 189, 248, 0.35)'
                    }}
                  />
                  <div
                    className="text-center font-bold text-xl sm:text-2xl leading-tight z-10 select-none whitespace-nowrap"
                    style={{
                      fontFamily: "'Aref Ruqaa', 'Amiri', serif",
                      color: '#38bdf8',
                      textShadow: '0 0 25px #38bdf8, 0 0 12px #ffffff'
                    }}
                  >
                    <div>{reaction.textLine1 || 'جزاك الله'}</div>
                    <div className="mt-0.5">{reaction.textLine2 || 'خيراً'}</div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-sky-200 bg-slate-950/85 px-3 py-0.5 rounded-full mt-2.5 border border-sky-400/60 whitespace-nowrap shadow-lg z-10">
                    {reaction.senderName}
                  </span>
                </div>
              )}

              {/* 4. Quick Emojis */}
              {reaction.type === 'emoji' && (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-4xl sm:text-5xl select-none leading-none animate-bounce">
                    {reaction.emoji}
                  </span>
                  <span className="text-[10px] sm:text-xs font-black text-white bg-slate-900/85 px-2.5 py-0.5 rounded-full mt-1.5 border border-white/25 whitespace-nowrap shadow-md">
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

          {/* 3 Premium Islamic Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {ISLAMIC_ACTIONS.map(action => (
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
                  {action.title.length > 12 ? action.textLine1 : action.title}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Subtle Vertical Divider */}
          <div className="hidden sm:block h-5 w-px bg-slate-700/80 mx-0.5" />

          {/* Quick Emojis */}
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map(emoji => (
              <motion.button
                key={emoji}
                whileHover={cooldownSeconds > 0 ? {} : { scale: 1.25 }}
                whileTap={cooldownSeconds > 0 ? {} : { scale: 0.9 }}
                disabled={cooldownSeconds > 0}
                onClick={() => handleSendEmoji(emoji)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-lg sm:text-xl transition-colors select-none ${
                  cooldownSeconds > 0
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : 'hover:bg-white/10 text-white cursor-pointer active:scale-90'
                }`}
                title={cooldownSeconds > 0 ? `يرجى الانتظار ${cooldownSeconds} ثوانٍ` : 'إرسال تفاعل'}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
