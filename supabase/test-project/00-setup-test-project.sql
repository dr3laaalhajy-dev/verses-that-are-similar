-- =====================================================================
-- 00-setup-test-project.sql  —  مشروع الاختبار matin-test فقط
-- يبني نفس بنية قاعدة الإنتاج (حسب تقرير البنية بتاريخ 2026-11-13) بدون أي بيانات.
-- لا تشغّله أبداً على مشروع الإنتاج.
-- آمن للتشغيل أكثر من مرة (IF NOT EXISTS / DROP IF EXISTS).
--
-- الصلاحيات (GRANTs) لـ anon و authenticated مطابقة للإنتاج *بعد*
-- تشغيل supabase/hotfix/02-revoke-destructive-anon.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) الإضافات (Supabase يضعها في schema extensions)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- 2) الـ sequences (تُربط بأعمدتها بعد إنشاء الجداول)
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.admin_codes_id_seq        AS integer;
CREATE SEQUENCE IF NOT EXISTS public.admins_id_seq             AS integer;
CREATE SEQUENCE IF NOT EXISTS public.app_testers_id_seq        AS integer;
CREATE SEQUENCE IF NOT EXISTS public.certificates_id_seq       AS bigint;
CREATE SEQUENCE IF NOT EXISTS public.challenge_progress_id_seq AS bigint;
CREATE SEQUENCE IF NOT EXISTS public.challenges_id_seq         AS integer;
CREATE SEQUENCE IF NOT EXISTS public.players_id_seq            AS integer;
CREATE SEQUENCE IF NOT EXISTS public.user_answers_id_seq       AS bigint;

