import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FetchedEventArraySchema } from "./schema.js";

const HERE = dirname(fileURLToPath(import.meta.url));

async function load(name: string): Promise<unknown> {
  const text = await readFile(join(HERE, name), "utf8");
  return JSON.parse(text);
}

test("gcal.fixture.json parses as FetchedEvent[]", async () => {
  const data = await load("gcal.fixture.json");
  const result = FetchedEventArraySchema.safeParse(data);
  if (!result.success) {
    assert.fail(
      `gcal fixture failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
    );
  }
  assert.ok(result.data.length >= 5, "expected at least 5 gcal fixtures");
});

test("lsd.fixture.json parses as FetchedEvent[]", async () => {
  const data = await load("lsd.fixture.json");
  const result = FetchedEventArraySchema.safeParse(data);
  if (!result.success) {
    assert.fail(
      `lsd fixture failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
    );
  }
  assert.ok(result.data.length >= 5, "expected at least 5 lsd fixtures");
});

test("fixtures have unique sourceEventIds within each file", async () => {
  for (const file of ["gcal.fixture.json", "lsd.fixture.json"]) {
    const data = (await load(file)) as Array<{ sourceEventId: string }>;
    const ids = new Set<string>();
    for (const row of data) {
      assert.ok(
        !ids.has(row.sourceEventId),
        `${file} has duplicate sourceEventId: ${row.sourceEventId}`,
      );
      ids.add(row.sourceEventId);
    }
  }
});
