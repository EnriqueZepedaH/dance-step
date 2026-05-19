import Link from "next/link";
import {
  Calendar,
  Database,
  PlusCircle,
  ShieldAlert,
  GitMerge,
  Image as ImageIcon,
} from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Admin landing. Pulls a few cheap counts to ground the section
// cards (events total, unresolved rejections, pending duplicates,
// last 7d flyer extractions). RLS reads use the normal server
// client; flyer_extractions has no policies so it goes through the
// admin client.

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const admin = getSupabaseAdminClient();

  const now = new Date();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    eventsCount,
    sourcesCount,
    rejectionsOpen,
    duplicatesOpen,
    flyerWeek,
  ] = await Promise.all([
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase
      .from("event_sources")
      .select("key", { count: "exact", head: true })
      .eq("enabled", true),
    supabase
      .from("quality_rejections")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    supabase
      .from("quality_rejections")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false)
      .eq("reason_code", "duplicate_cross_source"),
    admin
      .from("flyer_extractions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
  ]);

  const stat = (n: number | null | undefined) => n ?? 0;

  return (
    <section className="page-shell">
      <span className="eyebrow bullet">Admin · Home</span>
      <h1 className="display">Operations</h1>
      <p className="lede">
        Quick links to everything you can do as an admin. Counts below
        are live.
      </p>

      <div className="admin-card-grid">
        <article className="admin-card">
          <header>
            <Calendar size={18} aria-hidden />
            <h2>Events</h2>
            <span className="admin-card-count">{stat(eventsCount.count)}</span>
          </header>
          <p>Browse, edit, delete published and archived events.</p>
          <div className="admin-card-actions">
            <Link href="/admin/events" className="btn">
              Browse events
            </Link>
            <Link href="/admin/events/new" className="btn btn-ghost">
              <PlusCircle size={14} aria-hidden /> New event
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <header>
            <ImageIcon size={18} aria-hidden />
            <h2>Flyer extraction</h2>
            <span className="admin-card-count">
              {stat(flyerWeek.count)} <small>last 7d</small>
            </span>
          </header>
          <p>
            Upload a dance flyer to prefill the event form with Claude
            Vision. Full audit (latency, tokens, raw response, edits)
            persists in flyer_extractions.
          </p>
          <div className="admin-card-actions">
            <Link href="/admin/events/new" className="btn">
              Create from flyer
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <header>
            <Database size={18} aria-hidden />
            <h2>Scene · Sources</h2>
            <span className="admin-card-count">
              {stat(sourcesCount.count)} <small>enabled</small>
            </span>
          </header>
          <p>
            Toggle ingest sources, inspect last-run state, and trigger
            a re-fetch from the Railway worker.
          </p>
          <div className="admin-card-actions">
            <Link href="/admin/scene/sources" className="btn">
              Sources
            </Link>
            <Link href="/admin/scene/runs" className="btn btn-ghost">
              Runs
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <header>
            <ShieldAlert size={18} aria-hidden />
            <h2>Scene · Rejections</h2>
            <span className="admin-card-count">
              {stat(rejectionsOpen.count)} <small>unresolved</small>
            </span>
          </header>
          <p>
            Events the pipeline flagged on quality (past dates, missing
            venue, etc.). Promote anyway, edit, or dismiss.
          </p>
          <div className="admin-card-actions">
            <Link href="/admin/scene/rejections" className="btn">
              Resolve rejections
            </Link>
          </div>
        </article>

        <article className="admin-card">
          <header>
            <GitMerge size={18} aria-hidden />
            <h2>Scene · Duplicates</h2>
            <span className="admin-card-count">
              {stat(duplicatesOpen.count)} <small>pending</small>
            </span>
          </header>
          <p>
            Cross-source duplicate candidates (title+venue+time match).
            Merge or replace to keep the public Scene clean.
          </p>
          <div className="admin-card-actions">
            <Link href="/admin/scene/duplicates" className="btn">
              Review duplicates
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
