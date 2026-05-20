"use client";

import { useState } from "react";

type Props = {
  kind: string;
  kinds: string[];
  onKindChange: (next: string) => void;

  neighborhood: string;
  neighborhoods: string[];
  showNeighborhoodFilter: boolean;
  onNeighborhoodChange: (next: string) => void;

  count: number;
};

export function SceneFilters({
  kind,
  kinds,
  onKindChange,
  neighborhood,
  neighborhoods,
  showNeighborhoodFilter,
  onNeighborhoodChange,
  count,
}: Props) {
  const [open, setOpen] = useState(false);
  const hasAny = kinds.length > 0 || showNeighborhoodFilter;

  return (
    <div className="scene-filter-row">
      {hasAny ? (
        <button
          type="button"
          className="scene-filter-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          Filters{open ? " ▲" : " ▼"}
        </button>
      ) : null}

      <div
        className={`scene-filters${open ? " is-open" : ""}`}
        role="region"
        aria-label="Filters"
      >
        {kinds.length > 0 ? (
          <label className="scene-filter">
            <span>Kind</span>
            <select value={kind} onChange={(e) => onKindChange(e.target.value)}>
              <option value="all">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showNeighborhoodFilter ? (
          <label className="scene-filter">
            <span>Neighborhood</span>
            <select
              value={neighborhood}
              onChange={(e) => onNeighborhoodChange(e.target.value)}
            >
              <option value="all">All neighborhoods</option>
              {neighborhoods.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="scene-count">
        <strong>{count}</strong>{" "}
        <em>{count === 1 ? "event" : "events"}</em>
      </div>
    </div>
  );
}
