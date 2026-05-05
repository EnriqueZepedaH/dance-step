"use client";

import Image from "next/image";
import type { TrimmedItem } from "@/app/api/youtube/search/route";

type Props = {
  video: TrimmedItem;
  saved: boolean;
  onSave: () => void;
};

export function VideoCard({ video, saved, onSave }: Props) {
  return (
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
        <button
          type="button"
          className={`btn-save${saved ? " is-saved" : ""}`}
          onClick={onSave}
        >
          {saved ? "Saved · add to playlist" : "Save"}
        </button>
      </div>
    </article>
  );
}
