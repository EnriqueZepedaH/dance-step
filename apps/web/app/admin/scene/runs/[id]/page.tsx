import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Single ingest_run detail. Shows the run row + a breakdown of
// outcomes from raw_events + the most recent rows for spot-checking.
// The 'log' jsonb is currently always [] (worker logs to stdout,
// not into the row), but reserved here so we can wire it without
// touching this page.

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "America/Chicago",
});

function pill(status: string) {
  const cls =
    status === "success" || status === "inserted" || status === "unchanged" || status === "updated"
      ? "pill pill-ok"
      : status === "failed" || status === "rejected"
      ? "pill pill-bad"
      : status === "duplicate"
      ? "pill pill-warn"
      : "pill pill-mute";
  return <span className={cls}>{status}</span>;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = getSupabaseAdminClient();

  const { data: run } = await admin
    .from("ingest_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const { data: raw } = await admin
    .from("raw_events")
    .select("id, source_event_id, outcome, outcome_detail, fetched_at, promoted_event_id, processed")
    .eq("run_id", id)
    .order("fetched_at", { ascending: false })
    .limit(50);

  const rows = raw ?? [];

  const byOutcome = new Map<string, number>();
  for (const r of rows) {
    const k = r.outcome ?? "no_outcome";
    byOutcome.set(k, (byOutcome.get(k) ?? 0) + 1);
  }

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Scene · Runs</span>
      <h1 className="display">Run · {run.source}</h1>
      <p className="lede">
        Started {dateFmt.format(new Date(run.started_at))} ·{" "}
        {pill(run.status)}{" "}
        {run.error ? <span className="row-meta"> · error: {run.error}</span> : null}
      </p>

      <div className="admin-actions" style={{ marginTop: 8 }}>
        <Link href="/admin/scene/runs">← all runs</Link>
        <Link href={`/admin/scene/sources`}>sources</Link>
      </div>

      <h2 style={{ marginTop: 32 }}>Counts</h2>
      <ul className="run-counts">
        <li>Fetched: {run.fetched_count}</li>
        <li>Staged: {run.staged_count}</li>
        <li>Promoted: {run.promoted_count}</li>
        <li>Rejected: {run.rejected_count}</li>
        <li>Archived: {run.archived_count}</li>
      </ul>

      <h2 style={{ marginTop: 24 }}>Raw events (last 50)</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>source_event_id</th>
              <th>Outcome</th>
              <th>Detail</th>
              <th>Fetched</th>
              <th>Promoted to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code style={{ font: "12px monospace" }}>{r.source_event_id}</code></td>
                <td>{pill(r.outcome ?? "pending")}</td>
                <td>{r.outcome_detail ?? "—"}</td>
                <td>{dateFmt.format(new Date(r.fetched_at))}</td>
                <td>
                  {r.promoted_event_id ? (
                    <code style={{ font: "11px monospace" }}>{r.promoted_event_id.slice(0, 8)}</code>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(byOutcome).length > 0 ? (
        <p className="row-meta" style={{ marginTop: 12 }}>
          On this page: {[...byOutcome.entries()]
            .map(([k, v]) => `${v} ${k}`)
            .join(", ")}
        </p>
      ) : null}
    </section>
  );
}
