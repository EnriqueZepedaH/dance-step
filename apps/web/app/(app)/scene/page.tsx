import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SceneShell, type SceneEvent } from "@/components/scene/SceneShell";
import { env } from "@/lib/env";
import { chicagoCurrentMonth, isValidMonthKey } from "@/lib/scene/dates";

// Server-fetches every published event in the future, plus the
// joined venue. SceneShell does the filter + view switching on the
// client. Window is the worker's 8-week materialization horizon —
// past_date / out_of_window are quality-gated upstream.

const WINDOW_DAYS = 56;

type Row = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  kind: string | null;
  source: string | null;
  source_url: string | null;
  timezone: string;
  venues: {
    id: string;
    name: string;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    timezone: string;
  } | null;
};

type ScenePageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
    month?: string;
  }>;
};

export default async function ScenePage({ searchParams }: ScenePageProps) {
  const sp = await searchParams;
  const initialMonth = isValidMonthKey(sp.month)
    ? sp.month
    : chicagoCurrentMonth();

  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const horizonIso = new Date(
    now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const nowIso = now.toISOString();

  const [{ data: events, error }, { data: sources }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, description, starts_at, ends_at, kind, source, source_url, timezone, venues(id, name, neighborhood, lat, lng, timezone)",
      )
      .eq("status", "published")
      .gte("starts_at", nowIso)
      .lte("starts_at", horizonIso)
      .order("starts_at", { ascending: true }),
    supabase.from("event_sources").select("key, display_name"),
  ]);

  if (error) console.error("scene events query failed", error);

  const sourceNames: Record<string, string> = {};
  for (const s of sources ?? []) sourceNames[s.key] = s.display_name;

  const rows = (events ?? []) as unknown as Row[];

  const cleaned: SceneEvent[] = rows
    .filter(
      (r): r is Row & { venues: NonNullable<Row["venues"]> & { lat: number; lng: number } } =>
        !!r.venues && r.venues.lat !== null && r.venues.lng !== null,
    )
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      startsUtc: r.starts_at,
      endsUtc: r.ends_at,
      kind: r.kind,
      source: r.source,
      sourceUrl: r.source_url,
      timezone: r.timezone,
      venue: {
        id: r.venues.id,
        name: r.venues.name,
        neighborhood: r.venues.neighborhood,
        lat: r.venues.lat,
        lng: r.venues.lng,
        timezone: r.venues.timezone,
      },
    }));

  return (
    <section className="scene-page">
      <header className="scene-header">
        <span className="eyebrow bullet">The Scene · Chicago</span>
        <h1 className="display">Where the floor is tonight.</h1>
        <p className="lede">
          {cleaned.length} upcoming socials, classes, and rueda nights — filter
          by kind, neighborhood, or when. Click any event to add it to your
          calendar.
        </p>
      </header>

      <SceneShell
        events={cleaned}
        sourceNames={sourceNames}
        mapboxToken={env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialMonth={initialMonth}
      />
    </section>
  );
}
