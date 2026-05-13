import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createHash } from "node:crypto";

// Resolve a cross_source_dup rejection. Two actions:
//
//   merge   — keep the existing event; just mark the rejection
//             resolved. The duplicate raw_event already carries
//             outcome='duplicate' so this is purely a workflow
//             close.
//
//   replace — archive the existing event (status='archived') and
//             promote the duplicate candidate in its place. The
//             new row inherits the duplicate's source/source_event_id
//             so future cron ticks heartbeat it correctly.
//
// Both actions require the rejection to still be unresolved.

type Body = { action?: "merge" | "replace" };

type Normalized = {
  title: string;
  description?: string | null;
  startsUtc: string;
  endsUtc?: string | null;
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
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.action !== "merge" && body.action !== "replace") {
    return NextResponse.json(
      { error: "action must be 'merge' or 'replace'" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  const { data: rejection } = await admin
    .from("quality_rejections")
    .select(
      "id, resolved, duplicate_of, raw_event_id, reason_code, raw_events(source, source_event_id, normalized, content_hash)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!rejection) {
    return NextResponse.json({ error: "rejection not found" }, { status: 404 });
  }
  if (rejection.resolved) {
    return NextResponse.json({ error: "already resolved" }, { status: 409 });
  }
  if (rejection.reason_code !== "cross_source_dup") {
    return NextResponse.json(
      { error: "use /promote on non-duplicate rejections" },
      { status: 400 },
    );
  }

  const raw = rejection.raw_events as unknown as {
    source: string;
    source_event_id: string;
    normalized: Normalized;
    content_hash: string;
  } | null;
  if (!raw) {
    return NextResponse.json({ error: "raw_event missing" }, { status: 404 });
  }

  if (body.action === "merge") {
    await admin
      .from("quality_rejections")
      .update({
        resolved: true,
        resolved_by: guard.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", rejection.id);
    return NextResponse.json({ ok: true, action: "merge" });
  }

  // replace: archive existing, promote candidate.
  if (!rejection.duplicate_of) {
    return NextResponse.json(
      { error: "duplicate_of is missing — can't replace without a target" },
      { status: 422 },
    );
  }

  // Look up the candidate's venue. Same constraint as the
  // /promote endpoint: requires the venue to already exist (admin
  // creates new venues via /admin/events/new with sync geocoding).
  const { data: venue } = await admin
    .from("venues")
    .select("id")
    .eq("city", raw.normalized.venue.city)
    .eq("normalized_name", normalizeName(raw.normalized.venue.name))
    .eq(
      "normalized_address",
      normalizeAddress(raw.normalized.venue.address ?? raw.normalized.venue.name),
    )
    .maybeSingle();
  if (!venue) {
    return NextResponse.json(
      {
        error:
          "candidate venue not in DB; create it via /admin/events/new first.",
        venue: raw.normalized.venue,
      },
      { status: 422 },
    );
  }

  await admin
    .from("events")
    .update({ status: "archived" })
    .eq("id", rejection.duplicate_of);

  const contentHash =
    raw.content_hash ||
    createHash("sha256").update(JSON.stringify(raw.normalized)).digest("hex");

  const { data: existing } = await admin
    .from("events")
    .select("id")
    .eq("source", raw.source)
    .eq("source_event_id", raw.source_event_id)
    .maybeSingle();

  let eventId: string;
  if (existing) {
    await admin
      .from("events")
      .update({
        status: "published",
        venue_id: venue.id,
        title: raw.normalized.title,
        starts_at: raw.normalized.startsUtc,
        ends_at: raw.normalized.endsUtc ?? null,
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
        title: raw.normalized.title,
        description: raw.normalized.description ?? null,
        starts_at: raw.normalized.startsUtc,
        ends_at: raw.normalized.endsUtc ?? null,
        venue_id: venue.id,
        url: raw.normalized.sourceUrl ?? null,
        source_url: raw.normalized.sourceUrl ?? null,
        kind: raw.normalized.kind ?? null,
        source: raw.source,
        source_event_id: raw.source_event_id,
        content_hash: contentHash,
        last_seen_at: new Date().toISOString(),
        missing_run_count: 0,
        status: "published",
        city: raw.normalized.venue.city,
        timezone: raw.normalized.venue.timezone,
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
        outcome_detail: `admin replaced ${rejection.duplicate_of}`,
        processed: true,
        promoted_event_id: eventId,
      })
      .eq("id", rejection.raw_event_id),
  ]);

  return NextResponse.json({ ok: true, action: "replace", eventId });
}
