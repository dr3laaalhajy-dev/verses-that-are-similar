-- =====================================================
-- تحدي "من أنا؟" - مخطط قاعدة البيانات الكامل (Supabase)
-- جاهز للتشغيل مباشرة في محرر SQL (Supabase SQL Editor)
-- =====================================================

create extension if not exists pgcrypto;

-- 1) جدول الأسئلة
create table if not exists public.who_am_i_questions (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'الصحابة',
  hint_1     text not null,   -- التلميح الصعب
  hint_2     text not null,   -- التلميح السهل
  answer     text not null,   -- الإجابة الصحيحة (يمكن وضع أكثر من صيغة مفصولة بـ |)
  created_at timestamptz not null default now()
);

-- 2) جدول الجولات (الحالة المتزامنة للغرفة)
create table if not exists public.who_am_i_rounds (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  question_id uuid not null references public.who_am_i_questions(id),
  round_no    int  not null,
  status      text not null default 'active' check (status in ('active','revealed')),
  started_at  timestamptz not null default clock_timestamp(),
  unique (room_id, round_no)
);

-- 3) جدول الإجابات
create table if not exists public.who_am_i_answers (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  round_id    uuid not null references public.who_am_i_rounds(id) on delete cascade,
  user_id     text not null,
  player_name text not null,
  answer_text text not null,
  phase       smallint not null check (phase in (1,2)),
  is_correct  boolean  not null default false,
  points      int      not null default 0,
  overridden  boolean  not null default false,
  created_at  timestamptz not null default now(),
  unique (round_id, user_id)
);

-- 4) جدول الإرسالات (علامة الصح العامة لمن أجاب بدون كشف النص للخصوم)
create table if not exists public.who_am_i_submissions (
  round_id    uuid not null references public.who_am_i_rounds(id) on delete cascade,
  room_id     text not null,
  user_id     text not null,
  player_name text not null,
  created_at  timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- التريجر التلقائي لإضافة علامة الإرسال فور إدخال الإجابة
create or replace function public.who_am_i_mark_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.who_am_i_submissions (round_id, room_id, user_id, player_name)
  values (new.round_id, new.room_id, new.user_id, new.player_name)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_who_am_i_mark_submitted on public.who_am_i_answers;
create trigger trg_who_am_i_mark_submitted
after insert on public.who_am_i_answers
for each row execute function public.who_am_i_mark_submitted();

-- 5) دالة خادم لمزامنة الوقت بدقة بالمللي ثانية بين الهواتف والمتصفحات
create or replace function public.server_now()
returns timestamptz language sql stable as $$ select clock_timestamp() $$;

grant execute on function public.server_now() to anon, authenticated;

-- 6) صلاحيات وأمان الجداول (RLS)
alter table public.who_am_i_questions   enable row level security;
alter table public.who_am_i_rounds      enable row level security;
alter table public.who_am_i_answers     enable row level security;
alter table public.who_am_i_submissions enable row level security;

-- سياسات الأسئلة
drop policy if exists "questions read" on public.who_am_i_questions;
create policy "questions read" on public.who_am_i_questions
  for select to anon, authenticated using (true);

-- سياسات الجولات
drop policy if exists "rounds read" on public.who_am_i_rounds;
create policy "rounds read" on public.who_am_i_rounds
  for select to anon, authenticated using (true);

drop policy if exists "rounds insert" on public.who_am_i_rounds;
create policy "rounds insert" on public.who_am_i_rounds
  for insert to anon, authenticated with check (true);

drop policy if exists "rounds update" on public.who_am_i_rounds;
create policy "rounds update" on public.who_am_i_rounds
  for update to anon, authenticated using (true);

-- سياسات الإرسالات (علامات الصح)
drop policy if exists "submissions read" on public.who_am_i_submissions;
create policy "submissions read" on public.who_am_i_submissions
  for select to anon, authenticated using (true);

