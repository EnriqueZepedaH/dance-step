import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SavedVideosClient,
  type SavedVideo,
} from "@/components/library/SavedVideosClient";
import type { PlaylistOption } from "@/components/library/AddToPlaylistPopover";

// Saved videos. Card grid mirrors the search panel and the playlists
// grid: hover-to-preview on the thumbnail, click opens the same zoom
// modal with bookmark + add-to-playlist controls. RLS scopes both
// fetches to the signed-in user.

export default async function SavedVideosPage() {
  const supabase = await createSupabaseServerClient();

  const [bookmarksRes, playlistsRes] = await Promise.all([
    supabase
      .from("bookmarks")
      .select(
        "id, youtube_id, title, channel, thumbnail_url, playlist_items(playlist_id)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, name")
      .order("created_at", { ascending: false }),
  ]);

  const bookmarks: SavedVideo[] = (bookmarksRes.data ?? []).map((b) => ({
    bookmarkId: b.id,
    youtubeId: b.youtube_id,
    title: b.title,
    channel: b.channel,
    thumbnailUrl: b.thumbnail_url,
    playlistIds: (b.playlist_items ?? []).map((pi) => pi.playlist_id),
  }));

  const playlists: PlaylistOption[] = (playlistsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

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

      <SavedVideosClient
        initialBookmarks={bookmarks}
        initialPlaylists={playlists}
      />
    </section>
  );
}
