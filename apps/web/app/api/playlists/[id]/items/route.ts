import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Playlist membership. After migration 0004, playlist_items stores
// its own video snapshot (youtube_id, title, channel, thumbnail_url)
// and is no longer tied to the bookmarks table — removing a bookmark
// no longer cascades into playlists. RLS for playlist_items still
// gates by parent playlist ownership.

type AddBody = {
  youtubeId?: string;
  title?: string;
  channel?: string | null;
  thumbnail?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: playlistId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as AddBody;
  if (!body.youtubeId || !body.title) {
    return NextResponse.json(
      { error: "youtubeId and title required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // Append at the end. Concurrency is fine for v1's single-user-at-a-
  // time flow; if two adds race, the second silently gets the same
  // position and falls back to created_at-equivalent ordering.
  const { data: tail } = await supabase
    .from("playlist_items")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (tail?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("playlist_items")
    .insert({
      playlist_id: playlistId,
      youtube_id: body.youtubeId,
      title: body.title,
      channel: body.channel ?? null,
      thumbnail_url: body.thumbnail ?? null,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    // 23505 = duplicate (playlist_id, youtube_id). Surface a clean
    // 409 instead of a 500 so the UI can choose to ignore or message.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Video is already in this playlist." },
        { status: 409 },
      );
    }
    console.error("playlist_items insert failed", error);
    return NextResponse.json({ error: "add failed" }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: playlistId } = await ctx.params;
  const url = new URL(req.url);
  const youtubeId = url.searchParams.get("youtubeId");
  if (!youtubeId) {
    return NextResponse.json(
      { error: "youtubeId required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("playlist_items")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("youtube_id", youtubeId);

  if (error) {
    console.error("playlist_items delete failed", error);
    return NextResponse.json({ error: "remove failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
