"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Plus, Sparkles } from "lucide-react";

export type PlaylistCard = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  firstVideo: {
    youtubeId: string;
    thumbnailUrl: string | null;
  } | null;
};

type SortKey =
  | "modified-desc"
  | "modified-asc"
  | "created-desc"
  | "name"
  | "size";

const SORT_LABELS: Record<SortKey, string> = {
  "modified-desc": "Recently modified",
  "modified-asc": "Oldest modified",
  "created-desc": "Newest",
  name: "Name (A→Z)",
  size: "Most videos",
};

const HOVER_DELAY_MS = 400;
const MAX_NAME = 40;

type Props = { playlists: PlaylistCard[] };

// Grid of playlist cards with YouTube-style hover-to-preview on the
// first video. A single hoveredId state ensures only one preview is
// active at a time; the per-card timer is cancelled if the cursor
// leaves before HOVER_DELAY_MS elapses, so quick fly-overs don't
// spawn iframes. Rename/delete reuse the same API the row variant
// did, with router.refresh() so the sidebar count updates.

export function PlaylistCardGrid({ playlists }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("modified-desc");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<number | null>(null);

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
      case "created-desc":
        ordered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "modified-asc":
        ordered.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        break;
      case "modified-desc":
      default:
        ordered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
    }
    return ordered;
  }, [playlists, query, sort]);

  function handleHoverStart(id: string) {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setHoveredId(id);
    }, HOVER_DELAY_MS);
  }
  function handleHoverEnd() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setHoveredId(null);
  }

  if (playlists.length === 0) {
    return <PlaylistsEmptyState />;
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
        <p className="search-status">
          No playlists match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="playlist-cards">
          {visible.map((p) => (
            <PlaylistCardItem
              key={p.id}
              card={p}
              isHovered={hoveredId === p.id}
              onHoverStart={() => handleHoverStart(p.id)}
              onHoverEnd={handleHoverEnd}
            />
          ))}
        </ul>
      )}
    </>
  );
}

type ItemProps = {
  card: PlaylistCard;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
};

function PlaylistCardItem({
  card,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: ItemProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function saveRename() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Name cannot be blank.");
      return;
    }
    if (trimmed === card.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/playlists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, name: trimmed }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${card.name}"? This cannot be undone — bookmarks stay saved, but the playlist itself goes away.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/playlists?id=${encodeURIComponent(card.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <li className="playlist-card">
      <Link
        href={`/library/playlists/${card.id}`}
        className="playlist-card-thumb"
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        aria-label={`Open playlist ${card.name}`}
      >
        {card.firstVideo ? (
          isHovered ? (
            <iframe
              key={card.firstVideo.youtubeId}
              src={`https://www.youtube-nocookie.com/embed/${card.firstVideo.youtubeId}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1`}
              title={card.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              tabIndex={-1}
            />
          ) : card.firstVideo.thumbnailUrl ? (
            <Image
              src={card.firstVideo.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
            />
          ) : (
            <div className="playlist-card-thumb-empty" />
          )
        ) : (
          <div className="playlist-card-thumb-empty">
            <Sparkles size={20} strokeWidth={1.5} />
            <span>Empty playlist</span>
          </div>
        )}
        <span className="playlist-card-count">
          {card.itemsCount} {card.itemsCount === 1 ? "video" : "videos"}
        </span>
      </Link>

      <div className="playlist-card-meta">
        {editing ? (
          <div className="playlist-card-edit">
            <div className="char-input">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_NAME}
                disabled={busy}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") {
                    setDraft(card.name);
                    setEditing(false);
                    setError(null);
                  }
                }}
              />
              {draft.length >= MAX_NAME - 8 ? (
                <span
                  className={`char-counter${draft.length === MAX_NAME ? " at-max" : ""}`}
                  aria-live="polite"
                >
                  {draft.length}/{MAX_NAME}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={saveRename}
              disabled={busy}
              aria-label="Save"
              title="Save"
            >
              <Check size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setDraft(card.name);
                setEditing(false);
                setError(null);
              }}
              disabled={busy}
              aria-label="Cancel"
              title="Cancel"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <>
            <Link
              href={`/library/playlists/${card.id}`}
              className="playlist-card-title"
            >
              {card.name}
            </Link>
            <div className="playlist-card-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(true)}
                disabled={busy}
                aria-label="Rename playlist"
                title="Rename"
              >
                <Pencil size={14} strokeWidth={1.7} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={handleDelete}
                disabled={busy}
                aria-label="Delete playlist"
                title="Delete"
              >
                <Trash2 size={14} strokeWidth={1.7} />
              </button>
            </div>
          </>
        )}
        {error ? <span className="row-error">{error}</span> : null}
      </div>
    </li>
  );
}

function PlaylistsEmptyState() {
  return (
    <div className="playlists-empty">
      <div className="playlists-empty-art" aria-hidden>
        <ListMusicIcon />
      </div>
      <h2 className="playlists-empty-h">No playlists yet.</h2>
      <p className="playlists-empty-lede">
        Playlists are how you build your floor — drills you&rsquo;re working
        on, sets you love, breakdowns to revisit. Save a video first, then
        drop it into a brand-new playlist.
      </p>
      <div className="playlists-empty-actions">
        <Link href="/library" className="btn">
          <Plus size={14} strokeWidth={1.8} />
          Search the floor to start
        </Link>
      </div>
    </div>
  );
}

function ListMusicIcon() {
  // Inline SVG so the empty-state art is large + styleable without
  // pulling another lucide icon at oversized scale.
  return (
    <svg
      viewBox="0 0 24 24"
      width="56"
      height="56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15V6" />
      <path d="M18.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
      <path d="M12 12H3" />
      <path d="M16 6H3" />
      <path d="M12 18H3" />
    </svg>
  );
}
