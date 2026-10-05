-- Semester Tracker — Supabase schema (idempotent: safe to paste and re-run).
-- Model: one row per user in app_state (last write wins). Every time that
-- row's data changes or the row is deleted, the previous copy is archived
-- into app_state_history by trigger, so a bad sync can always be recovered.
-- Keep the service_role key out of the app; RLS is what protects the data.

-- ---------- app_state: one row per user, jsonb snapshot ----------
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "own row" on public.app_state;
create policy "own row" on public.app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- app_state_history: bounded per-user archive ----------
create table if not exists public.app_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists app_state_history_user_recent_idx
  on public.app_state_history (user_id, id desc);

alter table public.app_state_history enable row level security;

-- History is written only by the archive trigger (security definer) and is
-- immutable for users: they may read and clear their own rows, nothing else.
drop policy if exists "own history read" on public.app_state_history;
create policy "own history read" on public.app_state_history
  for select
  using (auth.uid() = user_id);

drop policy if exists "own history delete" on public.app_state_history;
create policy "own history delete" on public.app_state_history
  for delete
  using (auth.uid() = user_id);

-- ---------- triggers ----------
-- Keep updated_at server-authoritative on every write and cap the payload.

create or replace function public.touch_app_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Guard against runaway payloads (real tracker state stays far below this).
  if pg_column_size(new.data) > 1048576 then
    raise exception 'app_state.data exceeds 1 MiB';
  end if;
  return new;
end;
$$;

-- Archive the previous version on change or delete; keep only the latest 20.
create or replace function public.archive_app_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.data is not distinct from old.data then
    return null; -- no-op write; nothing new to archive
  end if;
  insert into public.app_state_history (user_id, data, updated_at)
    values (old.user_id, old.data, old.updated_at);
  delete from public.app_state_history
    where user_id = old.user_id
      and id not in (
        select id from public.app_state_history
        where user_id = old.user_id
        order by id desc
        limit 20
      );
  return null; -- AFTER trigger; return value is ignored
end;
$$;

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch
  before insert or update on public.app_state
  for each row execute function public.touch_app_state();

drop trigger if exists app_state_archive on public.app_state;
create trigger app_state_archive
  after update or delete on public.app_state
  for each row execute function public.archive_app_state();

-- ---------- grants (explicit; Supabase defaults also cover these) ----------
grant select, insert, update, delete on public.app_state to authenticated;
grant select, delete on public.app_state_history to authenticated;
