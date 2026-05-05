import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public event detail. Times are formatted server-side with an
// explicit America/Chicago timeZone so the same string renders on
// both server prerender and client hydration (Vercel runs in UTC,
// so an unspecified-tz format would diverge from the user's clock).

type Venue = {
  id: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type EventDetail = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  kind: string | null;
  description: string | null;
  url: string | null;
  venues: Venue | null;
};

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Chicago",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, ends_at, kind, description, url, venues(id, name, neighborhood, address, lat, lng)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("event detail query failed", error);
  if (!data) notFound();

  const event = data as unknown as EventDetail;
  const venue = event.venues;

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const dateLabel = longDateFmt.format(start);
  const timeLabel = end
    ? `${timeFmt.format(start)} – ${timeFmt.format(end)}`
    : timeFmt.format(start);

  const mapsUrl =
    venue?.lat && venue.lng
      ? `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`
      : null;

  return (
    <section className="page-shell">
      <p>
        <Link href="/scene" className="lede-link">
          ← Back to the map
        </Link>
      </p>

      {event.kind ? (
        <span className="eyebrow bullet">{event.kind} · Chicago</span>
      ) : (
        <span className="eyebrow bullet">Event · Chicago</span>
      )}
      <h1 className="display">{event.title}</h1>

      <dl className="event-meta">
        <div>
          <dt>When</dt>
          <dd>
            {dateLabel}
            <br />
            <span className="event-time">{timeLabel}</span>
            <span className="event-tz"> · America/Chicago</span>
          </dd>
        </div>
        {venue ? (
          <div>
            <dt>Where</dt>
            <dd>
              <strong>{venue.name}</strong>
              {venue.neighborhood ? (
                <>
                  <br />
                  <span>{venue.neighborhood}</span>
                </>
              ) : null}
              {venue.address ? (
                <>
                  <br />
                  <span className="event-address">{venue.address}</span>
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      {event.description ? (
        <p className="lede event-description">{event.description}</p>
      ) : null}

      <div className="event-actions">
        {mapsUrl ? (
          <a
            className="btn"
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
          </a>
        ) : null}
        {event.url ? (
          <a
            className="btn btn-ghost"
            href={event.url}
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        ) : null}
      </div>
    </section>
  );
}
