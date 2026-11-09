/**
 * Milestone Progress Service
 * إدارة وتتبع تقدم الإنجازات والشهادات بمعايير دقيقة وعزل تام للأقسام
 * مع الالتزام الصارم بشرط صحة الإجابة (is_correct === true) وتجاهل الخطأ والتخطي
 * توحيد مصدر الحقيقة (Single Source of Truth) بين صفحة الإعدادات والملف الشخصي
 */

import { supabase } from './supabase';

export interface UserMilestonesStats {
  ayah_100: number;          // إتمام 100 سؤال في تحدي إكمال الآية
  figh_quiz: number;         // ختم مسابقة الفقه والمعلومات الإسلامية (هدف: 100)
  surah_50: number;          // إتمام 50 سؤالاً في تحدي تحديد اسم السورة
  seerah_60: number;         // إتمام 60 سؤالاً في السيرة النبوية الشريفة
  akida_bank: number;        // ختم بنك أسئلة العقيدة الإسلامية (هدف: 100)
  hadith_100: number;        // إتمام 100 حديث شريف في السنة النبوية
  tafseer_100: number;       // إتمام 100 سؤال في تفسير القرآن الكريم
  history_conquests: number; // ختم مسابقة التاريخ والفتوحات الإسلامية (هدف: 100)
  arabic_language: number;   // إتمام مسابقة علوم اللغة العربية والمعاجم (هدف: 100)
  daily_streak_30: number;   // سلسلة 30 يوماً متتالية في التحدي اليومي
  speed_1000: number;        // المركز الأول و1000 نقطة في تحدي السرعة
}

export interface MilestoneItem {
  id: keyof UserMilestonesStats;
  title: string;
  category: string;
  target: number;
  icon: string;
  scope: string;
  rank: string;
  fallbackProgress: number;
}

/**
 * المصدر المعتمد والوحيد لإعدادات الإنجازات والشهادات في التطبيق
 */
export const MILESTONES_CONFIG: MilestoneItem[] = [
  {
    id: 'ayah_100',
    title: 'إتمام 100 سؤال في تحدي إكمال الآية',
    category: 'علوم القرآن',
    icon: '📖',
    target: 100,
    scope: 'كامل القرآن الكريم',
    rank: 'حافظ متقن',
    fallbackProgress: 0,
  },
  {
    id: 'figh_quiz',
    title: 'ختم مسابقة الفقه والمعلومات الإسلامية',
    category: 'الفقه الإسلامي',
    icon: '⚖️',
    target: 100,
    scope: 'العبادات والمعاملات',
    rank: 'فقيه متقن ومتميز',
    fallbackProgress: 0,
  },
  {
    id: 'surah_50',
    title: 'إتمام 50 سؤالاً في تحدي تحديد اسم السورة',
    category: 'متشابهات السور',
    icon: '🕌',
    target: 50,
    scope: 'أجزاء عم وتبارك والمفصل',
    rank: 'خبير المتشابهات',
    fallbackProgress: 0,
  },
  {
    id: 'seerah_60',
    title: 'إتمام 60 سؤالاً في السيرة النبوية الشريفة',
    category: 'السيرة النبوية',
    icon: '📜',
    target: 60,
    scope: 'العهد المكي والمدني والغزوات',
    rank: 'عالم بالسيرة النبوية',
    fallbackProgress: 0,
  },
  {
    id: 'akida_bank',
    title: 'ختم بنك أسئلة العقيدة الإسلامية',
    category: 'أصول الدين',
    icon: '🛡️',
    target: 100,
    scope: 'أركان الإيمان والتوحيد الخالص',
    rank: 'راسخ في العقيدة',
    fallbackProgress: 0,
  },
  {
    id: 'hadith_100',
    title: 'إتمام 100 حديث شريف في السنة النبوية',
    category: 'الحديث الشريف',
    icon: '✨',
    target: 100,
    scope: 'متون الحديث والأربعين النووية',
    rank: 'محدث متقن',
    fallbackProgress: 0,
  },
  {
    id: 'tafseer_100',
    title: 'إتمام 100 سؤال في تفسير القرآن الكريم',
    category: 'تفسير وبيان',
    icon: '💡',
    target: 100,
    scope: 'معاني الآيات ومقاصد السور',
    rank: 'عالم بالتفسير',
    fallbackProgress: 0,
  },
  {
    id: 'history_conquests',
    title: 'ختم مسابقة التاريخ والفتوحات الإسلامية',
    category: 'التاريخ الإسلامي',
    icon: '🏛️',
    target: 100,
    scope: 'سير الخلفاء الراشدين والفتوحات',
    rank: 'خبير بالتاريخ الإسلامي',
    fallbackProgress: 0,
  },
  {
    id: 'arabic_language',
    title: 'إتمام مسابقة علوم اللغة العربية والمعاجم',
    category: 'لغة الضاد',
    icon: '🖋️',
    target: 100,
    scope: 'فصيح الألفاظ والنحو والبلاغة',
    rank: 'أديب فصيح',
    fallbackProgress: 0,
  },
  {
    id: 'daily_streak_30',
    title: 'سلسلة 30 يوماً متتالية في التحدي اليومي',
    category: 'المثابرة والهمة',
    icon: '🔥',
    target: 30,
    scope: 'الشهر القرآني المبارك',
    rank: 'مواظب متفوق',
    fallbackProgress: 0,
  },
  {
    id: 'speed_1000',
    title: 'المركز الأول و1000 نقطة في تحدي السرعة',
    category: 'تحديات الصدارة',
    icon: '⚡',
    target: 1000,
    scope: 'سرعة البديهة في المتشابهات',
    rank: 'فارس السرعة الأول',
    fallbackProgress: 0,
  },
];

