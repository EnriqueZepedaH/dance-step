import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dancestep/db";
import type { NormalizedEvent } from "./types.js";
import type { ResolvedVenue } from "./clean.js";

// Reconcile a clean candidate against the events table. Dedup
// already ran upstream — this function never sees cross-source
// duplicates, only the same-source primary match path.
//
// Path:
//   (source, source_event_id) lookup
//      hit + content_hash equal → heartbeat last_seen_at + reset
//                                  missing_run_count → 'unchanged'
//      hit + content_hash diff  → UPDATE fields + heartbeat
//                                  → 'updated'
//      no hit                   → INSERT status='published'
//                                  → 'inserted'
//
// status is never auto-flipped from 'archived' back to 'published'
// here. If an admin archived a row by hand and the source brings
// it back, the row stays archived. archiveMissing is the only
// place that touches status (in the published → archived
// direction).

export type ReconcileOutcome =
  | { outcome: "unchanged"; eventId: string }
  | { outcome: "updated"; eventId: string }
  | { outcome: "inserted"; eventId: string }
  | { outcome: "error"; reason: string };

export type ReconcileInput = {
  source: string;
  sourceEventId: string;
  contentHash: string;
  normalized: NormalizedEvent;
  resolvedVenue: ResolvedVenue;
};

export async function reconcileCandidate(
  supabase: SupabaseClient<Database>,
  input: ReconcileInput,
  now: Date = new Date(),
): Promise<ReconcileOutcome> {
  const { source, sourceEventId, contentHash, normalized, resolvedVenue } = input;
  const nowIso = now.toISOString();

  const { data: existing, error: lookupErr } = await supabase
    .from("events")
    .select("id, content_hash, status")
    .eq("source", source)
    .eq("source_event_id", sourceEventId)
    .maybeSingle();

  if (lookupErr) {
    return { outcome: "error", reason: lookupErr.message };
  }

  if (existing) {
    // Hit + same hash → heartbeat only.
    if (existing.content_hash === contentHash) {
      await supabase
        .from("events")
        .update({ last_seen_at: nowIso, missing_run_count: 0 })
        .eq("id", existing.id);
      return { outcome: "unchanged", eventId: existing.id };
    }
    // Hit + diff hash → update content fields. Don't touch status.
    const { error: updErr } = await supabase
      .from("events")
      .update({
        title: normalized.title,
        description: normalized.description,
        starts_at: normalized.startsUtc,
        ends_at: normalized.endsUtc,
        venue_id: resolvedVenue.venueId,
        url: normalized.sourceUrl,
        source_url: normalized.sourceUrl,
        kind: normalized.kind,
        content_hash: contentHash,
        last_seen_at: nowIso,
        missing_run_count: 0,
      })
      .eq("id", existing.id);
    if (updErr) return { outcome: "error", reason: updErr.message };
    return { outcome: "updated", eventId: existing.id };
  }

  // No hit → insert. ensureUser-equivalent for events: insert with
  // created_by=null since the worker isn't a Clerk user.
  const { data: inserted, error: insErr } = await supabase
    .from("events")
    .insert({
      title: normalized.title,
      description: normalized.description,
      starts_at: normalized.startsUtc,
      ends_at: normalized.endsUtc,
      venue_id: resolvedVenue.venueId,
      url: normalized.sourceUrl,
      source_url: normalized.sourceUrl,
      kind: normalized.kind,
      source,
      source_event_id: sourceEventId,
      content_hash: contentHash,
      last_seen_at: nowIso,
      missing_run_count: 0,
      status: "published",
      city: normalized.venue.city,
      timezone: normalized.venue.timezone,
      created_by: null,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { outcome: "error", reason: insErr?.message ?? "insert failed" };
  }
  return { outcome: "inserted", eventId: inserted.id };
}

// Source-scoped soft-delete. Called once per source AFTER the
// source's ingest_runs row is marked 'success'. Failed/partial
// runs MUST NOT call this — a transient outage would otherwise
// drift all that source's events toward 'archived' status.
//
// Three consecutive misses = archive. At twice-daily cadence
// that's ~36 hours of absence.

export type ArchiveResult = { incremented: number; archived: number };

const ARCHIVE_THRESHOLD = 3;

export async function archiveMissing(
  supabase: SupabaseClient<Database>,
  sourceKey: string,
  runStartedAt: Date,
): Promise<ArchiveResult> {
  const cutoffIso = runStartedAt.toISOString();

  // Find candidates first (rows from this source that were NOT
  // seen this run). The supabase-js client doesn't expose a direct
  // "increment column" yet; do it as a two-step read + write.
  const { data: stale } = await supabase
    .from("events")
    .select("id, missing_run_count")
    .eq("source", sourceKey)
    .eq("status", "published")
    .lt("last_seen_at", cutoffIso);

  if (!stale || stale.length === 0) return { incremented: 0, archived: 0 };

  let archived = 0;
  // Bulk-update by bucketing on the new missing_run_count value.
  const buckets = new Map<number, string[]>();
  for (const row of stale) {
    const next = (row.missing_run_count ?? 0) + 1;
    const list = buckets.get(next) ?? [];
    list.push(row.id);
    buckets.set(next, list);
  }

  for (const [newCount, ids] of buckets) {
    const shouldArchive = newCount >= ARCHIVE_THRESHOLD;
    await supabase
      .from("events")
      .update({
        missing_run_count: newCount,
        ...(shouldArchive ? { status: "archived" as const } : {}),
      })
      .in("id", ids);
    if (shouldArchive) archived += ids.length;
  }

  return { incremented: stale.length, archived };
}
