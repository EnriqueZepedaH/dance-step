import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGcalIcs } from "./gcal.js";

// Inline ICS samples. Keeping them small and self-contained so test
// failures point at the parser behavior, not at a 100-line fixture.

const SINGLE_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:single-001@example.com
DTSTAMP:20260101T000000Z
DTSTART:20260513T010000Z
DTEND:20260513T053000Z
SUMMARY:Salsa on a School Night
DESCRIPTION:Doors at 7pm
LOCATION:Epiphany Center for the Arts\\, 201 S Ashland Ave\\, Chicago\\, IL 60607
URL:https://example.com/salsa
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

const WEEKLY_RECURRING = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:weekly-001@example.com
DTSTAMP:20260101T000000Z
DTSTART:20260512T200000Z
DTEND:20260513T010000Z
RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20260615T235959Z
SUMMARY:Baila Tuesdays
LOCATION:Barcocina
SEQUENCE:1
END:VEVENT
END:VCALENDAR`;

const CANCELLED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:cancelled-001@example.com
DTSTAMP:20260101T000000Z
DTSTART:20260513T010000Z
DTEND:20260513T053000Z
SUMMARY:Cancelled Show
STATUS:CANCELLED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

const w = {
  fromUtc: new Date("2026-05-01T00:00:00.000Z"),
  toUtc: new Date("2026-07-01T00:00:00.000Z"),
};

test("parseGcalIcs: single event in window produces one FetchedEvent", () => {
  const out = parseGcalIcs(SINGLE_EVENT, w);
  assert.equal(out.length, 1);
  const ev = out[0]!;
  assert.equal(ev.sourceEventId, "gcal:single-001@example.com:2026-05-13");
  assert.equal(ev.sequence, 0);
  assert.equal(ev.normalized.title, "Salsa on a School Night");
  assert.equal(ev.normalized.startsUtc, "2026-05-13T01:00:00.000Z");
  assert.equal(ev.normalized.endsUtc, "2026-05-13T05:30:00.000Z");
  assert.equal(ev.normalized.recurrenceRule, null);
  assert.equal(ev.normalized.sourceUrl, "https://example.com/salsa");
});

test("parseGcalIcs: LOCATION splits on first comma → venue.name + address", () => {
  const out = parseGcalIcs(SINGLE_EVENT, w);
  const v = out[0]!.normalized.venue;
  assert.equal(v.name, "Epiphany Center for the Arts");
  assert.equal(v.address, "201 S Ashland Ave, Chicago, IL 60607");
  assert.equal(v.city, "Chicago");
  assert.equal(v.timezone, "America/Chicago");
});

test("parseGcalIcs: weekly RRULE expands to occurrences within window", () => {
  const out = parseGcalIcs(WEEKLY_RECURRING, w);
  // 2026-05-12, 05-19, 05-26, 06-02, 06-09 → 5 Tuesdays inside window
  // (06-16 is past UNTIL=2026-06-15T23:59:59Z).
  assert.ok(
    out.length >= 5,
    `expected >=5 occurrences, got ${out.length}`,
  );
  // Every occurrence shares the parent UID + has a unique date suffix.
  const dates = new Set<string>();
  for (const ev of out) {
    assert.match(ev.sourceEventId, /^gcal:weekly-001@example\.com:\d{4}-\d{2}-\d{2}$/);
    assert.equal(ev.normalized.title, "Baila Tuesdays");
    assert.equal(ev.sequence, 1);
    dates.add(ev.sourceEventId);
  }
  assert.equal(dates.size, out.length, "each occurrence has a unique id");
});

test("parseGcalIcs: occurrences outside window are excluded", () => {
  const narrow = {
    fromUtc: new Date("2026-05-10T00:00:00.000Z"),
    toUtc: new Date("2026-05-20T00:00:00.000Z"),
  };
  const out = parseGcalIcs(WEEKLY_RECURRING, narrow);
  // Only 2026-05-12 and 2026-05-19 should land in this window.
  assert.equal(out.length, 2);
});

test("parseGcalIcs: status=CANCELLED is filtered out", () => {
  const out = parseGcalIcs(CANCELLED, w);
  assert.equal(out.length, 0);
});

test("parseGcalIcs: rawPayload is JSON-serializable", () => {
  const out = parseGcalIcs(SINGLE_EVENT, w);
  // The whole point of toJsonSafe is to make this never throw.
  assert.doesNotThrow(() => JSON.stringify(out[0]!.rawPayload));
});

test("parseGcalIcs: empty ICS returns empty array", () => {
  const empty = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
END:VCALENDAR`;
  assert.deepEqual(parseGcalIcs(empty, w), []);
});

test("parseGcalIcs: single event outside window is excluded", () => {
  const distantFuture = {
    fromUtc: new Date("2030-01-01T00:00:00.000Z"),
    toUtc: new Date("2030-02-01T00:00:00.000Z"),
  };
  assert.deepEqual(parseGcalIcs(SINGLE_EVENT, distantFuture), []);
});
