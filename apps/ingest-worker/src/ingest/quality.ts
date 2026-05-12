import type { NormalizedEvent } from "./types.js";
import type { ResolvedVenue } from "./clean.js";

// Sequential validation gates. First failing check short-circuits
// and produces a rejection reason — the orchestrator logs that
// reason to quality_rejections and never promotes the row into
// events. Order matters: cheap pure-data checks first, the
// network/DB-touching ungeocodable check last.
//
// The set of reason_code values is the contract surfaced in the
// admin /admin/scene/rejections UI; new codes must be added here
// AND surfaced in the UI badge map.

export type QualityResult =
  | { ok: true }
  | { ok: false; reasonCode: QualityReasonCode; reasonDetail?: string };

export type QualityReasonCode =
  | "missing_title"
  | "missing_start"
  | "past_date"
  | "out_of_window"
  | "ungeocodable_venue"
  | "invalid_url"
  | "suspicious_title";

export type QualityOptions = {
  now: Date;             // injected for testability
  windowDays?: number;   // out_of_window threshold; default 56 (8 weeks)
  pastGraceDays?: number; // past_date grace; default 1
};

const SUSPICIOUS_TITLE_RE = /^(test|tba|tbd)$/i;

export function checkQuality(
  normalized: NormalizedEvent,
  resolvedVenue: ResolvedVenue | null,
  opts: QualityOptions,
): QualityResult {
  const windowDays = opts.windowDays ?? 56;
  const pastGraceDays = opts.pastGraceDays ?? 1;

  const title = normalized.title.trim();
  if (!title) return fail("missing_title");
  if (title.length < 3 || SUSPICIOUS_TITLE_RE.test(title)) {
    return fail("suspicious_title", `title="${title}"`);
  }

  if (!normalized.startsUtc) return fail("missing_start");
  const start = Date.parse(normalized.startsUtc);
  if (!Number.isFinite(start)) return fail("missing_start", "unparseable start");

  const earliest =
    opts.now.getTime() - pastGraceDays * 24 * 60 * 60 * 1000;
  const latest =
    opts.now.getTime() + windowDays * 24 * 60 * 60 * 1000;
  if (start < earliest) return fail("past_date", normalized.startsUtc);
  if (start > latest) return fail("out_of_window", normalized.startsUtc);

  if (normalized.sourceUrl) {
    try {
      const u = new URL(normalized.sourceUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return fail("invalid_url", `protocol=${u.protocol}`);
      }
    } catch {
      return fail("invalid_url", normalized.sourceUrl);
    }
  }

  if (!resolvedVenue) {
    return fail("ungeocodable_venue", normalized.venue.name || "(unnamed)");
  }

  return { ok: true };
}

function fail(reasonCode: QualityReasonCode, reasonDetail?: string): QualityResult {
  return reasonDetail
    ? { ok: false, reasonCode, reasonDetail }
    : { ok: false, reasonCode };
}
