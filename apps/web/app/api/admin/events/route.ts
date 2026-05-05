import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUser } from "@/lib/db/users";
import { geocodeAddress } from "@/lib/mapbox/geocode";
import type { TablesUpdate } from "@/lib/db/types";

// Admin events CRUD. Auth is gated by proxy.ts; admin role is
// re-checked here for defense in depth (the layout's check is the
// primary gate, but a direct API hit must not bypass it). RLS on
// events/venues also enforces admin role at the DB layer.

type CreateBody = {
  title?: string;
  startsAt?: string;       // datetime-local: "YYYY-MM-DDTHH:mm"
  endsAt?: string | null;
  kind?: string | null;
  description?: string | null;
  url?: string | null;
  venueId?: string | null;
  newVenue?: { name: string; address: string } | null;
};

type PatchBody = {
  id?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  kind?: string | null;
  description?: string | null;
  url?: string | null;
  venueId?: string | null;
};

// Converts a naive Chicago wall-clock string ("2026-05-06T21:00") to
// an ISO UTC string. Single-pass: the offset is sampled at the input
// instant treated as UTC, which is fine outside DST transitions but
// can be one hour off if the input falls in the "missing" hour on
// the spring-forward boundary. Acceptable for admin-curated events.
function chicagoLocalToUtcIso(local: string): string {
  const sample = new Date(local + "Z");
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).formatToParts(sample);

  const part = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const epoch = (parts: Intl.DateTimeFormatPart[]) =>
    Date.UTC(
      Number(part(parts, "year")),
      Number(part(parts, "month")) - 1,
      Number(part(parts, "day")),
      Number(part(parts, "hour")) % 24,
      Number(part(parts, "minute")),
      Number(part(parts, "second")),
    );

  const offsetMs = epoch(fmt("UTC")) - epoch(fmt("America/Chicago"));
  return new Date(sample.getTime() + offsetMs).toISOString();
}

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "unauthenticated" }, { status: 401 }) };
  }
  const user = await ensureUser();
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { userId };
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.title || !body.startsAt) {
    return NextResponse.json(
      { error: "title and startsAt are required" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // Resolve venue: existing id, or create a new one with geocoding.
  let venueId = body.venueId ?? null;
  if (!venueId && body.newVenue) {
    const { name, address } = body.newVenue;
    if (!name || !address) {
      return NextResponse.json(
        { error: "newVenue requires name and address" },
        { status: 400 },
      );
    }
    const hit = await geocodeAddress(address);
    if (!hit) {
      return NextResponse.json(
        { error: "could not geocode address" },
        { status: 422 },
      );
    }
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .insert({
        name,
        address,
        lat: hit.lat,
        lng: hit.lng,
      })
      .select()
      .single();
    if (venueError) {
      console.error("venue insert failed", venueError);
      return NextResponse.json({ error: "venue create failed" }, { status: 500 });
    }
    venueId = venue.id;
  }

  if (!venueId) {
    return NextResponse.json(
      { error: "venueId or newVenue is required" },
      { status: 400 },
    );
  }

  const startsAtIso = chicagoLocalToUtcIso(body.startsAt);
  const endsAtIso = body.endsAt ? chicagoLocalToUtcIso(body.endsAt) : null;

  const { data, error } = await supabase
    .from("events")
    .insert({
      title: body.title,
      venue_id: venueId,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      kind: body.kind ?? null,
      description: body.description ?? null,
      url: body.url ?? null,
      created_by: guard.userId,
    })
    .select()
    .single();

  if (error) {
    console.error("event insert failed", error);
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const update: TablesUpdate<"events"> = {};
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.startsAt === "string")
    update.starts_at = chicagoLocalToUtcIso(body.startsAt);
  if (body.endsAt !== undefined)
    update.ends_at = body.endsAt ? chicagoLocalToUtcIso(body.endsAt) : null;
  if (body.kind !== undefined) update.kind = body.kind;
  if (body.description !== undefined) update.description = body.description;
  if (body.url !== undefined) update.url = body.url;
  if (body.venueId !== undefined) update.venue_id = body.venueId;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .update(update)
    .eq("id", body.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("event update failed", error);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ event: data });
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("event delete failed", error);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
