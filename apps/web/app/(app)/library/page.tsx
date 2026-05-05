import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SearchPanel } from "@/components/library/SearchPanel";

// Server-renders the initial state for the search panel: the user's
// existing playlists (so the "save" picker shows them) and the set of
// already-bookmarked YouTube IDs (so cards render with a "Saved" pill
// on first paint instead of waiting for a follow-up fetch). RLS
// ensures we only see this user's rows.

export default async function LibraryPage() {
  const supabase = await createSupabaseServerClient();

  const [playlistsRes, bookmarksRes] = await Promise.all([
    supabase
      .from("playlists")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase.from("bookmarks").select("youtube_id"),
  ]);

  const playlists = playlistsRes.data ?? [];
  const savedIds = (bookmarksRes.data ?? []).map((b) => b.youtube_id);

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
      <SearchPanel initialPlaylists={playlists} initialSavedIds={savedIds} />
    </section>
  );
}
