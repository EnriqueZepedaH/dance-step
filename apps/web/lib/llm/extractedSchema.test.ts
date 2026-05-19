import { test } from "node:test";
import assert from "node:assert/strict";

import { ExtractedSchema } from "./extractedSchema";

// The contract for what Claude can return. If this drifts and the
// route stops Zod-validating, prompt-injected fields could slip
// through. These tests are the canary.

test("ExtractedSchema: accepts a complete, well-formed extraction", () => {
  const parsed = ExtractedSchema.parse({
    title: "Salsa Social at Estudio Centro",
    description: "Live DJ, doors at 9pm.",
    startsLocal: "2026-06-12T21:00",
    endsLocal: "2026-06-13T02:00",
    venueName: "Estudio Centro",
    venueAddress: "Av. Madero 123, Aguascalientes",
    city: "Aguascalientes",
    country: "MX",
    timezone: "America/Mexico_City",
    kind: "social",
    sourceUrl: "https://example.com/event",
    confidence: { title: 0.95, startsLocal: 0.8 },
    warnings: [],
  });
  assert.equal(parsed.country, "MX");
  assert.equal(parsed.kind, "social");
});

test("ExtractedSchema: null fields allowed for everything except confidence/warnings", () => {
  const parsed = ExtractedSchema.parse({
    title: null,
    description: null,
    startsLocal: null,
    endsLocal: null,
    venueName: null,
    venueAddress: null,
    city: null,
    country: null,
    timezone: null,
    kind: null,
    sourceUrl: null,
    confidence: {},
    warnings: [],
  });
  assert.equal(parsed.title, null);
});

test("ExtractedSchema: rejects malformed startsLocal", () => {
  assert.throws(() =>
    ExtractedSchema.parse({
      title: "x",
      description: null,
      startsLocal: "06/12/2026 9:00pm",
      endsLocal: null,
      venueName: null,
      venueAddress: null,
      city: null,
      country: null,
      timezone: null,
      kind: null,
      sourceUrl: null,
      confidence: {},
      warnings: [],
    }),
  );
});

test("ExtractedSchema: rejects country that isn't 2 chars", () => {
  assert.throws(() =>
    ExtractedSchema.parse({
      title: null,
      description: null,
      startsLocal: null,
      endsLocal: null,
      venueName: null,
      venueAddress: null,
      city: null,
      country: "Mexico",
      timezone: null,
      kind: null,
      sourceUrl: null,
      confidence: {},
      warnings: [],
    }),
  );
});

test("ExtractedSchema: rejects unknown kind", () => {
  assert.throws(() =>
    ExtractedSchema.parse({
      title: null,
      description: null,
      startsLocal: null,
      endsLocal: null,
      venueName: null,
      venueAddress: null,
      city: null,
      country: null,
      timezone: null,
      kind: "party",
      sourceUrl: null,
      confidence: {},
      warnings: [],
    }),
  );
});

test("ExtractedSchema: rejects confidence values outside 0–1", () => {
  assert.throws(() =>
    ExtractedSchema.parse({
      title: null,
      description: null,
      startsLocal: null,
      endsLocal: null,
      venueName: null,
      venueAddress: null,
      city: null,
      country: null,
      timezone: null,
      kind: null,
      sourceUrl: null,
      confidence: { title: 1.5 },
      warnings: [],
    }),
  );
});
