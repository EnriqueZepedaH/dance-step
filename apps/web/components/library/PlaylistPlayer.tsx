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

// We talk to the iframe directly via postMessage instead of the
// YT.Player wrapper. YT.Player replaces the iframe element on
// construction, which races React's reconciler and explodes with a
// "Failed to execute removeChild" error on key changes. The bare
// postMessage protocol gives us the same events (onReady,
// onStateChange, infoDelivery.muted) without ever touching the DOM
// node React owns.

const YT_STATE_ENDED = 0;

type YTMessage = {
  event?: string;
  info?: number | { muted?: boolean; [k: string]: unknown };
};

// YouTube's official widgetapi.js always includes both `id` and
// `channel: "widget"` on outgoing messages, and the iframe will
// silently drop messages that don't match the channel — that's the
// most common reason a hand-rolled handshake "doesn't work."
const YT_CHANNEL = "widget";
const YT_PLAYER_ID = "dancestep-player";

function sendYTCommand(
  iframe: HTMLIFrameElement,
  func: string,
  args: unknown[] = [],
) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args,
      id: YT_PLAYER_ID,
      channel: YT_CHANNEL,
    }),
    "*",
  );
}

function sendYTListening(iframe: HTMLIFrameElement) {
  iframe.contentWindow?.postMessage(
    JSON.stringify({
      event: "listening",
      id: YT_PLAYER_ID,
      channel: YT_CHANNEL,
    }),
    "*",
  );
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

  // Sound preference carries across panels. Iframes always start with
  // mute=1 so the browser allows autoplay; we send unMute via
  // postMessage after onReady when the user has previously unmuted.
  // mutedRef tracks the live mute state of the active iframe (updated
  // by infoDelivery messages); soundOnRef remembers the user's intent
  // across panel changes.
  const soundOnRef = useRef(false);
  const mutedRef = useRef(true);
  const activeIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Refs mirroring state used inside long-lived listeners.
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

  // Callback ref attached only to the active iframe. Resets the live
  // mute tracking and sends a "listening" handshake so the iframe
  // starts broadcasting JSON events back via window.postMessage.
  // The iframe's internal API isn't always ready by the load event,
  // so we ping at several intervals; YouTube ignores duplicates.
  const onActiveIframe = useCallback((iframe: HTMLIFrameElement | null) => {
    activeIframeRef.current = iframe;
    mutedRef.current = true;
    if (!iframe) return;
    const ping = () => {
      // The iframe may have already been swapped by React; if so,
      // contentWindow is gone and the optional chain in sendYTListening
      // makes this a safe no-op.
      if (activeIframeRef.current === iframe) sendYTListening(iframe);
    };
    iframe.addEventListener("load", ping, { once: true });
    window.setTimeout(ping, 100);
    window.setTimeout(ping, 400);
    window.setTimeout(ping, 1200);
    window.setTimeout(ping, 3000);
  }, []);

  // Single window listener for the YouTube iframe message bus. Filters
  // by source so messages from other iframes (the Vercel preview bar,
  // Clerk widgets, etc.) are ignored.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const iframe = activeIframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (typeof e.data !== "string") return;
      let data: YTMessage;
      try {
        data = JSON.parse(e.data) as YTMessage;
      } catch {
        return;
      }
      if (data.event === "onReady") {
        if (soundOnRef.current) {
          sendYTCommand(iframe, "unMute");
          mutedRef.current = false;
        }
        return;
      }
      if (
        data.event === "infoDelivery" &&
        data.info &&
        typeof data.info === "object" &&
        typeof (data.info as { muted?: boolean }).muted === "boolean"
      ) {
        mutedRef.current = (data.info as { muted: boolean }).muted;
        return;
      }
      if (data.event === "onStateChange" && data.info === YT_STATE_ENDED) {
        soundOnRef.current = !mutedRef.current;
        goToRef.current(activeRef.current + 1);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
            href="/library/my"
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
          href="/library/my"
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
          // Active iframes always start muted so the browser allows
          // autoplay; the YT API unmutes after onReady when the user
          // has previously unmuted. enablejsapi=1 is the API hook.
          const src = `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&playsinline=1${
            isActive ? "&autoplay=1&mute=1&enablejsapi=1" : ""
          }`;
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
                {mounted ? (
                  <iframe
                    key={`${v.youtubeId}-${isActive ? "active" : "idle"}`}
                    ref={isActive ? onActiveIframe : undefined}
                    src={src}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : v.thumbnailUrl ? (
                  <Image
                    src={v.thumbnailUrl}
                    alt=""
                    fill
                    sizes="100vw"
                    className="player-thumb"
                  />
                ) : (
                  <div className="player-thumb-empty" />
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
