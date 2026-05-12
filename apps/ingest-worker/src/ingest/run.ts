import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@dancestep/db";
import type { FetchedEvent, NormalizedEvent } from "./types.js";
import { SourceFetchError } from "./types.js";
import { SOURCE_FACTORIES } from "./sources/registry.js";
import { resolveVenue, type ResolvedVenue } from "./clean.js";
import { checkQuality } from "./quality.js";
import { findDuplicate, toTarget, type DedupTarget } from "./dedup.js";
import { reconcileCandidate, archiveMissing } from "./reconcile.js";
import { contentHash } from "./lib/contentHash.js";
import { makeLogger, type Logger } from "./logger.js";

// Orchestrator. One pass per Railway Cron tick. Iterates enabled
// event_sources, runs each in isolation (failures in one source
// never abort the next), records everything into ingest_runs +
// raw_events + quality_rejections, and emits a final summary.

const WINDOW_DAYS = 56; // 8 weeks
const ARCHIVE_AFTER_SUCCESS = true;

type EventSource = Database["public"]["Tables"]["event_sources"]["Row"];

export type RunOptions = {
  // CSV gate; if non-empty, only these source keys run. Defaults
  // to "every enabled source in event_sources".
  sourceFilter?: string[];
  now?: Date;
};

export type RunSummary = {
  runStartedAt: string;
  perSource: Array<{
    source: string;
    status: "success" | "failed" | "partial";
    runId: string | null;
    fetched: number;
    staged: number;
    promoted: number;
    rejected: number;
    archived: number;
    error?: string;
  }>;
};

export async function runIngest(
  supabase: SupabaseClient<Database>,
  opts: RunOptions = {},
): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const window = {
    fromUtc: new Date(now.getTime() - 24 * 60 * 60 * 1000), // grace day for past_date check
    toUtc: new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000),
  };

  const { data: rows } = await supabase
    .from("event_sources")
    .select("*")
    .eq("enabled", true);

  const filterSet = opts.sourceFilter && opts.sourceFilter.length > 0
    ? new Set(opts.sourceFilter)
    : null;
  const sources = (rows ?? []).filter(
    (r) => !filterSet || filterSet.has(r.key),
  );

  const summary: RunSummary = {
    runStartedAt: now.toISOString(),
    perSource: [],
  };

  for (const source of sources) {
    summary.perSource.push(await runOneSource(supabase, source, window, now));
  }

  return summary;
}

async function runOneSource(
  supabase: SupabaseClient<Database>,
  source: EventSource,
  window: { fromUtc: Date; toUtc: Date },
  now: Date,
): Promise<RunSummary["perSource"][number]> {
  // 1. ingest_runs in_progress.
  const { data: runRow, error: runErr } = await supabase
    .from("ingest_runs")
    .insert({ source: source.key, status: "in_progress" })
    .select("id, started_at")
    .single();
  if (runErr || !runRow) {
    return {
      source: source.key,
      status: "failed",
      runId: null,
      fetched: 0, staged: 0, promoted: 0, rejected: 0, archived: 0,
      error: runErr?.message ?? "could not create ingest_runs row",
    };
  }
  const runId = runRow.id;
  const runStartedAt = new Date(runRow.started_at);
  const log = makeLogger({ run_id: runId, source: source.key });

  log("info", "source run started", { url: source.url });

  // 2. Fetch (isolated).
  const factory = SOURCE_FACTORIES[source.key];
  if (!factory) {
    return finalizeRun(supabase, runId, source.key, "failed", {
      fetched: 0, staged: 0, promoted: 0, rejected: 0, archived: 0,
      error: `no factory registered for source key '${source.key}'`,
    });
  }
  let fetched: FetchedEvent[] = [];
  try {
    fetched = await factory({ url: source.url }).fetch(window);
  } catch (e) {
    const msg = e instanceof SourceFetchError
      ? e.message
      : e instanceof Error
        ? e.message
        : String(e);
    log("error", "fetcher threw", { error: msg });
    return finalizeRun(supabase, runId, source.key, "failed", {
      fetched: 0, staged: 0, promoted: 0, rejected: 0, archived: 0,
      error: msg,
    });
  }
  log("info", "fetcher returned", { count: fetched.length });

  // 3. Stage into raw_events.
  const staged = await stageRaw(supabase, runId, source.key, fetched, log);

  // 4. Clean → quality → dedup → reconcile per row.
  let promoted = 0;
  let rejected = 0;
  let errors = 0;
  const inRunTargets: DedupTarget[] = [];

  for (const item of staged) {
    const result = await processOne(
      supabase,
      runId,
      source.key,
      item,
      inRunTargets,
      now,
      log,
    );
    if (result === "inserted" || result === "updated" || result === "unchanged") {
      promoted++;
    } else if (result === "rejected" || result === "duplicate") {
      rejected++;
    } else {
      errors++;
    }
  }

  // 5. Decide source status. errors > 0 → partial.
  const status: "success" | "partial" | "failed" =
    errors > 0 ? "partial" : "success";

  // 6. Archive missing — ONLY on success. Failed/partial runs must
  // not bump missing_run_count for this source's events.
  let archived = 0;
  if (status === "success" && ARCHIVE_AFTER_SUCCESS) {
    const { archived: archivedCount } = await archiveMissing(
      supabase,
      source.key,
      runStartedAt,
    );
    archived = archivedCount;
  }

  return finalizeRun(supabase, runId, source.key, status, {
    fetched: fetched.length,
    staged: staged.length,
    promoted,
    rejected,
    archived,
  });
}

