-- Server schema for optional sync.
-- Design: docs/superpowers/specs/2026-07-31-supabase-sync-design.md
--
-- Run once in the Supabase SQL editor, then set in .env:
--   EXPO_PUBLIC_SUPABASE_URL=...
--   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
-- Without those two variables the app never loads any of this (design §4).
--
-- Two columns exist on every table beyond the client's wire shape:
--   user_id            -- the RLS boundary. The anon key is publishable; THIS
--                         is what actually keeps accounts apart.
--   server_updated_at  -- the server's own clock, which the pull cursor tracks.
--                         Client `updated_at` values are used only to RESOLVE
--                         conflicts, never to decide what a pull returns, so
--                         pull completeness never depends on device clock skew.
--
-- The server is deliberately dumb storage: it runs no merge logic. Every
-- conflict decision happens client-side in src/engine/sync, where it is pure
-- and unit-tested.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sync_cards (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null,
  front text not null,
  back text not null,
  payload text,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false,
  device_id text not null,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.sync_palaces (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null,
  is_deleted boolean not null default false,
  device_id text not null,
  -- The palace's whole loci list travels as one JSON value: a route is a single
  -- logical unit (design §3.4). Merging loci row-by-row could transiently place
  -- two stops at the same position, which the client's UNIQUE(palace_id,
  -- position) index rejects — aborting the entire merge.
  loci jsonb not null default '[]'::jsonb,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.sync_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started bigint not null,
  ended bigint,
  module text not null,
  items integer not null default 0,
  accuracy real not null default 0,
  updated_at bigint not null,
  device_id text not null,
  server_updated_at timestamptz not null default now()
);

-- The three append-only tables below carry no updated_at or device_id: they are
-- never updated, so they have nothing to resolve. Merging them is a set union
-- on the primary key (design §3.1).

create table if not exists public.sync_review_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  ts bigint not null,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  elapsed_ms integer not null,
  difficulty real not null,
  stability real not null,
  retrievability real not null,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.sync_ability_log (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  module text not null,
  elo real not null,
  ts bigint not null,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.sync_assessments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  instrument text not null,
  raw_score real not null,
  normalized real,
  payload text,
  ts bigint not null,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cursor indexes — every pull filters on (user_id, server_updated_at)
-- ---------------------------------------------------------------------------

create index if not exists sync_cards_cursor_idx on public.sync_cards (user_id, server_updated_at);
create index if not exists sync_palaces_cursor_idx on public.sync_palaces (user_id, server_updated_at);
create index if not exists sync_sessions_cursor_idx on public.sync_sessions (user_id, server_updated_at);
create index if not exists sync_review_log_cursor_idx on public.sync_review_log (user_id, server_updated_at);
create index if not exists sync_ability_log_cursor_idx on public.sync_ability_log (user_id, server_updated_at);
create index if not exists sync_assessments_cursor_idx on public.sync_assessments (user_id, server_updated_at);

-- ---------------------------------------------------------------------------
-- server_updated_at must advance on every write, or the cursor misses rows
-- ---------------------------------------------------------------------------

create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'sync_cards', 'sync_palaces', 'sync_sessions',
    'sync_review_log', 'sync_ability_log', 'sync_assessments'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before insert or update on public.%I
         for each row execute function public.touch_server_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security — the real boundary
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'sync_cards', 'sync_palaces', 'sync_sessions',
    'sync_review_log', 'sync_ability_log', 'sync_assessments'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select using (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert with check (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);

    -- No delete policy, on purpose. Nothing in this app hard-deletes synced
    -- data: cards and palaces soft-delete via is_deleted, and the append-only
    -- tables must never lose a row. Omitting the policy means RLS denies
    -- deletes outright rather than relying on the client not to try.
  end loop;
end;
$$;
