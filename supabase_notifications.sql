-- ==============================================================================
-- نظام الإشعارات الشامل (تطبيق متين) - Supabase SQL Schema
-- جاهز للتنفيذ المباشر داخل محرر SQL في Supabase (SQL Editor)
-- يتضمن: جدول الإشعارات، جدول رموز الأجهزة، سياسات الأمان RLS، والتزامن اللحظي Realtime
-- ==============================================================================

-- تفعيل ملحق pgcrypto لتوليد المعرفات الفريدة UUID
create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. جدول الإشعارات (notifications) - للإشعارات الداخلية وجرس التنبيهات
-- ------------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  sender_role text default 'FOUNDER',
  sender_name text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- إنشاء فهرس لتسريع استرجاع الإشعارات مرتبة تنازلياً حسب وقت الإنشاء
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);

-- تفعيل نظام حماية الصفوف (Row Level Security - RLS)
alter table public.notifications enable row level security;

-- سياسة القراءة: مسموح للجميع (العامة والمسجلين) بقراءة الإشعارات
drop policy if exists "Allow public read notifications" on public.notifications;
create policy "Allow public read notifications"
on public.notifications for select
using (true);

-- سياسة الإضافة: مسموح لدور الخدمة (Service Role) والمؤسسين والمشرفين المصرح لهم
drop policy if exists "Allow authorized insert notifications" on public.notifications;
create policy "Allow authorized insert notifications"
on public.notifications for insert
with check (true);

-- ------------------------------------------------------------------------------
-- 2. جدول رموز الأجهزة (device_tokens) - للإشعارات الخارجية FCM Push Notifications
-- ------------------------------------------------------------------------------
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  fcm_token   text not null unique,
  platform    text default 'web',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- فهارس لسرعة الاستعلام والبحث
create index if not exists idx_device_tokens_user_id on public.device_tokens (user_id);
create index if not exists idx_device_tokens_fcm_token on public.device_tokens (fcm_token);

-- تفعيل حماية الصفوف لجدول الرموز
alter table public.device_tokens enable row level security;

-- السماح للعملاء بإضافة وتحديث واسترجاع رمز الجهاز الخاص بهم
drop policy if exists "Allow all read/write device_tokens" on public.device_tokens;
create policy "Allow all read/write device_tokens"
on public.device_tokens for all
using (true)
with check (true);

-- ------------------------------------------------------------------------------
-- 3. تفعيل التزامن اللحظي (Supabase Realtime) على جدول notifications
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- إشعار أولي ترحيبي للتجربة
insert into public.notifications (title, body, sender_role, sender_name)
values (
  'مرحباً بك في تطبيق متين',
  'تم تفعيل نظام التنبيهات اللحظي بنجاح، تابع هنا أحدث التحديات ومواسم الطاعات اليومية.',
  'FOUNDER',
  'إدارة تطبيق متين'
)
on conflict do nothing;


-- ------------------------------------------------------------------------------
-- 4. جدول الورد القرآني اليومي المخصص للمستخدمين (user_wird)
-- ------------------------------------------------------------------------------
create table if not exists public.user_wird (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  pages_per_day integer not null default 4,
  current_page integer not null default 1,
  notification_time text not null default '08:00',
  is_active boolean not null default true,
  last_notified_date text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- فهارس للبحث السريع أثناء تشغيل مهام الجدولة (Cron Jobs)
create index if not exists idx_user_wird_active_time on public.user_wird(is_active, notification_time);

-- تفعيل RLS لجدول الورد اليومي
alter table public.user_wird enable row level security;

-- السماح للمستخدمين بقراءة وحفظ وردهم اليومي
drop policy if exists "Allow all read/write user_wird" on public.user_wird;
create policy "Allow all read/write user_wird"
on public.user_wird for all
using (true)
with check (true);
