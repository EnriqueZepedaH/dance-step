"use client";

import { useMemo, useState } from "react";
import { EventsMap, type VenueWithEvents } from "./EventsMap";
import { EventCard } from "./EventCard";

export type SceneEvent = {
  id: string;
  title: string;
  description: string | null;
  startsUtc: string;
  endsUtc: string | null;
  kind: string | null;
  source: string | null;
  sourceUrl: string | null;
  timezone: string;
  venue: {
    id: string;
    name: string;
    neighborhood: string | null;
    lat: number;
    lng: number;
    timezone: string;
  };
};

type Props = {
  events: SceneEvent[];
  sourceNames: Record<string, string>;
  mapboxToken: string | undefined;
};

type ViewMode = "map" | "list";
type TimeWindow = "today" | "week" | "all";

const NEIGHBORHOOD_MIN = 3; // hide neighborhood filter unless ≥3 venues have one

export function SceneShell({ events, sourceNames, mapboxToken }: Props) {
  const [view, setView] = useState<ViewMode>("list");
  const [kind, setKind] = useState<string>("all");
  const [neighborhood, setNeighborhood] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { kinds, neighborhoods } = useMemo(() => {
    const k = new Set<string>();
    const n = new Set<string>();
    for (const e of events) {
      if (e.kind) k.add(e.kind);
      if (e.venue.neighborhood) n.add(e.venue.neighborhood);
    }
    return {
      kinds: [...k].sort(),
      neighborhoods: [...n].sort(),
    };
  }, [events]);

  const showNeighborhoodFilter = neighborhoods.length >= NEIGHBORHOOD_MIN;

  const filtered = useMemo(() => {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    return events.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (
        showNeighborhoodFilter &&
        neighborhood !== "all" &&
        e.venue.neighborhood !== neighborhood
      ) {
        return false;
      }
      const ts = new Date(e.startsUtc).getTime();
      if (timeWindow === "today" && ts > todayEnd.getTime()) return false;
      if (timeWindow === "week" && ts > weekEnd.getTime()) return false;
      if (ts < now) return false;
      return true;
    });
  }, [events, kind, neighborhood, timeWindow, showNeighborhoodFilter]);

  const venuesForMap: VenueWithEvents[] = useMemo(() => {
    const byVenue = new Map<string, VenueWithEvents>();
    for (const e of filtered) {
      const existing = byVenue.get(e.venue.id);
      if (existing) {
        existing.events.push({
          id: e.id,
          title: e.title,
          starts_at: e.startsUtc,
          kind: e.kind,
        });
      } else {
        byVenue.set(e.venue.id, {
          id: e.venue.id,
          name: e.venue.name,
          neighborhood: e.venue.neighborhood,
          lat: e.venue.lat,
          lng: e.venue.lng,
          events: [
            {
              id: e.id,
              title: e.title,
              starts_at: e.startsUtc,
              kind: e.kind,
            },
          ],
        });
      }
    }
    return [...byVenue.values()];
  }, [filtered]);

  return (
    <div className="scene-shell">
      <div className="scene-controls">
        <div className="scene-view-toggle" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={view === "list" ? "is-active" : ""}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "map"}
            className={view === "map" ? "is-active" : ""}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>

        <button
          type="button"
          className="scene-filter-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Filters{filtersOpen ? " ▲" : " ▼"}
        </button>

        <div
          className={`scene-filters${filtersOpen ? " is-open" : ""}`}
          role="region"
          aria-label="Filters"
        >
          <label className="scene-filter">
            <span>When</span>
            <div className="scene-radio-row">
              {(["today", "week", "all"] as TimeWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={timeWindow === w ? "is-active" : ""}
                  onClick={() => setTimeWindow(w)}
                >
                  {w === "today" ? "Today" : w === "week" ? "This week" : "Upcoming"}
                </button>
              ))}
            </div>
          </label>

          {kinds.length > 0 ? (
            <label className="scene-filter">
              <span>Kind</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="all">All kinds</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          ) : null}

          {showNeighborhoodFilter ? (
            <label className="scene-filter">
              <span>Neighborhood</span>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              >
                <option value="all">All neighborhoods</option>
                {neighborhoods.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="scene-count row-meta">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </div>
      </div>

      {view === "map" ? (
        <EventsMap venues={venuesForMap} mapboxToken={mapboxToken} />
      ) : (
        <div className="scene-list">
          {filtered.length === 0 ? (
            <p className="search-status">
              No events match these filters.
            </p>
          ) : (
            filtered.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                sourceLabel={
                  e.source ? sourceNames[e.source] ?? e.source : null
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
