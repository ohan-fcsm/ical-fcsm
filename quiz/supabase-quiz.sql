-- Run once in Supabase > SQL Editor.
-- Browser visitors have no direct read/write access to these tables.

create table if not exists public.quiz_results (
  id bigint generated always as identity primary key,
  score smallint not null check (score between 0 and 10),
  duration_seconds smallint not null check (duration_seconds between 1 and 150),
  created_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;
revoke all on table public.quiz_results from anon, authenticated;
grant select, insert on table public.quiz_results to service_role;

drop policy if exists "Anyone can submit a quiz result" on public.quiz_results;
drop policy if exists "Quiz API can submit results" on public.quiz_results;

create or replace function public.get_quiz_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'participants', count(*),
    'average_score', coalesce(round(avg(score)::numeric, 1), 0),
    'best_score', coalesce(max(score), 0),
    'best_time_seconds', (
      select duration_seconds
      from public.quiz_results
      order by score desc, duration_seconds asc, created_at asc
      limit 1
    )
  )
  from public.quiz_results;
$$;

revoke all on function public.get_quiz_stats() from public, anon, authenticated;
grant execute on function public.get_quiz_stats() to service_role;
