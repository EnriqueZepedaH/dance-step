// Stateless geocode probe for the admin event form. The "new venue"
// flow needs a way to verify Mapbox can resolve an address BEFORE the
// admin commits the whole form — otherwise a single geocode miss
// burns the admin's current state (or tempts them to re-extract the
// flyer, which costs another Anthropic call).
//
// This endpoint runs the same geocodeVenue() helper the events route
// uses on insert, so a success here guarantees the eventual submit
// will also resolve. No DB writes.

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { geocodeVenue } from "@/lib/mapbox/geocode";

type Body = {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
};

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as Body;
  const name = body.name?.trim() || null;
  const address = body.address?.trim() || null;
  const city = body.city?.trim();
  const country = body.country?.trim().toUpperCase();

  if (!city || !country) {
    return NextResponse.json(
      { error: "city and country are required" },
      { status: 400 },
    );
  }
  if (country.length !== 2) {
    return NextResponse.json(
      { error: "country must be ISO 3166-1 alpha-2 (e.g. US, MX)" },
      { status: 400 },
    );
  }
  if (!name && !address) {
    return NextResponse.json(
      { error: "name or address is required" },
      { status: 400 },
    );
  }

  const hit = await geocodeVenue({ name, address, city, country });
  if (!hit) {
    return NextResponse.json(
      {
        error: `Could not find "${name ?? address}" near ${city}, ${country}. Try simplifying the address.`,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(hit);
}