export interface CompletedAchievement {
  id: string;
  title: string;
  category: string;
  target: number;
  icon: string;
  scope: string;
  rank: string;
  score: string;
  serial: string;
  userProgress: number;
  targetGoal: number;
}

/**
 * معيار توحيد الفئات لضمان العزل التام للأقسام
 */
export function normalizeMilestoneCategory(cat: string): string {
  const c = String(cat || '').toLowerCase().trim();
  if (c === 'ayah' || c === 'ayah_100' || c === 'completion' || c === 'standard') return 'ayah';
  if (c === 'surah' || c === 'surah_50' || c === 'surah_name') return 'surah';
  if (c === 'figh' || c === 'figh_quiz' || c === 'fiqh' || c === 'general') return 'figh';
  if (c === 'seerah' || c === 'seerah_60' || c === 'sirah') return 'seerah';
  if (c === 'akida' || c === 'akida_bank' || c === 'aqida' || c === 'aqeedah') return 'akida';
  if (c === 'hadith' || c === 'hadith_100') return 'hadith';
  if (c === 'tafseer' || c === 'tafseer_100' || c === 'tafsir') return 'tafseer';
  if (c === 'history' || c === 'history_conquests') return 'history';
  if (c === 'arabia' || c === 'arabic' || c === 'arabic_language') return 'arabic';
  return c;
}

/**
 * 1. تصفية وتسجيل الإجابات الصحيحة فقط (Strict Correctness Filter)
 * يتم استدعاؤها فور إجابة اللاعب على أي سؤال في أي قسم
 */
export function recordMilestoneAnswer(params: {
  category: string;
  questionId: string | number;
  isCorrect: boolean;
  userId?: string | null;
}) {
  // قاعدة حاسمة: أي إجابة خاطئة أو متخطاة (Skipped) تُتجاهل تماماً
  if (!params.isCorrect) {
    return;
  }

  const category = normalizeMilestoneCategory(params.category);
  if (!category) return;

  const qIdStr = String(params.questionId);

  // أ) حفظ محلي معزول بالقسم فقط
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storageKey = `quran_correct_answers_${category}`;
      const raw = localStorage.getItem(storageKey);
      const set = new Set<string>(raw ? JSON.parse(raw) : []);
      set.add(qIdStr);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));

      // تحديث إجمالي الإجابات الصحيحة لهذا القسم حصراً
      localStorage.setItem(`quran_correct_count_${category}`, String(set.size));
    }
  } catch (err) {
    console.warn('[MilestoneService] Local storage answer record notice:', err);
  }

  // ب) مزامنة مع قاعدة بيانات Supabase
  const activeUser =
    params.userId ||
    (typeof window !== 'undefined' && (
      localStorage.getItem('quran_player_username') ||
      localStorage.getItem('quran_player_name') ||
      localStorage.getItem('quran_player_id')
    ));

  if (activeUser) {
    try {
      supabase
        .from('user_answers')
        .insert({
          user_id: activeUser,
          category: category,
          question_id: qIdStr,
          is_correct: true
        })
        .then(() => {}, () => {});
    } catch (_) {}
  }
}

