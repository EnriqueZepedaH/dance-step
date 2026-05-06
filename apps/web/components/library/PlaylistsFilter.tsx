"use client";

import { useMemo, useState } from "react";
import { PlaylistRow } from "./PlaylistRow";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  itemsCount: number;
};

type SortKey = "recent" | "name" | "size";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Most recent",
  name: "Name (A→Z)",
  size: "Most videos",
};

type Props = { playlists: PlaylistSummary[] };

export function PlaylistsFilter({ playlists }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = trimmed
      ? playlists.filter((p) => p.name.toLowerCase().includes(trimmed))
      : playlists;

    const ordered = [...filtered];
    switch (sort) {
      case "name":
        ordered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "size":
        ordered.sort((a, b) => b.itemsCount - a.itemsCount);
        break;
      case "recent":
      default:
        ordered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return ordered;
  }, [playlists, query, sort]);

  if (playlists.length === 0) {
    return (
      <p className="search-status">
        No playlists yet. Save a video and pick &ldquo;New playlist&rdquo;
        to start one.
      </p>
    );
  }

  return (
    <>
      <div className="playlist-filter">
        <input
          type="search"
          className="playlist-filter-input"
          placeholder="Filter playlists by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter playlists"
        />
        <label className="playlist-filter-sort">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="search-status">No playlists match &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="playlist-list">
          {visible.map((p) => (
            <PlaylistRow
              key={p.id}
              id={p.id}
              name={p.name}
              description={p.description}
            />
          ))}
        </ul>
      )}
    </>
  );
}
