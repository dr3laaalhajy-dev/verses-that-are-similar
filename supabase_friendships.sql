-- ==============================================================================
-- نظام الأصدقاء (تطبيق متين) - Supabase SQL Schema
-- جاهز للتنفيذ المباشر داخل محرر SQL في Supabase (SQL Editor)
-- ==============================================================================

-- تفعيل ملحق pgcrypto لتوليد المعرفات الفريدة UUID
create extension if not exists pgcrypto;

-- إنشاء جدول الصداقات friendships
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  user_id      text,
  friend_id    text,
  requesterId  text,
  addresseeId  text,
  receiver_id  text,
  status       text default 'pending', -- 'pending', 'accepted', 'blocked'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- فهارس لتسريع البحث
create index if not exists idx_friendships_user_id on public.friendships(user_id);
create index if not exists idx_friendships_friend_id on public.friendships(friend_id);
create index if not exists idx_friendships_addresseeId on public.friendships(addresseeId);
create index if not exists idx_friendships_requesterId on public.friendships(requesterId);

-- تفعيل حماية الصفوف RLS
alter table public.friendships enable row level security;

-- السماح للواجهة بقراءة وتحديث وإضافة طلبات الصداقة
drop policy if exists "Users can manage their own friendships" on public.friendships;
create policy "Users can manage their own friendships"
on public.friendships for all
using (true)
with check (true);

-- إضافة الجدول للتزامن اللحظي Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

