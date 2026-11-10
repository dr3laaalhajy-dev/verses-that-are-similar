-- =========================================================================
-- إعداد جداول وحماية (RLS) تقدم التحديات والشهادات (Offline-First Architecture)
-- جدول user_challenge_progress وجدول certificates مع سياسات القراءة العامة
-- =========================================================================

-- 1. إنشاء جدول تتبع تقدم التحديات والمجموعات user_challenge_progress
CREATE TABLE IF NOT EXISTS public.user_challenge_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    group_num INTEGER NOT NULL,
    level_num INTEGER NOT NULL DEFAULT 1,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    wrong_answers INTEGER NOT NULL DEFAULT 0,
    is_passed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_challenge_group UNIQUE (user_id, category, group_num, level_num)
);

-- إنشاء فهارس لتحسين سرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user_cat 
ON public.user_challenge_progress (user_id, category);

-- تفعيل سياسات الأمان RLS لجدول user_challenge_progress
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة (SELECT): متاحة للجميع (أو المسجلين) لعرض التقدم والإنجازات في البروفايل العام
DROP POLICY IF EXISTS "Allow select for all authenticated and anon users" ON public.user_challenge_progress;
CREATE POLICY "Allow select for all authenticated and anon users"
ON public.user_challenge_progress
FOR SELECT
USING (true);

-- سياسة الإضافة والتحديث (INSERT/UPDATE/UPSERT)
DROP POLICY IF EXISTS "Allow insert/update for all users" ON public.user_challenge_progress;
CREATE POLICY "Allow insert/update for all users"
ON public.user_challenge_progress
FOR ALL
USING (true)
WITH CHECK (true);


-- 2. إنشاء جدول الشهادات certificates (بدرجات ونسب ديناميكية دقيقة)
CREATE TABLE IF NOT EXISTS public.certificates (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    score TEXT NOT NULL,
    total_correct INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    serial TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_category_cert UNIQUE (user_id, category)
);

-- إنشاء فهارس لجدول الشهادات
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_category ON public.certificates (category);

-- تفعيل سياسات الأمان RLS لجدول certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة (SELECT): تتيح لأي زائر لبروفايل اللاعب رؤية شهاداته وأوسمته
DROP POLICY IF EXISTS "Allow read certificates for all users" ON public.certificates;
CREATE POLICY "Allow read certificates for all users"
ON public.certificates
FOR SELECT
USING (true);

-- سياسة الإضافة والتحديث للشهادات (INSERT/UPDATE/UPSERT)
DROP POLICY IF EXISTS "Allow insert and update certificates" ON public.certificates;
CREATE POLICY "Allow insert and update certificates"
ON public.certificates
FOR ALL
USING (true)
WITH CHECK (true);

