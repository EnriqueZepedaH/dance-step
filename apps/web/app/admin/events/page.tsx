import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeleteEventButton } from "@/components/admin/DeleteEventButton";

// Read-only list view of every event in the DB. RLS allows admin
// role full access via events_admin_write + the public select
// policy. Future enhancement: filter by upcoming-only / kind /
// venue. v1 keeps it as a flat sortable table.

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export default async function AdminEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, kind, venues(name, neighborhood)")
    .order("starts_at", { ascending: true });

  if (error) console.error("admin events query failed", error);
  const events = data ?? [];

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Events</span>
      <h1 className="display">Events ({events.length})</h1>

      <div className="admin-actions">
        <Link href="/admin/events/new" className="btn">
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="search-status">No events yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>When (Chicago)</th>
                <th>Venue</th>
                <th>Kind</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.title}</td>
                  <td>{dateFmt.format(new Date(e.starts_at))}</td>
                  <td>
                    {e.venues?.name ?? "—"}
                    {e.venues?.neighborhood ? (
                      <span className="row-meta"> · {e.venues.neighborhood}</span>
                    ) : null}
                  </td>
                  <td>{e.kind ?? "—"}</td>
                  <td className="row-actions">
                    <Link href={`/admin/events/${e.id}/edit`}>Edit</Link>
                    <span> · </span>
                    <DeleteEventButton id={e.id} title={e.title} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
