"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EventsMap, type VenueWithEvents } from "./EventsMap";
import type { SceneEvent } from "./SceneShell";

type Props = {
  events: SceneEvent[];
  mapboxToken: string | undefined;
};

const SHORT_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export function SceneMapView({ events, mapboxToken }: Props) {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const venues: VenueWithEvents[] = useMemo(() => {
    const m = new Map<string, VenueWithEvents>();
    for (const e of events) {
      const existing = m.get(e.venue.id);
      const lite = {
        id: e.id,
        title: e.title,
        starts_at: e.startsUtc,
        kind: e.kind,
      };
      if (existing) existing.events.push(lite);
      else {
        m.set(e.venue.id, {
          id: e.venue.id,
          name: e.venue.name,
          neighborhood: e.venue.neighborhood,
          lat: e.venue.lat,
          lng: e.venue.lng,
          events: [lite],
        });
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  return (
    <div className="scene-map-view">
      <aside className="scene-map-sidebar" aria-label="Venues">
        {venues.length === 0 ? (
          <p className="search-status">No events match these filters.</p>
        ) : (
          <ul className="scene-map-venue-list">
            {venues.map((v) => {
              const active = selectedVenueId === v.id;
              const next = v.events[0];
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    className={`scene-map-venue${active ? " is-active" : ""}`}
                    onClick={() => setSelectedVenueId(active ? null : v.id)}
                    aria-pressed={active}
                  >
                    <span className="scene-map-venue-name">{v.name}</span>
                    {v.neighborhood ? (
                      <span className="scene-map-venue-hood">
                        {v.neighborhood}
                      </span>
                    ) : null}
                    <span className="scene-map-venue-count">
                      {v.events.length}{" "}
                      {v.events.length === 1 ? "event" : "events"}
                    </span>
                    {next ? (
                      <span className="scene-map-venue-next">
                        Next: {SHORT_FMT.format(new Date(next.starts_at))}
                      </span>
                    ) : null}
                  </button>
                  {active ? (
                    <ul className="scene-map-venue-events">
                      {v.events.slice(0, 5).map((ev) => (
                        <li key={ev.id}>
                          <Link
                            href={`/scene/events/${ev.id}`}
                            className="scene-map-venue-event"
                          >
                            <span>{ev.title}</span>
                            <span className="row-meta">
                              {SHORT_FMT.format(new Date(ev.starts_at))}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="scene-map-canvas">
        <EventsMap
          venues={venues}
          mapboxToken={mapboxToken}
          selectedVenueId={selectedVenueId}
          onSelectVenue={setSelectedVenueId}
        />
      </div>
    </div>
  );
}
