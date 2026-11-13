-- =====================================================================
-- 01-fake-data.sql  —  مشروع الاختبار matin-test فقط
-- بيانات وهمية بالكامل (لا يوجد أي اسم أو بيانات من الإنتاج).
-- شغّله بعد 00-setup-test-project.sql. آمن للتشغيل أكثر من مرة.
--
-- كلمات السر التجريبية (للاختبار فقط):
--   اللاعبون test-player-1 ... test-player-6  ->  Test123456
--   الأدمن test-founder و test-cofounder     ->  AdminTest123456
-- كلها مخزنة كبصمة bcrypt (cost 10)، وليست نصاً عادياً.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- إعدادات النظام (الصف الوحيد id=1 الذي يحتاجه التطبيق)
-- ---------------------------------------------------------------------
INSERT INTO public.system_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6 لاعبين وهميين
-- ---------------------------------------------------------------------
INSERT INTO public.players (name, username, "uniquePlayerId", password, points, cups, streak)
SELECT v.name, v.username, v.upid,
       extensions.crypt('Test123456', extensions.gen_salt('bf', 10)),
       v.points, v.cups, v.streak
FROM (VALUES
  ('Test Player 1', 'test-player-1', 'MT-TST2', 120, 3, 2),
  ('Test Player 2', 'test-player-2', 'MT-TST3',  90, 2, 1),
  ('Test Player 3', 'test-player-3', 'MT-TST4',  60, 1, 0),
  ('Test Player 4', 'test-player-4', 'MT-TST5',  30, 0, 5),
  ('Test Player 5', 'test-player-5', 'MT-TST6',  10, 0, 0),
  ('Test Player 6', 'test-player-6', 'MT-TST7',   0, 0, 0)
) AS v(name, username, upid, points, cups, streak)
ON CONFLICT (username) DO NOTHING;

-- ---------------------------------------------------------------------
-- حسابا أدمن تجريبيان: FOUNDER و CO_FOUNDER
-- ---------------------------------------------------------------------
INSERT INTO public.admins (username, name, password, "isSuperAdmin", role, "canManageUsers")
VALUES
  ('test-founder',   'Test Founder',
   extensions.crypt('AdminTest123456', extensions.gen_salt('bf', 10)), true,  'FOUNDER',    true),
  ('test-cofounder', 'Test Co-Founder',
   extensions.crypt('AdminTest123456', extensions.gen_salt('bf', 10)), false, 'CO_FOUNDER', true)
ON CONFLICT (username) DO NOTHING;

-- مختبر وهمي واحد (نطاق example.com محجوز للأمثلة ولا يستقبل بريداً)
INSERT INTO public.app_testers (email, status, "approvedAt", approved_at)
VALUES ('tester-1@example.com', 'APPROVED', now(), now())
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5 تحديات وهمية (نصوص تجريبية وليست آيات حقيقية)
-- ---------------------------------------------------------------------
INSERT INTO public.challenges (keyword, verses, category, level, type, options, "correctText", juz, surah)
VALUES
  ('test-keyword-1',
   '[{"id":"t1-a","text":"نص تجريبي أول للتحدي ١","surah":"سورة تجريبية","number":1,"juz":1},{"id":"t1-b","text":"نص تجريبي ثانٍ للتحدي ١","surah":"سورة تجريبية","number":2,"juz":1}]'::jsonb,
   'تجريبي', 'easy', 'STANDARD', NULL, NULL, 1, 'سورة تجريبية'),
  ('test-keyword-2',
   '[{"id":"t2-a","text":"نص تجريبي أول للتحدي ٢","surah":"سورة تجريبية","number":3,"juz":1},{"id":"t2-b","text":"نص تجريبي ثانٍ للتحدي ٢","surah":"سورة تجريبية","number":4,"juz":1}]'::jsonb,
   'تجريبي', 'medium', 'STANDARD', NULL, NULL, 1, 'سورة تجريبية'),
  ('test-keyword-3',
   '[{"id":"t3-a","text":"أكمل النص التجريبي ...","surah":"سورة تجريبية","number":5,"juz":2}]'::jsonb,
   'تجريبي', 'easy', 'COMPLETION', '["تكملة صحيحة","تكملة خاطئة ١","تكملة خاطئة ٢","تكملة خاطئة ٣"]'::jsonb, 'تكملة صحيحة', 2, 'سورة تجريبية'),
  ('test-keyword-4',
   '[{"id":"t4-a","text":"أكمل النص التجريبي الآخر ...","surah":"سورة تجريبية","number":6,"juz":2}]'::jsonb,
   'تجريبي', 'hard', 'COMPLETION', '["خيار أ","خيار ب","خيار ج","خيار د"]'::jsonb, 'خيار ب', 2, 'سورة تجريبية'),
  ('test-keyword-5',
   '[{"id":"t5-a","text":"من أي سورة هذا النص التجريبي؟","surah":"سورة تجريبية","number":7,"juz":3}]'::jsonb,
   'تجريبي', 'easy', 'SURAH', '["سورة تجريبية","سورة وهمية","سورة مثال","سورة اختبار"]'::jsonb, 'سورة تجريبية', 3, 'سورة تجريبية')
