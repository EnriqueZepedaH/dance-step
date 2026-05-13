"use client";

import { useMemo } from "react";
import { EventCard } from "./EventCard";
import type { SceneEvent } from "./SceneShell";
import {
  chicagoToday,
  chipParts,
  formatChicagoLongDate,
  generateRailDates,
  toChicagoDateKey,
  type DateKey,
} from "@/lib/scene/dates";

type Props = {
  events: SceneEvent[];
  selectedDate: DateKey | null;
  onSelectDate: (next: DateKey | null) => void;
};

const RAIL_LENGTH = 14;

export function SceneListView({
  events,
  selectedDate,
  onSelectDate,
}: Props) {
  const today = chicagoToday();
  const rail = useMemo(() => generateRailDates(RAIL_LENGTH, today), [today]);

  const groups = useMemo(() => {
    // Group filtered events by Chicago-local date key. Time within a
    // date stays naturally sorted because the parent already sorted
    // by startsUtc.
    const byKey = new Map<DateKey, SceneEvent[]>();
    for (const e of events) {
      const key = toChicagoDateKey(e.startsUtc);
      if (selectedDate && key !== selectedDate) continue;
      const bucket = byKey.get(key);
      if (bucket) bucket.push(e);
      else byKey.set(key, [e]);
    }
    return [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [events, selectedDate]);

  return (
    <div className="scene-list-view">
      <div className="scene-rail" role="tablist" aria-label="Pick a date">
        <button
          type="button"
          role="tab"
          aria-selected={selectedDate === null}
          className={`scene-chip${selectedDate === null ? " is-active" : ""}`}
          onClick={() => onSelectDate(null)}
        >
          <span className="scene-chip-dow">All</span>
          <span className="scene-chip-day">Upcoming</span>
        </button>
        {rail.map((key) => {
          const parts = chipParts(key);
          const isToday = key === today;
          const active = selectedDate === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`scene-chip${active ? " is-active" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => onSelectDate(active ? null : key)}
            >
              <span className="scene-chip-dow">
                {isToday ? "Today" : parts.dow}
              </span>
              <span className="scene-chip-day">{parts.day}</span>
              <span className="scene-chip-month">{parts.month}</span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <p className="search-status">No events match the selected filters.</p>
      ) : (
        <div className="scene-list-groups">
          {groups.map(([key, items]) => (
            <section key={key} className="scene-list-group">
              <h2 className="scene-list-group-head">
                {key === today ? "Today · " : ""}
                {formatChicagoLongDate(key)}
              </h2>
              <div className="scene-list">
                {items.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
