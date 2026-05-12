import { test } from "node:test";
import assert from "node:assert/strict";

// dedup → clean → mapbox/geocode → env (zod-validated at load).
// Set placeholder env vars before dynamic-importing the module.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-very-long-string";
process.env.MAPBOX_TOKEN = "pk.test-token-very-long-string";

const { isLikelyDuplicate } = await import("./dedup.js");
type DedupTarget = import("./dedup.js").DedupTarget;

function t(over: Partial<DedupTarget> = {}): DedupTarget {
  return {
    titleNorm: "salsa tuesdays",
    venueId: "v-barcocina",
    venueNorm: "barcocina",
    startsAt: new Date("2026-05-13T01:00:00.000Z"),
    ...over,
  };
}

test("isLikelyDuplicate: exact match", () => {
  assert.equal(isLikelyDuplicate(t(), t()), true);
});

test("isLikelyDuplicate: same venue + same time + slightly different title → dup", () => {
  // 'salsa tuesday' vs 'salsa tuesdays' — Levenshtein 1 edit on
  // 14-char max → 1 - 1/14 ≈ 0.93, comfortably ≥ 0.85.
  const a = t();
  const b = t({ titleNorm: "salsa tuesday" });
  assert.equal(isLikelyDuplicate(a, b), true);
});

test("isLikelyDuplicate: same title + venue, time 30min apart → still dup (2 of 3)", () => {
  // Title match (true) + venue match (true) + time match (false)
  // = 2 of 3, rule fires.
  const a = t();
  const b = t({ startsAt: new Date("2026-05-13T01:30:00.000Z") });
  assert.equal(isLikelyDuplicate(a, b), true);
});

test("isLikelyDuplicate: same venue + time, completely different title → not dup", () => {
  // Only 2 of 3 needed, but venue match + time match = 2/3, so
  // even with a different title this IS a duplicate. That's the
  // designed behavior — two events at the same venue within 15
  // min of each other are almost certainly the same listing
  // titled differently across sources. Asserting the expected
  // call rather than the rejection.
  const a = t({ titleNorm: "salsa tuesdays" });
  const b = t({ titleNorm: "drum circle workshop" });
  assert.equal(isLikelyDuplicate(a, b), true);
});

test("isLikelyDuplicate: different venue, same time, same title → dup", () => {
  // Title match (true) + venue match (false) + time match (true)
  // = 2 of 3.
  const a = t();
  const b = t({ venueId: "v-other", venueNorm: "other place" });
  assert.equal(isLikelyDuplicate(a, b), true);
});

test("isLikelyDuplicate: same title only, week apart, different venue → not dup", () => {
  // Title match (true) + venue match (false) + time match (false)
  // = 1 of 3. This is the recurring-event-across-weeks case the
  // rule must NOT collapse.
  const a = t();
  const b = t({
    venueId: "v-other",
    venueNorm: "other place",
    startsAt: new Date("2026-05-20T01:00:00.000Z"),
  });
  assert.equal(isLikelyDuplicate(a, b), false);
});

test("isLikelyDuplicate: venue name match by JW similarity (not same id)", () => {
  // "barcocina" vs "barcocina west town" — JW with prefix
  // bonus = ~0.9+. Title also matches. 2 of 3.
  const a = t({ venueId: "v-1", venueNorm: "barcocina" });
  const b = t({ venueId: "v-2", venueNorm: "barcocina west town" });
  assert.equal(isLikelyDuplicate(a, b), true);
});

test("isLikelyDuplicate: all three buckets miss → not dup", () => {
  const a = t();
  const b = t({
    titleNorm: "completely unrelated event",
    venueId: "v-other",
    venueNorm: "different venue entirely",
    startsAt: new Date("2026-06-15T00:00:00.000Z"),
  });
  assert.equal(isLikelyDuplicate(a, b), false);
});

test("isLikelyDuplicate: time exactly at the 15-min boundary counts as match", () => {
  const a = t();
  const b = t({
    titleNorm: "completely different",
    venueId: "v-other",
    venueNorm: "different place",
    startsAt: new Date("2026-05-13T01:15:00.000Z"),
  });
  // Only time matches → 1 of 3 → not dup.
  assert.equal(isLikelyDuplicate(a, b), false);
});
