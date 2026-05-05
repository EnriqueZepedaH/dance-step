import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Playlist detail page. RLS gates ownership — a non-owner trying to
// view someone else's playlist sees a 404 because the row is not
// visible to them. Items are joined to bookmarks via the embedded
// resource select; supabase-js returns the FK-related row as a
// nested object on each item.

type Bookmark = {
  id: string;
  youtube_id: string;
  title: string;
  channel: string | null;
};
type Item = { position: number; bookmarks: Bookmark | null };

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();

  if (!playlist) notFound();

  const { data: itemsData } = await supabase
    .from("playlist_items")
    .select("position, bookmarks(id, youtube_id, title, channel)")
    .eq("playlist_id", id)
    .order("position", { ascending: true });

  const items = (itemsData ?? []) as unknown as Item[];

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Playlist</span>
      <h1 className="display">{playlist.name}</h1>
      {playlist.description ? <p className="lede">{playlist.description}</p> : null}
      <p>
        <Link href="/library/my" className="lede-link">
          ← Back to your library
        </Link>
      </p>

      {items.length === 0 ? (
        <p className="search-status">
          This playlist is empty. Save a video from{" "}
          <Link href="/library" className="lede-link">
            search
          </Link>{" "}
          and pick this playlist when prompted.
        </p>
      ) : (
        <div className="playlist-items">
          {items.map((item) => {
            const b = item.bookmarks;
            if (!b) return null;
            return (
              <article key={`${item.position}-${b.id}`} className="playlist-item">
                <div className="embed-wrap">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${b.youtube_id}`}
                    title={b.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <h3 className="video-title">{b.title}</h3>
                <p className="video-channel">{b.channel ?? ""}</p>
                <a
                  href={`https://www.youtube.com/watch?v=${b.youtube_id}`}
                  className="lede-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch on YouTube →
                </a>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
