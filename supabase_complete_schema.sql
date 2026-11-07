-- ==============================================================================
-- سكريبت إنشاء وتهيئة جداول قاعدة بيانات تطبيق متين بالكامل على Supabase
-- شغّل هذا السكريبت في محرر الـ SQL (SQL Editor) في لوحة تحكم Supabase بضغطة زر واحدة
-- ==============================================================================

-- 1. تفعيل الملحقات الضرورية
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. جدول رموز أجهزة المستخدمين للإشعارات (device_tokens)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  fcm_token TEXT UNIQUE NOT NULL,
  platform TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_fcm_token ON public.device_tokens(fcm_token);

-- 3. جدول سجل الإشعارات (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT,
  sender_role TEXT DEFAULT 'FOUNDER',
  sender_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 4. جدول اللاعبين والمستخدمين (players)
CREATE TABLE IF NOT EXISTS public.players (
  id SERIAL PRIMARY KEY,
  "uniquePlayerId" TEXT UNIQUE,
  "deviceId" TEXT UNIQUE,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  password TEXT DEFAULT '1234',
  "usernameChangedAt" TIMESTAMPTZ,
  points INT NOT NULL DEFAULT 0,
  cups INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  "completedChallengeIds" JSONB DEFAULT '[]'::jsonb,
  "seerahCompleted" BOOLEAN NOT NULL DEFAULT false,
  "generalCompleted" BOOLEAN NOT NULL DEFAULT false,
  "quranCompleted" BOOLEAN NOT NULL DEFAULT false,
  "activeFrame" TEXT,
  "equippedNameColor" TEXT,
  "ownedCosmetics" JSONB DEFAULT '[]'::jsonb,
  "powerUps" JSONB DEFAULT '{"freezeTime": 3, "deleteTwo": 3}'::jsonb,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_username ON public.players(username);
CREATE INDEX IF NOT EXISTS idx_players_name ON public.players(name);
CREATE INDEX IF NOT EXISTS idx_players_uniquePlayerId ON public.players("uniquePlayerId");

-- 5. جدول المشرفين (admins)
CREATE TABLE IF NOT EXISTS public.admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT,
  password TEXT NOT NULL,
  "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. جدول أكواد المشرفين (admin_codes)
CREATE TABLE IF NOT EXISTS public.admin_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN',
  "isUsed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. جدول التحديات القرآنية والأسئلة (challenges)
CREATE TABLE IF NOT EXISTS public.challenges (
  id SERIAL PRIMARY KEY,
  keyword TEXT UNIQUE NOT NULL,
  verses JSONB NOT NULL,
  category TEXT DEFAULT '',
  level TEXT DEFAULT '',
  type TEXT DEFAULT 'STANDARD',
  "audioUrl" TEXT,
  options JSONB,
  "correctText" TEXT,
  juz INT,
  surah TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(type);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON public.challenges(category);

-- 8. جدول الغرف والتحديات الجماعية والمزامنة الحية (rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  "isPrivate" BOOLEAN NOT NULL DEFAULT false,
  password TEXT,
  "player1Id" INT NOT NULL,
  "player2Id" INT,
  "player1Progress" INT NOT NULL DEFAULT 0,
  "player2Progress" INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'WAITING',
  "winnerId" INT,
  "challengeIds" JSONB NOT NULL,
  "surahFilters" JSONB DEFAULT '[]'::jsonb,
  "categoryFilter" TEXT DEFAULT '',
  "questionCount" INT NOT NULL DEFAULT 5,
  "maxPlayers" INT NOT NULL DEFAULT 2,
  "gameMode" TEXT NOT NULL DEFAULT 'STANDARD',
  "transitionMode" TEXT NOT NULL DEFAULT 'SYNC',
  "timePerQuestion" INT NOT NULL DEFAULT 20,
  "currentQuestionIndex" INT NOT NULL DEFAULT 0,
  "questionStartTime" DOUBLE PRECISION DEFAULT 0,
  "currentAnswers" JSONB DEFAULT '{}'::jsonb,
  "playersProgress" JSONB DEFAULT '{}'::jsonb,
  "lastReaction" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- 9. جدول إعدادات النظام وإصدارات التطبيق (system_settings)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  "hideAudioChallenge" BOOLEAN NOT NULL DEFAULT false,
  "hideCompletionChallenge" BOOLEAN NOT NULL DEFAULT false,
  "hideSurahChallenge" BOOLEAN NOT NULL DEFAULT false,
  "hideIslamicVideos" BOOLEAN NOT NULL DEFAULT false,
  "versionControl" JSONB,
  version_control JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إدراج صف الإعدادات الافتراضي إن لم يكن موجوداً
INSERT INTO public.system_settings (id, "hideAudioChallenge", "hideCompletionChallenge", "hideSurahChallenge", "hideIslamicVideos")
VALUES (1, false, false, false, false)
ON CONFLICT (id) DO NOTHING;

-- 10. جدول مختبري تطبيق متين على Google Play (app_testers)
CREATE TABLE IF NOT EXISTS public.app_testers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_testers_email ON public.app_testers(email);

-- 11. جدول الورد القرآني اليومي للمستخدمين (user_wird)
CREATE TABLE IF NOT EXISTS public.user_wird (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  pages_per_day INT NOT NULL DEFAULT 4,
  current_page INT NOT NULL DEFAULT 1,
  notification_time TEXT NOT NULL DEFAULT '08:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_notified_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_wird_user_id ON public.user_wird(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wird_is_active ON public.user_wird(is_active);

-- 12. جدول الصداقات والتواصل (friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  friend_id TEXT,
  "requesterId" INT,
  "addresseeId" INT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships("requesterId");
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships("addresseeId");

-- 13. جدول تفاعلات الإيموجي الحية في الغرف (reactions)
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  emoji TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reactions_room_id ON public.reactions(room_id);

-- 14. جدول تصنيفات مسابقة من أنا (who_am_i_categories)
CREATE TABLE IF NOT EXISTS public.who_am_i_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 15. تفعيل أمان الصفوف (Row Level Security - RLS) وسياسات الوصول المفتوحة
-- ==============================================================================
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'device_tokens', 'notifications', 'players', 'admins', 'admin_codes',
    'challenges', 'rooms', 'system_settings', 'app_testers', 'user_wird',
    'friendships', 'reactions', 'who_am_i_categories', 'who_am_i_questions',
    'who_am_i_rounds', 'who_am_i_answers', 'who_am_i_submissions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Public access policy" ON public.%I;', tbl);
      EXECUTE format('CREATE POLICY "Public access policy" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
    EXCEPTION WHEN OTHERS THEN
      -- تجاهل إن كان الجدول غير منشأ بعد
    END;
  END LOOP;
END $$;

-- ==============================================================================
-- 16. تفعيل التزامن اللحظي (Realtime) للجداول التفاعلية
-- ==============================================================================
DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'notifications', 'rooms', 'reactions', 'friendships',
    'who_am_i_rounds', 'who_am_i_answers', 'who_am_i_submissions'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      EXCEPTION WHEN OTHERS THEN
        -- تجاهل الأخطاء العابرة
      END;
    END IF;
  END LOOP;
END $$;

