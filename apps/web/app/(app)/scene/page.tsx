import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventsMap, type VenueWithEvents } from "@/components/scene/EventsMap";
import { env } from "@/lib/env";

// Server-fetches venues plus their upcoming events as a nested
// resource. Filtering "future events" is done in JS rather than at
// the DB level — supabase-js's nested filters are awkward, and the
// payload is small (~6 venues × N events). RLS on venues + events
// is public-select, so anon visitors get the full map.

type EventLite = {
  id: string;
  title: string;
  starts_at: string;
  kind: string | null;
};
type VenueRow = {
  id: string;
  name: string;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  events: EventLite[] | null;
};

export default async function ScenePage() {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  // Filter events at the DB level: only published events with
  // future start times. The previous "select all events then
  // filter in JS" worked when there was just admin-seeded data
  // (~96 rows); after migration 0005 the worker can promote
  // hundreds of events per venue, and pulling them all just to
  // drop the past ones is wasteful.
  const { data, error } = await supabase
    .from("venues")
    .select(
      "id, name, neighborhood, lat, lng, events!inner(id, title, starts_at, kind)",
    )
    .eq("events.status", "published")
    .gte("events.starts_at", nowIso)
    .order("name", { ascending: true });

  if (error) console.error("scene venues query failed", error);

  const rows = (data ?? []) as unknown as VenueRow[];

  const venues: VenueWithEvents[] = rows
    .filter(
      (v): v is VenueRow & { lat: number; lng: number } =>
        v.lat !== null && v.lng !== null,
    )
    .map((v) => ({
      id: v.id,
      name: v.name,
      neighborhood: v.neighborhood,
      lat: v.lat,
      lng: v.lng,
      events: (v.events ?? [])
        .slice()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    }))
    .filter((v) => v.events.length > 0);

  return (
    <section className="scene-page">
      <header className="scene-header">
        <span className="eyebrow bullet">The Scene · Chicago</span>
        <h1 className="display">Where the floor is tonight.</h1>
        <p className="lede">
          Click a pin to see the next few socials, classes, and rueda
          nights at that venue.
        </p>
      </header>

      <EventsMap venues={venues} mapboxToken={env.NEXT_PUBLIC_MAPBOX_TOKEN} />
    </section>
  );
}
