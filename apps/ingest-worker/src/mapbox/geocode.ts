import { env } from "../env.js";

// Mapbox Geocoding v5. Ported from apps/web/lib/mapbox/geocode.ts
// (the admin route's sync geocoder) with two differences:
//
//   1. Token comes from the worker env (MAPBOX_TOKEN), not from
//      Next's NEXT_PUBLIC_MAPBOX_TOKEN.
//   2. Extracts `neighborhood` from the Mapbox `context` array when
//      present, so clean.ts can populate venues.neighborhood
//      without a follow-up reverse-geocode call. Falls back to
//      `null` when the context doesn't carry one (frequent for
//      bar/club addresses outside core neighborhoods).
//
// Steady-state cache hit rate via venue_geocode_cache is ≥95%, so
// the free-tier 100k/mo quota is not a concern, but we still call
// at most once per unique address per cron run.

export type GeocodeHit = {
  lat: number;
  lng: number;
  placeName: string;
  neighborhood: string | null;
};

type MapboxContext = { id?: string; text?: string };
type MapboxFeature = {
  center?: [number, number];
  place_name?: string;
  context?: MapboxContext[];
};
type MapboxResponse = { features?: MapboxFeature[] };

export async function geocodeAddress(
  address: string,
): Promise<GeocodeHit | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(address)}.json` +
    `?limit=1&access_token=${encodeURIComponent(env.MAPBOX_TOKEN)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        msg: "mapbox geocode failed",
        status: res.status,
        body: await res.text().catch(() => ""),
      }),
    );
    return null;
  }

  const body = (await res.json()) as MapboxResponse;
  const top = body.features?.[0];
  if (!top?.center) return null;

  const [lng, lat] = top.center;
  return {
    lat,
    lng,
    placeName: top.place_name ?? address,
    neighborhood: extractNeighborhood(top.context),
  };
}

// Mapbox context entries are typed by their `id` prefix:
// "neighborhood.<num>", "locality.<num>", "place.<num>", etc.
// Prefer neighborhood; fall back to locality (which is sometimes
// what carries Chicago neighborhood names in their dataset).
function extractNeighborhood(ctx: MapboxContext[] | undefined): string | null {
  if (!ctx) return null;
  const neighborhood = ctx.find((c) => c.id?.startsWith("neighborhood."));
  if (neighborhood?.text) return neighborhood.text;
  const locality = ctx.find((c) => c.id?.startsWith("locality."));
  if (locality?.text) return locality.text;
  return null;
}
