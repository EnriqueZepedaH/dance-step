"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { VideoCard } from "./VideoCard";
import type { PlaylistOption } from "./AddToPlaylistPopover";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

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

type BookmarkInfo = { bookmarkId: string; playlistIds: Set<string> };

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
  const [bookmarks, setBookmarks] = useState<Map<string, BookmarkInfo>>(
    () =>
      new Map(
        initialBookmarks.map((b) => [
          b.youtubeId,
          { bookmarkId: b.bookmarkId, playlistIds: new Set(b.playlistIds) },
        ]),
      ),
  );
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [busyPlaylistEdge, setBusyPlaylistEdge] = useState<Set<string>>(
    new Set(),
  );

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

  // Ensure the bookmark exists; returns the bookmarkId (existing or new).
  // Updates local state with the new bookmark.
  async function ensureBookmark(video: TrimmedItem): Promise<string> {
    const existing = bookmarks.get(video.videoId);
    if (existing) return existing.bookmarkId;

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
    if (!res.ok) throw new Error("Could not save bookmark.");
    const { bookmark } = (await res.json()) as { bookmark: { id: string } };

    setBookmarks((prev) => {
      const next = new Map(prev);
      next.set(video.videoId, {
        bookmarkId: bookmark.id,
        playlistIds: new Set(),
      });
      return next;
    });
    return bookmark.id;
  }

  async function handleToggleSave(video: TrimmedItem) {
    await withSaving(video.videoId, async () => {
      const existing = bookmarks.get(video.videoId);
      if (existing) {
        const res = await fetch(
          `/api/bookmarks?youtubeId=${encodeURIComponent(video.videoId)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          setError("Could not remove bookmark.");
          return;
        }
        setBookmarks((prev) => {
          const next = new Map(prev);
          next.delete(video.videoId);
          return next;
        });
      } else {
        try {
          await ensureBookmark(video);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed.");
        }
      }
    });
  }

  async function handleTogglePlaylist(video: TrimmedItem, playlistId: string) {
    await withBusyEdge(video.videoId, playlistId, async () => {
      try {
        const bookmarkId = await ensureBookmark(video);
        const inPlaylist = bookmarks
          .get(video.videoId)
          ?.playlistIds.has(playlistId);

        if (inPlaylist) {
          const res = await fetch(
            `/api/playlists/${playlistId}/items?bookmarkId=${encodeURIComponent(bookmarkId)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error("Could not remove from playlist.");
          setBookmarks((prev) => {
            const next = new Map(prev);
            const cur = next.get(video.videoId);
            if (cur) {
              const ids = new Set(cur.playlistIds);
              ids.delete(playlistId);
              next.set(video.videoId, { ...cur, playlistIds: ids });
            }
            return next;
          });
        } else {
          const res = await fetch(`/api/playlists/${playlistId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookmarkId }),
          });
          if (!res.ok) throw new Error("Could not add to playlist.");
          setBookmarks((prev) => {
            const next = new Map(prev);
            const cur = next.get(video.videoId);
            if (cur) {
              const ids = new Set(cur.playlistIds);
              ids.add(playlistId);
              next.set(video.videoId, { ...cur, playlistIds: ids });
            }
            return next;
          });
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

    const bookmarkId = await ensureBookmark(video);
    const itemRes = await fetch(`/api/playlists/${playlist.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarkId }),
    });
    if (!itemRes.ok) throw new Error("Saved playlist, but couldn't add video.");

    setBookmarks((prev) => {
      const next = new Map(prev);
      const cur = next.get(video.videoId);
      if (cur) {
        const ids = new Set(cur.playlistIds);
        ids.add(playlist.id);
        next.set(video.videoId, { ...cur, playlistIds: ids });
      }
      return next;
    });

    // Re-run the layout's server component so the sidebar picks up the
    // new playlist row. Local state above already updates the popover
    // and the card; this keeps the left rail in sync without a reload.
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

      <div className="results-grid">
        {items.map((v) => {
          const info = bookmarks.get(v.videoId);
          const cardBusyEdges = new Set<string>();
          if (info) {
            for (const e of busyPlaylistEdge) {
              if (e.startsWith(`${v.videoId}::`)) {
                cardBusyEdges.add(e.split("::")[1]);
              }
            }
          }
          return (
            <VideoCard
              key={v.videoId}
              video={v}
              saved={Boolean(info)}
              saving={savingIds.has(v.videoId)}
              membership={info?.playlistIds ?? new Set()}
              busyPlaylistIds={cardBusyEdges}
              playlists={playlists}
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
