import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventsMap, type VenueWithEvents } from "@/components/scene/EventsMap";
import { env } from "@/lib/env";

// Server-fetches venues plus their upcoming events as a nested
// resource. Filtering "future events" is done in JS rather than at
// the DB level — supabase-js's nested filters are awkward, and the
// payload is small (~6 venues × N events). RLS on venues + events
// is public-select, so anon visitors get the full map.

export default async function ScenePage() {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("venues")
    .select(
      "id, name, neighborhood, lat, lng, events(id, title, starts_at, kind)",
    )
    .order("name", { ascending: true });

  if (error) console.error("scene venues query failed", error);

  const venues: VenueWithEvents[] = (data ?? [])
    .filter(
      (v): v is typeof v & { lat: number; lng: number } =>
        v.lat !== null && v.lng !== null,
    )
    .map((v) => ({
      id: v.id,
      name: v.name,
      neighborhood: v.neighborhood,
      lat: v.lat,
      lng: v.lng,
      events: (v.events ?? [])
        .filter((e) => e.starts_at >= nowIso)
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
