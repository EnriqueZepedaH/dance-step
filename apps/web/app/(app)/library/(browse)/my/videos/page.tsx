import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Saved videos. Read-only grid of every bookmark for the signed-in
// user. Mutation lives in the search panel's bookmark icon and the
// add-to-playlist popover; this page is a destination, not a hub.
// RLS scopes the fetch to the signed-in user.

export default async function SavedVideosPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("bookmarks")
    .select("id, youtube_id, title, channel, thumbnail_url")
    .order("created_at", { ascending: false });

  const bookmarks = data ?? [];

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Your library</span>
      <h1 className="display">Saved videos.</h1>
      <p className="lede">
        Every clip you&rsquo;ve bookmarked.{" "}
        <Link href="/library/my/playlists" className="lede-link">
          Jump to playlists →
        </Link>
      </p>

      {bookmarks.length === 0 ? (
        <p className="search-status">
          No bookmarks yet.{" "}
          <Link href="/library" className="lede-link">
            Search the floor
          </Link>{" "}
          to save your first.
        </p>
      ) : (
        <div className="results-grid">
          {bookmarks.map((b) => (
            <article key={b.id} className="video-card">
              {b.thumbnail_url ? (
                <div className="video-thumb">
                  <Image
                    src={b.thumbnail_url}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 100vw, 33vw"
                  />
                </div>
              ) : (
                <div className="video-thumb video-thumb-empty" />
              )}
              <div className="video-meta">
                <h3 className="video-title">{b.title}</h3>
                <p className="video-channel">{b.channel ?? ""}</p>
                <a
                  className="btn-save is-saved"
                  href={`https://www.youtube.com/watch?v=${b.youtube_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch on YouTube
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
