-- Public flyer opt-in for events created from the admin flyer-
-- extraction flow. Default false: an admin must explicitly choose
-- to surface the flyer on the public event detail page. Existing
-- events have no flyer, so the default is irrelevant for backfill.
--
-- /scene/events/[id] reads flyer_public alongside flyer_storage_path
-- and mints a 1h signed URL via the service-role client to render the
-- image — the bucket stays private and signed URLs are the only path
-- through which the bytes are exposed.

alter table events
  add column flyer_public boolean not null default false;
