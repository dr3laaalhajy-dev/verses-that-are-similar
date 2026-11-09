import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchUserMilestones,
  UserMilestonesStats,
  MILESTONES_CONFIG,
  MilestoneItem,
  CompletedAchievement
} from '../services/milestoneProgressService';

export interface UseAchievementsOptions {
  userId?: string | number | null;
  username?: string | null;
  playerName?: string | null;
  uniquePlayerId?: string | null;
  isSelf?: boolean;
}

export interface AchievementItem extends MilestoneItem {
  currentProgress: number;
  percent: number;
  isCompleted: boolean;
  certificate: CompletedAchievement | null;
}

/**
 * useAchievements Hook
 * توحيد مصدر الحقيقة (Single Source of Truth) بين صفحة الإعدادات والملف الشخصي
 * يضمن قراءة نفس الإحصائيات الصارمة وحساب نسبة الختم واشتقاق الشهادات المكتملة 100% فقط
 */
export function useAchievements(options?: UseAchievementsOptions | null) {
  const [stats, setStats] = useState<UserMilestonesStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserMilestones({
        userId: options?.userId,
        username: options?.username,
        playerName: options?.playerName,
        uniquePlayerId: options?.uniquePlayerId,
        isSelf: options?.isSelf
      });
      setStats(data);
    } catch (err: any) {
      console.error('[useAchievements] Error fetching milestones:', err);
      setError(err?.message || 'Error fetching achievements');
    } finally {
      setLoading(false);
    }
  }, [
    options?.userId,
    options?.username,
    options?.playerName,
    options?.uniquePlayerId,
    options?.isSelf
  ]);

  useEffect(() => {
    fetchProgress();

    const handleInvalidation = () => {
      fetchProgress();
    };

    window.addEventListener('milestones_updated', handleInvalidation);
    window.addEventListener('quran_certificates_updated', handleInvalidation);
    window.addEventListener('focus', handleInvalidation);

    return () => {
      window.removeEventListener('milestones_updated', handleInvalidation);
      window.removeEventListener('quran_certificates_updated', handleInvalidation);
      window.removeEventListener('focus', handleInvalidation);
    };
  }, [fetchProgress]);

  const serialSuffix =
    options?.uniquePlayerId || options?.username || options?.userId || 'CERT';

  // حساب حالة كل إنجاز والتحقق الرياضي من اكتماله
  const milestones: AchievementItem[] = useMemo(() => {
    return MILESTONES_CONFIG.map((m) => {
      const currentProgress = stats ? (stats[m.id] ?? 0) : 0;
      const percent = Math.min(
        100,
        Math.round((currentProgress / m.target) * 100)
      );
      const isCompleted = currentProgress >= m.target;

      const certificate: CompletedAchievement | null = isCompleted
        ? {
            id: m.id,
            title: m.title,
            category: m.category,
            target: m.target,
            icon: m.icon,
            scope: m.scope,
            rank: m.rank,
            score:
              m.id === 'speed_1000'
                ? `${currentProgress} نقطة`
                : m.id === 'daily_streak_30'
                ? `${currentProgress} يوماً`
                : '100%',
            serial: `MTN-${m.id.toUpperCase()}-${serialSuffix}`,
            userProgress: currentProgress,
            targetGoal: m.target
          }
        : null;

      return {
        ...m,
        currentProgress,
        percent,
        isCompleted,
        certificate
      };
    });
  }, [stats, serialSuffix]);

  // تصفية الشهادات المكتملة فعلياً بنسبة 100% فقط (userProgress >= targetGoal)
  const completedAchievements: CompletedAchievement[] = useMemo(() => {
    return milestones
      .filter((m) => m.isCompleted && m.certificate)
      .map((m) => m.certificate!);
  }, [milestones]);

  const completedCount = completedAchievements.length;
  const totalCount = MILESTONES_CONFIG.length;
  const completionPercent = Math.round((completedCount / totalCount) * 100);

  return {
    stats,
    milestones,
    completedAchievements,
    completedCount,
    totalCount,
    completionPercent,
    loading,
    error,
    refresh: fetchProgress
  };
}

export default useAchievements;
