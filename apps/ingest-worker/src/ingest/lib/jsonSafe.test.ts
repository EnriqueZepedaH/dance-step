import { test } from "node:test";
import assert from "node:assert/strict";
import { toJsonSafe } from "./jsonSafe.js";

test("toJsonSafe: primitives pass through", () => {
  assert.equal(toJsonSafe("hello"), "hello");
  assert.equal(toJsonSafe(42), 42);
  assert.equal(toJsonSafe(true), true);
  assert.equal(toJsonSafe(null), null);
  assert.equal(toJsonSafe(undefined), null);
});

test("toJsonSafe: Date becomes ISO string", () => {
  const d = new Date("2026-05-13T12:34:56.000Z");
  assert.equal(toJsonSafe(d), "2026-05-13T12:34:56.000Z");
});

test("toJsonSafe: invalid Date becomes null", () => {
  assert.equal(toJsonSafe(new Date(Number.NaN)), null);
});

test("toJsonSafe: bigint becomes string", () => {
  assert.equal(toJsonSafe(BigInt("123456789012345678901234")), "123456789012345678901234");
});

test("toJsonSafe: Infinity/NaN become null", () => {
  assert.equal(toJsonSafe(Number.POSITIVE_INFINITY), null);
  assert.equal(toJsonSafe(Number.NaN), null);
});

test("toJsonSafe: function and symbol become null at top level", () => {
  assert.equal(
    toJsonSafe(() => 1),
    null,
  );
  assert.equal(toJsonSafe(Symbol("x")), null);
});

test("toJsonSafe: nested object recurses, drops undefined fields", () => {
  const input = {
    title: "Salsa Tuesdays",
    when: new Date("2026-05-13T20:00:00.000Z"),
    notes: undefined,
    venue: { name: "Barcocina", lat: 41.89, lng: -87.66 },
  };
  const out = toJsonSafe(input) as Record<string, unknown>;
  assert.deepEqual(out, {
    title: "Salsa Tuesdays",
    when: "2026-05-13T20:00:00.000Z",
    venue: { name: "Barcocina", lat: 41.89, lng: -87.66 },
  });
  // undefined-keyed entries are dropped
  assert.ok(!("notes" in out));
});

test("toJsonSafe: arrays preserve order, functions become null inside arrays", () => {
  const out = toJsonSafe([1, "two", new Date("2026-05-13T00:00:00.000Z"), () => 3]);
  assert.deepEqual(out, [1, "two", "2026-05-13T00:00:00.000Z", null]);
});

test("toJsonSafe: circular reference produces [Circular] marker", () => {
  type Self = { name: string; me?: Self };
  const a: Self = { name: "loop" };
  a.me = a;
  const out = toJsonSafe(a) as { name: string; me: string };
  assert.equal(out.name, "loop");
  assert.equal(out.me, "[Circular]");
});

test("toJsonSafe: respects toJSON() when present (mimics RRule)", () => {
  class FakeRRule {
    toJSON() {
      return { freq: "WEEKLY", interval: 1, byweekday: ["TU"] };
    }
  }
  const out = toJsonSafe(new FakeRRule()) as Record<string, unknown>;
  assert.deepEqual(out, { freq: "WEEKLY", interval: 1, byweekday: ["TU"] });
});

test("toJsonSafe: round-trips through JSON.stringify without error", () => {
  type Cyclic = { id: number; self?: Cyclic; date: Date };
  const cyclic: Cyclic = { id: 1, date: new Date("2026-01-01T00:00:00.000Z") };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => JSON.stringify(toJsonSafe(cyclic)));
});
