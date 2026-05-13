import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DuplicateActions } from "@/components/admin/DuplicateActions";

// Cross-source duplicate review. Each rejection has duplicate_of
// pointing at the existing events row. Side-by-side comparison
// helps the admin choose between Merge (keep existing) and
// Replace (archive existing, promote candidate).

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

type Normalized = {
  title?: string;
  startsUtc?: string;
  venue?: { name?: string; address?: string | null };
  sourceUrl?: string | null;
  description?: string | null;
};

type RejRow = {
  id: string;
  reason_detail: string | null;
  created_at: string;
  duplicate_of: string | null;
  raw_events: {
    source: string;
    source_event_id: string;
    normalized: Normalized;
  } | null;
};

type ExistingRow = {
  id: string;
  title: string;
  starts_at: string;
  source: string | null;
  source_event_id: string | null;
  venues: { name: string; address: string | null } | null;
};

export default async function DuplicatesPage() {
  const admin = getSupabaseAdminClient();
  const { data: rejs } = await admin
    .from("quality_rejections")
    .select(
      "id, reason_detail, created_at, duplicate_of, raw_events(source, source_event_id, normalized)",
    )
    .eq("resolved", false)
    .eq("reason_code", "cross_source_dup")
    .order("created_at", { ascending: false })
    .limit(100);

  const rejections = (rejs ?? []) as unknown as RejRow[];
  const duplicateIds = [
    ...new Set(
      rejections.map((r) => r.duplicate_of).filter((x): x is string => !!x),
    ),
  ];

  const existingById = new Map<string, ExistingRow>();
  if (duplicateIds.length > 0) {
    const { data: existing } = await admin
      .from("events")
      .select("id, title, starts_at, source, source_event_id, venues(name, address)")
      .in("id", duplicateIds);
    for (const row of (existing ?? []) as unknown as ExistingRow[]) {
      existingById.set(row.id, row);
    }
  }

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Scene · Duplicates</span>
      <h1 className="display">Cross-source duplicates ({rejections.length}).</h1>
      <p className="lede">
        The worker thinks these candidates are the same event as one
        already in the DB. Merge to keep the existing row; Replace
        if the candidate is the better representation.
      </p>

      {rejections.length === 0 ? (
        <p className="search-status">All clear — no open duplicates.</p>
      ) : (
        <ul className="dup-list">
          {rejections.map((r) => {
            const cand = r.raw_events?.normalized;
            const existing = r.duplicate_of ? existingById.get(r.duplicate_of) : null;
            return (
              <li key={r.id} className="dup-card">
                <div className="dup-meta row-meta">
                  Detected {dateFmt.format(new Date(r.created_at))}
                  {r.reason_detail ? <> · {r.reason_detail}</> : null}
                </div>
                <div className="dup-pair">
                  <div className="dup-side">
                    <h3>Existing (in events)</h3>
                    {existing ? (
                      <>
                        <div className="dup-title">{existing.title}</div>
                        <div className="row-meta">
                          {dateFmt.format(new Date(existing.starts_at))} ·{" "}
                          {existing.venues?.name ?? "—"}
                        </div>
                        <div className="row-meta">
                          source:{" "}
                          <code style={{ font: "11px monospace" }}>
                            {existing.source ?? "admin"}
                          </code>
                        </div>
                      </>
                    ) : (
                      <div className="row-meta">existing event missing — was it deleted?</div>
                    )}
                  </div>
                  <div className="dup-side">
                    <h3>Candidate (raw_event)</h3>
                    <div className="dup-title">{cand?.title ?? "—"}</div>
                    <div className="row-meta">
                      {cand?.startsUtc
                        ? dateFmt.format(new Date(cand.startsUtc))
                        : "—"}{" "}
                      · {cand?.venue?.name ?? "—"}
                    </div>
                    <div className="row-meta">
                      source:{" "}
                      <code style={{ font: "11px monospace" }}>
                        {r.raw_events?.source}
                      </code>
                    </div>
                  </div>
                </div>
                <DuplicateActions id={r.id} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
