-- Ani-Mates schema
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
-- Safe to re-run: DDL uses "if not exists" / "or replace" where possible, but on a
-- second run the tables themselves will already exist -- drop them first if you need
-- a clean slate (see bottom of file, commented out).

create extension if not exists pgcrypto;

-- ROOMS -----------------------------------------------------------------
create table rooms (
  id         text primary key,        -- generated client-side via crypto.randomUUID(); used directly as the /room/:id URL slug
  name       text,
  created_at timestamptz not null default now()
);

-- PARTICIPANTS ------------------------------------------------------------
create table participants (
  id           uuid primary key,      -- client-generated (crypto.randomUUID()), persisted in localStorage per room
  room_id      text not null references rooms(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  is_host      boolean not null default false,
  joined_at    timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);
create index participants_room_id_idx on participants(room_id);

-- CATEGORIES --------------------------------------------------------------
create table categories (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null references rooms(id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  is_scored  boolean not null default true,   -- true = one of the 6 defaults, counts toward the compatibility score
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index categories_room_id_idx on categories(room_id);
create unique index categories_room_name_uidx on categories(room_id, lower(name));

-- PICKS ---------------------------------------------------------------------
create table picks (
  id             uuid primary key default gen_random_uuid(),
  room_id        text not null references rooms(id) on delete cascade,       -- denormalized to simplify RLS + realtime filters
  participant_id uuid not null references participants(id) on delete cascade,
  category_id    uuid not null references categories(id) on delete cascade,
  mal_id         integer not null,
  title          text not null,
  image_url      text,
  anime_type     text,               -- Jikan `type`: "TV" | "Movie" | "OVA" | ...
  year           integer,
  genres         text[] not null default '{}',
  updated_at     timestamptz not null default now(),
  unique (participant_id, category_id)   -- upsert target: one pick per person per category
);
create index picks_room_id_idx on picks(room_id);
create index picks_category_id_idx on picks(category_id);

-- Data-hygiene guard (not a security boundary -- see RLS note below)
create or replace function picks_room_id_matches_category()
returns trigger as $$
begin
  if new.room_id <> (select room_id from categories where id = new.category_id) then
    raise exception 'picks.room_id must match categories.room_id';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger picks_room_id_check
before insert or update on picks
for each row execute function picks_room_id_matches_category();

-- JIKAN SEARCH CACHE ---------------------------------------------------------
-- Shared across every room: caches Jikan search results by normalized query
-- text so repeated/popular searches (across the whole app, not just one room)
-- don't re-hit Jikan's rate-limited API. Not room-scoped, not realtime --
-- purely a lookup-on-demand cache checked/written by src/lib/jikan.js. Public,
-- non-sensitive data (it's just cached third-party API responses), so open
-- RLS here isn't a meaningful trade-off the way it is for the tables above.
create table jikan_search_cache (
  query      text primary key,   -- normalized (trimmed, lowercased) search query
  results    jsonb not null,     -- the Jikan response's `data` array for this query
  fetched_at timestamptz not null default now()
);

alter table jikan_search_cache enable row level security;
create policy jikan_cache_select_all on jikan_search_cache for select using (true);
create policy jikan_cache_insert_all on jikan_search_cache for insert with check (true);
create policy jikan_cache_update_all on jikan_search_cache for update using (true) with check (true);

-- REALTIME ------------------------------------------------------------------
alter publication supabase_realtime add table participants, categories, picks;

-- ROW LEVEL SECURITY ----------------------------------------------------------
-- IMPORTANT: this app has no Supabase Auth. Every browser talks to Supabase with the
-- same public anon key, so RLS has no per-user identity to check -- it cannot express
-- "only Alex's browser may edit Alex's picks." The policies below therefore only
-- enforce "you must know a room's id to touch its data" (the room id is a high-entropy
-- UUID and is never listed anywhere) -- NOT "you may only edit your own stuff." Anyone
-- with a room's link can read/write everything in that room via the REST API, not just
-- through the UI. That's an accepted trade-off for a casual party app, not an oversight.
-- If this ever needs to be tightened, the upgrade path is Supabase Anonymous Auth
-- (supabase.auth.signInAnonymously()), storing a real auth.uid() on participants and
-- checking it in WITH CHECK clauses.

alter table rooms        enable row level security;
alter table participants enable row level security;
alter table categories   enable row level security;
alter table picks        enable row level security;

create policy rooms_select_all on rooms for select using (true);
create policy rooms_insert_all on rooms for insert with check (true);
-- no update/delete policy -> default deny; rooms are immutable in v1

create policy participants_select_all on participants for select using (true);
create policy participants_insert_all on participants for insert with check (true);
create policy participants_update_all on participants for update using (true) with check (true);
-- no delete policy: "leaving" is a presence event, not a row deletion

create policy categories_select_all on categories for select using (true);
create policy categories_insert_all on categories for insert with check (true);
-- host-only enforcement for adding bonus categories happens client-side (UI only)

create policy picks_select_all on picks for select using (true);
create policy picks_insert_all on picks for insert with check (true);
create policy picks_update_all on picks for update using (true) with check (true);

-- To reset everything and start over, uncomment and run:
-- drop table if exists picks, categories, participants, rooms cascade;
