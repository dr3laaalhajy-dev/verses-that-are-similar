import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  database,
  ref,
  push,
  onChildAdded,
  off,
  serverTimestamp
} from '../services/firebase';

export type ReactionType = 'hurry' | 'forgive' | 'knowledge' | 'royal' | 'crescent' | 'spirit';

export interface FloatingReactionInstance {
  id: string;
  type: ReactionType;
  textLine1: string;
  textLine2: string;
  senderName: string;
  startX: number; // percentage (20% to 80%)
  icon?: string;
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
  // 1. استعجال (أسرع بارك الله فيك)
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
  // 2. مواساة / عتاب لطيف (سامحك الله)
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
  // 3. تشجيع علمي (زادك الله علماً)
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
  // 4. الظهور الملكي الذهبي (ما شاء الله تبارك الله)
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
  // 5. صعود الهلال المضيء (أحسن الله إليك)
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
  // 6. النبض الروحاني (جزاك الله خيراً)
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

export function getReactionDetails(rawTypeOrEmoji?: string, customLine1?: string, customLine2?: string) {
  const val = String(rawTypeOrEmoji || '').trim().toLowerCase();

  if (val === 'hurry' || val === '⏳' || val.includes('أسرع') || val.includes('اسرع')) {
    return {
      type: 'hurry' as ReactionType,
      textLine1: customLine1 || 'أسرع',
      textLine2: customLine2 || 'بارك الله فيك',
      icon: '⏳',
      color: '#ef4444'
    };
  }
  if (val === 'forgive' || val === '🍂' || val.includes('سامحك')) {
    return {
      type: 'forgive' as ReactionType,
      textLine1: customLine1 || 'سامحك',
      textLine2: customLine2 || 'الله',
      icon: '🍂',
      color: '#94a3b8'
    };
  }
  if (val === 'knowledge' || val === '📖' || val.includes('زادك') || val.includes('علم')) {
    return {
      type: 'knowledge' as ReactionType,
      textLine1: customLine1 || 'زادك الله',
      textLine2: customLine2 || 'علماً',
      icon: '📖',
      color: '#38bdf8'
    };
  }
  if (val === 'crescent' || val === '🌙' || val.includes('أحسن') || val.includes('احسن')) {
    return {
      type: 'crescent' as ReactionType,
      textLine1: customLine1 || 'أحسن الله',
      textLine2: customLine2 || 'إليك',
      icon: '🌙',
      color: '#10b981'
    };
  }
  if (val === 'spirit' || val === '💫' || val.includes('جزاك')) {
    return {
      type: 'spirit' as ReactionType,
      textLine1: customLine1 || 'جزاك الله',
      textLine2: customLine2 || 'خيراً',
      icon: '💫',
      color: '#06b6d4'
    };
  }
  // Default to royal (ما شاء الله تبارك الله)
  return {
    type: 'royal' as ReactionType,
    textLine1: customLine1 || 'ما شاء الله',
    textLine2: customLine2 || 'تبارك الله',
    icon: '✨',
    color: '#D4AF37'
  };
}

interface LiveReactionsOverlayProps {
  roomId?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  incomingReaction?: {
    type?: ReactionType;
    reactionType?: string;
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
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // 3. تصفية التفاعلات التاريخية (Ignore Old Data): حفظ لحظة فتح المكون (Mount Timestamp)
  const mountTimeRef = useRef<number>(Date.now());

  // 1 & 3 & 4. تفعيل الاستماع اللحظي (Firebase Listener) وطباعة الأخطاء وتصفية البيانات القديمة
  useEffect(() => {
    if (!roomId) {
      console.warn('[Firebase Live Reactions] roomId مفقود، تعذر بدء الاستماع.');
      return;
    }
    if (!database) {
      console.error('[Firebase Live Reactions] Realtime Database غير مهيأة! تأكد من VITE_FIREBASE_DATABASE_URL في .env');
      return;
    }

    const mountTime = mountTimeRef.current;
    console.log(`[Firebase Live Reactions] بدء الاستماع على rooms/${roomId}/reactions للمحاضرات بعد ${new Date(mountTime).toLocaleTimeString()}`);

    const reactionsRef = ref(database, `rooms/${roomId}/reactions`);

    // إعداد المستمع مع دالة التقاط الأخطاء (4. Error Logging)
    const unsubscribe = onChildAdded(
      reactionsRef,
      (snapshot) => {
        try {
          if (!snapshot.exists()) return;
          const data = snapshot.val();
          if (!data) return;

          console.log('[Firebase Live Reactions] تم استقبال تفاعل لحظي من Firebase:', snapshot.key, data);

          // 3. تصفية التفاعلات التاريخية: قبول التفاعلات الحديثة فقط التي حدثت بعد لحظة فتح الشاشة
          const reactionTime = typeof data.timestamp === 'number' ? data.timestamp : Date.now();
          if (reactionTime < mountTime) {
            console.log(`[Firebase Live Reactions] تم تجاهل تفاعل قديم (وقت التفاعل: ${reactionTime} < وقت الفتح: ${mountTime})`);
            return;
          }

          const rawType = data.reactionType || data.emoji || data.type;
          const details = getReactionDetails(rawType, data.textLine1, data.textLine2);

          // إضافة التفاعل إلى الشاشة (يعمل لكل من المرسل والمستقبل عند عودة البيانات من Firebase)
          triggerReactionInstance({
            id: snapshot.key || Math.random().toString(36).substring(2, 9) + Date.now(),
            type: details.type,
            textLine1: details.textLine1,
            textLine2: details.textLine2,
            senderName: data.senderName || 'متسابق',
            icon: details.icon
          });
        } catch (parseErr) {
          console.error('[Firebase Live Reactions] خطأ أثناء معالجة التفاعل المستلم:', parseErr);
        }
      },
      (error) => {
        // 4. طباعة الأخطاء: فحص هل هناك Permission Denied أو مشكلة صلاحيات
        console.error('[Firebase Live Reactions] خطأ في مستمع onChildAdded من Firebase:', error);
        if (error?.message?.includes('permission_denied') || (error as any)?.code === 'PERMISSION_DENIED') {
          console.error('[Firebase Live Reactions] 🛑 خطأ أذونات Firebase (PERMISSION_DENIED)! تأكد من صلاحيات القراءة (read: true) في قواعد Realtime Database Console.');
        }
      }
    );

    return () => {
      console.log(`[Firebase Live Reactions] إيقاف الاستماع على rooms/${roomId}/reactions`);
      try {
        off(reactionsRef);
      } catch (e) {
        // Safe unsubscribe
      }
    };
  }, [roomId]);

  // Cooldown countdown timer (10-second limit between reactions)
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // 2. إدارة دورة حياة التفاعل (Cleanup Timeout): حذف التفاعل من الـ State بعد 3000 ملي ثانية
  const triggerReactionInstance = (data: {
    id?: string;
    type: ReactionType;
    textLine1: string;
    textLine2: string;
    senderName: string;
    icon?: string;
  }) => {
    const id = data.id || Math.random().toString(36).substring(2, 9) + Date.now();
    const startX = 20 + Math.random() * 60; // 20% to 80%

    setFloatingReactions(prev => [
      ...prev.slice(-12),
      {
        id,
        type: data.type,
        textLine1: data.textLine1,
        textLine2: data.textLine2,
        senderName: data.senderName,
        startX,
        icon: data.icon
      }
    ]);

    // Cleanup بعد 3 ثوانٍ
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  };

  // 1 & 4. إرسال التفاعلات: منع العرض المحلي الوهمي 100%، والاعتماد الحصري على رد Firebase
  const handleSendAction = async (action: ReactionActionDef) => {
    if (cooldownSeconds > 0) return;
    setCooldownSeconds(10); // بدء مؤقت التهدئة 10 ثوانٍ

    const mySenderId = String(playerId || playerName || 'web_user');
    const mySenderName = String(playerName || 'أنت');

    // 🛑 1. تم إلغاء العرض المحلي الوهمي تماماً (Remove Optimistic UI):
    // لا نستدعي triggerReactionInstance هنا أبداً!
    // ستظهر الحركة على الشاشة فقط عندما يعود التفاعل من الـ Listener (onChildAdded).

    const payload = {
      action: 'reaction',
      roomId,
      playerId: mySenderId,
      playerName: mySenderName,
      type: action.type,
      reactionType: action.type,
      emoji: action.icon,
      textLine1: action.textLine1,
      textLine2: action.textLine2,
      timestamp: Date.now()
    };

    if (onSendReaction) onSendReaction(payload);

    // 4. إرسال التفاعل إلى Firebase مع طباعة الأخطاء (console.error)
    if (roomId && database) {
      try {
        console.log(`[Firebase Live Reactions] إرسال التفاعل إلى rooms/${roomId}/reactions:`, {
          type: action.type,
          senderName: mySenderName
        });
        const reactionsRef = ref(database, `rooms/${roomId}/reactions`);
        const newRef = await push(reactionsRef, {
          reactionType: action.type,
          emoji: action.icon,
          senderId: mySenderId,
          senderName: mySenderName,
          textLine1: action.textLine1,
          textLine2: action.textLine2,
          timestamp: serverTimestamp()
        });
        console.log('[Firebase Live Reactions] ✅ تم إرسال التفاعل بنجاح إلى Firebase بالمعرف:', newRef.key);
      } catch (fbErr: any) {
        console.error('[Firebase Live Reactions] ❌ فشل إرسال التفاعل إلى Firebase:', fbErr);
        if (fbErr?.code === 'PERMISSION_DENIED' || String(fbErr).includes('permission_denied')) {
          console.error('[Firebase Live Reactions] 🛑 خطأ PERMISSION_DENIED: قواعد حماية Firebase تمنع الكتابة (write) على rooms/' + roomId + '/reactions');
        }
      }
    } else {
      if (!roomId) console.error('[Firebase Live Reactions] لم يتم الإرسال: roomId مفقود!');
      if (!database) console.error('[Firebase Live Reactions] لم يتم الإرسال: كائن database غير مهيأ (تحقق من VITE_FIREBASE_DATABASE_URL)!');
    }

    // إرسال احتياطي عبر خادم Vercel REST API
    if (roomId) {
      try {
        await fetch('/api/1v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn('[Firebase Live Reactions] REST Fallback error:', err);
      }
    }
  };

  // ضبط العرض والأنيميشن (UI & Z-Index: 99999 و pointer-events-none)
  const portalContent = typeof document !== 'undefined' && floatingReactions.length > 0 ? (
    createPortal(
      <div
        className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden select-none"
        style={{ zIndex: 99999, pointerEvents: 'none' }}
      >
        <AnimatePresence>
          {floatingReactions.map(reaction => (
            <motion.div
              key={reaction.id}
              initial={{
                opacity: 0,
                scale: 0.5,
                y: 0,
                x: 0,
                filter: 'blur(3px)'
              }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.5, 1.15, 1, 1, 0.85],
                y: [0, -120, -280, -460, -650],
                x: [0, 15, -15, 10, 0],
                filter: ['blur(3px)', 'blur(0px)', 'blur(0px)', 'blur(0px)', 'blur(2px)']
              }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{
                duration: 2.9,
                ease: 'easeOut',
                times: [0, 0.12, 0.45, 0.75, 1]
              }}
              style={{
                position: 'absolute',
                bottom: '100px',
                left: `${reaction.startX}%`,
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
              className="flex flex-col items-center justify-center filter drop-shadow-2xl pointer-events-none select-none"
            >
              {/* 1. استعجال (أسرع بارك الله فيك) - اهتزاز وساعة رملية دوارة وتوهج أحمر */}
              {reaction.type === 'hurry' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
                  <motion.div
                    animate={{
                      rotate: [0, 0, 180, 180, 180],
                      scale: [1, 1, 1.25, 1, 1],
                      y: [10, 0, 0, 0, -10]
                    }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute text-4xl sm:text-5xl pointer-events-none select-none"
                    style={{ filter: 'drop-shadow(0 0 16px #ef4444)' }}
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
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
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

              {/* 3. تشجيع علمي (زادك الله علماً) - كتاب منير مشع بلون سماوي */}
              {reaction.type === 'knowledge' && (
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
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
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
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
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
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
                <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 pointer-events-none">
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
