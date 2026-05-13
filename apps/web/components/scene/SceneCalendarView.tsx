"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { SceneEvent } from "./SceneShell";
import {
  chicagoCurrentMonth,
  chicagoToday,
  compareMonthKeys,
  formatChicagoLongDate,
  monthRange,
  shiftMonth,
  toChicagoDateKey,
  type DateKey,
  type MonthKey,
} from "@/lib/scene/dates";

type Props = {
  events: SceneEvent[];
  month: MonthKey;
  onMonthChange: (next: MonthKey) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

export function SceneCalendarView({ events, month, onMonthChange }: Props) {
  // Group events by Chicago-local date once; both desktop grid and
  // mobile stack consume the same map.
  const byDate = useMemo(() => {
    const m = new Map<DateKey, SceneEvent[]>();
    for (const e of events) {
      const key = toChicagoDateKey(e.startsUtc);
      const bucket = m.get(key);
      if (bucket) bucket.push(e);
      else m.set(key, [e]);
    }
    return m;
  }, [events]);

  // Clamp the prev/next nav to the months actually covered by the
  // fetched horizon (today's month → ~+2 months out). If there are
  // no events, the user can still see the current month.
  const { minMonth, maxMonth } = useMemo(() => {
    if (events.length === 0) {
      const cur = chicagoCurrentMonth();
      return { minMonth: cur, maxMonth: cur };
    }
    let lo = "9999-12";
    let hi = "0000-01";
    for (const e of events) {
      const mk = toChicagoDateKey(e.startsUtc).slice(0, 7);
      if (mk < lo) lo = mk;
      if (mk > hi) hi = mk;
    }
    const today = chicagoCurrentMonth();
    if (lo > today) lo = today;
    return { minMonth: lo, maxMonth: hi };
  }, [events]);

  const effectiveMonth =
    compareMonthKeys(month, minMonth) < 0
      ? minMonth
      : compareMonthKeys(month, maxMonth) > 0
        ? maxMonth
        : month;
  const grid = useMemo(() => monthRange(effectiveMonth), [effectiveMonth]);
  const today = chicagoToday();

  const canPrev =
    compareMonthKeys(shiftMonth(effectiveMonth, -1), minMonth) >= 0;
  const canNext =
    compareMonthKeys(shiftMonth(effectiveMonth, 1), maxMonth) <= 0;

  const stackedDays = grid.days.filter((k) => byDate.has(k));

  return (
    <div className="scene-calendar-view">
      <div className="scene-calendar-nav">
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            canPrev && onMonthChange(shiftMonth(effectiveMonth, -1))
          }
          disabled={!canPrev}
          aria-label="Previous month"
        >
          ←
        </button>
        <h2 className="scene-calendar-label">{grid.label}</h2>
        <button
          type="button"
          className="btn btn-small"
          onClick={() =>
            canNext && onMonthChange(shiftMonth(effectiveMonth, 1))
          }
          disabled={!canNext}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="scene-calendar-grid" role="grid" aria-label={grid.label}>
        <div className="scene-calendar-row scene-calendar-weekdays" role="row">
          {WEEKDAYS.map((d) => (
            <div key={d} className="scene-calendar-weekday" role="columnheader">
              {d}
            </div>
          ))}
        </div>
        <div className="scene-calendar-row scene-calendar-days" role="row">
          {Array.from({ length: grid.firstWeekday }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="scene-calendar-cell is-pad"
              aria-hidden
            />
          ))}
          {grid.days.map((key) => {
            const items = byDate.get(key) ?? [];
            const isToday = key === today;
            return (
              <div
                key={key}
                className={`scene-calendar-cell${isToday ? " is-today" : ""}${items.length === 0 ? " is-empty" : ""}`}
                role="gridcell"
              >
                <div className="scene-calendar-cell-head">
                  <span className="scene-calendar-daynum">
                    {Number(key.slice(8, 10))}
                  </span>
                  {items.length > 0 ? (
                    <span className="scene-calendar-daycount">
                      {items.length}
                    </span>
                  ) : null}
                </div>
                {items.length > 0 ? (
                  <ul className="scene-calendar-events">
                    {items.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/scene/events/${e.id}`}
                          className="scene-calendar-event"
                        >
                          <span className="scene-calendar-event-time">
                            {TIME_FMT.format(new Date(e.startsUtc))}
                          </span>
                          <span className="scene-calendar-event-title">
                            {e.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {items.length > 3 ? (
                      <li className="scene-calendar-event-more">
                        +{items.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="scene-calendar-stack">
        {stackedDays.length === 0 ? (
          <p className="search-status">No events scheduled this month.</p>
        ) : (
          stackedDays.map((key) => (
            <section key={key} className="scene-calendar-stack-day">
              <h3 className="scene-calendar-stack-head">
                {formatChicagoLongDate(key)}
              </h3>
              <ul className="scene-calendar-stack-list">
                {(byDate.get(key) ?? []).map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/scene/events/${e.id}`}
                      className="scene-calendar-event"
                    >
                      <span className="scene-calendar-event-time">
                        {TIME_FMT.format(new Date(e.startsUtc))}
                      </span>
                      <span className="scene-calendar-event-title">
                        {e.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
