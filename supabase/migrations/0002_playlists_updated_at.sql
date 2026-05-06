-- supabase/migrations/0002_playlists_updated_at.sql
--
-- Adds an updated_at timestamp on playlists so the UI can sort by
-- 'most recently modified' / 'oldest modified'. Two triggers keep the
-- column honest:
--
--   1. BEFORE UPDATE on playlists — set updated_at = now() so renames
--      and description edits register.
--   2. AFTER INSERT/DELETE on playlist_items — bump the parent
--      playlist's updated_at so adding or removing videos counts as
--      'modifying the playlist'. Without this, only renames would
--      move a playlist's modified-time, which makes the sort useless
--      in practice.
--
-- Backfill existing rows by setting updated_at = created_at (no later
-- activity has happened on those rows yet, so this is accurate).

alter table playlists
  add column updated_at timestamptz not null default now();

create or replace function set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger playlists_set_updated_at
  before update on playlists
  for each row execute function set_updated_at();

create or replace function bump_parent_playlist_updated_at()
returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE') then
    update playlists set updated_at = now() where id = old.playlist_id;
    return old;
  else
    update playlists set updated_at = now() where id = new.playlist_id;
    return new;
  end if;
end;
$$;

create trigger playlist_items_bump_parent
  after insert or delete on playlist_items
  for each row execute function bump_parent_playlist_updated_at();

update playlists set updated_at = created_at;
