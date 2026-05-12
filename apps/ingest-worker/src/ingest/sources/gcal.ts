import ical, { type VEvent } from "node-ical";
import type {
  FetchedEvent,
  FetchWindow,
  NormalizedEvent,
  SourceFetcher,
} from "../types.js";
import { SourceFetchError } from "../types.js";
import { toJsonSafe } from "../lib/jsonSafe.js";

// Google Calendar (iCal) source. Expands RRULE-recurring events via
// rrule.between() — bounded to the 8-week window so unbounded
// (UNTIL-less) RRULEs don't produce an unbounded number of
// occurrences. Single-instance events flow through with their
// original DTSTART.
//
// Per-occurrence sourceEventId = "gcal:<UID>:<YYYY-MM-DD>". The
// YYYY-MM-DD slice is the occurrence's UTC date — it's stable as
// long as the calendar doesn't move events across day boundaries
// (which would change the id and trigger an "inserted" outcome on
// the new date and an archive sweep on the old; both correct).
//
// EXDATEs are honored. RECURRENCE-ID overrides on individual
// instances are NOT honored in v1 — the base RRULE expansion wins.
// Listed in deferred work; chasing this is moderate effort and only
// matters when an organizer single-instance-edits a recurring event.

const HOST = "google-calendar";

export function makeGcalFetcher(opts: { url: string }): SourceFetcher {
  return {
    key: "gcal",
    async fetch(window: FetchWindow): Promise<FetchedEvent[]> {
      const res = await fetch(opts.url, { cache: "no-store" });
      if (!res.ok) {
        throw new SourceFetchError(
          "gcal",
          `${HOST} returned ${res.status} ${res.statusText}`,
        );
      }
      const text = await res.text();
      return parseGcalIcs(text, window);
    },
  };
}

// Pure parser, exposed for tests. Takes the raw ICS body + window.
export function parseGcalIcs(
  text: string,
  window: FetchWindow,
): FetchedEvent[] {
  let parsed: ReturnType<typeof ical.parseICS>;
  try {
    parsed = ical.parseICS(text);
  } catch (err) {
    throw new SourceFetchError("gcal", "parseICS failed", err);
  }

  const out: FetchedEvent[] = [];

  for (const value of Object.values(parsed)) {
    if (!value || value.type !== "VEVENT") continue;
    const event = value as VEvent;
    if (event.status === "CANCELLED") continue;
    if (!event.start || !event.summary) continue;

    const seq = parseSequence(event.sequence);
    const baseDurationMs = computeDurationMs(event.start, event.end);
    const exclusions = exdateSet(event.exdate);

    const occurrenceStarts: Date[] = [];
    if (event.rrule) {
      // rrule.between(after, before, inclusive) — clamp at the
      // window boundary, never use .all() (an UNTIL-less RRULE
      // would emit unbounded occurrences).
      const expanded = event.rrule.between(window.fromUtc, window.toUtc, true);
      for (const occ of expanded) {
        const key = occ.toISOString().slice(0, 10);
        if (exclusions.has(key)) continue;
        occurrenceStarts.push(occ);
      }
    } else {
      // Single-instance event. Keep it if its start falls in window.
      if (event.start >= window.fromUtc && event.start <= window.toUtc) {
        occurrenceStarts.push(event.start);
      }
    }

    if (occurrenceStarts.length === 0) continue;

    // Serialize the VEVENT once per parent (raw payload doesn't
    // change per occurrence). toJsonSafe handles the embedded
    // Date + RRule.
    const rawPayload = toJsonSafe(event);

    for (const occ of occurrenceStarts) {
      const startsUtc = occ.toISOString();
      const endsUtc = baseDurationMs > 0
        ? new Date(occ.getTime() + baseDurationMs).toISOString()
        : null;
      const venue = splitLocation(event.location);
      const normalized: NormalizedEvent = {
        title: event.summary.trim(),
        description: event.description ? event.description.trim() : null,
        startsUtc,
        endsUtc,
        recurrenceRule: event.rrule ? event.rrule.toString() : null,
        venue,
        sourceUrl: event.url || null,
        kind: null, // gcal doesn't carry a structured kind; left for clean.ts heuristics
        imageUrl: null,
      };
      out.push({
        sourceEventId: `gcal:${event.uid}:${startsUtc.slice(0, 10)}`,
        rawPayload,
        sequence: seq,
        normalized,
      });
    }
  }

  return out;
}

function parseSequence(s: unknown): number | undefined {
  if (typeof s === "number" && Number.isFinite(s)) return s;
  if (typeof s === "string" && s !== "") {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function computeDurationMs(start: Date, end: Date | undefined): number {
  if (!end || !(end instanceof Date)) return 0;
  const ms = end.getTime() - start.getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function exdateSet(exdate: unknown): Set<string> {
  const out = new Set<string>();
  if (!exdate || typeof exdate !== "object") return out;
  for (const value of Object.values(exdate as Record<string, unknown>)) {
    if (value instanceof Date) {
      out.add(value.toISOString().slice(0, 10));
    } else if (typeof value === "string") {
      // Some node-ical builds keep EXDATE keys as ISO strings.
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        out.add(d.toISOString().slice(0, 10));
      }
    }
  }
  return out;
}

function splitLocation(loc: string | undefined): NormalizedEvent["venue"] {
  const fallback = {
    name: "",
    address: null as string | null,
    city: "Chicago",
    country: "US",
    timezone: "America/Chicago",
  };
  if (!loc || loc.trim() === "") return fallback;

  // LOCATION usually shows "Venue Name, 123 Address St, City, ST ZIP".
  // First comma splits venue name from the rest. Single-segment
  // locations get name == address.
  const trimmed = loc.trim();
  const idx = trimmed.indexOf(",");
  if (idx === -1) {
    return { ...fallback, name: trimmed, address: trimmed };
  }
  const name = trimmed.slice(0, idx).trim();
  const address = trimmed.slice(idx + 1).trim();
  return { ...fallback, name, address };
}
