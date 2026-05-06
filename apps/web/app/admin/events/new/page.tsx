import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/admin/EventForm";

export default async function NewEventPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("venues")
    .select("id, name, neighborhood")
    .order("name", { ascending: true });

  return (
    <section className="page-shell">
      <p>
        <Link href="/admin/events" className="lede-link">
          ← Back to events
        </Link>
      </p>
      <span className="eyebrow bullet">Admin · Events</span>
      <h1 className="display">New event</h1>
      <p className="lede">
        Pick an existing venue or supply an address and we&rsquo;ll geocode it
        once on save.
      </p>
      <EventForm mode="create" venues={data ?? []} />
    </section>
  );
}
