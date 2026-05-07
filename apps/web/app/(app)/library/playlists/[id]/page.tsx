import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PlaylistPlayer,
  type PlayerVideo,
} from "@/components/library/PlaylistPlayer";

// Playlist detail. RLS gates ownership — a non-owner trying to view
// someone else's playlist sees a 404 because the row is not visible
// to them. Items are joined to bookmarks via the embedded resource
// select. The page hands the data off to a fullscreen client player;
// no chrome from the (browse) library shell wraps this route, so the
// video gets the full viewport.

type Bookmark = {
  id: string;
  youtube_id: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
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
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!playlist) notFound();

  const { data: itemsData } = await supabase
    .from("playlist_items")
    .select(
      "position, bookmarks(id, youtube_id, title, channel, thumbnail_url)",
    )
    .eq("playlist_id", id)
    .order("position", { ascending: true });

  const items = (itemsData ?? []) as unknown as Item[];

  const videos: PlayerVideo[] = items
    .map((it) => it.bookmarks)
    .filter((b): b is Bookmark => b !== null)
    .map((b) => ({
      id: b.id,
      youtubeId: b.youtube_id,
      title: b.title,
      channel: b.channel,
      thumbnailUrl: b.thumbnail_url,
    }));

  return <PlaylistPlayer playlistName={playlist.name} videos={videos} />;
}