drop policy if exists "submissions insert" on public.who_am_i_submissions;
create policy "submissions insert" on public.who_am_i_submissions
  for insert to anon, authenticated with check (true);

-- سياسات الإجابات
drop policy if exists "answers read" on public.who_am_i_answers;
create policy "answers read" on public.who_am_i_answers
  for select to anon, authenticated using (true);

drop policy if exists "answers insert" on public.who_am_i_answers;
create policy "answers insert" on public.who_am_i_answers
  for insert to anon, authenticated with check (true);

drop policy if exists "answers update" on public.who_am_i_answers;
create policy "answers update" on public.who_am_i_answers
  for update to anon, authenticated using (true);

-- 7) تفعيل التزامن اللحظي (Realtime)
alter publication supabase_realtime add table public.who_am_i_rounds;
alter publication supabase_realtime add table public.who_am_i_answers;
alter publication supabase_realtime add table public.who_am_i_submissions;

-- 8) إضافة بيانات أولية لأسئلة الصحابة
insert into public.who_am_i_questions (category, hint_1, hint_2, answer) values
('الصحابة','أول من أسلم من الرجال الأحرار، وكان تاجراً معروفاً بالأمانة','صاحب النبي ﷺ في الغار وأول الخلفاء الراشدين','أبو بكر الصديق|ابو بكر|أبو بكر|ابوبكر الصديق|ابو بكر الصديق'),
('الصحابة','لقبه النبي ﷺ بالفاروق، وكان إسلامه عزاً للمسلمين','ثاني الخلفاء الراشدين وفتحت في عهده بلاد الشام والعراق ومصر','عمر بن الخطاب|عمر ابن الخطاب|الفاروق عمر'),
('الصحابة','كان يملك بئراً اشتراها للمسلمين، وتستحي منه الملائكة','ذو النورين، ثالث الخلفاء الراشدين وجامع المصحف','عثمان بن عفان|عثمان ابن عفان'),
('الصحابة','نام في فراش النبي ﷺ ليلة الهجرة وفدى رسول الله بنفسه','رابع الخلفاء الراشدين، ابن عم النبي وزوج فاطمة الزهراء','علي بن أبي طالب|علي ابن ابي طالب'),
('الصحابة','لُقّب بسيف الله المسلول، ولم يُهزم في معركة قط في الجاهلية والإسلام','قائد معركة اليرموك الخالدة وفاتح الشام','خالد بن الوليد|خالد ابن الوليد'),
('الصحابة','كان مؤذن الرسول ﷺ وتحمل أشد ألوان العذاب على إسلامه','حبشي الأصل، صعد على ظهر الكعبة المشرفة وأذّن يوم الفتح الأعظم','بلال بن رباح|بلال ابن رباح'),
('الصحابة','أمين هذه الأمة، وأحد العشرة المبشرين بالجنة','قائد جيوش المسلمين في الشام وتوفي في طاعون عمواس','أبو عبيدة بن الجراح|ابو عبيدة بن الجراح|أبو عبيدة عامر بن الجراح'),
('الصحابة','حواري رسول الله ﷺ وابن عمته صفية بنت عبد المطلب','أول من سل سيفاً في الإسلام وأحد الستة أصحاب الشورى','الزبير بن العوام|الزبير ابن العوام'),
('الصحابة','أول سفير في الإسلام، أرسله النبي ﷺ إلى المدينة المنورة ليعلم أهلها القرآن','شاب وسيم وثرِيّ ترك نعيم مكة واستشهد في غزوة أحد حاملاً اللواء','مصعب بن عمير|مصعب ابن عمير'),
('الصحابة','ترجمان القرآن وحبر هذه الأمة، دعا له النبي ﷺ بالفقه في الدين','ابن عم النبي ﷺ وكان من أصغر الصحابة وأكثرهم غزارة في العلم والتفسير','عبد الله بن عباس|عبدالله بن عباس|ابن عباس');
