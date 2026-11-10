-- 1. تحديث بيانات اللاعب alaa في جدول players
UPDATE public.players
SET 
  "seerahCompleted" = true,
  "generalCompleted" = true,
  "quranCompleted" = true,
  "activeFrame" = 'seerah',
  "streak" = 30,
  "points" = 1500,
  "cups" = 60,
  "completedChallengeIds" = '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 101, 102]'::jsonb,
  "updatedAt" = now()
WHERE 
  "uniquePlayerId" = 'MT-3CET' 
  OR username = 'alaa1'
  OR username = 'alaa';

-- 2. إدراج الشهادات في جدول certificates للمعرف MT-3CET
INSERT INTO public.certificates (user_id, category, title, score, total_correct, total_questions, serial, created_at, updated_at)
VALUES
  ('MT-3CET', 'seerah', 'ختم مسابقة السيرة النبوية الشريفة', '100%', 60, 60, 'MTN-SEERAH-100-3CET', now(), now()),
  ('MT-3CET', 'general', 'ختم مسابقة الفقه والمعلومات الإسلامية', '100%', 100, 100, 'MTN-GENERAL-100-3CET', now(), now()),
  ('MT-3CET', 'figh', 'ختم مسابقة الفقه والعبادات والمعاملات', '100%', 100, 100, 'MTN-FIGH-100-3CET', now(), now()),
  ('MT-3CET', 'akida', 'ختم بنك أسئلة العقيدة الإسلامية', '100%', 100, 100, 'MTN-AKIDA-100-3CET', now(), now()),
  ('MT-3CET', 'hadith', 'إتمام 100 حديث شريف في السنة النبوية', '100%', 100, 100, 'MTN-HADITH-100-3CET', now(), now()),
  ('MT-3CET', 'tafseer', 'إتمام 100 سؤال في تفسير القرآن الكريم', '100%', 100, 100, 'MTN-TAFSEER-100-3CET', now(), now()),
  ('MT-3CET', 'history', 'ختم مسابقة التاريخ والفتوحات الإسلامية', '100%', 100, 100, 'MTN-HISTORY-100-3CET', now(), now()),
  ('MT-3CET', 'arabia', 'إتمام مسابقة علوم اللغة العربية والمعاجم', '100%', 100, 100, 'MTN-ARABIA-100-3CET', now(), now()),
  ('MT-3CET', 'ayah_100', 'إتمام 100 سؤال في تحدي إكمال الآية', '100%', 100, 100, 'MTN-AYAH100-100-3CET', now(), now()),
  ('MT-3CET', 'surah_50', 'إتمام 50 سؤالاً في تحدي تحديد اسم السورة', '100%', 50, 50, 'MTN-SURAH50-100-3CET', now(), now()),
  ('MT-3CET', 'daily_streak_30', 'وسام المثابرة: سلسلة 30 يوماً متتالية', '30 يوماً', 30, 30, 'MTN-STREAK30-100-3CET', now(), now()),
  ('MT-3CET', 'speed_1000', 'وسام السرعة والهمة العالية', '1500 نقطة', 1500, 1000, 'MTN-SPEED1000-100-3CET', now(), now())
ON CONFLICT (user_id, category) 
DO UPDATE SET 
  score = EXCLUDED.score,
  total_correct = EXCLUDED.total_correct,
  total_questions = EXCLUDED.total_questions,
  updated_at = now();