-- ---------------------------------------------------------------------
-- 3) الجداول (نفس ترتيب الأعمدة والقيم الافتراضية وأسماء القيود في الإنتاج)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_codes (
  id          integer     NOT NULL DEFAULT nextval('public.admin_codes_id_seq'::regclass),
  code        text        NOT NULL,
  role        text        NOT NULL DEFAULT 'ADMIN'::text,
  "isUsed"    boolean     NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_codes_pkey PRIMARY KEY (id),
  CONSTRAINT admin_codes_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.admins (
  id               integer     NOT NULL DEFAULT nextval('public.admins_id_seq'::regclass),
  username         text        NOT NULL,
  name             text,
  password         text        NOT NULL,
  "isSuperAdmin"   boolean     NOT NULL DEFAULT false,
  role             text        NOT NULL DEFAULT 'ADMIN'::text,
  "canManageUsers" boolean     NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_username_key UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS public.app_testers (
  id           integer     NOT NULL DEFAULT nextval('public.app_testers_id_seq'::regclass),
  email        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'PENDING'::text,
  "approvedAt" timestamptz,
  approved_at  timestamptz,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT app_testers_pkey PRIMARY KEY (id),
  CONSTRAINT app_testers_email_key UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public.certificates (
  id              bigint      NOT NULL DEFAULT nextval('public.certificates_id_seq'::regclass),
  user_id         text        NOT NULL,
  category        text        NOT NULL,
  title           text        NOT NULL,
  score           text        NOT NULL DEFAULT '100%'::text,
  total_correct   integer     DEFAULT 0,
  total_questions integer     DEFAULT 0,
  serial          text,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT certificates_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_category_cert UNIQUE (user_id, category)
);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id              bigint      NOT NULL DEFAULT nextval('public.challenge_progress_id_seq'::regclass),
  user_id         text        NOT NULL,
  category        text        NOT NULL,
  group_num       integer     NOT NULL DEFAULT 1,
  level_num       integer     NOT NULL DEFAULT 1,
  correct_answers integer     NOT NULL DEFAULT 0,
  wrong_answers   integer     NOT NULL DEFAULT 0,
  is_passed       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT challenge_progress_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_challenge_progress UNIQUE (user_id, category, group_num, level_num)
);

CREATE TABLE IF NOT EXISTS public.challenges (
  id            integer     NOT NULL DEFAULT nextval('public.challenges_id_seq'::regclass),
  keyword       text        NOT NULL,
  verses        jsonb       NOT NULL,
  category      text        DEFAULT ''::text,
  level         text        DEFAULT ''::text,
  type          text        DEFAULT 'STANDARD'::text,
  "audioUrl"    text,
  options       jsonb,
  "correctText" text,
  juz           integer,
  surah         text,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_keyword_key UNIQUE (keyword)
);

-- ملاحظة: في الإنتاج user_id من نوع uuid ومربوط بـ auth.users (كما هو، لم نغيّره).
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id         uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id    uuid,
  token      text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  fcm_token  text,
  CONSTRAINT device_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT device_tokens_token_key UNIQUE (token),
  CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.friendships (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       text,
  friend_id     text,
  "requesterId" integer,
  "addresseeId" integer,
  status        text        NOT NULL DEFAULT 'PENDING'::text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id)
);

-- ملاحظة: في الإنتاج user_id من نوع uuid ومربوط بـ auth.users، و receiver_id من نوع bigint (كما هو).
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id     uuid,
  title       text        NOT NULL,
  body        text        NOT NULL,
  is_read     boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  receiver_id bigint,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.players (
  id                      integer     NOT NULL DEFAULT nextval('public.players_id_seq'::regclass),
  "uniquePlayerId"        text,
  "deviceId"              text,
  name                    text        NOT NULL,
  username                text,
  password                text        DEFAULT '1234'::text,
  "usernameChangedAt"     timestamptz,
  points                  integer     NOT NULL DEFAULT 0,
  cups                    integer     NOT NULL DEFAULT 0,
  streak                  integer     NOT NULL DEFAULT 0,
  "completedChallengeIds" jsonb       DEFAULT '[]'::jsonb,
  "seerahCompleted"       boolean     NOT NULL DEFAULT false,
  "generalCompleted"      boolean     NOT NULL DEFAULT false,
  "quranCompleted"        boolean     NOT NULL DEFAULT false,
  "activeFrame"           text,
  "equippedNameColor"     text,
  "ownedCosmetics"        jsonb       DEFAULT '[]'::jsonb,
  "powerUps"              jsonb       DEFAULT '{"deleteTwo": 3, "freezeTime": 3}'::jsonb,
  "isBlocked"             boolean     NOT NULL DEFAULT false,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT "players_uniquePlayerId_key" UNIQUE ("uniquePlayerId"),
  CONSTRAINT "players_deviceId_key" UNIQUE ("deviceId"),
  CONSTRAINT players_username_key UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS public.reactions (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  room_id       text        NOT NULL,
  reaction_type text        NOT NULL,
  emoji         text        NOT NULL,
  sender_id     text        NOT NULL,
  sender_name   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reactions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id                     uuid             NOT NULL DEFAULT gen_random_uuid(),
  code                   text             NOT NULL,
  name                   text             DEFAULT ''::text,
  "isPrivate"            boolean          NOT NULL DEFAULT false,
  password               text,
  "player1Id"            integer          NOT NULL,
  "player2Id"            integer,
  "player1Progress"      integer          NOT NULL DEFAULT 0,
  "player2Progress"      integer          NOT NULL DEFAULT 0,
  status                 text             NOT NULL DEFAULT 'WAITING'::text,
  "winnerId"             integer,
  "challengeIds"         jsonb            NOT NULL,
  "surahFilters"         jsonb            DEFAULT '[]'::jsonb,
  "categoryFilter"       text             DEFAULT ''::text,
  "questionCount"        integer          NOT NULL DEFAULT 5,
  "maxPlayers"           integer          NOT NULL DEFAULT 2,
  "gameMode"             text             NOT NULL DEFAULT 'STANDARD'::text,
  "transitionMode"       text             NOT NULL DEFAULT 'SYNC'::text,
  "timePerQuestion"      integer          NOT NULL DEFAULT 20,
  "currentQuestionIndex" integer          NOT NULL DEFAULT 0,
  "questionStartTime"    double precision DEFAULT 0,
  "currentAnswers"       jsonb            DEFAULT '{}'::jsonb,
  "playersProgress"      jsonb            DEFAULT '{}'::jsonb,
  "lastReaction"         jsonb            DEFAULT '{}'::jsonb,
  "createdAt"            timestamptz      NOT NULL DEFAULT now(),
  "updatedAt"            timestamptz      NOT NULL DEFAULT now(),
  "roomSettings"         jsonb            DEFAULT '{}'::jsonb,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  id                        integer     NOT NULL DEFAULT 1,
  "hideAudioChallenge"      boolean     NOT NULL DEFAULT false,
  "hideCompletionChallenge" boolean     NOT NULL DEFAULT false,
  "hideSurahChallenge"      boolean     NOT NULL DEFAULT false,
  "hideIslamicVideos"       boolean     NOT NULL DEFAULT false,
  "versionControl"          jsonb,
  version_control           jsonb,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  "updatedAt"               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_answers (
  id              bigint      NOT NULL DEFAULT nextval('public.user_answers_id_seq'::regclass),
  user_id         text        NOT NULL,
  category        text        NOT NULL,
  group_num       integer     NOT NULL DEFAULT 1,
  level_num       integer     NOT NULL DEFAULT 1,
  correct_answers integer     NOT NULL DEFAULT 0,
  wrong_answers   integer     NOT NULL DEFAULT 0,
  is_passed       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_answers_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_answers UNIQUE (user_id, category, group_num, level_num)
);

CREATE TABLE IF NOT EXISTS public.user_wird (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id            text        NOT NULL,
  pages_per_day      integer     NOT NULL DEFAULT 4,
  current_page       integer     NOT NULL DEFAULT 1,
  notification_time  text        NOT NULL DEFAULT '08:00'::text,
  is_active          boolean     NOT NULL DEFAULT true,
  last_notified_date text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_wird_pkey PRIMARY KEY (id),
  CONSTRAINT user_wird_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.who_am_i_categories (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  icon        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT who_am_i_categories_pkey PRIMARY KEY (id),
  CONSTRAINT who_am_i_categories_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.who_am_i_questions (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  category   text        NOT NULL DEFAULT 'الصحابة'::text,
  hint_1     text        NOT NULL,
  hint_2     text        NOT NULL,
  answer     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT who_am_i_questions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.who_am_i_rounds (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  room_id     text        NOT NULL,
  question_id uuid        NOT NULL,
  round_no    integer     NOT NULL,
  status      text        NOT NULL DEFAULT 'active'::text,
  started_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT who_am_i_rounds_pkey PRIMARY KEY (id),
  CONSTRAINT who_am_i_rounds_room_id_round_no_key UNIQUE (room_id, round_no),
  CONSTRAINT who_am_i_rounds_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revealed'::text]))),
  CONSTRAINT who_am_i_rounds_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.who_am_i_questions(id)
);

CREATE TABLE IF NOT EXISTS public.who_am_i_answers (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  room_id     text        NOT NULL,
  round_id    uuid        NOT NULL,
  user_id     text        NOT NULL,
  player_name text        NOT NULL,
  answer_text text        NOT NULL,
  phase       smallint    NOT NULL,
  is_correct  boolean     NOT NULL DEFAULT false,
  points      integer     NOT NULL DEFAULT 0,
  overridden  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT who_am_i_answers_pkey PRIMARY KEY (id),
  CONSTRAINT who_am_i_answers_round_id_user_id_key UNIQUE (round_id, user_id),
  CONSTRAINT who_am_i_answers_phase_check CHECK ((phase = ANY (ARRAY[1, 2]))),
  CONSTRAINT who_am_i_answers_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.who_am_i_rounds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.who_am_i_submissions (
  round_id    uuid        NOT NULL,
  room_id     text        NOT NULL,
  user_id     text        NOT NULL,
  player_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT who_am_i_submissions_pkey PRIMARY KEY (round_id, user_id),
  CONSTRAINT who_am_i_submissions_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.who_am_i_rounds(id) ON DELETE CASCADE
);

-- جلسات اللاعبين (نفس supabase/hotfix/03-player-sessions.sql). hash للتوكن فقط.
CREATE TABLE IF NOT EXISTS public.player_sessions (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  player_id    integer     NOT NULL,
  token_hash   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  revoked_reason text,
  CONSTRAINT player_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT player_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT player_sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT player_sessions_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id) ON DELETE CASCADE
);
ALTER TABLE public.player_sessions ADD COLUMN IF NOT EXISTS revoked_reason text;
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.player_sessions'::regclass
      AND conname = 'player_sessions_revoked_reason_check'
  ) THEN
    ALTER TABLE public.player_sessions
      ADD CONSTRAINT player_sessions_revoked_reason_check
      CHECK (revoked_reason IS NULL
             OR revoked_reason IN ('replaced', 'logout', 'password_changed', 'account_deleted'));
  END IF;
END
$do$;

-- ربط الـ sequences بأعمدتها (مثل الإنتاج: owned_by)
ALTER SEQUENCE public.admin_codes_id_seq        OWNED BY public.admin_codes.id;
ALTER SEQUENCE public.admins_id_seq             OWNED BY public.admins.id;
ALTER SEQUENCE public.app_testers_id_seq        OWNED BY public.app_testers.id;
ALTER SEQUENCE public.certificates_id_seq       OWNED BY public.certificates.id;
ALTER SEQUENCE public.challenge_progress_id_seq OWNED BY public.challenge_progress.id;
ALTER SEQUENCE public.challenges_id_seq         OWNED BY public.challenges.id;
ALTER SEQUENCE public.players_id_seq            OWNED BY public.players.id;
ALTER SEQUENCE public.user_answers_id_seq       OWNED BY public.user_answers.id;

-- ---------------------------------------------------------------------
-- 4) الفهارس الإضافية (فهارس المفاتيح والـ UNIQUE تُنشأ تلقائياً مع القيود أعلاه)
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS admins_username_lower           ON public.admins USING btree (lower(username));
CREATE INDEX IF NOT EXISTS idx_app_testers_email                  ON public.app_testers USING btree (email);
CREATE INDEX IF NOT EXISTS idx_certificates_category              ON public.certificates USING btree (category);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id               ON public.certificates USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_category        ON public.challenge_progress USING btree (category);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_cat        ON public.challenge_progress USING btree (user_id, category);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_id         ON public.challenge_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_category                ON public.challenges USING btree (category);
CREATE INDEX IF NOT EXISTS idx_challenges_type                    ON public.challenges USING btree (type);
CREATE INDEX IF NOT EXISTS idx_device_tokens_fcm_token            ON public.device_tokens USING btree (fcm_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id              ON public.device_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee              ON public.friendships USING btree ("addresseeId");
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id              ON public.friendships USING btree (friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester              ON public.friendships USING btree ("requesterId");
CREATE INDEX IF NOT EXISTS idx_friendships_user_id                ON public.friendships USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at           ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_name                       ON public.players USING btree (name);
CREATE INDEX IF NOT EXISTS idx_players_uniqueplayerid             ON public.players USING btree ("uniquePlayerId");
CREATE INDEX IF NOT EXISTS idx_players_username                   ON public.players USING btree (username);
CREATE INDEX IF NOT EXISTS idx_reactions_room_id                  ON public.reactions USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code                         ON public.rooms USING btree (code);
CREATE INDEX IF NOT EXISTS idx_rooms_status                       ON public.rooms USING btree (status);
CREATE INDEX IF NOT EXISTS idx_user_answers_category              ON public.user_answers USING btree (category);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_id               ON public.user_answers USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_wird_is_active                ON public.user_wird USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_user_wird_user_id                  ON public.user_wird USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_player_id          ON public.player_sessions USING btree (player_id);

-- ---------------------------------------------------------------------
-- 5) الدوال والتريغر
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.server_now()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
AS $function$ select clock_timestamp() $function$;

CREATE OR REPLACE FUNCTION public.who_am_i_mark_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.who_am_i_submissions (round_id, room_id, user_id, player_name)
  values (new.round_id, new.room_id, new.user_id, new.player_name)
  on conflict do nothing;
  return new;
end $function$;

GRANT EXECUTE ON FUNCTION public.server_now() TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_who_am_i_mark_submitted ON public.who_am_i_answers;
CREATE TRIGGER trg_who_am_i_mark_submitted
  AFTER INSERT ON public.who_am_i_answers
  FOR EACH ROW EXECUTE FUNCTION public.who_am_i_mark_submitted();

-- ---------------------------------------------------------------------
-- 6) RLS مفعّل على كل الجداول (مثل الإنتاج)
-- ---------------------------------------------------------------------
ALTER TABLE public.admin_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_testers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wird            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.who_am_i_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.who_am_i_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.who_am_i_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.who_am_i_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.who_am_i_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_sessions      ENABLE ROW LEVEL SECURITY;  -- بدون أي سياسة عمداً

-- ---------------------------------------------------------------------
-- 7) السياسات (Policies) — نسخة مطابقة لسياسات الإنتاج (متساهلة كما هي اليوم)
--    admins و admin_codes و app_testers: لا توجد عليها سياسات في الإنتاج (مغلقة).
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow insert and update certificates" ON public.certificates;
CREATE POLICY "Allow insert and update certificates" ON public.certificates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select certificates for all" ON public.certificates;
CREATE POLICY "Allow select certificates for all" ON public.certificates AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow insert and update challenge_progress" ON public.challenge_progress;
CREATE POLICY "Allow insert and update challenge_progress" ON public.challenge_progress AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select challenge_progress for all" ON public.challenge_progress;
CREATE POLICY "Allow select challenge_progress for all" ON public.challenge_progress AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public access policy" ON public.challenges;
CREATE POLICY "Public access policy" ON public.challenges AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.device_tokens;
CREATE POLICY "Public access policy" ON public.device_tokens AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.friendships;
CREATE POLICY "Public access policy" ON public.friendships AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.notifications;
CREATE POLICY "Public access policy" ON public.notifications AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on players" ON public.players;
CREATE POLICY "Allow public read access on players" ON public.players AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public access policy" ON public.players;
CREATE POLICY "Public access policy" ON public.players AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public inserts on reactions" ON public.reactions;
CREATE POLICY "Allow public inserts on reactions" ON public.reactions AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public reads on reactions" ON public.reactions;
CREATE POLICY "Allow public reads on reactions" ON public.reactions AS PERMISSIVE FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public access policy" ON public.reactions;
CREATE POLICY "Public access policy" ON public.reactions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.rooms;
CREATE POLICY "Public access policy" ON public.rooms AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.system_settings;
CREATE POLICY "Public access policy" ON public.system_settings AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert and update user_answers" ON public.user_answers;
CREATE POLICY "Allow insert and update user_answers" ON public.user_answers AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select user_answers for all" ON public.user_answers;
CREATE POLICY "Allow select user_answers for all" ON public.user_answers AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public access policy" ON public.user_wird;
CREATE POLICY "Public access policy" ON public.user_wird AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.who_am_i_answers;
CREATE POLICY "Public access policy" ON public.who_am_i_answers AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "answers insert" ON public.who_am_i_answers;
CREATE POLICY "answers insert" ON public.who_am_i_answers AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "answers read" ON public.who_am_i_answers;
CREATE POLICY "answers read" ON public.who_am_i_answers AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "answers update" ON public.who_am_i_answers;
CREATE POLICY "answers update" ON public.who_am_i_answers AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public access policy" ON public.who_am_i_categories;
CREATE POLICY "Public access policy" ON public.who_am_i_categories AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON public.who_am_i_questions;
CREATE POLICY "Public access policy" ON public.who_am_i_questions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "questions read" ON public.who_am_i_questions;
CREATE POLICY "questions read" ON public.who_am_i_questions AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public access policy" ON public.who_am_i_rounds;
CREATE POLICY "Public access policy" ON public.who_am_i_rounds AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rounds insert" ON public.who_am_i_rounds;
CREATE POLICY "rounds insert" ON public.who_am_i_rounds AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rounds read" ON public.who_am_i_rounds;
CREATE POLICY "rounds read" ON public.who_am_i_rounds AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "rounds update" ON public.who_am_i_rounds;
CREATE POLICY "rounds update" ON public.who_am_i_rounds AS PERMISSIVE FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public access policy" ON public.who_am_i_submissions;
CREATE POLICY "Public access policy" ON public.who_am_i_submissions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "submissions insert" ON public.who_am_i_submissions;
CREATE POLICY "submissions insert" ON public.who_am_i_submissions AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "submissions read" ON public.who_am_i_submissions;
CREATE POLICY "submissions read" ON public.who_am_i_submissions AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------
-- 8) الصلاحيات (GRANTs): نبدأ من الصفر لكل جدول ثم نعطي بالضبط ما بقي
--    في الإنتاج بعد سكربت 02-revoke-destructive-anon.sql.
--    service_role (السيرفر) له كل الصلاحيات مثل الإنتاج.
-- ---------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT  ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- admins و admin_codes و app_testers: لا شيء لـ anon/authenticated (مثل الإنتاج).
-- player_sessions: لا شيء لـ anon/authenticated (السيرفر فقط عبر service_role).
REVOKE ALL ON public.player_sessions FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE         ON public.certificates         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.challenge_progress   TO anon, authenticated;
GRANT SELECT                         ON public.challenges           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.device_tokens        TO anon, authenticated;
GRANT SELECT                         ON public.friendships          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.players              TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.reactions            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms                TO anon, authenticated;
GRANT SELECT                         ON public.system_settings      TO anon, authenticated;
GRANT SELECT                         ON public.user_answers         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.user_wird            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.who_am_i_answers     TO anon, authenticated;
GRANT SELECT                         ON public.who_am_i_categories  TO anon, authenticated;
GRANT SELECT                         ON public.who_am_i_questions   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.who_am_i_rounds      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.who_am_i_submissions TO anon, authenticated;

-- الإضافة من المتصفح في جداول الأرقام التسلسلية تحتاج USAGE على الـ sequence
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9) Realtime: نفس الجداول السبعة في supabase_realtime
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH t IN ARRAY ARRAY['friendships', 'notifications', 'reactions', 'rooms',
                           'who_am_i_answers', 'who_am_i_rounds', 'who_am_i_submissions']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$do$;

COMMIT;

NOTIFY pgrst, 'reload schema';
