import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SearchPanel,
  type InitialBookmark,
} from "@/components/library/SearchPanel";

// Server-renders initial state for the search panel: existing
// playlists and the user's saved bookmarks with their playlist
// memberships. Lets each video card paint with the correct saved
// state and "in this playlist" checkmarks on first render. RLS
// scopes everything to the signed-in user.

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();

  const [playlistsRes, bookmarksRes] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookmarks")
      .select("id, youtube_id, playlist_items(playlist_id)"),
  ]);

  const playlists = playlistsRes.data ?? [];
  const initialBookmarks: InitialBookmark[] = (bookmarksRes.data ?? []).map(
    (b) => ({
      bookmarkId: b.id,
      youtubeId: b.youtube_id,
      playlistIds: (b.playlist_items ?? []).map((pi) => pi.playlist_id),
    }),
  );

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">The Library · YouTube</span>
      <h1 className="display">Search the floor.</h1>
      <p className="lede">
        Find a clip, save it, and drop it into a playlist when you want
        to drill it later.{" "}
        <Link href="/library/my" className="lede-link">
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
