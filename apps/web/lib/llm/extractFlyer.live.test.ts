import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

// Live extraction test against Claude Vision. Gated by env so it
// stays out of CI runs that don't have either:
//
//   ANTHROPIC_API_KEY    - real key, will spend tokens
//   FLYER_FIXTURE_PATH   - absolute path to a flyer image (jpg/png/webp)
//
// Optional:
//   FLYER_FIXTURE_EXPECTED - JSON snippet of fields to assert against,
//     e.g. {"city":"Aguascalientes","country":"MX"}
//
// Real flyers are kept out of the repo by policy (see
// __fixtures__/README.md). Use a personal or synthetic flyer locally.

const MIME_FROM_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const fixturePath = process.env.FLYER_FIXTURE_PATH;
const apiKey = process.env.ANTHROPIC_API_KEY;
const shouldRun = Boolean(apiKey && fixturePath);

if (!shouldRun) {
  test("extractFlyer (live): skipped — no ANTHROPIC_API_KEY + FLYER_FIXTURE_PATH", () => {
    console.log(
      "[skip] set ANTHROPIC_API_KEY and FLYER_FIXTURE_PATH to run live extraction",
    );
  });
} else {
  test("extractFlyer (live): extracts a real flyer end-to-end", async () => {
    const path = fixturePath!;
    const ext = extname(path).toLowerCase();
    const mime = MIME_FROM_EXT[ext];
    if (!mime) {
      throw new Error(`unsupported fixture extension: ${ext}`);
    }

    // Lazy import — keeps env validation from blowing up the test
    // process when the key isn't set.
    const { extractFlyer } = await import("./extractFlyer.js");

    const buf = await readFile(path);
    const result = await extractFlyer({
      imageBase64: buf.toString("base64"),
      mime,
    });

    assert.ok(result.latencyMs > 0, "latency should be measured");
    assert.ok(result.usage.input > 0, "input tokens should be > 0");
    assert.ok(result.usage.output > 0, "output tokens should be > 0");
    assert.equal(
      result.usage.total,
      result.usage.input + result.usage.output,
      "total tokens matches input+output",
    );
    assert.ok(result.extracted.confidence, "confidence map present");

    const expected = process.env.FLYER_FIXTURE_EXPECTED;
    if (expected) {
      const want = JSON.parse(expected) as Record<string, unknown>;
      for (const [key, value] of Object.entries(want)) {
        assert.equal(
          (result.extracted as unknown as Record<string, unknown>)[key],
          value,
          `extracted.${key}`,
        );
      }
    }
  });
}
