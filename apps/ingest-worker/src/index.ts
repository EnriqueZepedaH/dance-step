// Worker entrypoint. Designed to be invoked once per Railway Cron
// tick (NOT a long-running daemon). Imports runIngest, awaits the
// summary, and exits cleanly with the right status code so Railway
// marks each cron-run accurately.

import { env } from "./env.js";
import { supabase } from "./db.js";
import { runIngest } from "./ingest/run.js";

async function main(): Promise<void> {
  const sourceFilter = env.INGEST_SOURCES
    ? env.INGEST_SOURCES.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      msg: "ingest-worker start",
      source_filter: sourceFilter ?? "all-enabled",
    }),
  );

  const summary = await runIngest(supabase, {
    sourceFilter,
    now: new Date(),
  });

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      msg: "ingest-worker summary",
      run_started_at: summary.runStartedAt,
      per_source: summary.perSource,
    }),
  );

  // Exit non-zero if any source failed. Railway uses the exit
  // code to mark the cron run success/failed.
  const anyFailed = summary.perSource.some((s) => s.status === "failed");
  if (anyFailed) {
    process.exit(2);
  }
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        msg: "ingest-worker crashed",
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }),
    );
    process.exit(1);
  },
);
