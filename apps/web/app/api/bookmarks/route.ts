import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Bookmark mutations. Auth is gated by proxy.ts (any non-public route
// requires a Clerk session). Ownership is enforced by RLS — the
// service-role client is intentionally NOT used here.

type CreateBody = {
  youtubeId?: string;
  title?: string;
  channel?: string | null;
  thumbnail?: string | null;
  durationSeconds?: number | null;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.youtubeId || !body.title) {
    return NextResponse.json(
      { error: "youtubeId and title are required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookmarks")
    .upsert(
      {
        user_id: userId,
        youtube_id: body.youtubeId,
        title: body.title,
        channel: body.channel ?? null,
        thumbnail_url: body.thumbnail ?? null,
        duration_seconds: body.durationSeconds ?? null,
      },
      { onConflict: "user_id,youtube_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("bookmark upsert failed", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ bookmark: data });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const youtubeId = url.searchParams.get("youtubeId");
  if (!youtubeId) {
    return NextResponse.json({ error: "youtubeId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("youtube_id", youtubeId);

  if (error) {
    console.error("bookmark delete failed", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
