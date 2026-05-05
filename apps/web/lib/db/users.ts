import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
};

// Idempotent upsert of the signed-in Clerk user into Supabase `users`.
// Server-only — uses the service-role client so it works regardless of
// RLS. Closes the webhook race window: a user that hits a protected
// route before Clerk's user.created webhook fires still gets a row.
export async function ensureUser(): Promise<AppUser> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("ensureUser() called without a Clerk session");
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .upsert({ id: userId, email, display_name: displayName }, { onConflict: "id" })
    .select("id, email, display_name, role")
    .single();

  if (error) throw error;
  return data;
}
