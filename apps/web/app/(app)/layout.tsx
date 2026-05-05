import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { ensureUser } from "@/lib/db/users";

// Wraps the post-landing pages (library, scene, future admin) with the
// shared shell. Calls ensureUser() for any signed-in visitor so the
// Supabase users row exists before feature pages start querying.
//
// Conditional: /scene is publicly browsable, so anon visitors should
// not trigger ensureUser (it would throw without a Clerk session). The
// proxy handles redirecting anon users away from /library and /admin.

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (userId) await ensureUser();

  return (
    <main>
      <SiteHeader variant="app" />
      {children}
      <Footer />
    </main>
  );
}
