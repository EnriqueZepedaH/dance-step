import "server-only";

import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@/lib/db/types";
import { env } from "@/lib/env";

export async function createSupabaseServerClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      accessToken: async () => {
        const { getToken } = await auth();
        return (await getToken()) ?? null;
      },
    },
  );
}
