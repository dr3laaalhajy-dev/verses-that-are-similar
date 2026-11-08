"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Trophy,
  CheckCircle2,
  Lock,
  Sparkles,
  Download,
  Eye,
  Flame,
  Star,
  Check,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { ChallengeCertificate } from './ChallengeCertificate';
import { CertificateModal } from './CertificateModal';
import {
  fetchUserMilestones,
  UserMilestonesStats,
  MILESTONES_CONFIG,
  MilestoneItem
} from '../services/milestoneProgressService';

export type { MilestoneItem };

interface AchievementsMilestoneTrackerProps {
  playerName?: string | null;
  playerUsername?: string | null;
  totalPoints?: number;
  cups?: number;
  userCertificates?: { category: string; date: string; name: string }[];
  onOpenCertificateModal?: (milestone: MilestoneItem) => void;
}

export const AchievementsMilestoneTracker: React.FC<AchievementsMilestoneTrackerProps> = ({
  playerName,
  playerUsername,
  totalPoints = 0,
  cups = 0,
  userCertificates = [],
  onOpenCertificateModal
}) => {
  // 1. حظر التعديل: استخراج اسم اللاعب المعتمد من قاعدة البيانات / الحساب الرسمي
  const verifiedPlayerName = useMemo(() => {
    return (
      playerName ||
      localStorage.getItem('quran_user_triple_name') ||
      localStorage.getItem('quran_player_name') ||
      localStorage.getItem('quran_user_name') ||
      'علاء'
    );
  }, [playerName]);

  // حالة التقدم الحية لكل إنجاز (Real-time Progress Mapping)
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(true);

  // حالة فتح نافذة معاينة وتحميل الشهادة المعتمدة
  const [activeCertMilestone, setActiveCertMilestone] = useState<MilestoneItem | null>(null);

  // جلب وقراءة بيانات التقدم الفعلي من قاعدة البيانات والذاكرة المحلية
  useEffect(() => {
    let isMounted = true;

    const fetchRealtimeProgress = async () => {
      setIsLoadingProgress(true);
      const newProgress: Record<string, number> = {};

      try {
        // جلب الإحصائيات الدقيقة مع الالتزام بشرط is_correct === true والعزل التام للأقسام
        const stats = await fetchUserMilestones({
          username: playerUsername,
          playerName: playerName,
          uniquePlayerId: localStorage.getItem('quran_player_id')
        });

        // مطابقة التقدم لكل إنجاز بدقة تامة وبدون أي أرقام عشوائية (Single Source of Truth)
        MILESTONES_CONFIG.forEach((m) => {
          // استخدام القيمة الدقيقة المحتسبة حصراً للإجابات الصحيحة في هذا القسم
          const val = stats[m.id] ?? 0;
          newProgress[m.id] = Math.min(Math.max(0, val), m.target);
        });

        if (isMounted) {
          setProgressMap(newProgress);
        }
      } catch (err) {
        console.error('[MilestoneTracker] Error computing progress:', err);
      } finally {
        if (isMounted) {
          setIsLoadingProgress(false);
        }
      }
    };

    fetchRealtimeProgress();

    return () => {
      isMounted = false;
    };
  }, [playerName, playerUsername, totalPoints, userCertificates]);

  // حساب الإحصائيات الإجمالية
  const { completedCount, totalCount, completionPercent } = useMemo(() => {
    const total = MILESTONES_CONFIG.length;
    let completed = 0;
    MILESTONES_CONFIG.forEach((m) => {
      const prog = progressMap[m.id] ?? 0;
      if (prog >= m.target) {
        completed++;
      }
    });
    return {
      completedCount: completed,
      totalCount: total,
      completionPercent: Math.round((completed / total) * 100)
    };
  }, [progressMap]);

  // معالجة الضغط على زر معاينة وتحميل الشهادة
  const handleOpenCertificate = (milestone: MilestoneItem) => {
    if (onOpenCertificateModal) {
      onOpenCertificateModal(milestone);
    } else {
      setActiveCertMilestone(milestone);
    }
  };

  return (
    <div className="w-full space-y-6 text-right" dir="rtl">
      {/* ========================================================= */}
      {/* شريط إحصائيات الإنجازات والأوسمة الرسمي */}
      {/* ========================================================= */}
      <div className="w-full max-w-sm md:max-w-md mx-auto p-4 md:p-6 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-amber-500/10 border border-amber-300/40 rounded-3xl shadow-xs">
        {/* 1. الترويسة والعنوان (Header Layout) */}
        <div className="flex flex-wrap items-start justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Award className="w-5 h-5 md:w-6 md:h-6 text-amber-100" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <h3 className="text-lg md:text-xl leading-tight font-black text-slate-800">
                  لوحة شهاداتي وإنجازاتي المعتمدة
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                  توثيق رسمي
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
                تتبع مسيرتك في ضبط المتشابهات ومسابقات علوم القرآن والسنة النبوية
              </p>
            </div>
          </div>
        </div>

        {/* 2. صناديق الإحصائيات (Stats Boxes) */}
        <div className="flex w-full gap-3 md:gap-4 my-4">
          <div className="flex-1 py-2 px-3 md:py-3 bg-white border border-slate-200 rounded-2xl text-center shadow-2xs">
            <span className="block text-[10px] md:text-xs font-bold text-slate-400">المكتملة</span>
            <span className="text-lg md:text-2xl font-black text-emerald-700 font-mono">
              {completedCount} / {totalCount}
            </span>
          </div>
          <div className="flex-1 py-2 px-3 md:py-3 bg-white border border-slate-200 rounded-2xl text-center shadow-2xs">
            <span className="block text-[10px] md:text-xs font-bold text-slate-400">نسبة الختم</span>
            <span className="text-lg md:text-2xl font-black text-amber-600 font-mono">
              {completionPercent}%
            </span>
          </div>
        </div>

        {/* 3. شريط التقدم السفلي (Progress Bar) */}
        <div className="pt-3 border-t border-amber-200/40">
          <div className="flex items-center justify-between text-xs md:text-sm font-medium text-slate-600 mb-1.5">
            <span>التقدم نحو إتمام جميع المسابقات:</span>
            <span className="text-amber-700 font-mono font-bold">{completionPercent}%</span>
          </div>
          <div className="w-full h-2 md:h-3 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full transition-all duration-700"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* شبكة بطاقات الإنجازات الـ 11 الحصرية (Milestone Cards) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MILESTONES_CONFIG.map((milestone) => {
          const currentProgress = progressMap[milestone.id] ?? 0;
          const isUnlocked = currentProgress >= milestone.target;
          const percent = Math.min(100, Math.round((currentProgress / milestone.target) * 100));

          return (
            <div
              key={milestone.id}
              className={`rounded-2xl sm:rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                isUnlocked
                  ? 'bg-white border-amber-300 shadow-md shadow-amber-500/10 hover:border-amber-400 hover:shadow-lg'
                  : 'bg-slate-50/70 border-slate-200/80 opacity-75 hover:opacity-90'
              }`}
            >
              <div>
                {/* رأس البطاقة ووسام الحالة */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>مكتملة ومُعتمدة</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold bg-slate-200/80 text-slate-600 px-2.5 py-0.5 rounded-full">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>غير مكتمل (قيد القفل)</span>
                    </span>
                  )}

                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-xl">
                    {milestone.category}
                  </span>
                </div>

                {/* العنوان والأيقونة */}
                <div className="flex items-start gap-3 my-2">
                  <span className="text-2xl p-2 rounded-2xl bg-amber-50 border border-amber-200/70 shrink-0">
                    {milestone.icon}
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 leading-snug">
                      {milestone.title}
                    </h4>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      {milestone.scope}
                    </p>
                  </div>
                </div>
              </div>

              {/* شريط التقدم والأزرار */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                {/* عداد التقدم الرقمي */}
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-400">حالة التقدم:</span>
                  <span
                    className={`font-mono ${
                      isUnlocked ? 'text-emerald-700 font-black' : 'text-slate-600'
                    }`}
                  >
                    {currentProgress} / {milestone.target} ({percent}%)
                  </span>
                </div>

                {/* شريط التقدم */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 mb-3.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUnlocked
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                        : 'bg-slate-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* أزرار الإجراءات حسب حالة الفتح */}
                {isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => handleOpenCertificate(milestone)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 active:scale-98 text-white font-black text-xs shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>معاينة وتحميل الشهادة</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>يتطلب إكمال الإنجاز ({currentProgress}/{milestone.target})</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* نافذة معاينة وتحميل الشهادة المعتمدة (CertificateModal) */}
      {/* ========================================================= */}
      {activeCertMilestone && (
        <CertificateModal
          isOpen={Boolean(activeCertMilestone)}
          onClose={() => setActiveCertMilestone(null)}
          playerName={verifiedPlayerName}
          challengeName={activeCertMilestone.title}
          score={`${activeCertMilestone.target} / ${activeCertMilestone.target} (100%)`}
          surahOrJuz={activeCertMilestone.scope}
          certificateId={`MTN-${activeCertMilestone.id.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`}
        />
      )}
    </div>
  );
};

export default AchievementsMilestoneTracker;
