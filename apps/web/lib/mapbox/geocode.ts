import "server-only";
import { env } from "@/lib/env";

// Server-side wrapper around Mapbox Geocoding v5. Used by the admin
// events handler when an admin creates a brand-new venue: the form
// submits a free-form address, and we geocode once at write time so
// the public Scene map gets accurate pins without runtime geocoding.
//
// Returns null on miss so callers can decide whether to require lat/
// lng or accept a venue with unresolved coordinates (we choose to
// reject — the map needs a real point).

export type GeocodeHit = { lat: number; lng: number; placeName: string };

export async function geocodeAddress(
  address: string,
): Promise<GeocodeHit | null> {
  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    throw new Error(
      "NEXT_PUBLIC_MAPBOX_TOKEN is required for venue geocoding",
    );
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(address)}.json` +
    `?limit=1&access_token=${encodeURIComponent(env.NEXT_PUBLIC_MAPBOX_TOKEN)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error("mapbox geocode failed", res.status, await res.text());
    return null;
  }

  const body = (await res.json()) as {
    features?: { center?: [number, number]; place_name?: string }[];
  };
  const top = body.features?.[0];
  if (!top?.center) return null;

  const [lng, lat] = top.center;
  return { lat, lng, placeName: top.place_name ?? address };
}
