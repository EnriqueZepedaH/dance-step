-- Forbid a single user from owning two playlists with the same name.
-- Different users can still share names (matching their own libraries
-- against each other isn't a thing in v1). Comparison is
-- case-insensitive: "Drills" and "drills" collide.
--
-- Step 1: dedupe any duplicates that already exist by appending
-- " (N)" to the newer ones. The oldest one (lowest created_at) keeps
-- the original name; subsequent duplicates get suffixed in created_at
-- order. updated_at is bumped so the modified-recent sort still puts
-- the renamed rows where users would expect them.
--
-- Step 2: add the unique index. Using a functional index on
-- (user_id, lower(name)) so case-only differences also collide.

update playlists p
set
  name = p.name || ' (' || sub.rn || ')',
  updated_at = now()
from (
  select
    id,
    row_number() over (
      partition by user_id, lower(name)
      order by created_at, id
    ) as rn
  from playlists
) sub
where p.id = sub.id and sub.rn > 1;

create unique index playlists_user_name_unique
  on playlists (user_id, lower(name));
