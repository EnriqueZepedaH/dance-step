import type { ReactNode } from "react";
import { LibraryShell } from "@/components/library/LibraryShell";

// Wraps every browse-mode /library route with the collapsible
// shell. The shell is now stateless on data — it just owns the
// collapse interaction; the per-page server components fetch what
// they each need. router.refresh() from mutations re-runs the page
// (not this layout), so there's nothing here to keep in sync.

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return <LibraryShell>{children}</LibraryShell>;
}
