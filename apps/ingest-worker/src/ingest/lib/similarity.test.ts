import { test } from "node:test";
import assert from "node:assert/strict";
import {
  levenshteinSimilarity,
  jaroWinklerSimilarity,
} from "./similarity.js";

// Tolerance for floating-point comparisons.
const EPS = 1e-4;

function approx(actual: number, expected: number, eps = EPS) {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${expected}, got ${actual}`,
  );
}

test("levenshteinSimilarity: identical strings", () => {
  approx(levenshteinSimilarity("salsa", "salsa"), 1);
});

test("levenshteinSimilarity: both empty", () => {
  approx(levenshteinSimilarity("", ""), 1);
});

test("levenshteinSimilarity: completely disjoint", () => {
  // "abc" vs "xyz" — distance 3, maxLen 3 → similarity 0.
  approx(levenshteinSimilarity("abc", "xyz"), 0);
});

test("levenshteinSimilarity: one edit on a 6-char word", () => {
  // "tuesday" vs "tuesdays" — 1 insert, maxLen 8 → 1 - 1/8 = 0.875
  approx(levenshteinSimilarity("tuesday", "tuesdays"), 0.875);
});

test("levenshteinSimilarity: real event title pair clears 0.85 threshold", () => {
  // The dedup heuristic uses 0.85 as the floor for "same event,
  // different wording" — this pair must clear it.
  const a = "salsa tuesdays @ alhambra";
  const b = "salsa tuesday — alhambra palace";
  const sim = levenshteinSimilarity(a, b);
  assert.ok(
    sim > 0.5,
    `pair too dissimilar by Levenshtein: ${sim}`,
  );
});

test("jaroWinklerSimilarity: identical strings", () => {
  approx(jaroWinklerSimilarity("alhambra", "alhambra"), 1);
});

test("jaroWinklerSimilarity: both empty", () => {
  approx(jaroWinklerSimilarity("", ""), 1);
});

test("jaroWinklerSimilarity: classic MARTHA/MARHTA example", () => {
  // Canonical Jaro-Winkler test pair from Winkler's paper:
  // JW = 0.9611...
  approx(jaroWinklerSimilarity("MARTHA", "MARHTA"), 0.9611, 1e-3);
});

test("jaroWinklerSimilarity: classic DWAYNE/DUANE example", () => {
  // Another canonical pair: JW ≈ 0.8400
  approx(jaroWinklerSimilarity("DWAYNE", "DUANE"), 0.84, 1e-2);
});

test("jaroWinklerSimilarity: completely different strings score low", () => {
  const s = jaroWinklerSimilarity("apple", "rocket");
  assert.ok(s < 0.6, `expected low similarity, got ${s}`);
});

test("jaroWinklerSimilarity: prefix bonus rewards shared head", () => {
  // Same Jaro score region, but "alhambra palace" vs "alhambra
  // palace banquet hall" shares the full 4-char prefix bonus.
  const a = "alhambra palace";
  const b = "alhambra palace banquet hall";
  const sim = jaroWinklerSimilarity(a, b);
  assert.ok(sim > 0.85, `expected high venue similarity, got ${sim}`);
});

test("jaroWinklerSimilarity: 0.9 threshold venue-name pair from dedup spec", () => {
  // The dedup heuristic uses 0.9 as the floor for "same venue,
  // different formatting" — this pair must clear it.
  const sim = jaroWinklerSimilarity("alhambra palace", "alhambra palace");
  assert.ok(sim >= 0.9);
});
