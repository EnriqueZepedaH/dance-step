import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { geocodeVenue } from "@/lib/mapbox/geocode";
import { isValidIanaTimezone, localToUtcIso } from "@/lib/time/local";
import type { TablesUpdate } from "@/lib/db/types";

// Admin events CRUD. Auth is gated by proxy.ts; admin role is
// re-checked here for defense in depth (the layout's check is the
// primary gate, but a direct API hit must not bypass it). RLS on
// events/venues also enforces admin role at the DB layer.
//
// As of migration 0006 this route also accepts flyer-extraction
// fields: flyerExtractionId references a completed flyer_extractions
// row; fieldsEdited captures which admin-edited fields diverged from
// the raw model output. Both feed the observability columns the
// admin form sets up in Phase 7.

const DEFAULT_TZ = "America/Chicago";
const DEFAULT_COUNTRY = "US";
const DEFAULT_CITY = "Chicago";

type CreateBody = {
  title?: string;
  startsAt?: string;       // datetime-local: "YYYY-MM-DDTHH:mm"
  endsAt?: string | null;
  kind?: string | null;
  description?: string | null;
  url?: string | null;
  venueId?: string | null;
  newVenue?: {
    name: string;
    address: string;
    city?: string;
    country?: string;
    timezone?: string;
    lat?: number;
    lng?: number;
  } | null;
  city?: string;
  country?: string;
  timezone?: string;
  flyerExtractionId?: string;
  fieldsEdited?: string[];
};

