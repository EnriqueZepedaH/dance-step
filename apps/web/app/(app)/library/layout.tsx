import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  LibrarySidebar,
  type SidebarPlaylist,
} from "@/components/library/LibrarySidebar";

// Wraps every /library route with a left rail listing the user's
// playlists and quick links to Search + Saved videos. RLS scopes the
// fetch to the signed-in user; an admin viewing a non-admin's library
// would still only see their own playlists, which is correct.
//
// router.refresh() from rename/delete/create flows re-runs this server
// component, so the sidebar stays in sync with mutations on the page.

export default async function LibraryLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("playlists")
    .select("id, name, playlist_items(count)")
    .order("created_at", { ascending: false });

  const playlists: SidebarPlaylist[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    itemsCount: p.playlist_items?.[0]?.count ?? 0,
  }));

  return (
    <div className="library-shell">
      <LibrarySidebar playlists={playlists} />
      <div className="library-main">{children}</div>
    </div>
  );
}
