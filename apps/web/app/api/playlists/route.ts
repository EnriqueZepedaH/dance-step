import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Playlist CRUD. The plan groups POST/PATCH/DELETE on this single
// route file (id passed in body for mutate/delete). RLS-bound client
// enforces ownership; non-owner mutations silently match zero rows.

const MAX_NAME_LENGTH = 40;

type CreateBody = { name?: string; description?: string | null };
type PatchBody = { id?: string; name?: string; description?: string | null };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .insert({
      user_id: userId,
      name,
      description: body.description ?? null,
    })
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "You already have a playlist with that name." },
        { status: 409 },
      );
    }
    console.error("playlist create failed", error);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
  return NextResponse.json({ playlist: data });
}

// Postgres returns SQLSTATE 23505 for unique-constraint violations.
// supabase-js surfaces the code on the error object; the migration
// at 0003_playlists_unique_name_per_user.sql adds a unique index on
// (user_id, lower(name)) so two playlists with the same name on the
// same account get rejected here.
function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const update: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "name cannot be blank" }, { status: 400 });
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }
    update.name = trimmed;
  }
  if (body.description !== undefined) update.description = body.description;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("playlists")
    .update(update)
    .eq("id", body.id)
    .select()
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "You already have a playlist with that name." },
        { status: 409 },
      );
    }
    console.error("playlist update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ playlist: data });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("playlists").delete().eq("id", id);

  if (error) {
    console.error("playlist delete failed", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
