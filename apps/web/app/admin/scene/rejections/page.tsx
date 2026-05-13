import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PromoteRejectionButton } from "@/components/admin/PromoteRejectionButton";

// Open quality_rejections (resolved=false). Cross-source dupes get
// their own /admin/scene/duplicates page; here we show everything
// else (ungeocodable_venue, suspicious_title, past_date, etc).

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

type NormalizedPreview = {
  title?: string;
  startsUtc?: string;
  venue?: { name?: string; address?: string | null };
  sourceUrl?: string | null;
};

function reasonPill(code: string) {
  const cls =
    code === "cross_source_dup" ? "pill pill-warn"
    : code === "ungeocodable_venue" ? "pill pill-warn"
    : "pill pill-bad";
  return <span className={cls}>{code}</span>;
}

export default async function RejectionsPage() {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("quality_rejections")
    .select(
      "id, reason_code, reason_detail, created_at, raw_event_id, raw_events(source, source_event_id, normalized)",
    )
    .eq("resolved", false)
    .neq("reason_code", "cross_source_dup")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    reason_code: string;
    reason_detail: string | null;
    created_at: string;
    raw_events: { source: string; source_event_id: string; normalized: NormalizedPreview } | null;
  }>;

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Scene · Rejections</span>
      <h1 className="display">Open rejections ({rows.length}).</h1>
      <p className="lede">
        Raw events the worker filtered out before they could reach{" "}
        <code>events</code>. Cross-source duplicates live on the
        Duplicates page; this view is for quality-gate failures
        like ungeocodable venues and suspicious titles.
      </p>

      {rows.length === 0 ? (
        <p className="search-status">All clear — no open rejections.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Detail</th>
                <th>Title (extracted)</th>
                <th>Starts</th>
                <th>Source</th>
                <th>Promote</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const n = r.raw_events?.normalized;
                const venue = n?.venue?.name ?? "—";
                return (
                  <tr key={r.id}>
                    <td>{reasonPill(r.reason_code)}</td>
                    <td>
                      {r.reason_detail ? r.reason_detail.slice(0, 80) : "—"}
                      <div className="row-meta">
                        {dateFmt.format(new Date(r.created_at))}
                      </div>
                    </td>
                    <td>
                      {n?.title ?? "—"}
                      <div className="row-meta">{venue}</div>
                    </td>
                    <td>
                      {n?.startsUtc
                        ? dateFmt.format(new Date(n.startsUtc))
                        : "—"}
                    </td>
                    <td>
                      <code style={{ font: "11px monospace" }}>
                        {r.raw_events?.source}
                      </code>
                    </td>
                    <td><PromoteRejectionButton id={r.id} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
