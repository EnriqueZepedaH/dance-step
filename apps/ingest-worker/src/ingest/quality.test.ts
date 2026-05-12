import { test } from "node:test";
import assert from "node:assert/strict";
import { checkQuality } from "./quality.js";
import type { NormalizedEvent } from "./types.js";
import type { ResolvedVenue } from "./clean.js";

const NOW = new Date("2026-05-13T00:00:00.000Z");

function ev(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    title: "Salsa Tuesdays",
    description: "social dancing",
    startsUtc: "2026-05-13T01:00:00.000Z",
    endsUtc: "2026-05-13T06:00:00.000Z",
    recurrenceRule: null,
    venue: {
      name: "Barcocina",
      address: "2901 W Armitage Ave, Chicago, IL",
      city: "Chicago",
      country: "US",
      timezone: "America/Chicago",
    },
    sourceUrl: "https://example.com/event",
    kind: "social",
    imageUrl: null,
    ...overrides,
  };
}

const VENUE: ResolvedVenue = {
  venueId: "11111111-1111-1111-1111-111111111111",
  neighborhood: "Logan Square",
  lat: 41.89,
  lng: -87.67,
};

test("checkQuality: ok path", () => {
  const out = checkQuality(ev(), VENUE, { now: NOW });
  assert.equal(out.ok, true);
});

test("checkQuality: missing_title (empty after trim)", () => {
  const out = checkQuality(ev({ title: "   " }), VENUE, { now: NOW });
  assert.deepEqual(out, { ok: false, reasonCode: "missing_title" });
});

test("checkQuality: suspicious_title (too short)", () => {
  const out = checkQuality(ev({ title: "ab" }), VENUE, { now: NOW });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "suspicious_title");
});

test("checkQuality: suspicious_title (test/tba/tbd)", () => {
  for (const t of ["test", "TBA", "tbd", "Test"]) {
    const out = checkQuality(ev({ title: t }), VENUE, { now: NOW });
    assert.equal(out.ok, false, `title=${t}`);
    if (!out.ok) assert.equal(out.reasonCode, "suspicious_title");
  }
});

test("checkQuality: missing_start (empty)", () => {
  const out = checkQuality(ev({ startsUtc: "" }), VENUE, { now: NOW });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "missing_start");
});

test("checkQuality: missing_start (unparseable)", () => {
  const out = checkQuality(ev({ startsUtc: "not-a-date" }), VENUE, { now: NOW });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "missing_start");
});

test("checkQuality: past_date (older than grace)", () => {
  const out = checkQuality(
    ev({ startsUtc: "2026-05-10T00:00:00.000Z" }),
    VENUE,
    { now: NOW },
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "past_date");
});

test("checkQuality: past_date — within grace window passes", () => {
  // NOW = 2026-05-13. Default grace 1 day → earliest = 2026-05-12.
  const out = checkQuality(
    ev({ startsUtc: "2026-05-12T06:00:00.000Z" }),
    VENUE,
    { now: NOW },
  );
  assert.equal(out.ok, true);
});

test("checkQuality: out_of_window (beyond 8 weeks)", () => {
  const out = checkQuality(
    ev({ startsUtc: "2026-09-01T00:00:00.000Z" }),
    VENUE,
    { now: NOW },
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "out_of_window");
});

test("checkQuality: invalid_url (non-http)", () => {
  const out = checkQuality(
    ev({ sourceUrl: "javascript:alert(1)" }),
    VENUE,
    { now: NOW },
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "invalid_url");
});

test("checkQuality: invalid_url (unparseable)", () => {
  const out = checkQuality(ev({ sourceUrl: "not a url" }), VENUE, { now: NOW });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "invalid_url");
});

test("checkQuality: sourceUrl null is OK", () => {
  const out = checkQuality(ev({ sourceUrl: null }), VENUE, { now: NOW });
  assert.equal(out.ok, true);
});

test("checkQuality: ungeocodable_venue when resolvedVenue is null", () => {
  const out = checkQuality(ev(), null, { now: NOW });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "ungeocodable_venue");
});

test("checkQuality: short-circuit order — missing_title before past_date", () => {
  const out = checkQuality(
    ev({ title: "", startsUtc: "1900-01-01T00:00:00.000Z" }),
    null,
    { now: NOW },
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reasonCode, "missing_title");
});
