"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { VideoCard } from "./VideoCard";
import { VideoZoomModal } from "./VideoZoomModal";
import type { PlaylistOption } from "./AddToPlaylistPopover";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

export type SavedVideo = {
  bookmarkId: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  playlistIds: string[];
};

type Props = {
  initialBookmarks: SavedVideo[];
  initialPlaylists: PlaylistOption[];
};

const HOVER_DELAY_MS = 400;

// Saved videos as a card grid with hover-to-preview + click-to-zoom,
// mirroring the search panel and the playlists grid. Mutation flow
// is local-state-first: removing a bookmark drops the card
// immediately and closes the modal if it was open. Playlist
// memberships and the playlists list both live here so the zoom
// modal's add-to-playlist popover stays in sync without a refetch.

export function SavedVideosClient({
  initialBookmarks,
  initialPlaylists,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [bookmarks, setBookmarks] = useState<SavedVideo[]>(initialBookmarks);
  const [playlists, setPlaylists] =
    useState<PlaylistOption[]>(initialPlaylists);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [busyEdges, setBusyEdges] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function asTrimmed(b: SavedVideo): TrimmedItem {
    return {
      videoId: b.youtubeId,
      title: b.title,
      channelTitle: b.channel ?? "",
      thumbnail: b.thumbnailUrl ?? "",
    };
  }

  function handleHoverStart(id: string) {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => setHoveredId(id),
      HOVER_DELAY_MS,
    );
  }
  function handleHoverEnd() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoveredId(null);
  }

  function withSaving(youtubeId: string, run: () => Promise<void>) {
    setSavingIds((prev) => {
      const n = new Set(prev);
      n.add(youtubeId);
      return n;
    });
    return run().finally(() => {
      setSavingIds((prev) => {
        const n = new Set(prev);
        n.delete(youtubeId);
        return n;
      });
    });
  }

  function withBusyEdge(
    youtubeId: string,
    playlistId: string,
    run: () => Promise<void>,
  ) {
    const key = `${youtubeId}::${playlistId}`;
    setBusyEdges((prev) => {
      const n = new Set(prev);
      n.add(key);
      return n;
    });
    return run().finally(() => {
      setBusyEdges((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    });
  }

  async function handleRemove(b: SavedVideo) {
    await withSaving(b.youtubeId, async () => {
      const res = await fetch(
        `/api/bookmarks?youtubeId=${encodeURIComponent(b.youtubeId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setError("Could not remove bookmark.");
        return;
      }
      setBookmarks((prev) => prev.filter((x) => x.youtubeId !== b.youtubeId));
      if (zoomedId === b.youtubeId) setZoomedId(null);
    });
  }

  async function handleTogglePlaylist(b: SavedVideo, playlistId: string) {
    await withBusyEdge(b.youtubeId, playlistId, async () => {
      const inPlaylist = b.playlistIds.includes(playlistId);
      try {
        if (inPlaylist) {
          const res = await fetch(
            `/api/playlists/${playlistId}/items?youtubeId=${encodeURIComponent(b.youtubeId)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error("Could not remove from playlist.");
          setBookmarks((prev) =>
            prev.map((x) =>
              x.youtubeId === b.youtubeId
                ? {
                    ...x,
                    playlistIds: x.playlistIds.filter(
                      (id) => id !== playlistId,
                    ),
                  }
                : x,
            ),
          );
        } else {
          const res = await fetch(`/api/playlists/${playlistId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              youtubeId: b.youtubeId,
              title: b.title,
              channel: b.channel,
              thumbnail: b.thumbnailUrl,
            }),
          });
          if (!res.ok) throw new Error("Could not add to playlist.");
          setBookmarks((prev) =>
            prev.map((x) =>
              x.youtubeId === b.youtubeId
                ? { ...x, playlistIds: [...x.playlistIds, playlistId] }
                : x,
            ),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Playlist update failed.");
      }
    });
  }

  async function handleCreatePlaylist(b: SavedVideo, name: string) {
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
        youtubeId: b.youtubeId,
        title: b.title,
        channel: b.channel,
        thumbnail: b.thumbnailUrl,
      }),
    });
    if (!itemRes.ok) throw new Error("Saved playlist, but couldn't add video.");
    setBookmarks((prev) =>
      prev.map((x) =>
        x.youtubeId === b.youtubeId
          ? { ...x, playlistIds: [...x.playlistIds, playlist.id] }
          : x,
      ),
    );
    // The /library/my/playlists grid + the (browse) layout don't
    // currently consume this list, but other browse routes may, and
    // a refresh keeps server data honest after a mutation.
    startTransition(() => router.refresh());
  }

  if (bookmarks.length === 0) {
    return <SavedVideosEmptyState />;
  }

  const zoomedBookmark = zoomedId
    ? (bookmarks.find((b) => b.youtubeId === zoomedId) ?? null)
    : null;

  return (
    <>
      {error ? <p className="search-status">Error: {error}</p> : null}

      {zoomedBookmark ? (
        <VideoZoomModal
          video={asTrimmed(zoomedBookmark)}
          saved={true}
          saving={savingIds.has(zoomedBookmark.youtubeId)}
          membership={new Set(zoomedBookmark.playlistIds)}
          busyPlaylistIds={
            new Set(
              [...busyEdges]
                .filter((k) => k.startsWith(`${zoomedBookmark.youtubeId}::`))
                .map((k) => k.split("::")[1]),
            )
          }
          playlists={playlists}
          onClose={() => setZoomedId(null)}
          onToggleSave={() => handleRemove(zoomedBookmark)}
          onTogglePlaylist={(pid) =>
            handleTogglePlaylist(zoomedBookmark, pid)
          }
          onCreatePlaylist={(name) =>
            handleCreatePlaylist(zoomedBookmark, name)
          }
        />
      ) : null}

      <div className="results-grid">
        {bookmarks.map((b) => {
          const cardBusyEdges = new Set<string>();
          for (const k of busyEdges) {
            if (k.startsWith(`${b.youtubeId}::`)) {
              cardBusyEdges.add(k.split("::")[1]);
            }
          }
          return (
            <VideoCard
              key={b.bookmarkId}
              video={asTrimmed(b)}
              saved={true}
              saving={savingIds.has(b.youtubeId)}
              membership={new Set(b.playlistIds)}
              busyPlaylistIds={cardBusyEdges}
              playlists={playlists}
              isHovered={hoveredId === b.youtubeId}
              onHoverStart={() => handleHoverStart(b.youtubeId)}
              onHoverEnd={handleHoverEnd}
              onZoom={() => {
                handleHoverEnd();
                setZoomedId(b.youtubeId);
              }}
              onToggleSave={() => handleRemove(b)}
              onTogglePlaylist={(pid) => handleTogglePlaylist(b, pid)}
              onCreatePlaylist={(name) => handleCreatePlaylist(b, name)}
            />
          );
        })}
      </div>
    </>
  );
}

function SavedVideosEmptyState() {
  return (
    <div className="playlists-empty">
      <div className="playlists-empty-art" aria-hidden>
        <Bookmark size={36} strokeWidth={1.4} />
      </div>
      <h2 className="playlists-empty-h">No saved videos yet.</h2>
      <p className="playlists-empty-lede">
        Bookmark a clip from search and it&rsquo;ll land here. Save the
        breakdowns you want to revisit, drills you&rsquo;re working, or
        anything that catches your eye.
      </p>
      <div className="playlists-empty-actions">
        <Link href="/library" className="btn">
          Search the floor →
        </Link>
      </div>
    </div>
  );
}
