import { test } from "node:test";
import assert from "node:assert/strict";

import { computeFieldsEdited } from "./fieldsEdited";
import type { ExtractedEvent } from "@/lib/llm/extractedSchema";

const baseExtraction: ExtractedEvent = {
  title: "Salsa Social",
  description: "DJ + open floor",
  startsLocal: "2026-06-12T21:00",
  endsLocal: null,
  venueName: "Estudio Centro",
  venueAddress: "Av. Madero 123",
  city: "Aguascalientes",
  country: "MX",
  timezone: "America/Mexico_City",
  kind: "social",
  sourceUrl: null,
  confidence: { title: 0.95 },
  warnings: [],
};

test("computeFieldsEdited: no changes → empty list", () => {
  const edited = computeFieldsEdited(baseExtraction, {
    title: baseExtraction.title,
    description: baseExtraction.description,
    startsLocal: baseExtraction.startsLocal,
    endsLocal: baseExtraction.endsLocal,
    venueName: baseExtraction.venueName,
    venueAddress: baseExtraction.venueAddress,
    city: baseExtraction.city,
    country: baseExtraction.country,
    timezone: baseExtraction.timezone,
    kind: baseExtraction.kind,
    sourceUrl: baseExtraction.sourceUrl,
  });
  assert.deepEqual(edited, []);
});

test("computeFieldsEdited: title edit shows up", () => {
  const edited = computeFieldsEdited(baseExtraction, {
    ...baseExtraction,
    title: "Salsa Social — Fixed Name",
  });
  assert.deepEqual(edited, ["title"]);
});

test("computeFieldsEdited: multiple edits", () => {
  const edited = computeFieldsEdited(baseExtraction, {
    ...baseExtraction,
    title: "X",
    venueAddress: "Different address",
    kind: "class",
  });
  assert.deepEqual(edited.sort(), ["kind", "title", "venueAddress"]);
});

test("computeFieldsEdited: null vs undefined collapse to no change", () => {
  // current snapshot may omit a field that the extraction had as null;
  // both serialize to JSON null and should NOT count as an edit.
  const edited = computeFieldsEdited(baseExtraction, {
    ...baseExtraction,
    endsLocal: undefined,
  });
  assert.deepEqual(edited, []);
});

test("computeFieldsEdited: null → string counts as edited", () => {
  const edited = computeFieldsEdited(baseExtraction, {
    ...baseExtraction,
    sourceUrl: "https://example.com/event",
  });
  assert.deepEqual(edited, ["sourceUrl"]);
});

test("computeFieldsEdited: ignores fields outside the tracked list", () => {
  // confidence isn't tracked — mutating it must not show up.
  const edited = computeFieldsEdited(baseExtraction, {
    ...baseExtraction,
    // @ts-expect-error intentional: testing untracked-field behavior
    confidence: { title: 0.1 },
  });
  assert.deepEqual(edited, []);
});