/**
 * استخراج عدد الإجابات الصحيحة المحلية لقسم معين حصراً
 */
function getLocalCorrectCount(category: string): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    const norm = normalizeMilestoneCategory(category);
    const storageKey = `quran_correct_answers_${norm}`;
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr.length;
      }
    }
    const countVal = Number(localStorage.getItem(`quran_correct_count_${norm}`) || 0);
    return isNaN(countVal) ? 0 : countVal;
  } catch {
    return 0;
  }
}

/**
 * 2. استعلام جلب الإحصائيات الدقيقة مع العزل التام للأقسام (Supabase Query Refactoring)
 * يعود بكائن مفصل يحتوي على مجموع الإجابات الصحيحة فقط (is_correct = true) لكل قسم
 */
export async function fetchUserMilestones(params?: {
  username?: string | null;
  playerName?: string | null;
  uniquePlayerId?: string | null;
  userId?: string | number | null;
  isSelf?: boolean;
}): Promise<UserMilestonesStats> {
  const localUsername = typeof window !== 'undefined' ? localStorage.getItem('quran_player_username') : null;
  const localName = typeof window !== 'undefined' ? (localStorage.getItem('quran_player_name') || localStorage.getItem('quran_user_name')) : null;
  const localId = typeof window !== 'undefined' ? localStorage.getItem('quran_player_id') : null;
  const localUniquePlayerId = typeof window !== 'undefined' ? localStorage.getItem('quran_unique_player_id') : null;

  // التحقق إن كان المستخدم المطلوب هو نفس المستخدم المحلي المتصل حالياً
  const isLocalUser = Boolean(
    !params ||
    params.isSelf === true ||
    (params.username && localUsername && params.username.toLowerCase() === localUsername.toLowerCase()) ||
    (params.playerName && localName && params.playerName.toLowerCase() === localName.toLowerCase()) ||
    (params.uniquePlayerId && localUniquePlayerId && params.uniquePlayerId.toLowerCase() === localUniquePlayerId.toLowerCase()) ||
    (params.uniquePlayerId && localId && params.uniquePlayerId.toLowerCase() === localId.toLowerCase()) ||
    (params.userId && localId && String(params.userId).toLowerCase() === localId.toLowerCase())
  );

  // القيم الافتراضية: إن لم يكن المستخدم المحلي، تبدأ دائماً من 0 لمنع تسريب بيانات المشاهد للملف الشخصي للاعبين الآخرين
  const stats: UserMilestonesStats = {
    ayah_100: isLocalUser ? getLocalCorrectCount('ayah') : 0,
    figh_quiz: isLocalUser ? getLocalCorrectCount('figh') : 0,
    surah_50: isLocalUser ? getLocalCorrectCount('surah') : 0,
    seerah_60: isLocalUser ? getLocalCorrectCount('seerah') : 0,
    akida_bank: isLocalUser ? getLocalCorrectCount('akida') : 0,
    hadith_100: isLocalUser ? getLocalCorrectCount('hadith') : 0,
    tafseer_100: isLocalUser ? getLocalCorrectCount('tafseer') : 0,
    history_conquests: isLocalUser ? getLocalCorrectCount('history') : 0,
    arabic_language: isLocalUser ? getLocalCorrectCount('arabic') : 0,
    daily_streak_30: isLocalUser && typeof window !== 'undefined' ? Number(localStorage.getItem('quran_streak') || 0) : 0,
    speed_1000: isLocalUser && typeof window !== 'undefined' ? Number(localStorage.getItem('quran_total_points') || 0) : 0
  };

  try {
    let completedChallengeIds: number[] = [];

    if (isLocalUser && typeof window !== 'undefined') {
      try {
        const rawCompleted =
          localStorage.getItem('quran_completed_ids') ||
          localStorage.getItem('quran_completed_challenges');
        if (rawCompleted) {
          completedChallengeIds = JSON.parse(rawCompleted);
        }
      } catch (_) {}
    }

    const candidateTargets = [
      params?.uniquePlayerId,
      params?.username,
      params?.playerName,
      params?.userId,
      isLocalUser ? (localUniquePlayerId || localUsername || localName || localId) : null
    ].filter(Boolean).map(v => String(v).trim());

    let dbPlayer: any = null;

    if (candidateTargets.length > 0) {
      const orParts: string[] = [];
      candidateTargets.forEach(target => {
        if (/^\d+$/.test(target)) {
          orParts.push(`id.eq.${target}`);
        }
        orParts.push(`uniquePlayerId.eq.${target}`);
        orParts.push(`username.eq.${target}`);
        orParts.push(`name.eq.${target}`);
      });

      const { data } = await supabase
        .from('players')
        .select('id, uniquePlayerId, username, name, completedChallengeIds, points, streak, seerahCompleted, generalCompleted, quranCompleted, activeFrame')
        .or(orParts.join(','))
        .limit(1)
        .maybeSingle();

      dbPlayer = data;
    }

    if (dbPlayer) {
      if (Array.isArray(dbPlayer.completedChallengeIds)) {
        if (isLocalUser) {
          completedChallengeIds = Array.from(
            new Set([...completedChallengeIds, ...dbPlayer.completedChallengeIds])
          );
        } else {
          completedChallengeIds = dbPlayer.completedChallengeIds;
        }
      }

      if (typeof dbPlayer.streak === 'number') {
        stats.daily_streak_30 = isLocalUser
          ? Math.max(stats.daily_streak_30, dbPlayer.streak)
          : dbPlayer.streak;
      }
      if (typeof dbPlayer.points === 'number') {
        stats.speed_1000 = isLocalUser
          ? Math.max(stats.speed_1000, dbPlayer.points)
          : dbPlayer.points;
      }

      // اعتماد الشهادات المكتملة الموثقة في قاعدة البيانات (100% Completion Flags)
      if (dbPlayer.seerahCompleted || dbPlayer.activeFrame === 'seerah') {
        stats.seerah_60 = Math.max(stats.seerah_60, 60);
      }
      if (dbPlayer.generalCompleted || dbPlayer.activeFrame === 'general') {
        stats.figh_quiz = Math.max(stats.figh_quiz, 100);
      }
      if (dbPlayer.quranCompleted || completedChallengeIds.length >= 100) {
        stats.ayah_100 = Math.max(stats.ayah_100, 100);
      }

      // مزامنة الشهادات المحلية في المتصفح تلقائياً عند تأكيد اكتمالها في قاعدة البيانات
      if (isLocalUser && typeof window !== 'undefined') {
        try {
          const savedCerts = JSON.parse(localStorage.getItem('quran_user_certificates') || '[]');
          let modified = false;
          const playerName = dbPlayer.name || localName || 'البطل القرآني';
          if (dbPlayer.seerahCompleted && !savedCerts.some((c: any) => c.category === 'seerah')) {
            savedCerts.push({ category: 'seerah', date: 'مُعتمدة', name: playerName });
            modified = true;
          }
          if (dbPlayer.generalCompleted && !savedCerts.some((c: any) => c.category === 'general')) {
            savedCerts.push({ category: 'general', date: 'مُعتمدة', name: playerName });
            modified = true;
          }
          if (modified) {
            localStorage.setItem('quran_user_certificates', JSON.stringify(savedCerts));
          }
        } catch (_) {}
      }
    }

    // 1) فصل إكمال الآية عن اسم السورة بالاعتماد على جدول challenges (العزل التام)
    if (completedChallengeIds.length > 0) {
      try {
        const { data: challengesRows } = await supabase
          .from('challenges')
          .select('id, type')
          .in('id', completedChallengeIds);

        if (challengesRows && challengesRows.length > 0) {
          let ayahCount = 0;
          let surahCount = 0;

          challengesRows.forEach((ch) => {
            const chType = String(ch.type || '').toUpperCase();
            if (chType === 'SURAH' || chType === 'SURAH_NAME') {
              surahCount++;
            } else if (chType === 'COMPLETION' || chType === 'STANDARD') {
              ayahCount++;
            }
          });

          if (isLocalUser) {
            stats.ayah_100 = Math.max(stats.ayah_100, ayahCount);
            stats.surah_50 = Math.max(stats.surah_50, surahCount);
          } else {
            stats.ayah_100 = ayahCount;
            stats.surah_50 = surahCount;
          }
        } else {
          if (isLocalUser) {
            stats.ayah_100 = Math.max(stats.ayah_100, completedChallengeIds.length);
          } else {
            stats.ayah_100 = completedChallengeIds.length;
          }
        }
      } catch (err) {
        console.warn('[MilestoneService] Challenges categorization notice:', err);
      }
    }

    // 2) استعلام الإجابات الصحيحة فقط (is_correct === true) من Supabase
    const searchUserIds = Array.from(
      new Set(
        [
          dbPlayer?.uniquePlayerId,
          dbPlayer?.username,
          dbPlayer?.name,
          dbPlayer?.id ? String(dbPlayer.id) : null,
          ...candidateTargets
        ].filter(Boolean) as string[]
      )
    );

    if (searchUserIds.length > 0) {
      try {
        const { data: correctRows } = await supabase
          .from('user_answers')
          .select('category, question_id, is_correct')
          .in('user_id', searchUserIds)
          .eq('is_correct', true);

        if (correctRows && Array.isArray(correctRows)) {
          // تجميع وتصنيف الإجابات الصحيحة بكل قسم حصراً
          const catMap: Record<string, Set<string>> = {};
          correctRows.forEach((r) => {
            if (r.is_correct === true && r.category) {
              const norm = normalizeMilestoneCategory(r.category);
              if (!catMap[norm]) catMap[norm] = new Set();
              catMap[norm].add(String(r.question_id || ''));
            }
          });

          if (catMap['figh']) {
            stats.figh_quiz = isLocalUser ? Math.max(stats.figh_quiz, catMap['figh'].size) : catMap['figh'].size;
          }
          if (catMap['seerah']) {
            stats.seerah_60 = isLocalUser ? Math.max(stats.seerah_60, catMap['seerah'].size) : catMap['seerah'].size;
          }
          if (catMap['akida']) {
            stats.akida_bank = isLocalUser ? Math.max(stats.akida_bank, catMap['akida'].size) : catMap['akida'].size;
          }
          if (catMap['hadith']) {
            stats.hadith_100 = isLocalUser ? Math.max(stats.hadith_100, catMap['hadith'].size) : catMap['hadith'].size;
          }
          if (catMap['tafseer']) {
            stats.tafseer_100 = isLocalUser ? Math.max(stats.tafseer_100, catMap['tafseer'].size) : catMap['tafseer'].size;
          }
          if (catMap['history']) {
            stats.history_conquests = isLocalUser ? Math.max(stats.history_conquests, catMap['history'].size) : catMap['history'].size;
          }
          if (catMap['arabic']) {
            stats.arabic_language = isLocalUser ? Math.max(stats.arabic_language, catMap['arabic'].size) : catMap['arabic'].size;
          }
          if (catMap['ayah']) {
            stats.ayah_100 = isLocalUser ? Math.max(stats.ayah_100, catMap['ayah'].size) : catMap['ayah'].size;
          }
          if (catMap['surah']) {
            stats.surah_50 = isLocalUser ? Math.max(stats.surah_50, catMap['surah'].size) : catMap['surah'].size;
          }
        }
      } catch (_) {}
    }

    // 3) فحص تقدم المواضيع المكتملة محلياً للمستخدم المتصل فقط
    if (isLocalUser && typeof window !== 'undefined') {
      const customCats = ['figh', 'akida', 'hadith', 'tafseer', 'history', 'arabia'];
      customCats.forEach((catKey) => {
        try {
          const rawTopics = localStorage.getItem(`quran_quiz_topics_${catKey}`);
          if (rawTopics) {
            const parsed = JSON.parse(rawTopics);
            let passedTopicsCount = 0;
            [1, 2, 3].forEach((lvl) => {
              if (Array.isArray(parsed[lvl])) {
                passedTopicsCount += parsed[lvl].length;
              }
            });
            const verifiedCorrects = passedTopicsCount * 12; // 12 سؤال صحيح في كل موضوع مجتاز
            const normKey = normalizeMilestoneCategory(catKey);
            if (normKey === 'figh') stats.figh_quiz = Math.max(stats.figh_quiz, verifiedCorrects);
            if (normKey === 'akida') stats.akida_bank = Math.max(stats.akida_bank, verifiedCorrects);
            if (normKey === 'hadith') stats.hadith_100 = Math.max(stats.hadith_100, verifiedCorrects);
            if (normKey === 'tafseer') stats.tafseer_100 = Math.max(stats.tafseer_100, verifiedCorrects);
            if (normKey === 'history') stats.history_conquests = Math.max(stats.history_conquests, verifiedCorrects);
            if (normKey === 'arabic') stats.arabic_language = Math.max(stats.arabic_language, verifiedCorrects);
          }
        } catch (_) {}
      });

      // السيرة النبوية: حساب الإجابات الصحيحة فقط
      try {
        const seerahRaw = localStorage.getItem('quran_quiz_progress_seerah');
        if (seerahRaw) {
          const sObj = JSON.parse(seerahRaw);
          const correctScore = Number(sObj.score || (sObj.easy ? sObj.easy * 15 : 0));
          stats.seerah_60 = Math.max(stats.seerah_60, correctScore);
        }
      } catch (_) {}
    }

  } catch (err) {
    console.error('[MilestoneService] Error in fetchUserMilestones:', err);
  }

  // كبح القيم القصوى عند حدود المستهدفات الرسمية
  return {
    ayah_100: Math.min(stats.ayah_100, 100),
    figh_quiz: Math.min(stats.figh_quiz, 100),
    surah_50: Math.min(stats.surah_50, 50),
    seerah_60: Math.min(stats.seerah_60, 60),
    akida_bank: Math.min(stats.akida_bank, 100),
    hadith_100: Math.min(stats.hadith_100, 100),
    tafseer_100: Math.min(stats.tafseer_100, 100),
    history_conquests: Math.min(stats.history_conquests, 100),
    arabic_language: Math.min(stats.arabic_language, 100),
    daily_streak_30: Math.min(stats.daily_streak_30, 30),
    speed_1000: Math.min(stats.speed_1000, 1000)
  };
}

