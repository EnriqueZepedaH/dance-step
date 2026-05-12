import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PlaylistPlayer,
  type PlayerVideo,
} from "@/components/library/PlaylistPlayer";

// Playlist detail. RLS gates ownership — a non-owner trying to view
// someone else's playlist sees a 404 because the row is not visible
// to them. After migration 0004, playlist_items holds its own video
// snapshot, so we no longer embed bookmarks here. The page hands the
// data off to a fullscreen client player; no chrome from the (browse)
// library shell wraps this route, so the video gets the full
// viewport.

type Item = {
  position: number;
  youtube_id: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
};

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
    .select("position, youtube_id, title, channel, thumbnail_url")
    .eq("playlist_id", id)
    .order("position", { ascending: true });

  const items = (itemsData ?? []) as Item[];

  const videos: PlayerVideo[] = items.map((it) => ({
    youtubeId: it.youtube_id,
    title: it.title,
    channel: it.channel,
    thumbnailUrl: it.thumbnail_url,
  }));

  return <PlaylistPlayer playlistName={playlist.name} videos={videos} />;
}
