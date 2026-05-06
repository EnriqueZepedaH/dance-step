"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bookmark, Sparkles } from "lucide-react";

export type SidebarPlaylist = {
  id: string;
  name: string;
  itemsCount: number;
};

type Props = { playlists: SidebarPlaylist[] };

export function LibrarySidebar({ playlists }: Props) {
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
    <aside className="library-sidebar" aria-label="Library navigation">
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
          href="/library/my"
          className={`sidebar-link${isActive("/library/my") ? " is-active" : ""}`}
        >
          <Bookmark size={14} strokeWidth={1.7} />
          <span className="sidebar-link-label">Saved videos</span>
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
                    <span className="sidebar-playlist-count">
                      {p.itemsCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
