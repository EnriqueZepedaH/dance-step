import { createHash } from "node:crypto";

// Canonical JSON serializer for content_hash. Hashes the
// NormalizedEvent so that two runs producing the same logical
// event collide on hash — the heartbeat path in reconcile.ts
// depends on this stability.
//
// Object keys are sorted recursively before stringification, so a
// fetcher emitting fields in a different order (or adding a
// nullish field) still hashes the same. Arrays preserve order
// (that IS semantically meaningful — recurrence days, etc.).

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
  }
  return sorted;
}
