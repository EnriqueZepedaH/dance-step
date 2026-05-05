import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Public route (gated as such in proxy.ts). Verifies the Clerk-signed
// Svix payload, then mirrors user state into Supabase via the service
// role client. ensureUser() in lib/db/users.ts is the synchronous
// fallback for the race between sign-up and webhook delivery.

type ClerkEmail = { email_address?: string };
type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmail[];
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};
type ClerkEvent = { type: string; data: { id: string } & Partial<ClerkUserData> };

function displayNameFor(u: Partial<ClerkUserData>): string | null {
  const composed = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return composed || u.username || null;
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
  if (!headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"]) {
    return NextResponse.json({ error: "missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(body, headers) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  if (event.type === "user.created" || event.type === "user.updated") {
    const u = event.data;
    const row = {
      id: u.id,
      email: u.email_addresses?.[0]?.email_address ?? null,
      display_name: displayNameFor(u),
    };
    const { error } = await admin
      .from("users")
      .upsert(row as unknown as never, { onConflict: "id" });
    if (error) {
      console.error("clerk webhook upsert failed", error);
      return NextResponse.json({ error: "upsert failed" }, { status: 500 });
    }
  } else if (event.type === "user.deleted") {
    const { error } = await admin.from("users").delete().eq("id", event.data.id);
    if (error) {
      console.error("clerk webhook delete failed", error);
      return NextResponse.json({ error: "delete failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
