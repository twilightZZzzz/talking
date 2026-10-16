-- Утренняя речь v2: схема данных. См. docs/SPEC-v2.md §5

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Asia/Yekaterinburg',
  daily_goal_min int not null default 15 check (daily_goal_min between 5 and 240),
  default_mode text not null default 'full' check (default_mode in ('full', 'exp')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  self_problems text[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  mode text not null default 'full' check (mode in ('full', 'exp')),
  topic_id text,
  custom_topic text,
  frame_id text,
  challenge_id text,
  twister_id text,
  content_version int not null default 1,
  steps_done int[] not null default '{}',
  breath int check (breath is null or breath >= 0),
  fillers int check (fillers is null or fillers >= 0),
  clarity smallint check (clarity is null or clarity between 1 and 5),
  challenge_done boolean,
  note text,
  saved_at timestamptz,
  saved_hour smallint check (saved_hour is null or saved_hour between 0 and 23),
  "full" boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.activities (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('ritual_step', 'drill', 'take', 'day_saved', 'legacy')),
  ref text not null default '',
  duration_s int not null default 0 check (duration_s >= 0),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activities_user_date on public.activities (user_id, date);
create unique index activities_ritual_step_once on public.activities (user_id, date, ref)
  where kind = 'ritual_step';
create unique index activities_take_once on public.activities (user_id, ref)
  where kind = 'take';

create table public.takes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  take_no int not null default 1,
  context text not null default 'free' check (context in ('ritual', 'free', 'drill', 'plan')),
  exercise_id text,
  topic text,
  frame_id text,
  challenge_id text,
  source text not null default 'record' check (source in ('record', 'upload')),
  audio_path text,
  mime text,
  duration_s numeric,
  status text not null default 'created'
    check (status in ('created', 'uploaded', 'transcribing', 'transcribed', 'analyzing', 'done', 'failed')),
  failed_stage text,
  error text,
  locked_until timestamptz,
  transcript text,
  words jsonb,
  metrics jsonb,
  feedback jsonb,
  fillers_excluded int[] not null default '{}',
  asr_model text,
  llm_model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz
);
create index takes_user_created on public.takes (user_id, created_at desc);
create index takes_user_date on public.takes (user_id, session_date);

create table public.problem_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  take_id uuid references public.takes (id) on delete cascade,
  code text not null,
  severity real not null check (severity between 0 and 1),
  evidence jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index problem_events_user_created on public.problem_events (user_id, created_at desc);

create table public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null check (source in ('ai', 'rules')),
  profile jsonb not null default '{}',
  items jsonb not null default '[]',
  done text[] not null default '{}'
);
create index coach_plans_user_created on public.coach_plans (user_id, created_at desc);

create table public.achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  unlocked_at timestamptz not null default now(),
  source text not null default 'calc' check (source in ('calc', 'legacy')),
  primary key (user_id, code)
);

-- updated_at
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger sessions_touch before update on public.sessions for each row execute function public.touch_updated_at();

-- профиль создаётся при регистрации
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS: каждый видит только свои строки
do $$
declare t text;
begin
  foreach t in array array['profiles', 'sessions', 'activities', 'takes', 'problem_events', 'coach_plans', 'achievements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Storage: приватный бакет audio, путь {user_id}/{take_id}.{ext}
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 26214400)
on conflict (id) do nothing;

create policy "audio_own_select" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
