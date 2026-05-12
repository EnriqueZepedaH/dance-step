import { test, mock } from "node:test";
import assert from "node:assert/strict";

// env.ts reads MAPBOX_TOKEN at module load; set before import.
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-very-long-string";
process.env.MAPBOX_TOKEN = "pk.test-token-very-long-string";

const { geocodeAddress } = await import("./geocode.js");

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return mock.method(globalThis, "fetch", async () => ({
    ok,
    status,
    statusText: ok ? "OK" : "ERR",
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as Response);
}

test("geocodeAddress: hit with neighborhood in context", async () => {
  mockFetchOnce({
    features: [
      {
        center: [-87.6731, 41.8901],
        place_name: "Barcocina, 2901 W Armitage Ave, Chicago, IL 60647",
        context: [
          { id: "neighborhood.123", text: "Logan Square" },
          { id: "locality.456", text: "Chicago" },
          { id: "place.789", text: "Chicago" },
        ],
      },
    ],
  });
  const hit = await geocodeAddress("Barcocina, 2901 W Armitage Ave");
  assert.ok(hit);
  assert.equal(hit!.lat, 41.8901);
  assert.equal(hit!.lng, -87.6731);
  assert.equal(hit!.neighborhood, "Logan Square");
  assert.match(hit!.placeName, /Barcocina/);
});

test("geocodeAddress: hit without neighborhood falls back to locality", async () => {
  mockFetchOnce({
    features: [
      {
        center: [-87.65, 41.88],
        place_name: "Some Address",
        context: [{ id: "locality.1", text: "Chicago" }],
      },
    ],
  });
  const hit = await geocodeAddress("Some Address");
  assert.ok(hit);
  assert.equal(hit!.neighborhood, "Chicago");
});

test("geocodeAddress: no neighborhood or locality returns null neighborhood", async () => {
  mockFetchOnce({
    features: [{ center: [-87.65, 41.88], place_name: "x", context: [] }],
  });
  const hit = await geocodeAddress("x");
  assert.ok(hit);
  assert.equal(hit!.neighborhood, null);
});

test("geocodeAddress: empty features returns null", async () => {
  mockFetchOnce({ features: [] });
  const hit = await geocodeAddress("nowhere");
  assert.equal(hit, null);
});

test("geocodeAddress: non-OK response returns null", async () => {
  mockFetchOnce({ message: "Forbidden" }, false, 403);
  const hit = await geocodeAddress("anywhere");
  assert.equal(hit, null);
});
