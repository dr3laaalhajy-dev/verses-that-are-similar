-- =====================================================================
-- 03-player-sessions.sql
-- جدول جلسات اللاعبين. يُخزَّن فيه hash (SHA-256) للتوكن فقط، ولا يُخزَّن التوكن أبداً.
-- يُشغَّل يدوياً في Supabase SQL Editor. آمن للتشغيل أكثر من مرة.
-- لا يلمس أي بيانات موجودة: ينشئ جدولاً جديداً فارغاً فقط.
--
-- الوصول: RLS مفعّل بدون أي سياسة، ولا أي صلاحية لـ anon أو authenticated.
-- السيرفر فقط (service_role) يقرأ ويكتب.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_sessions (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  player_id    integer     NOT NULL,                 -- نفس نوع players.id
  token_hash   text        NOT NULL,                 -- SHA-256 hex للتوكن (64 حرفاً)
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  CONSTRAINT player_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT player_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT player_sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- حذف اللاعب يحذف جلساته تلقائياً
  CONSTRAINT player_sessions_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_sessions_player_id
  ON public.player_sessions USING btree (player_id);

ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;

-- لا سياسات (policies) عمداً: anon و authenticated لا يرون أي صف حتى لو حصلوا على صلاحية بالخطأ.
REVOKE ALL ON public.player_sessions FROM PUBLIC;
REVOKE ALL ON public.player_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_sessions TO service_role;

COMMIT;

-- للتحقق (قراءة فقط): يجب أن تظهر صلاحيات service_role فقط، و rls = true
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls,
       (SELECT string_agg(r.rolname || ':' || a.privilege_type, ', ' ORDER BY r.rolname, a.privilege_type)
          FROM aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
         WHERE r.rolname IN ('anon', 'authenticated', 'service_role')) AS grants
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'player_sessions';
