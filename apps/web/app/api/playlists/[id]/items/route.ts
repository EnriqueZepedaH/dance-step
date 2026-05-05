import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Playlist membership. RLS for playlist_items gates by parent
// playlist ownership (auth.jwt() ->> 'sub' must match the playlist's
// user_id). The bookmark-ownership check below is belt-and-suspenders:
// RLS on bookmarks SELECT hides non-owned rows, so a maybeSingle()
// look-up returns null if the user is trying to attach a bookmark
// that isn't theirs.

type AddBody = { bookmarkId?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: playlistId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as AddBody;
  if (!body.bookmarkId) {
    return NextResponse.json({ error: "bookmarkId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Confirm the bookmark is visible to the user (RLS will return null
  // for someone else's id) before we let it land in the playlist.
  const { data: bookmark } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("id", body.bookmarkId)
    .maybeSingle();
  if (!bookmark) {
    return NextResponse.json({ error: "bookmark not found" }, { status: 404 });
  }

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
      bookmark_id: body.bookmarkId,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
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
  const bookmarkId = url.searchParams.get("bookmarkId");
  if (!bookmarkId) {
    return NextResponse.json(
      { error: "bookmarkId required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("playlist_items")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("bookmark_id", bookmarkId);

  if (error) {
    console.error("playlist_items delete failed", error);
    return NextResponse.json({ error: "remove failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
