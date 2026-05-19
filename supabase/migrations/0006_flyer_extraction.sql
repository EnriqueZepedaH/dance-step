-- Flyer-to-Event auto-extraction: audit + observability table and the
-- two events columns that link a published event back to its source
-- flyer + Claude extraction. Also adds events.country to match the
-- venues/event_sources country columns added in 0005 (an oversight in
-- that migration — keeping the schema consistent matters now that
-- non-US events are about to land).
--
-- Apply via Supabase MCP (mcp__supabase__apply_migration) or paste
-- into the Supabase SQL editor. After applying, regenerate the
-- packages/db types (npm run db:types or the MCP equivalent), and
-- create the private Storage bucket `event-flyers` via the dashboard
-- (public: false, no select policy) — that step is NOT in this file
-- because Storage bucket creation is an API call, not SQL.
--
-- Design notes:
--  * flyer_extractions is a service-role-only table (RLS on, zero
--    policies). The /api/admin/flyers/extract route inserts a row in
--    status='processing' BEFORE uploading the image to Storage, so an
--    upload or vision crash never leaves an orphan flyer with no
--    audit trail.
--  * raw_response + extracted capture every Claude call verbatim;
--    finalized_payload + fields_edited capture the human-edited final
--    event payload. Together they form an eval/replay corpus for
--    future model swaps or fine-tunes.
--  * events.country aligns the events table with venues.country and
--    event_sources.country (both added in 0005). Default 'US' keeps
--    seeded Chicago rows working without backfill.

-- ---------- flyer_extractions: audit + observability ----------
create table flyer_extractions (
  id uuid primary key default gen_random_uuid(),

  storage_path text not null,
  mime         text not null,
  bytes        int  not null,

  model         text not null,
  latency_ms    int,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  total_tokens  int  not null default 0,

  raw_response       jsonb,
  extracted          jsonb,
  finalized_payload  jsonb,

  status   text not null check (status in ('processing','completed','failed')),
  error    text,
  warnings jsonb not null default '[]'::jsonb,

  fields_edited text[] not null default '{}',

  created_by         text not null references users(id) on delete restrict,
  finalized_event_id uuid references events(id) on delete set null,

  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index flyer_extractions_created_by_idx
  on flyer_extractions (created_by, created_at desc);

create index flyer_extractions_finalized_idx
  on flyer_extractions (finalized_event_id)
  where finalized_event_id is not null;

alter table flyer_extractions enable row level security;
-- intentionally NO policies: service-role only. Admins read/write
-- via /api/admin/* routes that use getSupabaseAdminClient().

-- ---------- events: link to flyer + add missing country column ----------
alter table events
  add column flyer_storage_path  text,
  add column flyer_extraction_id uuid references flyer_extractions(id) on delete set null,
  add column country             text not null default 'US';
