import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LibraryShell } from "@/components/library/LibraryShell";
import { type SidebarPlaylist } from "@/components/library/LibrarySidebar";

// Wraps every browse-mode /library route with a left rail listing
// the user's playlists and quick links to Search + Saved videos.
// router.refresh() from rename/delete/create flows re-runs this
// server component, so the sidebar stays in sync with mutations.
//
// The grid + collapsed-state machinery lives in <LibraryShell>, a
// thin client wrapper. This server layout just feeds it data.

export default async function LibraryLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, name")
    .order("created_at", { ascending: false });

  const playlists: SidebarPlaylist[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return <LibraryShell playlists={playlists}>{children}</LibraryShell>;
}
