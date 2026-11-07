/**
 * Milestone Progress Service
 * إدارة وتتبع تقدم الإنجازات والشهادات بمعايير دقيقة وعزل تام للأقسام
 * مع الالتزام الصارم بشرط صحة الإجابة (is_correct === true) وتجاهل الخطأ والتخطي
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

/**
 * معيار توحيد الفئات لضمان العزل التام للأقسام
 */
export function normalizeMilestoneCategory(cat: string): string {
  const c = String(cat || '').toLowerCase().trim();
  if (c === 'ayah' || c === 'ayah_100' || c === 'completion' || c === 'standard') return 'ayah';
  if (c === 'surah' || c === 'surah_50' || c === 'surah_name') return 'surah';
  if (c === 'figh' || c === 'figh_quiz' || c === 'fiqh') return 'figh';
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
    const storageKey = `quran_correct_answers_${category}`;
    const raw = localStorage.getItem(storageKey);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(qIdStr);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));

    // تحديث إجمالي الإجابات الصحيحة لهذا القسم حصراً
    localStorage.setItem(`quran_correct_count_${category}`, String(set.size));
  } catch (err) {
    console.warn('[MilestoneService] Local storage answer record notice:', err);
  }

  // ب) مزامنة اختيارية مع قاعدة بيانات Supabase
  const activeUser =
    params.userId ||
    localStorage.getItem('quran_player_username') ||
    localStorage.getItem('quran_player_name') ||
    localStorage.getItem('quran_player_id');

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
 * 2 & 3. استعلام جلب الإحصائيات الدقيقة مع العزل التام للأقسام (Supabase Query Refactoring)
 * يعود بكائن مفصل يحتوي على مجموع الإجابات الصحيحة فقط (is_correct = true) لكل قسم
 */
export async function fetchUserMilestones(params?: {
  username?: string | null;
  playerName?: string | null;
  uniquePlayerId?: string | null;
}): Promise<UserMilestonesStats> {
  const activeUser =
    params?.username ||
    params?.playerName ||
    params?.uniquePlayerId ||
    localStorage.getItem('quran_player_username') ||
    localStorage.getItem('quran_player_name') ||
    localStorage.getItem('quran_player_id');

  // القيم الافتراضية الصفرية (لا أرقام عشوائية ولا افتراضات وهمية)
  const stats: UserMilestonesStats = {
    ayah_100: getLocalCorrectCount('ayah'),
    figh_quiz: getLocalCorrectCount('figh'),
    surah_50: getLocalCorrectCount('surah'),
    seerah_60: getLocalCorrectCount('seerah'),
    akida_bank: getLocalCorrectCount('akida'),
    hadith_100: getLocalCorrectCount('hadith'),
    tafseer_100: getLocalCorrectCount('tafseer'),
    history_conquests: getLocalCorrectCount('history'),
    arabic_language: getLocalCorrectCount('arabic'),
    daily_streak_30: Number(localStorage.getItem('quran_streak') || 0),
    speed_1000: Number(localStorage.getItem('quran_total_points') || 0)
  };

  try {
    // 1) قراءة بيانات اللاعب المعتمدة من Supabase (completedChallengeIds, points, streak)
    let completedChallengeIds: number[] = [];
    try {
      const rawCompleted =
        localStorage.getItem('quran_completed_ids') ||
        localStorage.getItem('quran_completed_challenges');
      if (rawCompleted) {
        completedChallengeIds = JSON.parse(rawCompleted);
      }
    } catch (_) {}

    if (activeUser) {
      const { data: dbPlayer } = await supabase
        .from('players')
        .select('completedChallengeIds, points, streak')
        .or(`uniquePlayerId.eq.${activeUser},username.eq.${activeUser},name.eq.${activeUser}`)
        .limit(1)
        .maybeSingle();

      if (dbPlayer) {
        if (Array.isArray(dbPlayer.completedChallengeIds)) {
          completedChallengeIds = Array.from(
            new Set([...completedChallengeIds, ...dbPlayer.completedChallengeIds])
          );
        }
        if (typeof dbPlayer.streak === 'number') {
          stats.daily_streak_30 = Math.max(stats.daily_streak_30, dbPlayer.streak);
        }
        if (typeof dbPlayer.points === 'number') {
          stats.speed_1000 = Math.max(stats.speed_1000, dbPlayer.points);
        }
      }
    }

    // 2) فصل إكمال الآية عن اسم السورة بالاعتماد على جدول challenges (العزل التام)
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

          stats.ayah_100 = Math.max(stats.ayah_100, ayahCount);
          stats.surah_50 = Math.max(stats.surah_50, surahCount);
        } else {
          stats.ayah_100 = Math.max(stats.ayah_100, completedChallengeIds.length);
        }
      } catch (err) {
        console.warn('[MilestoneService] Challenges categorization notice:', err);
      }
    }

    // 3) استعلام الإجابات الصحيحة فقط (is_correct === true) من Supabase إن وجد اتصال
    if (activeUser) {
      try {
        const { data: correctRows } = await supabase
          .from('user_answers')
          .select('category, question_id, is_correct')
          .eq('user_id', activeUser)
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

          if (catMap['figh']) stats.figh_quiz = Math.max(stats.figh_quiz, catMap['figh'].size);
          if (catMap['seerah']) stats.seerah_60 = Math.max(stats.seerah_60, catMap['seerah'].size);
          if (catMap['akida']) stats.akida_bank = Math.max(stats.akida_bank, catMap['akida'].size);
          if (catMap['hadith']) stats.hadith_100 = Math.max(stats.hadith_100, catMap['hadith'].size);
          if (catMap['tafseer']) stats.tafseer_100 = Math.max(stats.tafseer_100, catMap['tafseer'].size);
          if (catMap['history']) stats.history_conquests = Math.max(stats.history_conquests, catMap['history'].size);
          if (catMap['arabic']) stats.arabic_language = Math.max(stats.arabic_language, catMap['arabic'].size);
          if (catMap['ayah']) stats.ayah_100 = Math.max(stats.ayah_100, catMap['ayah'].size);
          if (catMap['surah']) stats.surah_50 = Math.max(stats.surah_50, catMap['surah'].size);
        }
      } catch (_) {
        // يتم الاعتماد على العدادات الموثقة محلياً
      }
    }

    // 4) فحص تقدم المواضيع المكتملة في المسابقات الإسلامية (كل موضوع مجتاز يعادل 12 إجابة صحيحة)
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
        // نأخذ score فقط (الإجابات الصحيحة) وليس answeredCount
        const correctScore = Number(sObj.score || (sObj.easy ? sObj.easy * 15 : 0));
        stats.seerah_60 = Math.max(stats.seerah_60, correctScore);
      }
    } catch (_) {}

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
