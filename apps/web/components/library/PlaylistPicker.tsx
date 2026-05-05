"use client";

import { useState } from "react";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

export type Playlist = { id: string; name: string };

type Props = {
  video: TrimmedItem;
  playlists: Playlist[];
  onClose: () => void;
  onPlaylistCreated: (playlist: Playlist) => void;
  onSaved: () => void;
};

// Saves the bookmark first, then optionally attaches it to a chosen
// or newly-created playlist. The bookmark upsert is idempotent
// (unique on user_id + youtube_id) so re-saving an already-saved
// video to a new playlist is safe.

export function PlaylistPicker({
  video,
  playlists,
  onClose,
  onPlaylistCreated,
  onSaved,
}: Props) {
  type Choice = { kind: "bookmark-only" } | { kind: "existing"; id: string } | { kind: "new" };

  const [choice, setChoice] = useState<Choice>({ kind: "bookmark-only" });
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);

    try {
      const bookmarkRes = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeId: video.videoId,
          title: video.title,
          channel: video.channelTitle,
          thumbnail: video.thumbnail,
        }),
      });
      if (!bookmarkRes.ok) throw new Error("Could not save bookmark.");
      const { bookmark } = await bookmarkRes.json();

      let targetPlaylistId: string | null = null;

      if (choice.kind === "new") {
        const trimmed = newName.trim();
        if (!trimmed) throw new Error("Name the new playlist first.");
        const playlistRes = await fetch("/api/playlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!playlistRes.ok) throw new Error("Could not create playlist.");
        const { playlist } = await playlistRes.json();
        onPlaylistCreated({ id: playlist.id, name: playlist.name });
        targetPlaylistId = playlist.id;
      } else if (choice.kind === "existing") {
        targetPlaylistId = choice.id;
      }

      if (targetPlaylistId) {
        const itemRes = await fetch(
          `/api/playlists/${targetPlaylistId}/items`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookmarkId: bookmark.id }),
          },
        );
        if (!itemRes.ok) throw new Error("Saved, but could not add to playlist.");
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2 className="modal-title">Save</h2>
        <p className="modal-subtitle">{video.title}</p>

        <fieldset className="picker-options">
          <label className="picker-row">
            <input
              type="radio"
              name="picker"
              checked={choice.kind === "bookmark-only"}
              onChange={() => setChoice({ kind: "bookmark-only" })}
            />
            <span>Just bookmark — no playlist</span>
          </label>

          {playlists.map((p) => (
            <label className="picker-row" key={p.id}>
              <input
                type="radio"
                name="picker"
                checked={choice.kind === "existing" && choice.id === p.id}
                onChange={() => setChoice({ kind: "existing", id: p.id })}
              />
              <span>{p.name}</span>
            </label>
          ))}

          <label className="picker-row">
            <input
              type="radio"
              name="picker"
              checked={choice.kind === "new"}
              onChange={() => setChoice({ kind: "new" })}
            />
            <span>New playlist…</span>
          </label>

          {choice.kind === "new" && (
            <input
              className="picker-new-name"
              type="text"
              placeholder="Playlist name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          )}
        </fieldset>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSave}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
