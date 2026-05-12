import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PlaylistCardGrid,
  type PlaylistCard,
} from "@/components/library/PlaylistCardGrid";

// Playlists hub: YouTube-style grid where each card shows the first
// video's thumbnail and previews the video on hover. After migration
// 0004, playlist_items carries its own video snapshot, so the cover
// fetch no longer joins bookmarks. We sort items by position
// client-side and take position 0 as the cover. For the playlist
// sizes we expect (single-digit videos per playlist for most users),
// pulling all items per playlist is fine.

type PlaylistRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  playlist_items:
    | {
        position: number;
        youtube_id: string;
        thumbnail_url: string | null;
      }[]
    | null;
};

export default async function MyPlaylistsPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("playlists")
    .select(
      `id, name, description, created_at, updated_at,
       playlist_items(position, youtube_id, thumbnail_url)`,
    )
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as unknown as PlaylistRow[];

  const cards: PlaylistCard[] = rows.map((p) => {
    const items = [...(p.playlist_items ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const first = items[0] ?? null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      itemsCount: items.length,
      firstVideo: first
        ? {
            youtubeId: first.youtube_id,
            thumbnailUrl: first.thumbnail_url,
          }
        : null,
    };
  });

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Your library</span>
      <h1 className="display">Playlists.</h1>
      <p className="lede">
        Your hand-built sets, sorted however you like.{" "}
        <Link href="/library/my/videos" className="lede-link">
          Jump to saved videos →
        </Link>
      </p>

      <PlaylistCardGrid playlists={cards} />
    </section>
  );
}
