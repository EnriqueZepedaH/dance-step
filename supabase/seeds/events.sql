-- supabase/seeds/events.sql
--
-- Seeds 6 Chicago venues + 12 weekly recurring events expanded across
-- 8 weeks (~96 event rows). v1 has no recurrence parser, so we
-- materialize each occurrence as its own row.
--
-- Apply via the Supabase MCP `execute_sql` tool, or psql:
--   psql "$DATABASE_URL" -f supabase/seeds/events.sql
--
-- Re-running creates duplicate event rows (no unique constraint).
-- For a clean re-seed, run `delete from events;` first.

insert into venues (name, address, neighborhood, lat, lng) values
  ('Logan Square Hall',     '2620 N Kedzie Blvd, Chicago, IL',   'Logan Square', 41.928, -87.708),
  ('Pilsen Social Club',    '1733 W 18th St, Chicago, IL',       'Pilsen',       41.857, -87.668),
  ('West Loop Lounge',      '1100 W Randolph St, Chicago, IL',   'West Loop',    41.884, -87.652),
  ('Lincoln Park Pavilion', '2400 N Stockton Dr, Chicago, IL',   'Lincoln Park', 41.926, -87.643),
  ('Wicker Park Studio',    '1500 N Damen Ave, Chicago, IL',     'Wicker Park',  41.908, -87.677),
  ('Hyde Park Cafe',        '5300 S Lake Shore Dr, Chicago, IL', 'Hyde Park',    41.794, -87.589)
on conflict do nothing;

-- 12 event templates × 8 weekly occurrences = 96 rows. Times are
-- expressed as Chicago wall clock and converted to UTC by the
-- AT TIME ZONE 'America/Chicago' cast — Postgres stores timestamptz
-- internally as UTC.
with templates(title, venue_name, dow, hour_of_day, minute_of_day, duration_hours, kind, description) as (
  values
    ('Salsa con Sabor',         'Logan Square Hall',     'Wed', 21, 0, 3, 'social',   'Weekly Cuban Casino night with live DJ.'),
    ('Rueda en el Parque',      'Lincoln Park Pavilion', 'Sat', 18, 0, 2, 'social',   'Outdoor rueda meetup, beginners welcome.'),
    ('La Havana Social',        'West Loop Lounge',      'Fri', 22, 0, 4, 'social',   'Late-night Cuban casino social with DJ Carlos.'),
    ('Pilsen Casino Night',     'Pilsen Social Club',    'Thu', 20, 0, 3, 'social',   'Mid-week social, all levels welcome.'),
    ('Wicker Park Drills',      'Wicker Park Studio',    'Tue', 19, 0, 2, 'class',    'Footwork and turn drills, intermediate.'),
    ('Hyde Park Sunday Social', 'Hyde Park Cafe',        'Sun', 19, 0, 3, 'social',   'Relaxed Sunday social with cafecito.'),
    ('Logan Square Beginner',   'Logan Square Hall',     'Mon', 19, 0, 1, 'class',    'Absolute beginner Cuban Casino class.'),
    ('West Loop Late Show',     'West Loop Lounge',      'Sat', 23, 0, 3, 'social',   'After-hours social for the night owls.'),
    ('Lincoln Park Practica',   'Lincoln Park Pavilion', 'Wed', 20, 0, 2, 'practica', 'Open practica, bring questions.'),
    ('Pilsen Festival Friday',  'Pilsen Social Club',    'Fri', 21, 0, 4, 'social',   'Live timba band on the floor.'),
    ('Wicker Park Performance', 'Wicker Park Studio',    'Thu', 21, 0, 2, 'class',    'Performance team open rehearsal.'),
    ('Hyde Park Friday Night',  'Hyde Park Cafe',        'Fri', 20, 0, 3, 'social',   'Friday night Cuban casino, all levels.')
),
dow_map(name, offset_days) as (
  values ('Mon', 0), ('Tue', 1), ('Wed', 2), ('Thu', 3), ('Fri', 4), ('Sat', 5), ('Sun', 6)
),
base as (
  -- Anchor the first occurrence at the Monday of the week containing 2026-05-04.
  select '2026-05-04'::date as week_start
)
insert into events (title, venue_id, starts_at, ends_at, kind, description, recurrence)
select
  t.title,
  v.id,
  ((base.week_start + (d.offset_days || ' days')::interval +
    make_interval(hours => t.hour_of_day, mins => t.minute_of_day))
    at time zone 'America/Chicago')
    + (n.week_n * interval '7 days'),
  ((base.week_start + (d.offset_days || ' days')::interval +
    make_interval(hours => t.hour_of_day, mins => t.minute_of_day))
    at time zone 'America/Chicago')
    + (n.week_n * interval '7 days')
    + make_interval(hours => t.duration_hours),
  t.kind,
  t.description,
  'weekly'
from templates t
join dow_map d on d.name = t.dow
join venues v on v.name = t.venue_name
cross join base
cross join generate_series(0, 7) as n(week_n);
