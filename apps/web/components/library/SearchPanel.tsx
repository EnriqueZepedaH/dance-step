"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { VideoCard } from "./VideoCard";
import { VideoZoomModal } from "./VideoZoomModal";
import type { PlaylistOption } from "./AddToPlaylistPopover";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

const HOVER_DELAY_MS = 400;

export type InitialBookmark = {
  bookmarkId: string;
  youtubeId: string;
  playlistIds: string[];
};

type Props = {
  initialPlaylists: PlaylistOption[];
  initialBookmarks: InitialBookmark[];
};

type SearchResponse =
  | { rateLimited: true }
  | { items: TrimmedItem[]; nextPageToken?: string; cached: boolean };

export function SearchPanel({ initialPlaylists, initialBookmarks }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 400);
  const [items, setItems] = useState<TrimmedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const [playlists, setPlaylists] = useState<PlaylistOption[]>(initialPlaylists);
  // Two independent stores after migration 0004: a saved set keyed
  // by youtubeId (bookmark presence), and a per-video set of
  // playlist ids it belongs to. Removing a bookmark no longer
  // affects memberships and vice versa.
  const [savedIds, setSavedIds] = useState<Set<string>>(
    () => new Set(initialBookmarks.map((b) => b.youtubeId)),
  );
  const [memberships, setMemberships] = useState<Map<string, Set<string>>>(
    () =>
      new Map(
        initialBookmarks.map((b) => [b.youtubeId, new Set(b.playlistIds)]),
      ),
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [busyPlaylistEdge, setBusyPlaylistEdge] = useState<Set<string>>(
    new Set(),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  function handleHoverStart(videoId: string) {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setHoveredId(videoId);
    }, HOVER_DELAY_MS);
  }
  function handleHoverEnd() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoveredId(null);
  }

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

  // Mark a transient saving spinner on a video; cleanup when the awaited
  // mutation resolves regardless of outcome.
  function withSaving<T>(youtubeId: string, run: () => Promise<T>): Promise<T> {
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(youtubeId);
      return next;
    });
    return run().finally(() => {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(youtubeId);
        return next;
      });
    });
  }

  function edgeKey(youtubeId: string, playlistId: string) {
    return `${youtubeId}::${playlistId}`;
  }
  function withBusyEdge<T>(
    youtubeId: string,
    playlistId: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const key = edgeKey(youtubeId, playlistId);
    setBusyPlaylistEdge((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    return run().finally(() => {
      setBusyPlaylistEdge((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  }

  function addMembership(youtubeId: string, playlistId: string) {
    setMemberships((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(youtubeId) ?? []);
      cur.add(playlistId);
      next.set(youtubeId, cur);
      return next;
    });
  }
  function removeMembership(youtubeId: string, playlistId: string) {
    setMemberships((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(youtubeId) ?? []);
      cur.delete(playlistId);
      next.set(youtubeId, cur);
      return next;
    });
  }

  async function handleToggleSave(video: TrimmedItem) {
    await withSaving(video.videoId, async () => {
      if (savedIds.has(video.videoId)) {
        const res = await fetch(
          `/api/bookmarks?youtubeId=${encodeURIComponent(video.videoId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          setError("Could not remove bookmark.");
          return;
        }
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(video.videoId);
          return next;
        });
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeId: video.videoId,
            title: video.title,
            channel: video.channelTitle,
            thumbnail: video.thumbnail,
          }),
        });
        if (!res.ok) {
          setError("Could not save bookmark.");
          return;
        }
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(video.videoId);
          return next;
        });
      }
    });
  }

  async function handleTogglePlaylist(video: TrimmedItem, playlistId: string) {
    await withBusyEdge(video.videoId, playlistId, async () => {
      const inPlaylist = memberships.get(video.videoId)?.has(playlistId);
      try {
        if (inPlaylist) {
          const res = await fetch(
            `/api/playlists/${playlistId}/items?youtubeId=${encodeURIComponent(video.videoId)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error("Could not remove from playlist.");
          removeMembership(video.videoId, playlistId);
        } else {
          const res = await fetch(`/api/playlists/${playlistId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              youtubeId: video.videoId,
              title: video.title,
              channel: video.channelTitle,
              thumbnail: video.thumbnail,
            }),
          });
          if (!res.ok) throw new Error("Could not add to playlist.");
          addMembership(video.videoId, playlistId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Playlist update failed.");
      }
    });
  }

  async function handleCreatePlaylistFor(video: TrimmedItem, name: string) {
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not create playlist.");
    }
    const { playlist } = (await res.json()) as {
      playlist: { id: string; name: string };
    };
    setPlaylists((prev) => [{ id: playlist.id, name: playlist.name }, ...prev]);

    const itemRes = await fetch(`/api/playlists/${playlist.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        youtubeId: video.videoId,
        title: video.title,
        channel: video.channelTitle,
        thumbnail: video.thumbnail,
      }),
    });
    if (!itemRes.ok) throw new Error("Saved playlist, but couldn't add video.");

    addMembership(video.videoId, playlist.id);

    startTransition(() => router.refresh());
  }

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
      {!loading &&
        !rateLimited &&
        !error &&
        debounced.trim().length >= 2 &&
        items.length === 0 && <p className="search-status">No results.</p>}

      {zoomedId
        ? (() => {
            const v = items.find((x) => x.videoId === zoomedId);
            if (!v) return null;
            const cardBusyEdges = new Set<string>();
            for (const e of busyPlaylistEdge) {
              if (e.startsWith(`${v.videoId}::`)) {
                cardBusyEdges.add(e.split("::")[1]);
              }
            }
            return (
              <VideoZoomModal
                video={v}
                saved={savedIds.has(v.videoId)}
                saving={savingIds.has(v.videoId)}
                membership={memberships.get(v.videoId) ?? new Set()}
                busyPlaylistIds={cardBusyEdges}
                playlists={playlists}
                onClose={() => setZoomedId(null)}
                onToggleSave={() => handleToggleSave(v)}
                onTogglePlaylist={(pid) => handleTogglePlaylist(v, pid)}
                onCreatePlaylist={(name) => handleCreatePlaylistFor(v, name)}
              />
            );
          })()
        : null}

      <div className="results-grid">
        {items.map((v) => {
          const cardBusyEdges = new Set<string>();
          for (const e of busyPlaylistEdge) {
            if (e.startsWith(`${v.videoId}::`)) {
              cardBusyEdges.add(e.split("::")[1]);
            }
          }
          return (
            <VideoCard
              key={v.videoId}
              video={v}
              saved={savedIds.has(v.videoId)}
              saving={savingIds.has(v.videoId)}
              membership={memberships.get(v.videoId) ?? new Set()}
              busyPlaylistIds={cardBusyEdges}
              playlists={playlists}
              isHovered={hoveredId === v.videoId}
              onHoverStart={() => handleHoverStart(v.videoId)}
              onHoverEnd={handleHoverEnd}
              onZoom={() => {
                handleHoverEnd();
                setZoomedId(v.videoId);
              }}
              onToggleSave={() => handleToggleSave(v)}
              onTogglePlaylist={(pid) => handleTogglePlaylist(v, pid)}
              onCreatePlaylist={(name) => handleCreatePlaylistFor(v, name)}
            />
          );
        })}
      </div>
    </div>
  );
}
