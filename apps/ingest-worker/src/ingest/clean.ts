import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dancestep/db";
import type { NormalizedEvent } from "./types.js";
import { geocodeAddress } from "../mapbox/geocode.js";

// Cleaning + venue resolution. Inputs are NormalizedEvent rows from
// raw_events. Outputs are (venueId, neighborhood) pairs that the
// reconcile stage can stamp onto events.
//
// The hot path goes:
//   normalize address → venue_geocode_cache lookup → existing
//   venues row lookup → (if miss) Mapbox geocode + cache write +
//   venues upsert.
//
// Two short-circuits keep the Mapbox call rate near zero in
// steady state:
//   1. LSD events ship lat/lng in their rawPayload (from the
//      Google Maps daddr param) — pass them as coordsHint and we
//      skip Mapbox entirely.
//   2. The cache is keyed on normalizeAddress() output, which is
//      deterministic — duplicate addresses cross-source hit cache.

const SUITE_RE = /\b(\d+(?:st|nd|rd|th))?\s*(suite|ste|apt|unit|fl|floor|#)\s*[\w-]*/gi;
const ZIP_RE = /\b\d{5}(-\d{4})?\b/g;
const PUNCT_RE = /[–—‘’“”·|]/g;

// Common US street-suffix abbreviations expanded to full form so
// "123 W Armitage Ave" and "123 W Armitage Avenue" collapse to the
// same cache key. Add entries here if new sources surface new forms.
const STREET_EXPANSIONS: Array<[RegExp, string]> = [
  [/\bst\b\.?/g, "street"],
  [/\bave\b\.?/g, "avenue"],
  [/\bblvd\b\.?/g, "boulevard"],
  [/\brd\b\.?/g, "road"],
  [/\bdr\b\.?/g, "drive"],
  [/\bln\b\.?/g, "lane"],
  [/\bct\b\.?/g, "court"],
  [/\bpl\b\.?/g, "place"],
  [/\bpkwy\b\.?/g, "parkway"],
  [/\bhwy\b\.?/g, "highway"],
];

export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.trim().toLowerCase();
  s = s.replace(PUNCT_RE, " ");
  s = s.replace(SUITE_RE, " ");
  s = s.replace(ZIP_RE, " ");
  for (const [re, full] of STREET_EXPANSIONS) {
    s = s.replace(re, full);
  }
  s = s.replace(/[^a-z0-9\s,]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Drop a trailing ",state" remnant if it survived.
  s = s.replace(/[,\s]+$/g, "");
  return s;
}

export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(PUNCT_RE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ResolvedVenue = {
  venueId: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
};

export type CoordsHint = { lat: number; lng: number };

// Resolve a NormalizedEvent's venue to a venues.id. Hits the
// geocode cache first; geocodes on miss; upserts the venues row;
// returns the resolved id. Returns null if we can't get
// coordinates (caller will record an 'ungeocodable_venue'
// rejection).
export async function resolveVenue(
  supabase: SupabaseClient<Database>,
  normalized: NormalizedEvent,
  coordsHint?: CoordsHint | null,
): Promise<ResolvedVenue | null> {
  const v = normalized.venue;
  const normAddr = normalizeAddress(v.address ?? v.name);
  const normName = normalizeName(v.name);
  if (!normAddr && !normName) return null;

  // Cache lookup — fastest path. Key is normalized address.
  let lat: number | null = null;
  let lng: number | null = null;
  let neighborhood: string | null = null;
  let placeName: string | null = null;

  if (normAddr) {
    const { data: cached } = await supabase
      .from("venue_geocode_cache")
      .select("lat, lng, neighborhood, place_name")
      .eq("normalized_address", normAddr)
      .maybeSingle();
    if (cached) {
      lat = cached.lat;
      lng = cached.lng;
      neighborhood = cached.neighborhood;
      placeName = cached.place_name;
    }
  }

  // Coord hint short-circuit (e.g. LSD's embedded daddr coords).
  if (lat === null && coordsHint) {
    lat = coordsHint.lat;
    lng = coordsHint.lng;
    if (normAddr) {
      await supabase
        .from("venue_geocode_cache")
        .upsert(
          {
            normalized_address: normAddr,
            lat,
            lng,
            neighborhood: null,
            place_name: v.address ?? v.name,
          },
          { onConflict: "normalized_address" },
        );
    }
  }

  // Mapbox geocode — final fallback.
  if (lat === null) {
    const addressForGeocoder = v.address ?? v.name;
    if (!addressForGeocoder) return null;
    const hit = await geocodeAddress(addressForGeocoder);
    if (!hit) return null;
    lat = hit.lat;
    lng = hit.lng;
    neighborhood = hit.neighborhood;
    placeName = hit.placeName;
    if (normAddr) {
      await supabase
        .from("venue_geocode_cache")
        .upsert(
          {
            normalized_address: normAddr,
            lat,
            lng,
            neighborhood,
            place_name: placeName,
          },
          { onConflict: "normalized_address" },
        );
    }
  }

  if (lat === null || lng === null) return null;

  // Look for an existing venue row keyed on (city, normalized_name,
  // normalized_address). The unique index from migration 0005 lets
  // us upsert with on-conflict to avoid duplicate venues.
  const { data: existing } = await supabase
    .from("venues")
    .select("id, neighborhood")
    .eq("city", v.city)
    .eq("normalized_name", normName)
    .eq("normalized_address", normAddr)
    .maybeSingle();

  if (existing) {
    // Backfill neighborhood if cache learned it after the venue
    // was first inserted with a null one.
    if (!existing.neighborhood && neighborhood) {
      await supabase
        .from("venues")
        .update({ neighborhood })
        .eq("id", existing.id);
    }
    return {
      venueId: existing.id,
      neighborhood: existing.neighborhood ?? neighborhood ?? null,
      lat,
      lng,
    };
  }

  const { data: inserted, error } = await supabase
    .from("venues")
    .insert({
      name: v.name,
      address: v.address ?? null,
      city: v.city,
      country: v.country,
      timezone: v.timezone,
      lat,
      lng,
      neighborhood,
      normalized_name: normName,
      normalized_address: normAddr,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        msg: "venue insert failed",
        error: error?.message ?? "unknown",
        venue: { name: v.name, address: v.address },
      }),
    );
    return null;
  }
  return { venueId: inserted.id, neighborhood, lat, lng };
}
