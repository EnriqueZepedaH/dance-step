-- Decouple playlist_items from bookmarks. Before this migration,
-- removing a bookmark cascaded into playlist_items, so unbookmarking
-- a video also yanked it from every playlist it lived in. Now each
-- playlist_item stores its own video snapshot (youtube_id, title,
-- channel, thumbnail_url), and the FK + cascade to bookmarks is
-- gone. A playlist is an independent collection of videos; bookmarks
-- are a separate personal "saved" list.
--
-- Step 1: add snapshot columns nullable, backfill from bookmarks.
-- Step 2: enforce NOT NULL on the columns the app reads.
-- Step 3: drop bookmark_id (FK + column) and re-key the table on
--         (playlist_id, youtube_id) so the same video can't appear
--         twice in a single playlist.

alter table playlist_items
  add column youtube_id    text,
  add column title         text,
  add column channel       text,
  add column thumbnail_url text;

update playlist_items pi
set
  youtube_id    = b.youtube_id,
  title         = b.title,
  channel       = b.channel,
  thumbnail_url = b.thumbnail_url
from bookmarks b
where pi.bookmark_id = b.id;

alter table playlist_items
  alter column youtube_id set not null,
  alter column title set not null;

alter table playlist_items drop constraint playlist_items_pkey;
alter table playlist_items drop column bookmark_id;
alter table playlist_items add primary key (playlist_id, youtube_id);

-- Position index was defined on (playlist_id, position); it survives
-- the PK swap untouched. No RLS policy changes needed — the policy
-- still gates on playlist ownership.