type StagedRow = {
  rawId: string;
  sourceEventId: string;
  contentHash: string;
  normalized: NormalizedEvent;
  rawPayload: Json;
  sequence: number | null;
};

async function stageRaw(
  supabase: SupabaseClient<Database>,
  runId: string,
  sourceKey: string,
  fetched: FetchedEvent[],
  log: Logger,
): Promise<StagedRow[]> {
  if (fetched.length === 0) return [];
  // De-dup by sourceEventId within the run — the unique
  // (run_id, source, source_event_id) index would reject a second
  // insert anyway, but a fetcher emitting the same id twice is a
  // bug worth surfacing. Keep the first occurrence.
  const seen = new Set<string>();
  const inserts: Array<Database["public"]["Tables"]["raw_events"]["Insert"]> = [];
  const meta: Array<{ sourceEventId: string; normalized: NormalizedEvent; rawPayload: Json; sequence: number | null; contentHash: string }> = [];
  for (const item of fetched) {
    if (seen.has(item.sourceEventId)) {
      log("warn", "duplicate sourceEventId within run; dropping later occurrence", {
        source_event_id: item.sourceEventId,
      });
      continue;
    }
    seen.add(item.sourceEventId);
    const hash = contentHash(item.normalized);
    inserts.push({
      run_id: runId,
      source: sourceKey,
      source_event_id: item.sourceEventId,
      raw_payload: item.rawPayload,
      normalized: item.normalized as unknown as Json,
      content_hash: hash,
      sequence: item.sequence ?? null,
    });
    meta.push({
      sourceEventId: item.sourceEventId,
      normalized: item.normalized,
      rawPayload: item.rawPayload,
      sequence: item.sequence ?? null,
      contentHash: hash,
    });
  }
  const { data: inserted, error } = await supabase
    .from("raw_events")
    .insert(inserts)
    .select("id, source_event_id");
  if (error || !inserted) {
    log("error", "raw_events insert failed", { error: error?.message });
    return [];
  }

  // Reattach metadata. Insert order isn't guaranteed by Postgres,
  // so re-match by sourceEventId.
  const byId = new Map<string, string>();
  for (const row of inserted) byId.set(row.source_event_id, row.id);

  const result: StagedRow[] = [];
  for (const m of meta) {
    const rawId = byId.get(m.sourceEventId);
    if (!rawId) continue;
    result.push({
      rawId,
      sourceEventId: m.sourceEventId,
      contentHash: m.contentHash,
      normalized: m.normalized,
      rawPayload: m.rawPayload,
      sequence: m.sequence,
    });
  }
  return result;
}

