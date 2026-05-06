import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EventForm,
  type EventFormInitial,
} from "@/components/admin/EventForm";

// Convert a UTC ISO timestamp from the DB to the "YYYY-MM-DDTHH:mm"
// format an <input type="datetime-local"> expects, expressed in
// Chicago wall-clock so the admin sees what they originally entered.
function utcIsoToChicagoLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  }).formatToParts(new Date(iso));
  const part = (t: string) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  // Intl can produce "24" for midnight in some locales — normalize.
  const hour = part("hour") === "24" ? "00" : part("hour");
  return `${part("year")}-${part("month")}-${part("day")}T${hour}:${part("minute")}`;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [eventRes, venuesRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, kind, description, url, venue_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("venues")
      .select("id, name, neighborhood")
      .order("name", { ascending: true }),
  ]);

  if (!eventRes.data) notFound();
  const e = eventRes.data;

  const initial: EventFormInitial = {
    id: e.id,
    title: e.title,
    startsAtLocal: utcIsoToChicagoLocal(e.starts_at),
    endsAtLocal: e.ends_at ? utcIsoToChicagoLocal(e.ends_at) : null,
    kind: e.kind,
    description: e.description,
    url: e.url,
    venueId: e.venue_id,
  };

  return (
    <section className="page-shell">
      <p>
        <Link href="/admin/events" className="lede-link">
          ← Back to events
        </Link>
      </p>
      <span className="eyebrow bullet">Admin · Events</span>
      <h1 className="display">Edit · {e.title}</h1>
      <EventForm mode="edit" initial={initial} venues={venuesRes.data ?? []} />
    </section>
  );
}
