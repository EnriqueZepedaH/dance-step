import "server-only";
import { env } from "@/lib/env";

// Server-side wrapper around Mapbox Geocoding v5. Used by the admin
// events handler when an admin creates a brand-new venue from the form
// or from flyer extraction.
//
// Mapbox handles multi-part free-form queries well, so we build a
// richer query from venue name + street address + city + country
// rather than passing just one field. Mapbox's POI database is weaker
// than Google's in Latin America, so omitting context like "city,
// country" makes lookups for places like "Parque 3 Centurias" fail
// even when they're known POIs. A two-tier fallback (full → just
// "city, country") guarantees we always return SOME pin if the
// city itself geocodes, so an unknown venue address lands at city
// center rather than failing the entire event create.
//
// `precision` lets callers know whether the pin is street-accurate
// or only city-accurate; logging it helps admins decide whether to
// hand-correct the address later.

export type GeocodeInput = {
  name?: string | null;
  address?: string | null;
  city: string;
  country: string;
};

export type GeocodeHit = {
  lat: number;
  lng: number;
  placeName: string;
  precision: "address" | "city";
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

// Build a comma-joined query from name + address + city + country.
// Drops one of name/address when one is contained in the other after
// normalization — avoids sending "Parque 3 Centurias, Parque 3 Centurias,
// Aguascalientes, Mexico" which confuses the geocoder more than it helps.
function buildQuery(input: GeocodeInput): string {
  const parts: string[] = [];
  const name = input.name?.trim() || null;
  const address = input.address?.trim() || null;

  if (name && address) {
    const nN = normalize(name);
    const nA = normalize(address);
    if (nA.includes(nN) || nN.includes(nA)) {
      parts.push(address.length >= name.length ? address : name);
    } else {
      parts.push(name, address);
    }
  } else if (name) {
    parts.push(name);
  } else if (address) {
    parts.push(address);
  }

  parts.push(input.city, input.country);
  return parts.join(", ");
}

async function lookup(query: string): Promise<{ lat: number; lng: number; placeName: string } | null> {
  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    throw new Error(
      "NEXT_PUBLIC_MAPBOX_TOKEN is required for venue geocoding",
    );
  }

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
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
  return { lat, lng, placeName: top.place_name ?? query };
}

export async function geocodeVenue(
  input: GeocodeInput,
): Promise<GeocodeHit | null> {
  const fullQuery = buildQuery(input);
  const exact = await lookup(fullQuery);
  if (exact) return { ...exact, precision: "address" };

  // Fallback: drop the venue/address detail and pin at city center.
  const cityOnly = `${input.city}, ${input.country}`;
  if (cityOnly === fullQuery) return null;
  const cityHit = await lookup(cityOnly);
  if (cityHit) {
    console.warn(
      `geocode fell back to city for "${fullQuery}" → "${cityOnly}"`,
    );
    return { ...cityHit, precision: "city" };
  }

  return null;
}