type PatchBody = {
  id?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  kind?: string | null;
  description?: string | null;
  url?: string | null;
  venueId?: string | null;
};

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.title || !body.startsAt) {
    return NextResponse.json(
      { error: "title and startsAt are required" },
      { status: 400 },
    );
  }

  const city = body.city?.trim() || DEFAULT_CITY;
  const country = body.country?.trim().toUpperCase() || DEFAULT_COUNTRY;
  const timezone = body.timezone?.trim() || DEFAULT_TZ;
  if (!isValidIanaTimezone(timezone)) {
    return NextResponse.json(
      { error: `invalid timezone: ${timezone}` },
      { status: 400 },
    );
  }
  if (country.length !== 2) {
    return NextResponse.json(
      { error: "country must be ISO 3166-1 alpha-2" },
      { status: 400 },
    );
  }

  // Resolve flyer extraction (if any) via the service-role client —
  // flyer_extractions is RLS-policy-less, service-role only. The
  // storage_path comes from the DB, never the client.
  let flyerStoragePath: string | null = null;
  if (body.flyerExtractionId) {
    const admin = getSupabaseAdminClient();
    const { data: extraction, error: lookupErr } = await admin
      .from("flyer_extractions")
      .select("status, storage_path")
      .eq("id", body.flyerExtractionId)
      .maybeSingle();
    if (lookupErr) {
      console.error("flyer_extractions lookup failed", lookupErr);
      return NextResponse.json(
        { error: "flyer lookup failed" },
        { status: 500 },
      );
    }
    if (!extraction) {
      return NextResponse.json(
        { error: "flyerExtractionId not found" },
        { status: 400 },
      );
    }
    if (extraction.status !== "completed") {
      return NextResponse.json(
        { error: `flyer extraction is ${extraction.status}, not completed` },
        { status: 400 },
      );
    }
    flyerStoragePath = extraction.storage_path;
  }

  const supabase = await createSupabaseServerClient();

  // Resolve venue: existing id, or create a new one with geocoding.
  let venueId = body.venueId ?? null;
  if (!venueId && body.newVenue) {
    const { name, address } = body.newVenue;
    if (!name || !address) {
      return NextResponse.json(
        { error: "newVenue requires name and address" },
        { status: 400 },
      );
    }
    // Manual-coordinates escape hatch: when the form supplied valid
    // lat/lng, skip the geocoder entirely and use them. Mapbox's POI
    // database has gaps (especially in Latin America); the admin can
    // paste coords from Google Maps to bypass.
    const manualLat = body.newVenue.lat;
    const manualLng = body.newVenue.lng;
    const manualValid =
      typeof manualLat === "number" &&
      typeof manualLng === "number" &&
      Number.isFinite(manualLat) &&
      Number.isFinite(manualLng) &&
      manualLat >= -90 &&
      manualLat <= 90 &&
      manualLng >= -180 &&
      manualLng <= 180;

    let hit: { lat: number; lng: number; precision: "address" | "city" | "manual" } | null;
    if (manualValid) {
      hit = { lat: manualLat, lng: manualLng, precision: "manual" };
    } else {
      const geo = await geocodeVenue({
        name,
        address,
        city: body.newVenue.city?.trim() || city,
        country: (body.newVenue.country || country).toUpperCase(),
      });
      hit = geo ? { ...geo, precision: geo.precision } : null;
    }
    if (!hit) {
      return NextResponse.json(
        {
          error: `Could not find "${name}" or "${address}" on the map. Try simplifying the address, use just the city + country, or paste coordinates from Google Maps.`,
        },
        { status: 422 },
      );
    }
    if (hit.precision === "city") {
      console.warn(
        `venue "${name}" geocoded only to city precision — pin at city center`,
      );
    }
    // Widened in 0006-era: persist city/country/timezone on the venue
    // when supplied, otherwise let column defaults (Chicago/US/...) win.
    const venueInsert: {
      name: string;
      address: string;
      lat: number;
      lng: number;
      city?: string;
      country?: string;
      timezone?: string;
    } = {
      name,
      address,
      lat: hit.lat,
      lng: hit.lng,
    };
    if (body.newVenue.city) venueInsert.city = body.newVenue.city;
    if (body.newVenue.country) {
      venueInsert.country = body.newVenue.country.toUpperCase();
    }
    if (body.newVenue.timezone) venueInsert.timezone = body.newVenue.timezone;

    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert(venueInsert)
      .select()
      .single();
    if (venueError) {
      console.error("venue insert failed", venueError);
      return NextResponse.json({ error: "venue create failed" }, { status: 500 });
    }
    venueId = venue.id;
  }

  if (!venueId) {
    return NextResponse.json(
      { error: "venueId or newVenue is required" },
      { status: 400 },
    );
  }

  const startsAtIso = localToUtcIso(body.startsAt, timezone);
  const endsAtIso = body.endsAt ? localToUtcIso(body.endsAt, timezone) : null;

  const { data, error } = await supabase
    .from("events")
    .insert({
      title: body.title,
      venue_id: venueId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      kind: body.kind ?? null,
      description: body.description ?? null,
      url: body.url ?? null,
      created_by: guard.userId,
      city,
      country,
      timezone,
      flyer_storage_path: flyerStoragePath,
      flyer_extraction_id: body.flyerExtractionId ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("event insert failed", error);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }

  // Best-effort observability finalization. We don't want a botched
  // audit update to 500 the already-created event — log and move on.
  if (body.flyerExtractionId) {
    const admin = getSupabaseAdminClient();
    const finalizedPayload = {
      id: data.id,
      title: body.title,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      kind: body.kind ?? null,
      description: body.description ?? null,
      url: body.url ?? null,
      city,
      country,
      timezone,
      venueId,
    };
    const { error: finalizeErr } = await admin
      .from("flyer_extractions")
      .update({
        finalized_event_id: data.id,
        fields_edited: body.fieldsEdited ?? [],
        finalized_payload: finalizedPayload,
      })
      .eq("id", body.flyerExtractionId);
    if (finalizeErr) {
      console.error(
        "flyer_extractions finalize failed (event created OK)",
        finalizeErr,
      );
    }
  }

  return NextResponse.json({ event: data });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the event's existing timezone so we can interpret incoming
  // datetime-local strings correctly even when the PATCH body doesn't
  // include a tz field (which is the common admin-edit path today).
  let eventTimezone = DEFAULT_TZ;
  if (typeof body.startsAt === "string" || body.endsAt !== undefined) {
    const { data: existing, error: lookupErr } = await supabase
      .from("events")
      .select("timezone")
      .eq("id", body.id)
      .maybeSingle();
    if (lookupErr) {
      console.error("event lookup failed", lookupErr);
      return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }
    if (existing?.timezone) eventTimezone = existing.timezone;
  }

  const update: TablesUpdate<"events"> = {};
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.startsAt === "string") {
    update.starts_at = localToUtcIso(body.startsAt, eventTimezone);
  }
  if (body.endsAt !== undefined) {
    update.ends_at = body.endsAt
      ? localToUtcIso(body.endsAt, eventTimezone)
      : null;
  }
  if (body.kind !== undefined) update.kind = body.kind;
  if (body.description !== undefined) update.description = body.description;
  if (body.url !== undefined) update.url = body.url;
  if (body.venueId !== undefined) update.venue_id = body.venueId;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("events")
    .update(update)
    .eq("id", body.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("event update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ event: data });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("event delete failed", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
