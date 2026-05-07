"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ListPlus,
  X,
  ExternalLink,
} from "lucide-react";
import {
  AddToPlaylistPopover,
  type PlaylistOption,
} from "./AddToPlaylistPopover";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

type Props = {
  video: TrimmedItem;
  saved: boolean;
  saving: boolean;
  membership: Set<string>;
  busyPlaylistIds: Set<string>;
  playlists: PlaylistOption[];
  onClose: () => void;
  onToggleSave: () => void;
  onTogglePlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => Promise<void> | void;
};

// Click-to-zoom modal for a search result. Plays the video in a
// large 16:9 frame with the same bookmark + add-to-playlist actions
// that live on the result card. Mutation state is owned by the
// parent SearchPanel — props mirror the card so saves made in the
// modal show up in the underlying grid as soon as the modal closes.
// Browser autoplay policy still requires mute, so the iframe boots
// muted and the user unmutes via the YT controls.

export function VideoZoomModal({
  video,
  saved,
  saving,
  membership,
  busyPlaylistIds,
  playlists,
  onClose,
  onToggleSave,
  onTogglePlaylist,
  onCreatePlaylist,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="zoom-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <div className="zoom-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="zoom-close"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={18} strokeWidth={1.8} />
        </button>

        <div className="zoom-frame">
          <iframe
            key={video.videoId}
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&mute=1&rel=0&playsinline=1&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="zoom-meta">
          <div className="zoom-text">
            <h2 className="zoom-title">{video.title}</h2>
            <p className="zoom-channel">{video.channelTitle}</p>
          </div>
          <div className="zoom-actions">
            <button
              type="button"
              className={`icon-btn${saved ? " is-active" : ""}`}
              onClick={onToggleSave}
              disabled={saving}
              aria-pressed={saved}
              aria-label={saved ? "Remove bookmark" : "Save bookmark"}
              title={saved ? "Saved · click to remove" : "Save"}
            >
              {saved ? (
                <BookmarkCheck size={18} strokeWidth={1.7} />
              ) : (
                <Bookmark size={18} strokeWidth={1.7} />
              )}
            </button>
            <div className="zoom-playlist-anchor">
              <button
                type="button"
                className={`icon-btn${popoverOpen ? " is-active" : ""}`}
                onClick={() => setPopoverOpen((v) => !v)}
                aria-expanded={popoverOpen}
                aria-label="Add to playlist"
                title="Add to playlist"
              >
                <ListPlus size={18} strokeWidth={1.7} />
              </button>
              {popoverOpen ? (
                <AddToPlaylistPopover
                  playlists={playlists}
                  membership={membership}
                  busyIds={busyPlaylistIds}
                  onToggle={onTogglePlaylist}
                  onCreate={onCreatePlaylist}
                  onClose={() => setPopoverOpen(false)}
                />
              ) : null}
            </div>
            <a
              className="icon-btn"
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Watch on YouTube"
              title="Watch on YouTube"
            >
              <ExternalLink size={18} strokeWidth={1.7} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
