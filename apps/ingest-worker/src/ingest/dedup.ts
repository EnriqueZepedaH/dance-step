import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@dancestep/db";
import type { NormalizedEvent } from "./types.js";
import type { ResolvedVenue } from "./clean.js";
import { normalizeName } from "./clean.js";
import {
  jaroWinklerSimilarity,
  levenshteinSimilarity,
} from "./lib/similarity.js";

// Cross-source duplicate detection.
//
// Three independent buckets:
//   title  — slug + Levenshtein-normalized similarity ≥ 0.85
//   venue  — same resolved venue_id OR normalized_name JW ≥ 0.9
//   time   — |start_a - start_b| ≤ 15 minutes
//
// 2 of 3 buckets match → call it a duplicate. The loose title
// threshold catches "Salsa Tuesdays @ Alhambra" vs "Salsa Tuesday
// — Alhambra Palace"; the time + venue gates prevent two different
// nights at the same venue from collapsing.

const TITLE_THRESHOLD = 0.85;
const VENUE_THRESHOLD = 0.9;
const TIME_WINDOW_MS = 15 * 60 * 1000;
const SEARCH_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DedupCandidate = {
  normalized: NormalizedEvent;
  resolvedVenue: ResolvedVenue;
};

export type DedupTarget = {
  titleNorm: string;
  venueId: string;
  venueNorm: string;
  startsAt: Date;
};

export type DedupHit =
  | { kind: "existing"; eventId: string }
  | { kind: "in-run"; index: number };

export type DedupResult =
  | { duplicate: false }
  | { duplicate: true; of: DedupHit };

export function toTarget(
  normalized: NormalizedEvent,
  resolvedVenue: ResolvedVenue,
): DedupTarget {
  return {
    titleNorm: normalizeName(normalized.title),
    venueId: resolvedVenue.venueId,
    venueNorm: normalizeName(normalized.venue.name),
    startsAt: new Date(normalized.startsUtc),
  };
}

// Pure: does `a` look like the same event as `b`?
export function isLikelyDuplicate(a: DedupTarget, b: DedupTarget): boolean {
  let buckets = 0;
  if (levenshteinSimilarity(a.titleNorm, b.titleNorm) >= TITLE_THRESHOLD) buckets++;
  if (a.venueId === b.venueId) {
    buckets++;
  } else if (
    jaroWinklerSimilarity(a.venueNorm, b.venueNorm) >= VENUE_THRESHOLD
  ) {
    buckets++;
  }
  if (
    Math.abs(a.startsAt.getTime() - b.startsAt.getTime()) <= TIME_WINDOW_MS
  ) {
    buckets++;
  }
  return buckets >= 2;
}

// Check the in-run buffer first (other candidates from this run),
// then existing events in the DB within ±1 day of the candidate's
// start. Returns the first match; we don't enumerate all of them.
export async function findDuplicate(
  supabase: SupabaseClient<Database>,
  candidate: DedupTarget,
  inRun: DedupTarget[],
  candidateOwnSource: string,
  candidateOwnSourceEventId: string,
): Promise<DedupResult> {
  for (let i = 0; i < inRun.length; i++) {
    const other = inRun[i]!;
    if (other === candidate) continue;
    if (isLikelyDuplicate(candidate, other)) {
      return { duplicate: true, of: { kind: "in-run", index: i } };
    }
  }

  const fromIso = new Date(
    candidate.startsAt.getTime() - SEARCH_WINDOW_MS,
  ).toISOString();
  const toIso = new Date(
    candidate.startsAt.getTime() + SEARCH_WINDOW_MS,
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("events")
    .select("id, title, starts_at, venue_id, source, source_event_id, venues(normalized_name)")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso)
    .eq("status", "published");

  if (error || !rows) return { duplicate: false };

  for (const row of rows) {
    // Don't dedup against the candidate's own previously-promoted row
    // — reconcile.ts handles the (source, source_event_id) match
    // path and would re-mark it as 'unchanged' there.
    if (
      row.source === candidateOwnSource &&
      row.source_event_id === candidateOwnSourceEventId
    ) {
      continue;
    }
    const venue = (row.venues as unknown as { normalized_name: string | null } | null) ?? null;
    const target: DedupTarget = {
      titleNorm: normalizeName(row.title),
      venueId: row.venue_id ?? "",
      venueNorm: venue?.normalized_name ?? "",
      startsAt: new Date(row.starts_at),
    };
    if (isLikelyDuplicate(candidate, target)) {
      return { duplicate: true, of: { kind: "existing", eventId: row.id } };
    }
  }

  return { duplicate: false };
}
