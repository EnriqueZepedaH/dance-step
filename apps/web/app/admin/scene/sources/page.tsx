import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { SourceToggle } from "@/components/admin/SourceToggle";

// Source registry view. event_sources is public-readable for the
// /scene UI to show "via X" pills, but its writes are admin-only;
// we hit it via the service-role client here. The denormalized
// last_run_* columns on event_sources let us avoid a join.
//
// Counts column hits events filtered by source.

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

function statusPill(status: string | null) {
  if (!status) return <span className="pill pill-mute">never run</span>;
  const cls =
    status === "success" ? "pill pill-ok"
    : status === "failed" ? "pill pill-bad"
    : "pill pill-warn";
  return <span className={cls}>{status}</span>;
}

export default async function SourcesPage() {
  const admin = getSupabaseAdminClient();

  const [{ data: sources }, { data: counts }] = await Promise.all([
    admin
      .from("event_sources")
      .select("*")
      .order("key", { ascending: true }),
    admin
      .from("events")
      .select("source")
      .eq("status", "published")
      .not("source", "is", null),
  ]);

  const publishedBySource = new Map<string, number>();
  for (const row of counts ?? []) {
    if (!row.source) continue;
    publishedBySource.set(row.source, (publishedBySource.get(row.source) ?? 0) + 1);
  }

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Scene · Sources</span>
      <h1 className="display">Ingestion sources.</h1>
      <p className="lede">
        Sources the Railway worker pulls from on each cron tick. The
        last-run pill reflects the most recent run; click through to
        see the full history.
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Last run</th>
              <th>Published</th>
              <th>Toggle</th>
            </tr>
          </thead>
          <tbody>
            {(sources ?? []).map((s) => (
              <tr key={s.key}>
                <td>
                  <div>{s.display_name}</div>
                  <div className="row-meta">{s.key} · {s.city}</div>
                </td>
                <td>
                  <span className="pill pill-mute">{s.kind}</span>
                </td>
                <td>
                  {statusPill(s.last_status)}
                  {s.last_run_id ? (
                    <>
                      {" · "}
                      <Link href={`/admin/scene/runs/${s.last_run_id}`}>
                        view
                      </Link>
                    </>
                  ) : null}
                </td>
                <td>
                  {s.last_run_at
                    ? dateFmt.format(new Date(s.last_run_at))
                    : "—"}
                </td>
                <td>{publishedBySource.get(s.key) ?? 0}</td>
                <td>
                  <SourceToggle sourceKey={s.key} initial={s.enabled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
