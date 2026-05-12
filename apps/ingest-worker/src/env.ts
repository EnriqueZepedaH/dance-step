import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";

// In local dev, load apps/ingest-worker/.env.local if present.
// Railway provides env vars via the dashboard, so this no-ops in
// production. Built-in Node API since v20.12.
const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = resolve(HERE, "..", ".env.local");
if (existsSync(ENV_FILE)) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(ENV_FILE);
}

// Worker env contract, validated at module load. Fails loudly if a
// required var is missing — Railway will surface the error in the
// service start logs.

// Accept either the canonical worker var names OR the matching
// Next-side names so the user can copy values verbatim from
// apps/web/.env.local without renaming. Railway will populate the
// canonical names from its dashboard.
const rawSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  MAPBOX_TOKEN: z.string().min(20).optional(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(20).optional(),
  INGEST_SOURCES: z.string().optional(),
});

const raw = rawSchema.parse(process.env);
const supabaseUrl = raw.SUPABASE_URL ?? raw.NEXT_PUBLIC_SUPABASE_URL;
const mapboxToken = raw.MAPBOX_TOKEN ?? raw.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!supabaseUrl) {
  throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
}
if (!mapboxToken) {
  throw new Error("Set MAPBOX_TOKEN (or NEXT_PUBLIC_MAPBOX_TOKEN).");
}

export const env = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: raw.SUPABASE_SERVICE_ROLE_KEY,
  MAPBOX_TOKEN: mapboxToken,
  INGEST_SOURCES: raw.INGEST_SOURCES,
};