-- 3. إدراج الشهادات في جدول certificates لاسم المستخدم alaa1
INSERT INTO public.certificates (user_id, category, title, score, total_correct, total_questions, serial, created_at, updated_at)
VALUES
  ('alaa1', 'seerah', 'ختم مسابقة السيرة النبوية الشريفة', '100%', 60, 60, 'MTN-SEERAH-100-ALAA1', now(), now()),
  ('alaa1', 'general', 'ختم مسابقة الفقه والمعلومات الإسلامية', '100%', 100, 100, 'MTN-GENERAL-100-ALAA1', now(), now()),
  ('alaa1', 'figh', 'ختم مسابقة الفقه والعبادات والمعاملات', '100%', 100, 100, 'MTN-FIGH-100-ALAA1', now(), now()),
  ('alaa1', 'akida', 'ختم بنك أسئلة العقيدة الإسلامية', '100%', 100, 100, 'MTN-AKIDA-100-ALAA1', now(), now()),
  ('alaa1', 'hadith', 'إتمام 100 حديث شريف في السنة النبوية', '100%', 100, 100, 'MTN-HADITH-100-ALAA1', now(), now()),
  ('alaa1', 'tafseer', 'إتمام 100 سؤال في تفسير القرآن الكريم', '100%', 100, 100, 'MTN-TAFSEER-100-ALAA1', now(), now()),
  ('alaa1', 'history', 'ختم مسابقة التاريخ والفتوحات الإسلامية', '100%', 100, 100, 'MTN-HISTORY-100-ALAA1', now(), now()),
  ('alaa1', 'arabia', 'إتمام مسابقة علوم اللغة العربية والمعاجم', '100%', 100, 100, 'MTN-ARABIA-100-ALAA1', now(), now()),
  ('alaa1', 'ayah_100', 'إتمام 100 سؤال في تحدي إكمال الآية', '100%', 100, 100, 'MTN-AYAH100-100-ALAA1', now(), now()),
  ('alaa1', 'surah_50', 'إتمام 50 سؤالاً في تحدي تحديد اسم السورة', '100%', 50, 50, 'MTN-SURAH50-100-ALAA1', now(), now()),
  ('alaa1', 'daily_streak_30', 'وسام المثابرة: سلسلة 30 يوماً متتالية', '30 يوماً', 30, 30, 'MTN-STREAK30-100-ALAA1', now(), now()),
  ('alaa1', 'speed_1000', 'وسام السرعة والهمة العالية', '1500 نقطة', 1500, 1000, 'MTN-SPEED1000-100-ALAA1', now(), now())
ON CONFLICT (user_id, category) 
DO UPDATE SET 
  score = EXCLUDED.score,
  total_correct = EXCLUDED.total_correct,
  total_questions = EXCLUDED.total_questions,
  updated_at = now();

-- 4. إدراج تقدم المجموعات في جدول challenge_progress للمعرف MT-3CET
INSERT INTO public.challenge_progress (user_id, category, group_num, level_num, correct_answers, wrong_answers, is_passed, created_at, updated_at)
VALUES
  ('MT-3CET', 'seerah', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'seerah', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'seerah', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 4, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 5, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 3, 1, 20, 0, true, now(), now())
ON CONFLICT (user_id, category, group_num, level_num)
DO UPDATE SET 
  correct_answers = EXCLUDED.correct_answers,
  wrong_answers = EXCLUDED.wrong_answers,
  is_passed = true,
  updated_at = now();

-- 5. إدراج تقدم المجموعات في جدول challenge_progress للاسم alaa1
INSERT INTO public.challenge_progress (user_id, category, group_num, level_num, correct_answers, wrong_answers, is_passed, created_at, updated_at)
VALUES
  ('alaa1', 'seerah', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'seerah', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'seerah', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'general', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'general', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'general', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'general', 4, 1, 20, 0, true, now(), now()),
  ('alaa1', 'general', 5, 1, 20, 0, true, now(), now()),
  ('alaa1', 'figh', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'figh', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'figh', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'akida', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'akida', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'akida', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'hadith', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'hadith', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'hadith', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'tafseer', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'tafseer', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'tafseer', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'history', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'history', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'history', 3, 1, 20, 0, true, now(), now()),
  ('alaa1', 'arabia', 1, 1, 20, 0, true, now(), now()),
  ('alaa1', 'arabia', 2, 1, 20, 0, true, now(), now()),
  ('alaa1', 'arabia', 3, 1, 20, 0, true, now(), now())
ON CONFLICT (user_id, category, group_num, level_num)
DO UPDATE SET 
  correct_answers = EXCLUDED.correct_answers,
  wrong_answers = EXCLUDED.wrong_answers,
  is_passed = true,
  updated_at = now();

-- 6. إدراج تقدم المجموعات في جدول user_answers للمعرف MT-3CET
INSERT INTO public.user_answers (user_id, category, group_num, level_num, correct_answers, wrong_answers, is_passed, created_at, updated_at)
VALUES
  ('MT-3CET', 'seerah', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'seerah', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'seerah', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 4, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'general', 5, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'figh', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'akida', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'hadith', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'tafseer', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'history', 3, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 1, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 2, 1, 20, 0, true, now(), now()),
  ('MT-3CET', 'arabia', 3, 1, 20, 0, true, now(), now())
ON CONFLICT (user_id, category, group_num, level_num)
DO UPDATE SET 
  correct_answers = EXCLUDED.correct_answers,
  wrong_answers = EXCLUDED.wrong_answers,
  is_passed = true,
  updated_at = now();
