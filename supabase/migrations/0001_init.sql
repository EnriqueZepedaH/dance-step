-- DanceStep v1 — initial schema and RLS.
--
-- Apply this migration by pasting it into the Supabase SQL editor
-- (Project → SQL Editor → New query → Run), or via the Supabase CLI:
--   supabase db push
--
-- The Clerk ↔ Supabase native third-party auth integration must be
-- enabled in the Supabase dashboard before RLS will recognize the
-- Clerk session token (Authentication → Third Party Auth → Add Clerk).
-- With the integration enabled, Supabase exposes the Clerk user_id
-- as auth.jwt() ->> 'sub' (a text value, not a UUID).

-- ---------- TABLES ----------

create table users (
  id            text primary key,                     -- Clerk user_id
  email         text,
  display_name  text,
  role          text not null default 'user',         -- 'user' | 'admin'
  created_at    timestamptz not null default now()
);

create table bookmarks (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null references users(id) on delete cascade,
  youtube_id        text not null,
  title             text not null,
  channel           text,
  thumbnail_url     text,
  duration_seconds  int,
  created_at        timestamptz not null default now(),
  unique (user_id, youtube_id)
);
create index bookmarks_user_created_idx
  on bookmarks (user_id, created_at desc);

create table playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index playlists_user_created_idx
  on playlists (user_id, created_at desc);

create table playlist_items (
  playlist_id uuid not null references playlists(id) on delete cascade,
  bookmark_id uuid not null references bookmarks(id) on delete cascade,
  position    int  not null default 0,
  primary key (playlist_id, bookmark_id)
);
create index playlist_items_position_idx
  on playlist_items (playlist_id, position);

create table venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  neighborhood  text,
  lng           double precision,
  lat           double precision
);

create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  venue_id    uuid references venues(id) on delete restrict,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  recurrence  text,
  kind        text,
  description text,
  url         text,
  created_by  text references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index events_starts_at_idx on events (starts_at);

create table youtube_cache (
  query_hash  text primary key,
  query       text not null,
  page_token  text,
  results     jsonb not null,
  fetched_at  timestamptz not null default now()
);

create table lab_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------- RLS ENABLE ----------

alter table users          enable row level security;
alter table bookmarks      enable row level security;
alter table playlists      enable row level security;
alter table playlist_items enable row level security;
alter table venues         enable row level security;
alter table events         enable row level security;
alter table youtube_cache  enable row level security;
alter table lab_waitlist   enable row level security;

-- ---------- POLICIES ----------
-- auth.jwt() ->> 'sub' = Clerk user_id. Service role bypasses RLS.

-- users: read own row only. Writes happen via service role (ensureUser, webhook).
create policy users_select_self on users
  for select using (id = auth.jwt() ->> 'sub');

-- bookmarks: full CRUD on own rows.
create policy bookmarks_owner_all on bookmarks
  for all
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

-- playlists: full CRUD on own rows.
create policy playlists_owner_all on playlists
  for all
  using      (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

-- playlist_items: no direct user_id, gate via parent playlist ownership.
create policy playlist_items_owner_all on playlist_items
  for all
  using (
    playlist_id in (
      select id from playlists where user_id = auth.jwt() ->> 'sub'
    )
  )
  with check (
    playlist_id in (
      select id from playlists where user_id = auth.jwt() ->> 'sub'
    )
  );

-- venues + events: world-readable; admin-only writes.
create policy venues_select_public on venues for select using (true);
create policy events_select_public on events for select using (true);

create policy events_admin_write on events
  for all
  using (
    exists (
      select 1 from users
      where id = auth.jwt() ->> 'sub' and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from users
      where id = auth.jwt() ->> 'sub' and role = 'admin'
    )
  );

create policy venues_admin_write on venues
  for all
  using (
    exists (
      select 1 from users
      where id = auth.jwt() ->> 'sub' and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from users
      where id = auth.jwt() ->> 'sub' and role = 'admin'
    )
  );

-- youtube_cache: server-only. No public policy. Service role bypasses RLS.

-- lab_waitlist: anonymous inserts allowed; reads admin-only.
create policy lab_waitlist_insert_public on lab_waitlist
  for insert with check (true);

create policy lab_waitlist_select_admin on lab_waitlist
  for select using (
    exists (
      select 1 from users
      where id = auth.jwt() ->> 'sub' and role = 'admin'
    )
  );
