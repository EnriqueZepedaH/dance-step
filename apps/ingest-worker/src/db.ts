import { createClient } from "@supabase/supabase-js";
import type { Database } from "@dancestep/db";
import { env } from "./env.js";

// Service-role client. RLS is bypassed; the worker has full write
// access to ingest_runs / raw_events / events / venues. Never expose
// this client to user-facing code.

export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
