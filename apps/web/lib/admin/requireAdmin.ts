import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/db/users";

// Defense-in-depth admin guard for API handlers. The /admin/* layout
// is the primary gate; this helper covers direct API hits that would
// otherwise bypass the layout. Returns { userId } on success or
// { error: NextResponse } on failure — callers narrow with an
// "error" in guard check.

export type AdminGuard = { userId: string } | { error: NextResponse };

export async function requireAdmin(): Promise<AdminGuard> {
  const { userId } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }
  const user = await ensureUser();
  if (user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { userId };
}