/**
 * دالة جلب الإنجازات والشهادات المكتملة فعلياً (Single Source of Truth)
 * Strict Validation: userProgress >= targetGoal (100% فقط)
 */
export async function getCompletedAchievements(
  userIdentifier?: string | number | {
    userId?: string | number | null;
    username?: string | null;
    playerName?: string | null;
    uniquePlayerId?: string | null;
    isSelf?: boolean;
  } | null
): Promise<CompletedAchievement[]> {
  let params: {
    userId?: string | number | null;
    username?: string | null;
    playerName?: string | null;
    uniquePlayerId?: string | null;
    isSelf?: boolean;
  } = {};

  if (typeof userIdentifier === 'object' && userIdentifier !== null) {
    params = userIdentifier;
  } else if (typeof userIdentifier === 'string' || typeof userIdentifier === 'number') {
    const str = String(userIdentifier).trim();
    if (/^\d+$/.test(str)) {
      params = { userId: str };
    } else if (str.startsWith('MT-')) {
      params = { uniquePlayerId: str };
    } else {
      params = { username: str, playerName: str };
    }
  }

  // 1. جلب الإحصائيات الحقيقية مع العزل التام للأقسام
  const stats = await fetchUserMilestones(params);

  // 2. تصفية الشهادات التي حققت فقط 100% (userProgress >= targetGoal)
  const completedList: CompletedAchievement[] = [];
  const serialSuffix = params.uniquePlayerId || params.username || params.userId || 'CERT';

  MILESTONES_CONFIG.forEach((m) => {
    const userProgress = stats[m.id] ?? 0;
    const targetGoal = m.target;

    // الشرط الرياضي الصارم: لا تظهر الشهادة أبداً ما لم يكتمل العداد بنسبة 100%
    if (userProgress >= targetGoal) {
      completedList.push({
        id: m.id,
        title: m.title,
        category: m.category,
        target: m.target,
        icon: m.icon,
        scope: m.scope,
        rank: m.rank,
        score: m.id === 'speed_1000' ? `${userProgress} نقطة` : (m.id === 'daily_streak_30' ? `${userProgress} يوماً` : '100%'),
        serial: `MTN-${m.id.toUpperCase()}-${serialSuffix}`,
        userProgress,
        targetGoal
      });
    }
  });

  return completedList;
}
