import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/db/users";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

// Admin role gate. Lives outside the (app) route group so admin
// pages don't share the public app shell — they get their own
// header with admin nav and an explicit role check at the layout
// level. Defense-in-depth: every admin API handler also re-checks
// role independently, and RLS on events/venues enforces admin at
// the DB layer.

const ADMIN_NAV = [
  { href: "/admin/events", label: "Events" },
  { href: "/library", label: "Library" },
  { href: "/scene", label: "The Scene" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await ensureUser();
  if (user.role !== "admin") redirect("/");

  return (
    <main>
      <SiteHeader variant="app" nav={ADMIN_NAV} />
      {children}
      <Footer />
    </main>
  );
}
