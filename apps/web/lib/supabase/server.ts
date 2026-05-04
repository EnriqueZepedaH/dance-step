import "server-only";

import { createServerClient } from "@supabase/ssr";
import { auth } from "@clerk/nextjs/server";

export async function createSupabaseServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      accessToken: async () => {
        const { getToken } = await auth();
        return (await getToken()) ?? null;
      },
    },
  );
}
