"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SceneViewNav } from "./SceneViewNav";
import { SceneFilters } from "./SceneFilters";
import { SceneListView } from "./SceneListView";
import { SceneCalendarView } from "./SceneCalendarView";
import { SceneMapView } from "./SceneMapView";
import {
  chicagoCurrentMonth,
  isValidDateKey,
  isValidMonthKey,
  type DateKey,
  type MonthKey,
} from "@/lib/scene/dates";

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

export type SceneViewMode = "list" | "calendar" | "map";

type Props = {
  events: SceneEvent[];
  sourceNames: Record<string, string>;
  mapboxToken: string | undefined;
  initialMonth: MonthKey;
};

const NEIGHBORHOOD_MIN = 3;
const VALID_VIEWS: SceneViewMode[] = ["list", "calendar", "map"];

function parseView(raw: string | null, fallback: SceneViewMode): SceneViewMode {
  return raw && (VALID_VIEWS as string[]).includes(raw)
    ? (raw as SceneViewMode)
    : fallback;
}

export function SceneShell({
  events,
  sourceNames,
  mapboxToken,
  initialMonth,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the source of truth for view/date/month. Missing view/date
  // intentionally mean default list view and no selected date, even
  // after client-side query updates.
  const view = parseView(searchParams.get("view"), "list");
  const dateParam = searchParams.get("date");
  const monthParam = searchParams.get("month");
  const selectedDate: DateKey | null = isValidDateKey(dateParam)
    ? dateParam
    : null;
  const month: MonthKey = isValidMonthKey(monthParam)
    ? monthParam
    : initialMonth;

  const [kind, setKind] = useState<string>("all");
  const [neighborhood, setNeighborhood] = useState<string>("all");

  const { kinds, neighborhoods } = useMemo(() => {
    const k = new Set<string>();
    const n = new Set<string>();
    for (const e of events) {
      if (e.kind) k.add(e.kind);
      if (e.venue.neighborhood) n.add(e.venue.neighborhood);
    }
    return { kinds: [...k].sort(), neighborhoods: [...n].sort() };
  }, [events]);

  const showNeighborhoodFilter = neighborhoods.length >= NEIGHBORHOOD_MIN;

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (
        showNeighborhoodFilter &&
        neighborhood !== "all" &&
        e.venue.neighborhood !== neighborhood
      ) {
        return false;
      }
      return true;
    });
  }, [events, kind, neighborhood, showNeighborhoodFilter]);

  const pushQuery = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setView = useCallback(
    (next: SceneViewMode) => {
      pushQuery((p) => {
        if (next === "list") p.delete("view");
        else p.set("view", next);
        // Clear view-specific params so toggling views doesn't carry
        // stale `date`/`month` keys into a view that ignores them.
        if (next !== "list") p.delete("date");
        if (next !== "calendar") p.delete("month");
      });
    },
    [pushQuery],
  );

  const setSelectedDate = useCallback(
    (next: DateKey | null) => {
      pushQuery((p) => {
        if (next) p.set("date", next);
        else p.delete("date");
      });
    },
    [pushQuery],
  );

  const setMonth = useCallback(
    (next: MonthKey) => {
      pushQuery((p) => {
        if (next === chicagoCurrentMonth()) p.delete("month");
        else p.set("month", next);
      });
    },
    [pushQuery],
  );

  return (
    <div className="scene-shell">
      <div className="scene-controls">
        <SceneViewNav view={view} onChange={setView} />
        <SceneFilters
          kind={kind}
          kinds={kinds}
          onKindChange={setKind}
          neighborhood={neighborhood}
          neighborhoods={neighborhoods}
          showNeighborhoodFilter={showNeighborhoodFilter}
          onNeighborhoodChange={setNeighborhood}
          count={filtered.length}
        />
      </div>

      {view === "list" ? (
        <SceneListView
          events={filtered}
          sourceNames={sourceNames}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      ) : view === "calendar" ? (
        <SceneCalendarView
          events={filtered}
          month={month}
          onMonthChange={setMonth}
        />
      ) : (
        <SceneMapView events={filtered} mapboxToken={mapboxToken} />
      )}
    </div>
  );
}
