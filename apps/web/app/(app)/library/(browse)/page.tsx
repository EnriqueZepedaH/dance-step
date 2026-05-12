import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SearchPanel,
  type InitialBookmark,
} from "@/components/library/SearchPanel";

// Server-renders initial state for the search panel: existing
// playlists and the user's saved bookmarks with their playlist
// memberships. After migration 0004, playlist_items no longer
// references bookmarks, so memberships are joined client-side on
// youtube_id. RLS scopes playlist_items by parent playlist
// ownership, so the fetch already only returns the user's own
// playlist rows.

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();

  const [playlistsRes, bookmarksRes, itemsRes] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase.from("bookmarks").select("id, youtube_id"),
    supabase.from("playlist_items").select("playlist_id, youtube_id"),
  ]);

  const playlists = playlistsRes.data ?? [];

  const membership = new Map<string, string[]>();
  for (const row of itemsRes.data ?? []) {
    const list = membership.get(row.youtube_id) ?? [];
    list.push(row.playlist_id);
    membership.set(row.youtube_id, list);
  }

  const initialBookmarks: InitialBookmark[] = (bookmarksRes.data ?? []).map(
    (b) => ({
      bookmarkId: b.id,
      youtubeId: b.youtube_id,
      playlistIds: membership.get(b.youtube_id) ?? [],
    }),
  );

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">The Library · YouTube</span>
      <h1 className="display">Search the floor.</h1>
      <p className="lede">
        Find a clip, save it, and drop it into a playlist when you want
        to drill it later.{" "}
        <Link href="/library/my/videos" className="lede-link">
          Open your saved library →
        </Link>
      </p>
      <SearchPanel
        initialPlaylists={playlists}
        initialBookmarks={initialBookmarks}
      />
    </section>
  );
}
