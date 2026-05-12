"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";

export type PlaylistOption = { id: string; name: string };

type Props = {
  playlists: PlaylistOption[];
  membership: Set<string>;            // playlistIds this video is in
  busyIds: Set<string>;                // playlistIds with an in-flight toggle
  onToggle: (playlistId: string) => void;
  onCreate: (name: string) => Promise<void> | void;
  onClose: () => void;
  // Anchor side. "bottom" drops the popover below the trigger
  // (default; right for cards in a flowing grid). "top" lifts it
  // above the trigger — used inside the zoom modal where the
  // actions row sits near the bottom of the viewport.
  placement?: "top" | "bottom";
};

const MAX_NAME = 40;

export function AddToPlaylistPopover({
  playlists,
  membership,
  busyIds,
  onToggle,
  onCreate,
  onClose,
  placement = "bottom",
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const showFilter = playlists.length > 8;
  const q = filter.trim().toLowerCase();
  const visible = q
    ? playlists.filter((p) => p.name.toLowerCase().includes(q))
    : playlists;

  // Click-outside + Escape to dismiss.
  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Name the playlist first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
      setNewName("");
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create playlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`atp-popover atp-${placement}`}
      ref={ref}
      role="dialog"
      aria-label="Add to playlist"
    >
      <div className="atp-header">
        <span className="atp-title">Add to playlist</span>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>

      {playlists.length === 0 && !creating ? (
        <p className="atp-empty">No playlists yet — create one below.</p>
      ) : null}

      {showFilter ? (
        <input
          type="search"
          className="atp-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter playlists…"
          aria-label="Filter playlists"
        />
      ) : null}

      <ul className="atp-list">
        {visible.map((p) => {
          const inPlaylist = membership.has(p.id);
          const pending = busyIds.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`atp-row${inPlaylist ? " is-in" : ""}`}
                onClick={() => onToggle(p.id)}
                disabled={pending}
              >
                <span className="atp-check" aria-hidden>
                  {inPlaylist ? <Check size={13} strokeWidth={2.2} /> : null}
                </span>
                <span className="atp-name">{p.name}</span>
              </button>
            </li>
          );
        })}
        {showFilter && visible.length === 0 ? (
          <li className="atp-no-match">No playlists match.</li>
        ) : null}
      </ul>

      {creating ? (
        <div className="atp-create">
          <div className="char-input">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New playlist name"
              maxLength={MAX_NAME}
              disabled={busy}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                  setError(null);
                }
              }}
            />
            {newName.length >= MAX_NAME - 8 ? (
              <span
                className={`char-counter${newName.length === MAX_NAME ? " at-max" : ""}`}
                aria-live="polite"
              >
                {newName.length}/{MAX_NAME}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-small"
            onClick={handleCreate}
            disabled={busy}
          >
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="atp-create-trigger"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} strokeWidth={1.8} />
          New playlist
        </button>
      )}

      {error ? <p className="atp-error">{error}</p> : null}
    </div>
  );
}
