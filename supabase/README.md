# supabase/

Database migrations and seed data for the DanceStep Supabase project.

This lives at the repo root (not under `apps/web/`) because the database
is shared infrastructure: future services (e.g. `apps/lab-api/`) will
also talk to it.

## Applying a migration

Easiest path for v1 — paste the file contents into the **Supabase
dashboard SQL editor** (Project → SQL Editor → New query → Run).

Alternative — Supabase CLI (requires `supabase login` + `supabase link
--project-ref <ref>` first):

```sh
supabase db push
```

## Files

- `migrations/0001_init.sql` — initial schema + RLS for users,
  bookmarks, playlists, playlist_items, venues, events, youtube_cache,
  and lab_waitlist. RLS keys off Clerk's `auth.jwt() ->> 'sub'`.
- `seeds/` — populated in Phase 4 (Chicago events).

## Verifying RLS after applying

Open the Supabase SQL editor and run as the `anon` role:

```sql
set role anon;
select * from bookmarks;             -- → 0 rows (or filtered to nothing)
insert into lab_waitlist (email) values ('test@example.com');  -- → ok
select * from lab_waitlist;          -- → 0 rows (admin-only read)
reset role;
```
