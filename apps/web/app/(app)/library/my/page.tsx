import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlaylistRow } from "@/components/library/PlaylistRow";

// Read-only "your library" view: every bookmark and playlist for the
// signed-in user. Mutation (rename/delete) is deferred to v1.1; for
// now the picker on /library covers the only mutation a typical
// user needs day-to-day.

export default async function MyLibraryPage() {
  const supabase = await createSupabaseServerClient();

  const [bookmarksRes, playlistsRes] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("id, youtube_id, title, channel, thumbnail_url")
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, name, description")
      .order("created_at", { ascending: false }),
  ]);

  const bookmarks = bookmarksRes.data ?? [];
  const playlists = playlistsRes.data ?? [];

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Your library</span>
      <h1 className="display">Your saved floor.</h1>
      <p className="lede">
        <Link href="/library" className="lede-link">
          ← Back to search
        </Link>
      </p>

      <h2 className="section-h2">Playlists</h2>
      {playlists.length === 0 ? (
        <p className="search-status">
          No playlists yet. Save a video and pick &ldquo;New playlist&rdquo;
          to start one.
        </p>
      ) : (
        <ul className="playlist-list">
          {playlists.map((p) => (
            <PlaylistRow
              key={p.id}
              id={p.id}
              name={p.name}
              description={p.description}
            />
          ))}
        </ul>
      )}

      <h2 className="section-h2">Saved videos</h2>
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
