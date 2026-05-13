import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createHash } from "node:crypto";

// Promote-anyway: bypass the worker's quality gates and force a
// rejected raw_event into events. Cleared up by the admin
// /admin/scene/rejections page.
//
// V1 scope: requires that a venue already exists in the venues
// table matching the rejected event's normalized name + address.
// The worker's resolveVenue lives in apps/ingest-worker/, not in
// the web app, and the geocoder is URL-restricted to browser
// origins — server-side promote can't safely call Mapbox here.
// If no matching venue exists, return 422 telling the admin to
// create it via /admin/events first.
//
// Sets:
//   events.status = 'published', source = raw.source,
//   source_event_id = raw.source_event_id, content_hash from raw
//   raw_events.outcome = 'inserted', promoted_event_id = new id
//   quality_rejections.resolved = true, resolved_by, resolved_at

type Normalized = {
  title: string;
  description?: string | null;
  startsUtc: string;
  endsUtc?: string | null;
  recurrenceRule?: string | null;
  venue: {
    name: string;
    address?: string | null;
    city: string;
    country: string;
    timezone: string;
  };
  sourceUrl?: string | null;
  kind?: string | null;
};

function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;
  const admin = getSupabaseAdminClient();

  const { data: rejection } = await admin
    .from("quality_rejections")
    .select("id, raw_event_id, resolved")
    .eq("id", id)
    .maybeSingle();
  if (!rejection) {
    return NextResponse.json({ error: "rejection not found" }, { status: 404 });
  }
  if (rejection.resolved) {
    return NextResponse.json({ error: "already resolved" }, { status: 409 });
  }

  const { data: raw } = await admin
    .from("raw_events")
    .select("*")
    .eq("id", rejection.raw_event_id)
    .single();
  if (!raw) {
    return NextResponse.json({ error: "raw_event missing" }, { status: 404 });
  }

  const normalized = raw.normalized as unknown as Normalized;
  const { data: venue } = await admin
    .from("venues")
    .select("id")
    .eq("city", normalized.venue.city)
    .eq("normalized_name", normalizeName(normalized.venue.name))
    .eq("normalized_address", normalizeAddress(normalized.venue.address ?? normalized.venue.name))
    .maybeSingle();

  if (!venue) {
    return NextResponse.json(
      {
        error:
          "no matching venue exists. Create it via /admin/events/new (the form will geocode), then promote again.",
        venue: normalized.venue,
      },
      { status: 422 },
    );
  }

  const contentHash =
    raw.content_hash ||
    createHash("sha256").update(JSON.stringify(normalized)).digest("hex");

  // Upsert into events keyed on (source, source_event_id) so a
  // re-promote of an already-promoted row updates instead of
  // dup-inserting.
  const { data: existing } = await admin
    .from("events")
    .select("id, status")
    .eq("source", raw.source)
    .eq("source_event_id", raw.source_event_id)
    .maybeSingle();

  let eventId: string;
  if (existing) {
    await admin
      .from("events")
      .update({
        status: "published",
        title: normalized.title,
        description: normalized.description ?? null,
        starts_at: normalized.startsUtc,
        ends_at: normalized.endsUtc ?? null,
        venue_id: venue.id,
        url: normalized.sourceUrl ?? null,
        source_url: normalized.sourceUrl ?? null,
        kind: normalized.kind ?? null,
        content_hash: contentHash,
        last_seen_at: new Date().toISOString(),
        missing_run_count: 0,
      })
      .eq("id", existing.id);
    eventId = existing.id;
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("events")
      .insert({
        title: normalized.title,
        description: normalized.description ?? null,
        starts_at: normalized.startsUtc,
        ends_at: normalized.endsUtc ?? null,
        venue_id: venue.id,
        url: normalized.sourceUrl ?? null,
        source_url: normalized.sourceUrl ?? null,
        kind: normalized.kind ?? null,
        source: raw.source,
        source_event_id: raw.source_event_id,
        content_hash: contentHash,
        last_seen_at: new Date().toISOString(),
        missing_run_count: 0,
        status: "published",
        city: normalized.venue.city,
        timezone: normalized.venue.timezone,
        created_by: null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return NextResponse.json(
        { error: insErr?.message ?? "insert failed" },
        { status: 500 },
      );
    }
    eventId = inserted.id;
  }

  await Promise.all([
    admin
      .from("quality_rejections")
      .update({
        resolved: true,
        resolved_by: guard.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", rejection.id),
    admin
      .from("raw_events")
      .update({
        outcome: "inserted",
        outcome_detail: "promoted by admin",
        processed: true,
        promoted_event_id: eventId,
      })
      .eq("id", raw.id),
  ]);

  return NextResponse.json({ ok: true, eventId });
}
