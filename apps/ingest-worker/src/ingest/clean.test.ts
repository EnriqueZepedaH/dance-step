import { test } from "node:test";
import assert from "node:assert/strict";

// clean.js transitively imports the Mapbox geocoder, which loads
// env.ts at module init and zod-validates the worker's env vars.
// These tests only exercise the pure normalize helpers, so we just
// satisfy env.parse() with placeholder values before importing.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-very-long-string";
process.env.MAPBOX_TOKEN = "pk.test-token-very-long-string";

const { normalizeAddress, normalizeName } = await import("./clean.js");

// The geocode cache key MUST be deterministic — these tests are
// the contract that protects steady-state cache hit rate. If a
// future change breaks any of these, the worker starts re-
// geocoding every venue every run and quickly burns the free
// quota.

test("normalizeAddress: empty input → empty output", () => {
  assert.equal(normalizeAddress(""), "");
  assert.equal(normalizeAddress(null), "");
  assert.equal(normalizeAddress(undefined), "");
});

test("normalizeAddress: lowercases", () => {
  assert.equal(
    normalizeAddress("201 S ASHLAND AVE, CHICAGO, IL 60607"),
    "201 s ashland avenue, chicago, il",
  );
});

test("normalizeAddress: collapses suite/floor/apt", () => {
  assert.equal(
    normalizeAddress("3868 N Lincoln Ave 2ND FLOOR, Chicago, IL 60613"),
    "3868 n lincoln avenue , chicago, il",
  );
  // Comma punctuation survives between strip points; that's fine —
  // the cache key contract only needs determinism, not pretty
  // formatting. The double comma here is the same every time.
  assert.equal(
    normalizeAddress("123 Main St, Suite 200, Chicago, IL 60607"),
    "123 main street, , chicago, il",
  );
});

test("normalizeAddress: strips ZIP", () => {
  assert.equal(
    normalizeAddress("730 S Clark St, Chicago, IL 60605"),
    "730 s clark street, chicago, il",
  );
  assert.equal(
    normalizeAddress("100 W Madison St, Chicago, IL 60602-1234"),
    "100 w madison street, chicago, il",
  );
});

test("normalizeAddress: expands common street suffixes", () => {
  // st → street
  assert.match(normalizeAddress("100 N Main St"), /street/);
  // ave → avenue
  assert.match(normalizeAddress("100 N Main Ave"), /avenue/);
  // blvd → boulevard
  assert.match(normalizeAddress("100 N Lake Shore Blvd"), /boulevard/);
});

test("normalizeAddress: same input twice produces same output (determinism)", () => {
  const input = "201 S Ashland Ave, Suite 100, Chicago, IL 60607";
  assert.equal(normalizeAddress(input), normalizeAddress(input));
});

test("normalizeAddress: trailing comma/whitespace stripped", () => {
  assert.equal(normalizeAddress("123 Main Street, "), "123 main street");
});

test("normalizeAddress: punctuation normalized", () => {
  // "é" and "–" both become spaces, then runs collapse — output
  // is deterministic; that's what the cache key contract needs.
  assert.equal(
    normalizeAddress("Café Latin – 100 W Madison St"),
    "caf latin 100 w madison street",
  );
});

test("normalizeName: empty → empty", () => {
  assert.equal(normalizeName(""), "");
  assert.equal(normalizeName(null), "");
});

test("normalizeName: lowercases + strips punctuation", () => {
  assert.equal(normalizeName("Barcocina West Town"), "barcocina west town");
  assert.equal(
    normalizeName("Latin Street Music & Dancing Studio"),
    "latin street music dancing studio",
  );
  assert.equal(
    normalizeName("Alhambra Palace — Banquet Hall"),
    "alhambra palace banquet hall",
  );
});

test("normalizeName: deterministic across calls", () => {
  const input = "Latin Street Music & Dancing Studio";
  assert.equal(normalizeName(input), normalizeName(input));
});
