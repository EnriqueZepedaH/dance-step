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
// fetches to the signed-in user. After migration 0004, playlist
// memberships are joined client-side on youtube_id (playlist_items
// no longer references bookmarks).

export default async function SavedVideosPage() {
  const supabase = await createSupabaseServerClient();

  const [bookmarksRes, playlistsRes, itemsRes] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("id, youtube_id, title, channel, thumbnail_url")
      .order("created_at", { ascending: false }),
    supabase
      .from("playlists")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase.from("playlist_items").select("playlist_id, youtube_id"),
  ]);

  const membership = new Map<string, string[]>();
  for (const row of itemsRes.data ?? []) {
    const list = membership.get(row.youtube_id) ?? [];
    list.push(row.playlist_id);
    membership.set(row.youtube_id, list);
  }

  const bookmarks: SavedVideo[] = (bookmarksRes.data ?? []).map((b) => ({
    bookmarkId: b.id,
    youtubeId: b.youtube_id,
    title: b.title,
    channel: b.channel,
    thumbnailUrl: b.thumbnail_url,
    playlistIds: membership.get(b.youtube_id) ?? [],
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
