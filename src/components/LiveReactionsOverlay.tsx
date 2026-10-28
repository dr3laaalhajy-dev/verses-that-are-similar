import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface FloatingReactionInstance {
  id: string;
  emoji: string;
  senderName: string;
  startX: number; // percentage (20 to 80%)
}

interface LiveReactionsOverlayProps {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  incomingReaction?: {
    emoji: string;
    senderName: string;
    timestamp: number;
    senderId?: string;
  } | null;
  onSendReaction?: (emoji: string) => void;
  showBar?: boolean;
}

const REACTION_EMOJIS = ['👏', '🤯', '🎉', '😂', '⏱️'];

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

  // Trigger floating reaction on incoming reaction from room (from other players)
  useEffect(() => {
    if (!incomingReaction || !incomingReaction.timestamp) return;

    if (incomingReaction.timestamp > lastHandledTime) {
      setLastHandledTime(incomingReaction.timestamp);

      // Avoid duplicating if sender already saw it locally
      const isMyReaction = incomingReaction.senderId && (incomingReaction.senderId === playerId || incomingReaction.senderId === playerName);
      if (!isMyReaction) {
        triggerFloatingReaction(incomingReaction.emoji, incomingReaction.senderName || 'متسابق');
      }
    }
  }, [incomingReaction, lastHandledTime, playerId, playerName]);

  const triggerFloatingReaction = (emoji: string, senderName: string) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    const startX = 20 + Math.random() * 60; // 20% to 80%

    setFloatingReactions(prev => [...prev.slice(-15), { id, emoji, senderName, startX }]);

    // Auto remove after animation completes (2.5 seconds)
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  const handleEmojiClick = async (emoji: string) => {
    // 1. Immediately show floating bubble for the sender
    triggerFloatingReaction(emoji, playerName || 'أنت');

    if (onSendReaction) {
      onSendReaction(emoji);
    }

    // 2. Broadcast to room participants via server
    if (roomId) {
      try {
        await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reaction',
            roomId,
            playerId: playerId || playerName,
            playerName: playerName || 'متسابق',
            emoji
          })
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
                scale: 0.5,
                y: 0,
                x: 0
              }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.5, 1.25, 1, 1, 0.85],
                y: [0, -120, -280, -450, -650],
                x: [0, 20, -20, 15, 0]
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                duration: 2.4,
                ease: 'easeOut',
                times: [0, 0.15, 0.45, 0.75, 1]
              }}
              style={{
                position: 'absolute',
                bottom: '85px',
                left: `${reaction.startX}%`,
                transform: 'translateX(-50%)'
              }}
              className="flex flex-col items-center justify-center filter drop-shadow-xl"
            >
              <span className="text-4xl sm:text-5xl select-none leading-none">
                {reaction.emoji}
              </span>
              <span className="text-[11px] sm:text-xs font-black text-white bg-slate-900/85 px-2.5 py-0.5 rounded-full mt-1.5 border border-white/25 whitespace-nowrap shadow-md">
                {reaction.senderName}
              </span>
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
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg pointer-events-auto w-fit mx-auto my-2">
          {REACTION_EMOJIS.map(emoji => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleEmojiClick(emoji)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xl sm:text-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none active:scale-90"
              title="إرسال تفاعل لحظي"
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      )}
    </>
  );
};

