"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { VideoCard } from "./VideoCard";
import { PlaylistPicker, type Playlist } from "./PlaylistPicker";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

type Props = {
  initialPlaylists: Playlist[];
  initialSavedIds: string[];
};

type SearchResponse =
  | { rateLimited: true }
  | { items: TrimmedItem[]; nextPageToken?: string; cached: boolean };

export function SearchPanel({ initialPlaylists, initialSavedIds }: Props) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 400);
  const [items, setItems] = useState<TrimmedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialSavedIds),
  );
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [pickerVideo, setPickerVideo] = useState<TrimmedItem | null>(null);

  // Debounced fetch effect. react-hooks/set-state-in-effect flags any
  // synchronous setState in an effect, but a debounced async fetch
  // legitimately needs the early-return reset and the loading flag
  // to land synchronously when the query changes — async results
  // cannot be derived during render. The disable is scoped to this
  // single effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setError(null);
      setRateLimited(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json() as Promise<SearchResponse>)
      .then((data) => {
        if (cancelled) return;
        if ("rateLimited" in data) {
          setItems([]);
          setRateLimited(true);
          return;
        }
        setRateLimited(false);
        setItems(data.items);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Search failed.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="search-panel">
      <input
        className="search-input"
        type="search"
        placeholder="Search YouTube — e.g. casino festival"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search YouTube"
      />

      {loading && <p className="search-status">Searching…</p>}
      {rateLimited && (
        <p className="search-status">
          YouTube&rsquo;s daily quota is used up. Try again tomorrow, or open
          your saved bookmarks.
        </p>
      )}
      {error && <p className="search-status">Search failed: {error}</p>}
      {!loading && !rateLimited && !error && debounced.trim().length >= 2 && items.length === 0 && (
        <p className="search-status">No results.</p>
      )}

      <div className="results-grid">
        {items.map((v) => (
          <VideoCard
            key={v.videoId}
            video={v}
            saved={savedIds.has(v.videoId)}
            onSave={() => setPickerVideo(v)}
          />
        ))}
      </div>

      {pickerVideo && (
        <PlaylistPicker
          video={pickerVideo}
          playlists={playlists}
          onClose={() => setPickerVideo(null)}
          onPlaylistCreated={(p) => setPlaylists((prev) => [p, ...prev])}
          onSaved={() => {
            const v = pickerVideo;
            setSavedIds((prev) => {
              const next = new Set(prev);
              next.add(v.videoId);
              return next;
            });
            setPickerVideo(null);
          }}
        />
      )}
    </div>
  );
}
