-- Scene ingestion pipeline schema. Adds the staging + audit tables
-- and the multi-city + provenance columns the Railway ingest-worker
-- needs. Existing data is preserved: venues and events default to
-- Chicago / America/Chicago so the seeded rows keep working.
--
-- Apply via Supabase MCP (mcp__supabase__apply_migration) or paste
-- into the Supabase SQL editor. After applying, regenerate the
-- packages/db types (npm run db:types or the MCP equivalent).
--
-- Design notes:
--  * raw_events is APPEND-ONLY per run. Every fetch produces one row
--    per event, even when content is unchanged — the "unchanged"
--    outcome path is what keeps events.last_seen_at advancing.
--  * archive logic is source-scoped; see the worker's
--    archiveMissing(sourceKey, runStartedAt) and only call it after a
--    source's run finishes status='success'.
--  * event_sources carries city/country/timezone so a second-city
--    onboarding adds rows here without further schema changes.

-- ---------- VENUES: multi-city + canonicalization ----------
alter table venues
  add column city               text not null default 'Chicago',
  add column country            text not null default 'US',
  add column timezone           text not null default 'America/Chicago',
  add column normalized_address text,
  add column normalized_name    text;

create unique index venues_norm_uniq
  on venues (city, normalized_name, normalized_address)
  where normalized_address is not null;

-- ---------- EVENTS: provenance + status + content hash ----------
alter table events
  add column status             text not null default 'published'
    check (status in ('published','archived','hidden')),
  add column source             text,
  add column source_event_id    text,
  add column source_url         text,
  add column content_hash       text,
  add column last_seen_at       timestamptz,
  add column missing_run_count  int not null default 0,
  add column city               text not null default 'Chicago',
  add column timezone           text not null default 'America/Chicago';

create unique index events_source_uid_uniq
  on events (source, source_event_id)
  where source is not null;
create index events_city_starts_idx on events (city, starts_at);
create index events_status_idx on events (status);

-- ---------- EVENT_SOURCES: catalog of ingestion sources ----------
create table event_sources (
  key             text primary key,
  display_name    text not null,
  kind            text not null check (kind in ('ical','html','json')),
  url             text not null,
  enabled         boolean not null default true,
  city            text not null,
  country         text not null,
  timezone        text not null,
  last_run_id     uuid,
  last_status     text,
  last_run_at     timestamptz,
  created_at      timestamptz not null default now()
);
alter table event_sources enable row level security;
create policy event_sources_select_public on event_sources
  for select using (true);
-- writes: service-role only (RLS bypassed); no admin policy needed.

-- ---------- INGEST_RUNS: per-run audit ----------
create table ingest_runs (
  id              uuid primary key default gen_random_uuid(),
  source          text not null references event_sources(key) on delete cascade,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'in_progress'
    check (status in ('in_progress','success','failed','partial')),
  fetched_count   int not null default 0,
  staged_count    int not null default 0,
  promoted_count  int not null default 0,
  rejected_count  int not null default 0,
  archived_count  int not null default 0,
  error           text,
  log             jsonb not null default '[]'::jsonb
);
alter table ingest_runs enable row level security;
-- no public policy; service role bypasses, admin UI reads via /api/admin/scene/* routes
create index ingest_runs_source_started_idx
  on ingest_runs (source, started_at desc);

-- ---------- RAW_EVENTS: append-only extract buffer ----------
create table raw_events (
  id                uuid primary key default gen_random_uuid(),
  source            text not null references event_sources(key) on delete cascade,
  source_event_id   text not null,
  run_id            uuid not null references ingest_runs(id) on delete cascade,
  fetched_at        timestamptz not null default now(),
  raw_payload       jsonb not null,
  normalized        jsonb not null,
  content_hash      text not null,
  sequence          int,
  processed         boolean not null default false,
  promoted_event_id uuid references events(id) on delete set null,
  outcome           text check (outcome in ('inserted','updated','unchanged','rejected','duplicate')),
  outcome_detail    text
);
alter table raw_events enable row level security;
-- (run_id, source, source_event_id) is intra-run dedup safety; fresh
-- runs always produce a brand-new row per event.
create unique index raw_events_run_source_uid_uniq
  on raw_events (run_id, source, source_event_id);
create index raw_events_run_idx           on raw_events (run_id);
create index raw_events_unprocessed_idx   on raw_events (processed) where processed = false;
create index raw_events_src_uid_fetched_idx
  on raw_events (source, source_event_id, fetched_at desc);

-- ---------- QUALITY_REJECTIONS: why a raw_event didn't promote ----------
create table quality_rejections (
  id              uuid primary key default gen_random_uuid(),
  raw_event_id    uuid not null references raw_events(id) on delete cascade,
  run_id          uuid not null references ingest_runs(id) on delete cascade,
  reason_code     text not null,
  reason_detail   text,
  duplicate_of    uuid references events(id) on delete set null,
  resolved        boolean not null default false,
  resolved_by     text references users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
alter table quality_rejections enable row level security;
create index quality_rejections_open_idx
  on quality_rejections (resolved, created_at desc);

-- ---------- VENUE_GEOCODE_CACHE: Mapbox-call dedup ----------
create table venue_geocode_cache (
  normalized_address text primary key,
  lat                double precision not null,
  lng                double precision not null,
  place_name         text,
  neighborhood       text,
  fetched_at         timestamptz not null default now()
);
alter table venue_geocode_cache enable row level security;

-- ---------- Seed source registry ----------
insert into event_sources (key, display_name, kind, url, city, country, timezone) values
  ('gcal', 'Social Dancing Chicago calendar', 'ical',
    'https://calendar.google.com/calendar/ical/c0670267847f53909b569c3ffdccac65d7ff12a8ea270b3e9daf0db5e2dc549c%40group.calendar.google.com/public/basic.ics',
    'Chicago', 'US', 'America/Chicago'),
  ('lsd', 'Latin Street Dancing', 'html',
    'https://www.latinstreetdancing.com/upcoming-events/',
    'Chicago', 'US', 'America/Chicago');
