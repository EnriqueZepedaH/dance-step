// Worker entrypoint. Designed to be invoked once per Railway Cron
// tick (NOT a long-running daemon). Imports runIngest, awaits the
// summary, and exits cleanly with the right status code so Railway
// marks the cron-run success/failed accurately.
//
// Branch F lands this stub; branch P fills in runIngest in
// ./ingest/run.ts.

async function main(): Promise<void> {
  // Lazy require so failures in env.ts surface as a process-level
  // crash with the zod parse error, not a missed dynamic import.
  await import("./env.js");
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      msg: "ingest-worker entrypoint hit — runIngest lands in branch P",
    }),
  );
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
      }),
    );
    process.exit(1);
  },
);
