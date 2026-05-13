import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Ingest run history. RLS on ingest_runs is service-role only;
// fetched via the admin client. Paginate by 30 rows; the canonical
// health query "select * from ingest_runs order by started_at desc
// limit 10" is right at the top.

const PAGE_SIZE = 30;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

function statusPill(status: string) {
  const cls =
    status === "success" ? "pill pill-ok"
    : status === "failed" ? "pill pill-bad"
    : status === "in_progress" ? "pill pill-mute"
    : "pill pill-warn";
  return <span className={cls}>{status}</span>;
}

function durationMs(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = getSupabaseAdminClient();
  const { data, count } = await admin
    .from("ingest_runs")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(from, to);

  const rows = data ?? [];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Scene · Runs</span>
      <h1 className="display">Ingest run history.</h1>
      <p className="lede">
        Every cron tick produces one row per source. Click a run to
        see its JSON log and which raw events promoted, were
        rejected, or matched as cross-source duplicates.
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Started (Chicago)</th>
              <th>Source</th>
              <th>Status</th>
              <th>Fetched</th>
              <th>Promoted</th>
              <th>Rejected</th>
              <th>Archived</th>
              <th>Duration</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateFmt.format(new Date(r.started_at))}</td>
                <td>{r.source}</td>
                <td>{statusPill(r.status)}</td>
                <td>{r.fetched_count}</td>
                <td>{r.promoted_count}</td>
                <td>{r.rejected_count}</td>
                <td>{r.archived_count}</td>
                <td>{durationMs(r.started_at, r.finished_at)}</td>
                <td className="row-actions">
                  <Link href={`/admin/scene/runs/${r.id}`}>view</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="row-meta">
                  No runs yet — Railway worker hasn&rsquo;t fired its first cron tick.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="admin-actions" style={{ marginTop: 16 }}>
          {page > 1 ? (
            <Link href={`/admin/scene/runs?page=${page - 1}`}>← prev</Link>
          ) : null}
          <span className="row-meta">page {page} / {pageCount}</span>
          {page < pageCount ? (
            <Link href={`/admin/scene/runs?page=${page + 1}`}>next →</Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
