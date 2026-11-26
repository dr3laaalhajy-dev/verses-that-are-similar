-- =====================================================================
-- 04-player-khatma.sql
-- Quran reading progress (khatma): which of the 604 Mushaf pages the player has read in the
-- current cycle, and how many complete khatmas they finished.
-- Run manually in the Supabase SQL Editor. Safe to run more than once.
-- Touches no existing data: creates one new empty table and one function.
--
-- Access: RLS enabled with NO policy, no privilege for anon or authenticated.
-- Only the server (service_role, /api/friends) reads and writes.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.player_khatma (
  player_id       integer     NOT NULL,
  read_pages      smallint[]  NOT NULL DEFAULT '{}',   -- pages read in the current cycle (1..604, sorted, unique)
  pages_read      integer     NOT NULL DEFAULT 0,      -- = cardinality(read_pages)
  completed_count integer     NOT NULL DEFAULT 0,      -- finished khatmas
  cycle           integer     NOT NULL DEFAULT 1,      -- current khatma number
  last_report_at  timestamptz,                         -- last accepted report (rate check)
  day             date,                                -- day of day_pages (server, UTC)
  day_pages       integer     NOT NULL DEFAULT 0,      -- new pages accepted on that day (daily cap)
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_khatma_pkey PRIMARY KEY (player_id),
  CONSTRAINT player_khatma_player_id_fkey FOREIGN KEY (player_id)
    REFERENCES public.players(id) ON DELETE CASCADE
);

ALTER TABLE public.player_khatma ENABLE ROW LEVEL SECURITY;   -- no policy on purpose
REVOKE ALL ON public.player_khatma FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.player_khatma TO service_role;

-- Atomic merge of newly read pages (two devices at the same time lose nothing: row lock).
-- The server validates the pages (range, rate, daily cap) BEFORE calling it.
-- When all 604 pages are read: completed_count + 1, cycle + 1, read_pages starts empty again.
CREATE OR REPLACE FUNCTION public.khatma_add_pages(p_player integer, p_pages smallint[], p_day date)
 RETURNS public.player_khatma
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  r      public.player_khatma;
  merged smallint[];
  added  integer;
begin
  insert into public.player_khatma (player_id) values (p_player) on conflict (player_id) do nothing;
  select * into r from public.player_khatma where player_id = p_player for update;

  select coalesce(array_agg(distinct p order by p), '{}')
    into merged
    from unnest(r.read_pages || coalesce(p_pages, '{}'::smallint[])) as p
   where p between 1 and 604;

  added := coalesce(array_length(merged, 1), 0) - coalesce(array_length(r.read_pages, 1), 0);

  if r.day is distinct from p_day then
    r.day := p_day;
    r.day_pages := 0;
  end if;
  r.day_pages := r.day_pages + greatest(added, 0);

  if coalesce(array_length(merged, 1), 0) >= 604 then
    r.completed_count := r.completed_count + 1;
    r.cycle := r.cycle + 1;
    merged := '{}';
  end if;

  update public.player_khatma
     set read_pages      = merged,
         pages_read      = coalesce(array_length(merged, 1), 0),
         completed_count = r.completed_count,
         cycle           = r.cycle,
         day             = r.day,
         day_pages       = r.day_pages,
         last_report_at  = now(),
         updated_at      = now()
   where player_id = p_player
  returning * into r;

  return r;
end $function$;

REVOKE ALL ON FUNCTION public.khatma_add_pages(integer, smallint[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.khatma_add_pages(integer, smallint[], date) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Rollback (only if needed):
--   DROP FUNCTION IF EXISTS public.khatma_add_pages(integer, smallint[], date);
--   DROP TABLE IF EXISTS public.player_khatma;