async function processOne(
  supabase: SupabaseClient<Database>,
  runId: string,
  sourceKey: string,
  staged: StagedRow,
  inRunTargets: DedupTarget[],
  now: Date,
  log: Logger,
): Promise<"inserted" | "updated" | "unchanged" | "duplicate" | "rejected" | "error"> {
  // Extract coords hint for LSD (lat/lng baked into rawPayload).
  const coordsHint = extractCoordsHint(staged.rawPayload);

  const resolvedVenue = await resolveVenue(
    supabase,
    staged.normalized,
    coordsHint,
  );

  const quality = checkQuality(staged.normalized, resolvedVenue, { now });
  if (!quality.ok) {
    await Promise.all([
      supabase.from("quality_rejections").insert({
        raw_event_id: staged.rawId,
        run_id: runId,
        reason_code: quality.reasonCode,
        reason_detail: quality.reasonDetail ?? null,
      }),
      supabase.from("raw_events").update({
        processed: true,
        outcome: "rejected",
        outcome_detail: quality.reasonCode,
      }).eq("id", staged.rawId),
    ]);
    log("info", "rejected", {
      reason_code: quality.reasonCode,
      source_event_id: staged.sourceEventId,
    });
    return "rejected";
  }

  // dedup against in-run + existing events.
  const target = toTarget(staged.normalized, resolvedVenue!);
  const dup = await findDuplicate(
    supabase,
    target,
    inRunTargets,
    sourceKey,
    staged.sourceEventId,
  );
  if (dup.duplicate) {
    const duplicateOfEventId =
      dup.of.kind === "existing" ? dup.of.eventId : null;
    await Promise.all([
      supabase.from("quality_rejections").insert({
        raw_event_id: staged.rawId,
        run_id: runId,
        reason_code: "cross_source_dup",
        reason_detail: dup.of.kind === "in-run" ? "matched another candidate in this run" : "matched an existing event",
        duplicate_of: duplicateOfEventId,
      }),
      supabase.from("raw_events").update({
        processed: true,
        outcome: "duplicate",
        outcome_detail: dup.of.kind,
      }).eq("id", staged.rawId),
    ]);
    log("info", "cross_source_dup", { source_event_id: staged.sourceEventId });
    return "duplicate";
  }

  // Reconcile.
  inRunTargets.push(target);
  const outcome = await reconcileCandidate(supabase, {
    source: sourceKey,
    sourceEventId: staged.sourceEventId,
    contentHash: staged.contentHash,
    normalized: staged.normalized,
    resolvedVenue: resolvedVenue!,
  }, now);

  if (outcome.outcome === "error") {
    log("error", "reconcile failed", {
      source_event_id: staged.sourceEventId,
      reason: outcome.reason,
    });
    await supabase.from("raw_events").update({
      processed: true,
      outcome: "rejected",
      outcome_detail: `reconcile:${outcome.reason.slice(0, 100)}`,
    }).eq("id", staged.rawId);
    return "error";
  }

  await supabase.from("raw_events").update({
    processed: true,
    outcome: outcome.outcome,
    promoted_event_id: outcome.eventId,
  }).eq("id", staged.rawId);

  return outcome.outcome;
}

async function finalizeRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  sourceKey: string,
  status: "success" | "partial" | "failed",
  counts: { fetched: number; staged: number; promoted: number; rejected: number; archived: number; error?: string },
): Promise<RunSummary["perSource"][number]> {
  await Promise.all([
    supabase.from("ingest_runs").update({
      status,
      finished_at: new Date().toISOString(),
      fetched_count: counts.fetched,
      staged_count: counts.staged,
      promoted_count: counts.promoted,
      rejected_count: counts.rejected,
      archived_count: counts.archived,
      error: counts.error ?? null,
    }).eq("id", runId),
    supabase.from("event_sources").update({
      last_run_id: runId,
      last_status: status,
      last_run_at: new Date().toISOString(),
    }).eq("key", sourceKey),
  ]);
  return {
    source: sourceKey,
    status,
    runId,
    fetched: counts.fetched,
    staged: counts.staged,
    promoted: counts.promoted,
    rejected: counts.rejected,
    archived: counts.archived,
    ...(counts.error ? { error: counts.error } : {}),
  };
}

// LSD rawPayload carries `coords: { lat, lng } | null`. Other
// sources don't ship this; resolveVenue will fall through to
// cache lookup → Mapbox geocode. Defensive parsing avoids
// throwing on a malformed payload.
function extractCoordsHint(
  rawPayload: Json,
): { lat: number; lng: number } | null {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return null;
  }
  const coords = (rawPayload as Record<string, unknown>).coords;
  if (!coords || typeof coords !== "object" || Array.isArray(coords)) return null;
  const c = coords as Record<string, unknown>;
  const lat = typeof c.lat === "number" ? c.lat : NaN;
  const lng = typeof c.lng === "number" ? c.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
