import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/requireAdmin";

// Toggle event_sources.enabled. RLS on the table is select-public
// only; writes need the service-role client. requireAdmin gates
// the route — RLS bypass + admin check = defense in depth.

type PatchBody = { key?: string; enabled?: boolean };

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.key || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "key and enabled required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("event_sources")
    .update({ enabled: body.enabled })
    .eq("key", body.key);
  if (error) {
    console.error("event_sources update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
