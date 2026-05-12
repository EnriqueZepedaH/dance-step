import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@dancestep/db";

// Canonical post-extraction shape every source maps into. content_hash
// is computed over a canonical JSON serialization of this object, so
// keep it deterministic — no source-specific fields here, no Dates
// (use ISO strings), no nested DOM references.
export type NormalizedEvent = {
  title: string;
  description: string | null;
  startsUtc: string;          // ISO 8601 UTC
  endsUtc: string | null;     // ISO 8601 UTC
  recurrenceRule: string | null;  // RRULE in stringified form (informational only — expansion happens at fetch time)
  venue: NormalizedVenue;
  sourceUrl: string | null;
  kind: string | null;        // "social" | "class" | "festival" | "practica" | "other" | null
  imageUrl: string | null;
};

export type NormalizedVenue = {
  name: string;
  address: string | null;
  city: string;
  country: string;
  timezone: string;
};

// Wrapper a fetcher returns. The source-side bookkeeping
// (sourceEventId, rawPayload, sequence) lives here so the clean +
// quality + reconcile pipeline can work with the pure NormalizedEvent
// without leaking source concerns.
//
// rawPayload MUST be JSON-safe — fetchers run it through toJsonSafe()
// before populating this field. node-ical events ship Date objects
// and RRule instances; cheerio rows can carry DOM cycles.
export type FetchedEvent = {
  sourceEventId: string;
  rawPayload: Json;
  sequence?: number;          // iCal SEQUENCE; undefined for non-iCal sources
  normalized: NormalizedEvent;
};

export type FetchWindow = { fromUtc: Date; toUtc: Date };

export type SourceFetcher = {
  key: string;
  fetch(window: FetchWindow): Promise<FetchedEvent[]>;
};

// Context handed to orchestrator-internal helpers. Keeps the
// log/run-id in scope without threading through every signature.
export type IngestContext = {
  runId: string;
  sourceKey: string;
  log: (level: LogLevel, msg: string, fields?: Record<string, unknown>) => void;
  supabase: SupabaseClient<Database>;
};

export type LogLevel = "debug" | "info" | "warn" | "error";

// Thrown by fetchers when extraction fails. The orchestrator catches
// this and marks the run failed without aborting other sources.
export class SourceFetchError extends Error {
  constructor(
    public sourceKey: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SourceFetchError";
  }
}
