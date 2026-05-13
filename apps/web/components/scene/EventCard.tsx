import Link from "next/link";
import { CalendarPlus, ExternalLink, MapPin } from "lucide-react";
import type { SceneEvent } from "./SceneShell";

type Props = {
  event: SceneEvent;
  sourceLabel: string | null;
};

// Time is rendered in the EVENT'S timezone (venue's tz), not the
// viewer's, so "Tuesday 8pm" looks the same wherever you're
// reading from. For Chicago events (only city in v1) this is
// always America/Chicago.
function makeFmt(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function EventCard({ event, sourceLabel }: Props) {
  const fmt = makeFmt(event.timezone);
  const start = new Date(event.startsUtc);
  const end = event.endsUtc ? new Date(event.endsUtc) : null;

  return (
    <article className="event-card">
      <div className="event-card-head">
        <Link href={`/scene/events/${event.id}`} className="event-card-title">
          {event.title}
        </Link>
        {sourceLabel ? (
          <span className="pill pill-mute" title={`from ${sourceLabel}`}>
            via {sourceLabel}
          </span>
        ) : null}
      </div>

      <div className="event-card-meta">
        <time dateTime={event.startsUtc}>{fmt.format(start)}</time>
        {end ? <span> – {fmt.format(end)}</span> : null}
      </div>

      <div className="event-card-meta">
        <MapPin size={14} strokeWidth={1.7} aria-hidden />{" "}
        <span>{event.venue.name}</span>
        {event.venue.neighborhood ? (
          <span className="row-meta"> · {event.venue.neighborhood}</span>
        ) : null}
      </div>

      {event.description ? (
        <p className="event-card-body">{event.description.slice(0, 240)}{event.description.length > 240 ? "…" : ""}</p>
      ) : null}

      <div className="event-card-actions">
        <a
          className="event-card-action"
          href={`/api/scene/events/${event.id}/ics`}
        >
          <CalendarPlus size={14} strokeWidth={1.7} aria-hidden />{" "}
          Add to calendar
        </a>
        {event.sourceUrl ? (
          <a
            className="event-card-action"
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} strokeWidth={1.7} aria-hidden />{" "}
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
