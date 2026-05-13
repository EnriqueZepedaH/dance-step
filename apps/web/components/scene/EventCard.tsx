import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  MapPin,
} from "lucide-react";
import type { SceneEvent } from "./SceneShell";
import { EventDescription } from "./EventDescription";

type Props = {
  event: SceneEvent;
};

// Time is rendered in the EVENT'S timezone (venue's tz), not the
// viewer's, so "Tuesday 8pm" looks the same wherever you're
// reading from. For Chicago events (only city in v1) this is
// always America/Chicago.
function makeFmt(timeZone: string) {
  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone,
    }),
    day: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      timeZone,
    }),
    weekday: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }),
  };
}

export function EventCard({ event }: Props) {
  const fmt = makeFmt(event.timezone);
  const start = new Date(event.startsUtc);
  const end = event.endsUtc ? new Date(event.endsUtc) : null;
  const timeLabel = end
    ? `${fmt.time.format(start)} – ${fmt.time.format(end)}`
    : fmt.time.format(start);

  return (
    <article className="event-card">
      <div className="event-card-top">
        <div className="event-card-date" aria-hidden>
          <span>{fmt.month.format(start)}</span>
          <strong>{fmt.day.format(start)}</strong>
        </div>

        <div className="event-card-main">
          <div className="event-card-head">
            <Link
              href={`/scene/events/${event.id}`}
              className="event-card-title"
            >
              {event.title}
            </Link>
            <div className="event-card-pills">
              {event.kind ? <span className="pill">{event.kind}</span> : null}
            </div>
          </div>

          <div className="event-card-meta-list">
            <div className="event-card-meta">
              <CalendarDays size={15} strokeWidth={1.7} aria-hidden />
              <time dateTime={event.startsUtc}>
                {fmt.weekday.format(start)} · {timeLabel}
              </time>
            </div>

            <div className="event-card-meta">
              <MapPin size={15} strokeWidth={1.7} aria-hidden />
              <span>{event.venue.name}</span>
              {event.venue.neighborhood ? (
                <span className="row-meta"> · {event.venue.neighborhood}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <EventDescription
        description={event.description}
        className="event-card-body"
        maxLength={260}
      />

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
