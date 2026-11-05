-- ==============================================================================
-- سياسات الأمان RLS وعرض المتصدرين العام (Public Leaderboard)
-- تطبيق متين - المتشابهات القرآنية
-- يسمح بالقراءة العامة لجدول المتصدرين لجميع الزوار (anon & authenticated & public)
-- ويحجب البيانات الحساسة (مثل كلمات المرور ورموز الأجهزة)
-- ==============================================================================

-- 1. تفعيل سياسة القراءة العامة على جدول اللاعبين الأساسي "Player"
ALTER TABLE IF EXISTS public."Player" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for leaderboard" ON public."Player";
CREATE POLICY "Allow public read for leaderboard"
ON public."Player"
FOR SELECT
TO public
USING (true);

-- 2. إنشاء منظر عام (Public View) للمتصدرين يحتوي حصرياً على الأعمدة غير الحساسة
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  id,
  name,
  username,
  "uniquePlayerId",
  points,
  cups,
  streak,
  "seerahCompleted",
  "generalCompleted",
  "quranCompleted",
  "activeFrame",
  "equippedNameColor",
  "createdAt",
  "updatedAt"
FROM public."Player"
WHERE "isBlocked" = false;

-- منح صلاحيات القراءة العامة لجميع الزوار
GRANT SELECT ON public.leaderboard TO public;

-- منظر إضافي باسم players للتوافق الشامل
CREATE OR REPLACE VIEW public.players AS
SELECT * FROM public.leaderboard;

GRANT SELECT ON public.players TO public;

-- منح أدوار Supabase (anon و authenticated) في حال تشغيلها في بيئة Supabase
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'GRANT SELECT ON public.leaderboard TO anon';
    EXECUTE 'GRANT SELECT ON public.players TO anon';
    EXECUTE 'GRANT SELECT ON public."Player" TO anon';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT ON public.leaderboard TO authenticated';
    EXECUTE 'GRANT SELECT ON public.players TO authenticated';
    EXECUTE 'GRANT SELECT ON public."Player" TO authenticated';
  END IF;
END
$$;
