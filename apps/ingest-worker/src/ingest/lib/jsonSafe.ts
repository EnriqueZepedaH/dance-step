import type { Json } from "@dancestep/db";

// Converts an arbitrary value into a JSON-safe shape suitable for
// persisting into a Postgres jsonb column. The pipeline's
// raw_events.raw_payload comes through here before insert because
// node-ical events ship Date objects and RRule instances, and
// cheerio nodes can hold cyclic DOM references — both blow up
// JSON.stringify.
//
// Rules:
//   - undefined, function, symbol  → dropped (in objects) / null (in arrays)
//   - Date                         → ISO string
//   - bigint                       → string (Postgres jsonb can't hold bigints)
//   - objects/arrays               → recursed; cycles produce "[Circular]"
//   - anything with toJSON()       → calls it
//   - primitives                   → passed through

export function toJsonSafe(input: unknown): Json {
  return walk(input, new WeakSet());
}

function walk(value: unknown, seen: WeakSet<object>): Json {
  if (value === null || value === undefined) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value as Json;
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : null;
  if (t === "bigint") return (value as bigint).toString();
  if (t === "function" || t === "symbol") return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (typeof value === "object") {
    // Cycle guard. Re-visiting an object returns a marker string;
    // the dedup downstream uses content_hash on the normalized
    // payload, not the raw, so this poison value never affects
    // identity.
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);

    // Prefer the caller's own serializer (RRule.toJSON gives the
    // structured form; many libraries implement it).
    const obj = value as { toJSON?: () => unknown };
    if (typeof obj.toJSON === "function") {
      try {
        return walk(obj.toJSON(), seen);
      } catch {
        // fall through to generic walk
      }
    }

    if (Array.isArray(value)) {
      const out: Json[] = [];
      for (const item of value) out.push(walk(item, seen));
      return out;
    }

    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const safe = walk(v, seen);
      // Drop undefined-equivalents on objects so the persisted
      // payload stays compact.
      if (safe === null && v === undefined) continue;
      out[k] = safe;
    }
    return out;
  }

  return null;
}
