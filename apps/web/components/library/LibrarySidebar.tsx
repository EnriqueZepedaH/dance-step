"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Bookmark,
  Sparkles,
  ListMusic,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export type SidebarPlaylist = {
  id: string;
  name: string;
};

type Props = {
  playlists: SidebarPlaylist[];
  collapsed: boolean;
  onToggle: () => void;
};

// Two visual modes share one component: the full content
// (.sidebar-content) and the icon rail (.sidebar-rail). The parent
// LibraryShell adds .is-collapsed to the grid which CSS uses to swap
// which mode is visible and to narrow the column. Keeping both in
// the same React tree means no remount when the user toggles, so
// scroll position and any in-flight state are preserved.

export function LibrarySidebar({ playlists, collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f
      ? playlists.filter((p) => p.name.toLowerCase().includes(f))
      : playlists;
  }, [playlists, filter]);

  function isActive(href: string, exact = true) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`library-sidebar${collapsed ? " is-collapsed" : ""}`}
      aria-label="Library navigation"
    >
      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? (
          <PanelLeftOpen size={16} strokeWidth={1.7} />
        ) : (
          <PanelLeftClose size={16} strokeWidth={1.7} />
        )}
      </button>

      <div className="sidebar-content">
        <nav className="library-sidebar-section">
          <span className="sidebar-eyebrow">Library</span>
          <Link
            href="/library"
            className={`sidebar-link${isActive("/library") ? " is-active" : ""}`}
          >
            <Search size={14} strokeWidth={1.7} />
            <span className="sidebar-link-label">Search</span>
          </Link>
          <Link
            href="/library/my/videos"
            className={`sidebar-link${isActive("/library/my/videos") ? " is-active" : ""}`}
          >
            <Bookmark size={14} strokeWidth={1.7} />
            <span className="sidebar-link-label">Saved videos</span>
          </Link>
          <Link
            href="/library/my/playlists"
            className={`sidebar-link${isActive("/library/my/playlists") ? " is-active" : ""}`}
          >
            <ListMusic size={14} strokeWidth={1.7} />
            <span className="sidebar-link-label">Playlists</span>
          </Link>
        </nav>

        <div className="library-sidebar-section">
          <div className="sidebar-row">
            <span className="sidebar-eyebrow">Playlists</span>
            {playlists.length > 0 ? (
              <span className="sidebar-count">{playlists.length}</span>
            ) : null}
          </div>

          {playlists.length > 4 ? (
            <input
              type="search"
              placeholder="Filter playlists…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="sidebar-filter"
              aria-label="Filter playlists"
            />
          ) : null}

          {playlists.length === 0 ? (
            <p className="sidebar-empty">
              <Sparkles size={12} strokeWidth={1.7} />
              Save a video and pick &ldquo;New playlist&rdquo; to start one.
            </p>
          ) : visible.length === 0 ? (
            <p className="sidebar-empty">No matches.</p>
          ) : (
            <ul className="sidebar-playlists">
              {visible.map((p) => {
                const href = `/library/playlists/${p.id}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={href}
                      className={`sidebar-link${isActive(href) ? " is-active" : ""}`}
                    >
                      <span className="sidebar-playlist-name">{p.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <nav className="sidebar-rail" aria-label="Library quick links">
        <Link
          href="/library"
          className={`rail-link${isActive("/library") ? " is-active" : ""}`}
          title="Search"
          aria-label="Search"
        >
          <Search size={16} strokeWidth={1.7} />
        </Link>
        <Link
          href="/library/my/videos"
          className={`rail-link${isActive("/library/my/videos") ? " is-active" : ""}`}
          title="Saved videos"
          aria-label="Saved videos"
        >
          <Bookmark size={16} strokeWidth={1.7} />
        </Link>
        <Link
          href="/library/my/playlists"
          className={`rail-link${isActive("/library/my/playlists") ? " is-active" : ""}`}
          title="Playlists"
          aria-label="Playlists"
        >
          <ListMusic size={16} strokeWidth={1.7} />
        </Link>
      </nav>
    </aside>
  );
}
