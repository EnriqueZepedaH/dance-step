import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public endpoint (gated as such in proxy.ts) — anonymous visitors
// can submit. RLS on lab_waitlist allows insert without auth and
// blocks select unless the requester is an admin.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("lab_waitlist").insert({ email });

  // Treat unique-violation (email already on the list) as success — we
  // don't want to leak whether an address has signed up before, and
  // the user's intent is "I want updates" either way.
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("lab_waitlist insert failed", error);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
