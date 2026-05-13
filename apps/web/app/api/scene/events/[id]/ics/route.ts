import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Single-event ICS export. Public — RLS on events lets anon read.
// Renders a minimal ICS with a full VTIMEZONE block for
// America/Chicago (currently the only city); future cities will
// need their own VTIMEZONE template.
//
// Calendar clients (Google, Apple, Outlook) require VTIMEZONE to
// interpret DTSTART;TZID correctly — a naive "Z" timestamp works
// but loses the floating local-time identity (events shift if
// the user's calendar is set to a different zone). With VTIMEZONE,
// "8pm Tuesday in Chicago" stays 8pm Tuesday in Chicago.

export const runtime = "nodejs";

const CRLF = "\r\n";

const VTIMEZONE_CHICAGO = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Chicago",
  "X-LIC-LOCATION:America/Chicago",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join(CRLF);

function escapeIcs(text: string): string {
  // Per RFC 5545 §3.3.11: backslash, semicolon, comma must be
  // escaped in TEXT properties; newlines become literal "\n".
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toIcsLocal(utcIso: string, timeZone: string): string {
  // Render an ISO 8601 instant as YYYYMMDDTHHmmSS in the target
  // zone so we can emit DTSTART;TZID=America/Chicago:YYYY... .
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}${get("month")}${get("day")}T${hour}${get("minute")}${get("second")}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, starts_at, ends_at, timezone, url, venues(name, address)",
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!event) notFound();

  const tz = event.timezone || "America/Chicago";
  const venue = (event.venues as { name: string; address: string | null } | null) ?? null;
  const location = venue
    ? venue.address
      ? `${venue.name}, ${venue.address}`
      : venue.name
    : "";

  const dtStart = toIcsLocal(event.starts_at, tz);
  const dtEnd = event.ends_at
    ? toIcsLocal(event.ends_at, tz)
    : toIcsLocal(
        new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString(),
        tz,
      );
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DanceStep//Scene//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VTIMEZONE_CHICAGO,
    "BEGIN:VEVENT",
    `UID:${event.id}@dancestep`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${tz}:${dtStart}`,
    `DTEND;TZID=${tz}:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : "",
    location ? `LOCATION:${escapeIcs(location)}` : "",
    event.url ? `URL:${event.url}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const body = lines.join(CRLF) + CRLF;

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.id}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
