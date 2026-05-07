"use client";

import { useState } from "react";
import Image from "next/image";
import { Bookmark, BookmarkCheck, ListPlus } from "lucide-react";
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
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onZoom: () => void;
  onToggleSave: () => void;
  onTogglePlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => Promise<void> | void;
};

export function VideoCard({
  video,
  saved,
  saving,
  membership,
  busyPlaylistIds,
  playlists,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onZoom,
  onToggleSave,
  onTogglePlaylist,
  onCreatePlaylist,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="video-card-wrap">
      <article className="video-card">
        <div
          className="video-thumb"
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          onFocus={onHoverStart}
          onBlur={onHoverEnd}
          onClick={onZoom}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onZoom();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Open ${video.title}`}
        >
          {isHovered ? (
            <iframe
              key={video.videoId}
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&modestbranding=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              tabIndex={-1}
            />
          ) : video.thumbnail ? (
            <Image
              src={video.thumbnail}
              alt=""
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
            />
          ) : (
            <div className="video-thumb-empty-inner" />
          )}
        </div>
        <div className="video-meta">
          <h3 className="video-title">{video.title}</h3>
          <p className="video-channel">{video.channelTitle}</p>
          <div className="card-actions">
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
                <BookmarkCheck size={16} strokeWidth={1.7} />
              ) : (
                <Bookmark size={16} strokeWidth={1.7} />
              )}
            </button>
            <button
              type="button"
              className={`icon-btn${popoverOpen ? " is-active" : ""}`}
              onClick={() => setPopoverOpen((v) => !v)}
              aria-expanded={popoverOpen}
              aria-label="Add to playlist"
              title="Add to playlist"
            >
              <ListPlus size={16} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </article>

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
  );
}
