import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { View } from '../types/challenges';
import { supabase } from '../services/supabase';
import { useApp } from '../contexts/AppContext';
import { router } from '../services/router';
import {
  GroupChallengeEmblem,
  DailyChallengeEmblem,
  SkillsChallengeEmblem,
  SpeedChallengeEmblem,
  IslamicQuizEmblem
} from '../components/IslamicChallengeEmblems';

export interface ChallengesHubPageProps {
  setView: (view: View) => void;
  incompleteChallenge: any;
  setChallengeMode: (mode: any) => void;
  setCurrentChallengeIndex: (index: number) => void;
  dailyCompleted: boolean;
  handleStartDaily: () => void;
  timeLeft: string;
  setIsSpeedMode: (isSpeed: boolean) => void;
  systemSettings: {
    hideAudioChallenge?: boolean;
    [key: string]: any;
  };
  dailyChallenge?: any;
  userId?: string | number | null;
  activeRunningRoom?: any;
  handleResumeActiveRoom?: (room: any) => void;
}

export const ChallengesHubPage: React.FC<ChallengesHubPageProps> = ({
  setView,
  incompleteChallenge,
  setChallengeMode,
  setCurrentChallengeIndex,
  dailyCompleted,
  handleStartDaily,
  timeLeft,
  setIsSpeedMode,
  systemSettings,
  dailyChallenge,
  userId,
  activeRunningRoom,
  handleResumeActiveRoom
}) => {
  const app = useApp();

  // 1. حالة التحقق من الغرفة الجماعية النشطة (Active Room Rejoin)
  const [queriedActiveRoom, setQueriedActiveRoom] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkActiveRoom = async () => {
      const activeUser = userId || app?.playerUsername || app?.playerName ||
        localStorage.getItem('quran_player_username') ||
        localStorage.getItem('quran_player_name');
      if (!activeUser) return;

      try {
        const pIdParam = encodeURIComponent(String(activeUser));
        const res = await fetch(`/api/1v1?action=check-active&playerId=${pIdParam}`);
        const data = await res.json();
        if (isMounted && res.ok && data && data.id && (data.status === 'PLAYING' || data.status === 'WAITING' || data.status === 'active')) {
          const myId = String(userId || activeUser);
          const pProgress = data.playersProgress ? (data.playersProgress[myId] || Object.values(data.playersProgress).find((p: any) => p.name === activeUser || p.username === activeUser)) : null;
          if (pProgress && (pProgress.hasLeft || pProgress.isResigned || pProgress.isAbandoned || pProgress.status === 'abandoned' || pProgress.finishTime)) {
            setQueriedActiveRoom(null);
            return;
          }
          setQueriedActiveRoom(data);
        } else if (isMounted) {
          setQueriedActiveRoom(null);
        }
      } catch (err) {
        console.warn('[ChallengesHubPage] Error checking active room:', err);
      }
    };

    checkActiveRoom();
    return () => { isMounted = false; };
  }, [userId, app?.playerUsername, app?.playerName]);

  const effectiveActiveRoom = activeRunningRoom || app?.activeRunningRoom || queriedActiveRoom;
  const effectiveResumeRoom = handleResumeActiveRoom || app?.handleResumeActiveRoom;
  // 1. حالة التحقق من إتمام التحدي اليومي
  const [isDailyCompleted, setIsDailyCompleted] = useState<boolean>(() => {
    if (dailyCompleted) return true;
    try {
      const today = new Date().toISOString().split('T')[0];
      return localStorage.getItem('quran_daily_completed') === today;
    } catch {
      return false;
    }
  });

  // استعلام التحقق من إتمام التحدي من Supabase والتخزين المحلي
  const checkDailyCompletion = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];

    // أ. فحص سريع من الحالة والتخزين المحلي
    try {
      if (dailyCompleted || localStorage.getItem('quran_daily_completed') === today) {
        setIsDailyCompleted(true);
        // مسح التحدي اليومي غير المكتمل من التخزين إن وُجد
        const savedIncomplete = localStorage.getItem('quran_incomplete_challenge');
        if (savedIncomplete) {
          const parsed = JSON.parse(savedIncomplete);
          if (parsed.mode === 'daily') {
            localStorage.removeItem('quran_incomplete_challenge');
          }
        }
        return;
      }
    } catch {}

    // ب. التحقق من جدول اللاعبين (players.completedChallengeIds) والتخزين المحلي
    try {
      const activeUser = userId || 
                         localStorage.getItem('quran_player_id') || 
                         localStorage.getItem('quran_unique_player_id') || 
                         localStorage.getItem('quran_player_username') || 
                         localStorage.getItem('quran_player_name');

      if (!activeUser) return;

      const challengeId = dailyChallenge?.id;

      // 1. فحص التخزين المحلي للتحديات المكتملة
      if (challengeId) {
        const localCompleted = localStorage.getItem('quran_completed_challenges') || localStorage.getItem('quran_completed_ids');
        if (localCompleted) {
          try {
            const ids = JSON.parse(localCompleted);
            if (Array.isArray(ids) && ids.includes(challengeId)) {
              setIsDailyCompleted(true);
              localStorage.setItem('quran_daily_completed', today);
              return;
            }
          } catch {}
        }
      }

      // 2. فحص جدول players لقائمة completedChallengeIds
      const isNum = !isNaN(Number(activeUser)) && Number(activeUser) > 0;
      let query = supabase.from('players').select('completedChallengeIds');
      if (isNum) {
        query = query.or(`id.eq.${activeUser},uniquePlayerId.eq.${activeUser}`);
      } else {
        query = query.or(`uniquePlayerId.eq.${activeUser},username.eq.${activeUser},name.eq.${activeUser}`);
      }

      const { data: playerData, error: playerErr } = await query.limit(1).maybeSingle();

      if (!playerErr && playerData?.completedChallengeIds && Array.isArray(playerData.completedChallengeIds)) {
        if (challengeId && playerData.completedChallengeIds.includes(challengeId)) {
          setIsDailyCompleted(true);
          localStorage.setItem('quran_daily_completed', today);
          return;
        }
      }
    } catch (err) {
      console.error('[ChallengesHubPage] Safe catch verifying daily challenge completion:', err);
    }
  }, [dailyCompleted, userId, dailyChallenge]);

  // تحديث الحالة عند تغير الـ Prop
  useEffect(() => {
    if (dailyCompleted) {
      setIsDailyCompleted(true);
    } else {
      checkDailyCompletion();
    }
  }, [dailyCompleted, checkDailyCompletion]);

  // 3. إعادة جلب البيانات والتحقق عند العودة للشاشة وتركيز النافذة (Revalidation on Focus)
  useEffect(() => {
    const handleRevalidate = () => {
      checkDailyCompletion();
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleRevalidate();
      }
    });

    handleRevalidate();

    return () => {
      window.removeEventListener('focus', handleRevalidate);
    };
  }, [checkDailyCompletion]);

  // التحقق الشرطي من وجود تحدٍ غير مكتمل قابل للاستئناف
  const showIncompleteAlert = incompleteChallenge && (!isDailyCompleted || incompleteChallenge.mode !== 'daily');

  return (
    <motion.div
      key="challenges"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col gap-6 max-w-6xl mx-auto py-4 md:py-6 px-4 pb-36 sm:pb-48"
    >
      {/* Clean Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-brand-gold rounded-full" />
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-brand-emerald tracking-tight">
              التحديات الإسلامية
            </h2>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              مسابقات قرآنية وثقافية لتثبيت الحفظ والمنافسة الشريفة
            </p>
          </div>
        </div>
      </div>

      {/* 1. لافتة 'يوجد تحدي جماعي قيد التشغيل - العودة للتحدي' */}
      {effectiveActiveRoom && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-emerald-700/20 flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/40"
        >
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
              <Zap className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-emerald-950">
                  {effectiveActiveRoom.status === 'WAITING' ? 'قيد الانتظار ⏳' : 'تحدي جاري الآن ⚡'}
                </span>
                <span className="text-xs text-emerald-100 font-bold">
                  {effectiveActiveRoom.name || 'غرفة التحدي الجماعي'}
                </span>
              </div>
              <h3 className="font-black text-white text-sm sm:text-base mt-1">
                يوجد تحدي جماعي قيد التشغيل - العودة للتحدي
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const target = effectiveActiveRoom;
              if (!target) return;
              try {
                localStorage.setItem('activeRoomId', String(target.id));
              } catch (_) {}

              if (effectiveResumeRoom) {
                try { effectiveResumeRoom(target); } catch (_) {}
              } else if (app?.handleResumeActiveRoom) {
                try { app.handleResumeActiveRoom(target); } catch (_) {}
              } else if (app?.handleJoinV1) {
                try { app.handleJoinV1(target.id); } catch (_) {}
              }

              // Direct view switch guarantee
              if (target.status === 'WAITING') {
                setView('group_waiting');
              } else if (target.gameMode === 'WHO_AM_I' || target.challenge_type === 'who_am_i') {
                setView('group_game');
              } else {
                setView('challenge');
              }

              // Route push
              try {
                router.push(`/room/${target.id}`);
              } catch (_) {}
            }}
            className="w-full sm:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>العودة للتحدي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* 2. لافتة 'لديك تحدي لم يكتمل بعد' (تظهر فقط إذا لم يكتمل التحدي) */}
      {showIncompleteAlert && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-right shadow-xs"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <span className="font-black text-slate-800 text-sm sm:text-base block">لديك تحدٍ لم يكتمل بعد!</span>
              <span className="text-xs font-bold text-slate-500">استمر في رحلتك وسجل اسمك بين المتصدرين</span>
            </div>
          </div>

          <button
            onClick={() => {
              setChallengeMode(incompleteChallenge.mode);
              if (incompleteChallenge.mode === 'normal') {
                setCurrentChallengeIndex(incompleteChallenge.index);
              }
              setView('challenge');
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-brand-emerald text-white rounded-xl font-black text-xs sm:text-sm hover:bg-[#033628] transition-all shadow-xs active:scale-95 flex items-center justify-center gap-2"
          >
            <span>متابعة التحدي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Clean & Beautiful Challenges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">

        {/* 1. Group Live Challenge Card (التحدي الجماعي) */}
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView('group_join')}
          className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-amber-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
        >
          <div className="flex items-start justify-between">
            <GroupChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>مباشر الآن</span>
              </span>
              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-amber-700 transition-colors">
              التحدي الجماعي
            </h3>
            <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
              سباق مباشر في غرف خاصة وعامة في المتشابهات والمعلومات الإسلامية
            </p>
          </div>
        </motion.button>

        {/* 2. Daily Challenge Card (التحدي اليومي) */}
        <motion.button
          whileHover={{ y: (dailyCompleted || isDailyCompleted) ? 0 : -3 }}
          whileTap={{ scale: (dailyCompleted || isDailyCompleted) ? 1 : 0.98 }}
          onClick={handleStartDaily}
          disabled={dailyCompleted || isDailyCompleted}
          className={`group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border min-h-[160px] ${
            (dailyCompleted || isDailyCompleted)
              ? 'bg-slate-50/90 border-slate-200/80 shadow-xs'
              : 'bg-white border-slate-150 hover:border-emerald-400 shadow-xs hover:shadow-md'
          }`}
        >
          <div>
            <div className="flex items-start justify-between">
              <DailyChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                  (dailyCompleted || isDailyCompleted)
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200/40'
                }`}>
                  {(dailyCompleted || isDailyCompleted) ? '✓ تم الإنجاز اليوم' : 'كل 24 ساعة'}
                </span>
                {!(dailyCompleted || isDailyCompleted) && (
                  <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-brand-emerald group-hover:-translate-x-1 transition-all" />
                )}
              </div>
            </div>

            <div className="mt-3.5">
              <h3 className={`text-base md:text-lg font-black ${(dailyCompleted || isDailyCompleted) ? 'text-slate-700' : 'text-slate-800 group-hover:text-brand-emerald'} transition-colors`}>
                التحدي اليومي
              </h3>
              <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
                {(dailyCompleted || isDailyCompleted) ? 'أحسنت! حافظت على شعلتك وسلسلة إنجازك' : 'إكمال الآية اليومية لتثبيت حفظ الورد ومضاعفة نقاطك'}
              </p>
            </div>
          </div>

          {/* عنصر الموعد القادم المنظم داخل البطاقة */}
          {(dailyCompleted || isDailyCompleted) && (
            <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between bg-emerald-50/70 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs">
                <Clock className="w-3.5 h-3.5 text-brand-emerald" />
                <span>الموعد القادم:</span>
              </div>
              <span className="text-xs font-black text-brand-emerald tabular-nums">
                {timeLeft || 'غداً'}
              </span>
            </div>
          )}
        </motion.button>

        {/* 3. Skills Challenge Card (تحدي المهارات) */}
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setIsSpeedMode(false);
            setView('skills_menu');
          }}
          className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-teal-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
        >
          <div className="flex items-start justify-between">
            <SkillsChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/40">
                {systemSettings.hideAudioChallenge ? 'مهارتان' : '3 مهارات'}
              </span>
              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-teal-600 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-teal-700 transition-colors">
              تحدي المهارات
            </h3>
            <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
              {systemSettings.hideAudioChallenge
                ? 'إكمال المتشابهات القرآنية، وتحديد اسم السورة الكريمة'
                : 'تلاوة صوتية بالذكاء الاصطناعي، أو إكمال المتشابهات، أو اسم السورة'}
            </p>
          </div>
        </motion.button>

        {/* 4. Speed Challenge Card (تحدي السرعة) */}
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setIsSpeedMode(true);
            setView('speed_menu');
          }}
          className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-rose-400 bg-white shadow-xs hover:shadow-md min-h-[160px]"
        >
          <div className="flex items-start justify-between">
            <SpeedChallengeEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200/40">
                30 ثانية
              </span>
              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-rose-600 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-rose-700 transition-colors">
              تحدي السرعة
            </h3>
            <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
              اختبار سرعة البديهة واستحضار الآيات المتشابهة مع العداد
            </p>
          </div>
        </motion.button>

        {/* 5. Islamic Knowledge Quiz Card (تحدي معلومات إسلامية) */}
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView('islamic_quiz')}
          className="group relative p-5 md:p-6 rounded-2xl text-right overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-150 hover:border-emerald-500 bg-white shadow-xs hover:shadow-md min-h-[160px]"
        >
          <div className="flex items-start justify-between">
            <IslamicQuizEmblem className="w-12 h-12 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/40">
                5,820 سؤال
              </span>
              <ArrowLeft className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:-translate-x-1 transition-all" />
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-base md:text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
              تحدي معلومات إسلامية
            </h3>
            <p className="text-slate-400 font-bold text-xs mt-1 leading-relaxed">
              موسوعة أسئلة شاملة في العقيدة، الفقه، السيرة، التفسير، والتاريخ
            </p>
          </div>
        </motion.button>

      </div>
    </motion.div>
  );
};

export default ChallengesHubPage;

