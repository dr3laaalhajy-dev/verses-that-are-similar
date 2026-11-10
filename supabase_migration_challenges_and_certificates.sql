-- =========================================================================
-- إعداد جداول وصلاحيات وحماية (RLS) التحديات والشهادات في Supabase
-- تطبيق متين - المتشابهات القرآنية
-- 1. جدول تقدم التحديات (challenge_progress)
-- 2. جدول إجابات المستخدمين المتوافق (user_answers)
-- 3. جدول الشهادات والدرجات المعتمدة (certificates)
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. جدول تقدم التحديات والمجموعات (challenge_progress)
-- يحتوي على الإجابات الصحيحة والخاطئة وحالة الاجتياز
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,                                       -- معرّف اللاعب (مرتبط بـ uniquePlayerId أو id في جدول players)
    category TEXT NOT NULL,                                      -- القسم (seerah, general, figh, akida, hadith, ...)
    group_num INTEGER NOT NULL DEFAULT 1,                        -- رقم المجموعة أو الموضوع
    level_num INTEGER NOT NULL DEFAULT 1,                        -- مستوى الصعوبة
    correct_answers INTEGER NOT NULL DEFAULT 0,                  -- عدد الإجابات الصحيحة (الحد الأدنى للاجتياز 12)
    wrong_answers INTEGER NOT NULL DEFAULT 0,                    -- عدد الإجابات الخاطئة
    is_passed BOOLEAN NOT NULL DEFAULT true,                     -- هل اجتاز المجموعة بنجاح
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_challenge_progress UNIQUE (user_id, category, group_num, level_num)
);

-- فهارس تحسين الأداء
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_id ON public.challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_category ON public.challenge_progress(category);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_cat ON public.challenge_progress(user_id, category);

-- -------------------------------------------------------------------------
-- 2. جدول user_answers (متطابق بالكامل تحسباً لأي استعلامات قديمة أو إضافية)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_answers (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    group_num INTEGER NOT NULL DEFAULT 1,
    level_num INTEGER NOT NULL DEFAULT 1,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    wrong_answers INTEGER NOT NULL DEFAULT 0,
    is_passed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_answers UNIQUE (user_id, category, group_num, level_num)
);

CREATE INDEX IF NOT EXISTS idx_user_answers_user_id ON public.user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_category ON public.user_answers(category);

-- -------------------------------------------------------------------------
-- 3. جدول الشهادات المعتمدة (certificates)
-- يحفظ الدرجات والنسب المئوية الحقيقية المحسوبة
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificates (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,                                       -- معرّف صاحب الشهادة
    category TEXT NOT NULL,                                      -- قسم التحدي (seerah, general, ...)
    title TEXT NOT NULL,                                         -- عنوان الشهادة
    score TEXT NOT NULL DEFAULT '100%',                          -- النسبة المئوية الدقيقة (مثل 85%, 90%, 100%)
    total_correct INTEGER DEFAULT 0,                             -- إجمالي الإجابات الصحيحة في المسابقة
    total_questions INTEGER DEFAULT 0,                           -- إجمالي عدد الأسئلة
    serial TEXT,                                                 -- الرقم التسلسلي المعتمد للشهادة
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_category_cert UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_category ON public.certificates(category);

-- -------------------------------------------------------------------------
-- 4. تفعيل سياسات الأمان والحماية (Row Level Security - RLS)
-- -------------------------------------------------------------------------
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- أ) سياسات القراءة العامة (SELECT): متاحة للجميع (الزوار والمسجلين)
-- تتيح لأي زائر للبروفايل العام رؤية شهادات وإنجازات اللاعب بدون أي أخطاء أو حجب
DROP POLICY IF EXISTS "Allow select challenge_progress for all" ON public.challenge_progress;
CREATE POLICY "Allow select challenge_progress for all"
ON public.challenge_progress
FOR SELECT
TO public, anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow select user_answers for all" ON public.user_answers;
CREATE POLICY "Allow select user_answers for all"
ON public.user_answers
FOR SELECT
TO public, anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow select certificates for all" ON public.certificates;
CREATE POLICY "Allow select certificates for all"
ON public.certificates
FOR SELECT
TO public, anon, authenticated
USING (true);

-- ب) سياسات الإضافة والتعديل والحفظ (INSERT, UPDATE, ALL)
-- تسمح بحفظ النتائج والشهادات عند اجتياز التحديات والمزامنة السحابية
DROP POLICY IF EXISTS "Allow insert and update challenge_progress" ON public.challenge_progress;
CREATE POLICY "Allow insert and update challenge_progress"
ON public.challenge_progress
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert and update user_answers" ON public.user_answers;
CREATE POLICY "Allow insert and update user_answers"
ON public.user_answers
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert and update certificates" ON public.certificates;
CREATE POLICY "Allow insert and update certificates"
ON public.certificates
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);

-- -------------------------------------------------------------------------
-- 5. منح الصلاحيات الشاملة لأدوار Supabase (Permissions)
-- -------------------------------------------------------------------------
GRANT ALL ON public.challenge_progress TO anon, authenticated, service_role;
GRANT ALL ON public.user_answers TO anon, authenticated, service_role;
GRANT ALL ON public.certificates TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
