"use client";

import { createClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";
import { useMemo } from "react";
import type { Database } from "@/lib/db/types";

export function useSupabaseBrowserClient() {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          accessToken: () => session?.getToken() ?? Promise.resolve(null),
        },
      ),
    [session],
  );
}
