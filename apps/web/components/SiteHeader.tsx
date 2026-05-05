import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";

export type NavItem = { href: string; label: string };

const LANDING_NAV: NavItem[] = [
  { href: "#library", label: "Library" },
  { href: "#scene", label: "The Scene" },
  { href: "#lab", label: "The Lab" },
  { href: "#manifesto", label: "Manifesto" },
];

const APP_NAV: NavItem[] = [
  { href: "/library", label: "Library" },
  { href: "/scene", label: "The Scene" },
  { href: "/upload", label: "The Lab" },
];

type Props = {
  variant?: "landing" | "app";
  nav?: NavItem[];
};

export function SiteHeader({ variant = "landing", nav }: Props) {
  const items = nav ?? (variant === "app" ? APP_NAV : LANDING_NAV);
  const revealClass = variant === "landing" ? "site-header reveal d-1" : "site-header";

  return (
    <header className={revealClass}>
      <Link className="brand" href="/">
        <span className="brand-glyph">d</span>
        <span>DanceStep</span>
        <sup>est. 26</sup>
      </Link>

      <nav className="nav" aria-label="Main">
        {items.map((item) =>
          item.href.startsWith("#") ? (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ) : (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ),
        )}
      </nav>

      <div className="header-auth">
        <Show when="signed-out">
          <Link className="btn" href="/sign-in">
            Enter the Floor
            <ArrowUpRight size={16} strokeWidth={1.6} />
          </Link>
        </Show>
        <Show when="signed-in">
          <Link className="btn btn-ghost" href="/library">
            Library
          </Link>
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
