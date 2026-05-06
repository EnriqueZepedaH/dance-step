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
  onToggleSave,
  onTogglePlaylist,
  onCreatePlaylist,
}: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="video-card-wrap">
      <article className="video-card">
        {video.thumbnail ? (
          <div className="video-thumb">
            <Image
              src={video.thumbnail}
              alt=""
              fill
              sizes="(max-width: 720px) 100vw, 33vw"
            />
          </div>
        ) : (
          <div className="video-thumb video-thumb-empty" />
        )}
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
