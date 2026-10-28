import React, { useState, useEffect } from 'react';
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

  // Trigger floating reaction on incoming reaction from room
  useEffect(() => {
    if (incomingReaction && incomingReaction.timestamp > lastHandledTime) {
      setLastHandledTime(incomingReaction.timestamp);
      triggerFloatingReaction(incomingReaction.emoji, incomingReaction.senderName || 'متسابق');
    }
  }, [incomingReaction, lastHandledTime]);

  const triggerFloatingReaction = (emoji: string, senderName: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const startX = 20 + Math.random() * 60; // 20% to 80%

    setFloatingReactions(prev => [...prev.slice(-15), { id, emoji, senderName, startX }]);

    // Auto remove after animation completes (2.5 seconds)
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  const handleEmojiClick = async (emoji: string) => {
    triggerFloatingReaction(emoji, playerName || 'أنت');

    if (onSendReaction) {
      onSendReaction(emoji);
    }

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

  return (
    <>
      {/* Floating Animated Emojis Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{
                opacity: 0,
                scale: 0.5,
                y: '100vh',
                x: `${reaction.startX}vw`
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1.2, 1, 0.9],
                y: ['80vh', '60vh', '40vh', '20vh'],
                x: [
                  `${reaction.startX}vw`,
                  `${reaction.startX + 4}vw`,
                  `${reaction.startX - 4}vw`,
                  `${reaction.startX + 2}vw`
                ]
              }}
              transition={{
                duration: 2.2,
                ease: 'easeOut',
                times: [0, 0.15, 0.7, 1]
              }}
              className="absolute flex flex-col items-center justify-center filter drop-shadow-lg"
            >
              <span className="text-3xl sm:text-4xl select-none leading-none">
                {reaction.emoji}
              </span>
              <span className="text-[10px] sm:text-xs font-black text-white bg-slate-900/75 px-2 py-0.5 rounded-full mt-1 border border-white/20 whitespace-nowrap shadow-xs">
                {reaction.senderName}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Horizontal Reactions Bar */}
      {showBar && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg pointer-events-auto w-fit mx-auto">
          {REACTION_EMOJIS.map(emoji => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.25 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleEmojiClick(emoji)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-lg sm:text-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
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

