"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ListMusic,
  X,
} from "lucide-react";

export type PlayerVideo = {
  id: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
};

type Props = {
  playlistName: string;
  videos: PlayerVideo[];
};

// Active panel uses the full YouTube IFrame Player API. We tried two
// rounds of hand-rolled postMessage and the iframe never broadcast
// events back, so we're switching to the wrapper-div pattern that
// react-youtube uses in production: a stable React-owned div whose
// children are managed by YT (vanilla DOM, outside React's view).
// React never tries to unmount the YT-replaced node directly, so the
// "removeChild" race that killed the first attempt can't happen.

const YT_STATE_ENDED = 0;

type YTPlayerInstance = {
  isMuted: () => boolean;
  unMute: () => void;
  mute: () => void;
  destroy: () => void;
};
type YTApi = {
  Player: new (
    el: HTMLElement | string,
    cfg: {
      videoId?: string;
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, unknown>;
      events?: {
        onReady?: (e: { target: YTPlayerInstance }) => void;
        onStateChange?: (e: {
          data: number;
          target: YTPlayerInstance;
        }) => void;
      };
    },
  ) => YTPlayerInstance;
};

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTApi | null> | null = null;
function loadYTApi(): Promise<YTApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT ?? null);
    };
    if (!document.querySelector("script[data-yt-iframe-api]")) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.dataset.ytIframeApi = "1";
      document.head.appendChild(tag);
    }
  });
  return ytApiPromise;
}

// The active panel renders this. The wrapper div stays in React's
// tree; YT.Player attaches to a placeholder we append into the
// wrapper via vanilla DOM, replacing it with its iframe. On unmount
// we destroy the player and clear the wrapper, leaving an empty div
// for React to remove cleanly. soundOnRef and onEndedRef are passed
// in via refs so the effect's deps stay tight on videoId.
type ActivePanelProps = {
  video: PlayerVideo;
  soundOnRef: React.MutableRefObject<boolean>;
  onEndedRef: React.MutableRefObject<() => void>;
};
function ActivePanel({ video, soundOnRef, onEndedRef }: ActivePanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let cancelled = false;
    let player: YTPlayerInstance | null = null;

    while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
    const placeholder = document.createElement("div");
    placeholder.style.width = "100%";
    placeholder.style.height = "100%";
    wrapper.appendChild(placeholder);

    void loadYTApi().then((YT) => {
      if (cancelled || !YT?.Player) return;
      try {
        player = new YT.Player(placeholder, {
          videoId: video.youtubeId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              if (soundOnRef.current) {
                try {
                  e.target.unMute();
                } catch {
                  /* unmute may fail before user gesture; ignore */
                }
              }
            },
            onStateChange: (e) => {
              // Sync the cross-panel sound preference on every state
              // change — catches the user clicking mute/unmute in
              // the YT controls without us having to poll.
              try {
                soundOnRef.current = !e.target.isMuted();
              } catch {
                /* keep prior value */
              }
              if (e.data === YT_STATE_ENDED) onEndedRef.current();
            },
          },
        });
      } catch {
        /* construction can throw if torn down mid-load */
      }
    });

    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* may already be destroyed */
      }
      // Belt-and-suspenders: ensure the wrapper is empty before React
      // unmounts it, regardless of what destroy() left behind.
      if (wrapper) {
        while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
      }
    };
  }, [video.youtubeId, soundOnRef, onEndedRef]);

  return <div ref={wrapperRef} className="player-yt-host" />;
}

// Vertical scroll-snap player. The track is the only scrollable
// region; each panel is 100svh tall with mandatory snap so two
// videos can never share the screen. IntersectionObserver picks the
// most-visible panel as "active". Iframes are mounted only for the
// active panel and its immediate neighbors so we don't pile fifty
// embeds on the page; the active iframe gets autoplay=1&mute=1 so
// snapping to a panel starts playback without a click. Browsers
// require muted for autoplay; the user can unmute via the YouTube
// player UI.