ON CONFLICT (keyword) DO NOTHING;

-- ---------------------------------------------------------------------
-- لعبة "من أنا": فئة وأسئلة وهمية
-- ---------------------------------------------------------------------
INSERT INTO public.who_am_i_categories (name, description, icon)
VALUES ('فئة تجريبية', 'أسئلة وهمية للاختبار فقط', 'Sparkles')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.who_am_i_questions (id, category, hint_1, hint_2, answer)
VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'فئة تجريبية', 'تلميح صعب تجريبي ١', 'تلميح سهل تجريبي ١', 'جواب تجريبي ١'),
  ('00000000-0000-4000-8000-0000000000a2', 'فئة تجريبية', 'تلميح صعب تجريبي ٢', 'تلميح سهل تجريبي ٢', 'جواب تجريبي ٢|جواب بديل ٢'),
  ('00000000-0000-4000-8000-0000000000a3', 'فئة تجريبية', 'تلميح صعب تجريبي ٣', 'تلميح سهل تجريبي ٣', 'جواب تجريبي ٣')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- صداقات وهمية: 1 و 2 أصدقاء، 1 و 3 أصدقاء، 4 أرسل طلباً إلى 1 (معلّق)
-- ---------------------------------------------------------------------
INSERT INTO public.friendships (id, user_id, friend_id, "requesterId", "addresseeId", status)
SELECT v.fid::uuid, a.id::text, b.id::text, a.id, b.id, v.status
FROM (VALUES
  ('00000000-0000-4000-8000-0000000000f1', 'test-player-1', 'test-player-2', 'ACCEPTED'),
  ('00000000-0000-4000-8000-0000000000f2', 'test-player-1', 'test-player-3', 'ACCEPTED'),
  ('00000000-0000-4000-8000-0000000000f3', 'test-player-4', 'test-player-1', 'PENDING')
) AS v(fid, from_user, to_user, status)
JOIN public.players a ON a.username = v.from_user
JOIN public.players b ON b.username = v.to_user
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- إشعارات وهمية: واحد عام (بدون مستلم) واثنان لـ test-player-1
-- ---------------------------------------------------------------------
INSERT INTO public.notifications (id, title, body, is_read, receiver_id)
VALUES ('00000000-0000-4000-8000-0000000000e1', 'إشعار تجريبي عام', 'هذا إشعار وهمي لبيئة الاختبار.', false, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (id, title, body, is_read, receiver_id)
SELECT v.nid::uuid, v.title, v.body, v.is_read, p.id
FROM (VALUES
  ('00000000-0000-4000-8000-0000000000e2', 'طلب صداقة تجريبي', 'test-player-4 أرسل لك طلب صداقة (وهمي).', false),
  ('00000000-0000-4000-8000-0000000000e3', 'إشعار تجريبي مقروء', 'إشعار وهمي تمت قراءته.', true)
) AS v(nid, title, body, is_read)
JOIN public.players p ON p.username = 'test-player-1'
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- للتحقق (قراءة فقط): عدد الصفوف الوهمية
SELECT 'players' AS t, count(*) FROM public.players
UNION ALL SELECT 'admins', count(*) FROM public.admins
UNION ALL SELECT 'challenges', count(*) FROM public.challenges
UNION ALL SELECT 'friendships', count(*) FROM public.friendships
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'who_am_i_questions', count(*) FROM public.who_am_i_questions;
