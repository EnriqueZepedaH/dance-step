import { z } from "zod";

// Worker env contract, validated at module load. Fails loudly if a
// required var is missing — Railway will surface the error in the
// service start logs.

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  MAPBOX_TOKEN: z.string().min(20),
  // Optional CSV gate (e.g. "gcal" to skip lsd during a manual run).
  // Empty/undefined means "run every enabled source from event_sources".
  INGEST_SOURCES: z.string().optional(),
});

export const env = schema.parse(process.env);
