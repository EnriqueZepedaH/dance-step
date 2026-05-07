"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  LibrarySidebar,
  type SidebarPlaylist,
} from "@/components/library/LibrarySidebar";

// Client wrapper around the (browse) layout. Owns the collapse state
// for the playlist sidebar so the toggle button can flip it from the
// sidebar itself, and applies the matching class to the shell so the
// CSS grid track widths follow. State persists per-user in
// localStorage; SSR renders expanded by default and useEffect fixes
// the visual on mount (smoothed by a CSS transition on the grid).

const STORAGE_KEY = "library-sidebar-collapsed";

type Props = {
  playlists: SidebarPlaylist[];
  children: ReactNode;
};

export function LibraryShell({ playlists, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Standard SSR-safe hydration pattern: render the default on the
  // server, then sync from localStorage after mount. The setState
  // inside an effect is intentional, since the value isn't known on
  // the server.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* localStorage unavailable; stay expanded */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* persist best-effort */
      }
      return next;
    });
  }

  return (
    <div className={`library-shell${collapsed ? " is-collapsed" : ""}`}>
      <LibrarySidebar
        playlists={playlists}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <div className="library-main">{children}</div>
    </div>
  );
}
