import { test } from "node:test";
import assert from "node:assert/strict";
import { localToUtcDate } from "./timezone.js";

test("localToUtcDate: CST (winter) — Chicago is UTC-6", () => {
  // Jan 15, 2026 8:00 PM Chicago = Jan 16, 2026 02:00 UTC
  const out = localToUtcDate(
    { year: 2026, month: 1, day: 15, hour: 20, minute: 0 },
    "America/Chicago",
  );
  assert.equal(out.toISOString(), "2026-01-16T02:00:00.000Z");
});

test("localToUtcDate: CDT (summer) — Chicago is UTC-5", () => {
  // Jul 15, 2026 8:00 PM Chicago = Jul 16, 2026 01:00 UTC
  const out = localToUtcDate(
    { year: 2026, month: 7, day: 15, hour: 20, minute: 0 },
    "America/Chicago",
  );
  assert.equal(out.toISOString(), "2026-07-16T01:00:00.000Z");
});

test("localToUtcDate: spans midnight in Chicago", () => {
  // May 13, 2026 1:00 AM Chicago = May 13, 2026 06:00 UTC (CDT)
  const out = localToUtcDate(
    { year: 2026, month: 5, day: 13, hour: 1, minute: 0 },
    "America/Chicago",
  );
  assert.equal(out.toISOString(), "2026-05-13T06:00:00.000Z");
});

test("localToUtcDate: passes through UTC for an already-UTC zone", () => {
  const out = localToUtcDate(
    { year: 2026, month: 5, day: 13, hour: 12, minute: 30, second: 15 },
    "UTC",
  );
  assert.equal(out.toISOString(), "2026-05-13T12:30:15.000Z");
});