export function PlaylistPlayer({ playlistName, videos }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Array<HTMLElement | null>>([]);
  const [active, setActive] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  // Sound preference carries across panels. Every iframe still starts
  // muted (browsers refuse autoplay-with-sound on a fresh iframe);
  // ActivePanel calls player.unMute() in onReady when this is true,
  // and updates it on every state change so user-driven mute toggles
  // in the YT controls propagate forward.
  const soundOnRef = useRef(false);

  // Refs mirroring state used inside the active panel's effect so it
  // can advance the playlist without re-creating the player on every
  // state update.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const root = trackRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number(e.target.getAttribute("data-index"));
          if (!best || e.intersectionRatio > best.ratio) {
            best = { idx, ratio: e.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.5) setActive(best.idx);
      },
      { root, threshold: [0.5, 0.75, 1] },
    );
    panelRefs.current.forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [videos.length]);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(videos.length - 1, i));
      panelRefs.current[clamped]?.scrollIntoView({ behavior: "smooth" });
    },
    [videos.length],
  );
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  }, [goTo]);

  // Stable advance callback handed to ActivePanel via ref so the YT
  // player effect doesn't tear down on every parent re-render.
  const onEndedRef = useRef<() => void>(() => {});
  useEffect(() => {
    onEndedRef.current = () => {
      if (activeRef.current < videos.length - 1) {
        goToRef.current(activeRef.current + 1);
      }
    };
  }, [videos.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        goTo(active - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo]);

  if (videos.length === 0) {
    return (
      <div className="player-root">
        <header className="player-header">
          <Link
            href="/library/my/videos"
            className="player-back"
            aria-label="Back to your library"
          >
            <ArrowLeft size={16} strokeWidth={1.7} />
            <span>Library</span>
          </Link>
          <div className="player-title-block">
            <span className="eyebrow">Playlist</span>
            <h1 className="player-title">{playlistName}</h1>
          </div>
        </header>
        <section className="player-empty">
          <p className="lede">This playlist has no videos yet.</p>
          <Link href="/library" className="lede-link">
            Search the floor and save one →
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="player-root">
      <header className="player-header">
        <Link
          href="/library/my/videos"
          className="player-back"
          aria-label="Back to your library"
        >
          <ArrowLeft size={16} strokeWidth={1.7} />
          <span>Library</span>
        </Link>
        <div className="player-title-block">
          <span className="eyebrow">Playlist</span>
          <h1 className="player-title">{playlistName}</h1>
        </div>
      </header>

      <div className="player-track" ref={trackRef}>
        {videos.map((v, i) => {
          const mounted = Math.abs(i - active) <= 1;
          const isActive = i === active;
          return (
            <section
              key={v.id}
              data-index={i}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
              className={`player-panel${isActive ? " is-active" : ""}`}
              aria-current={isActive ? "true" : undefined}
            >
              <div className="player-frame">
                {!mounted ? (
                  v.thumbnailUrl ? (
                    <Image
                      src={v.thumbnailUrl}
                      alt=""
                      fill
                      sizes="100vw"
                      className="player-thumb"
                    />
                  ) : (
                    <div className="player-thumb-empty" />
                  )
                ) : isActive ? (
                  <ActivePanel
                    video={v}
                    soundOnRef={soundOnRef}
                    onEndedRef={onEndedRef}
                  />
                ) : (
                  <iframe
                    key={v.youtubeId}
                    src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&playsinline=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="player-meta">
                <h2 className="player-meta-title">{v.title}</h2>
                <p className="player-meta-channel">{v.channel ?? ""}</p>
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="lede-link"
                >
                  Watch on YouTube ↗
                </a>
              </div>
            </section>
          );
        })}
      </div>

      <div className="player-rail" role="toolbar" aria-label="Playlist controls">
        <button
          type="button"
          className="rail-btn"
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous video"
          title="Previous (↑)"
        >
          <ChevronUp size={18} strokeWidth={1.8} />
        </button>
        <span className="rail-counter" aria-live="polite">
          <span className="rail-counter-now">{active + 1}</span>
          <span className="rail-counter-sep">/</span>
          <span className="rail-counter-total">{videos.length}</span>
        </span>
        <button
          type="button"
          className="rail-btn"
          onClick={() => goTo(active + 1)}
          disabled={active === videos.length - 1}
          aria-label="Next video"
          title="Next (↓)"
        >
          <ChevronDown size={18} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={`rail-btn rail-btn-queue${queueOpen ? " is-on" : ""}`}
          onClick={() => setQueueOpen((q) => !q)}
          aria-label={queueOpen ? "Hide queue" : "Show queue"}
          aria-expanded={queueOpen}
        >
          <ListMusic size={16} strokeWidth={1.7} />
        </button>
      </div>

      {queueOpen ? (
        <aside className="player-queue" aria-label="Playlist queue">
          <div className="queue-header">
            <div>
              <span className="eyebrow">Up next</span>
              <h2 className="queue-h2">{playlistName}</h2>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setQueueOpen(false)}
              aria-label="Close queue"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
          <ol className="queue-list">
            {videos.map((v, i) => {
              const isActive = i === active;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    className={`queue-row${isActive ? " is-active" : ""}`}
                    onClick={() => {
                      goTo(i);
                      setQueueOpen(false);
                    }}
                  >
                    <span className="queue-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {v.thumbnailUrl ? (
                      <Image
                        src={v.thumbnailUrl}
                        alt=""
                        width={96}
                        height={54}
                        className="queue-thumb"
                      />
                    ) : (
                      <span className="queue-thumb queue-thumb-empty" />
                    )}
                    <span className="queue-meta">
                      <span className="queue-title">{v.title}</span>
                      <span className="queue-channel">{v.channel ?? ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      ) : null}
    </div>
  );
}
