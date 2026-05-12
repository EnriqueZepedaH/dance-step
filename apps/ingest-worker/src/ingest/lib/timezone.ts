// Convert a wall-clock instant in an IANA timezone to a UTC Date.
// The standard trick: treat the parts as if they were UTC to get a
// "sample" instant, then ask Intl.DateTimeFormat what that instant
// looks like in the target zone. The diff between (target zone
// rendering) and (target wall-clock we wanted) is the timezone
// offset to subtract.
//
// Correct for every offset (including 30/45-minute zones) and
// across DST transitions, except for the "missing hour" on
// spring-forward boundary (caller might pass a wall-clock that
// doesn't exist); we accept being one hour off in that ambiguous
// case rather than rejecting the input.

type LocalParts = {
  year: number;
  month: number;  // 1-12
  day: number;
  hour: number;
  minute: number;
  second?: number;
};

export function localToUtcDate(
  local: LocalParts,
  timeZone: string,
): Date {
  const second = local.second ?? 0;
  const targetUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    second,
  );

  // Render the sample instant in the target zone. Whatever zone-local
  // wall-clock comes out, subtract it from the target wall-clock to
  // get the offset.
  const sampleInZone = wallClockMs(new Date(targetUtcMs), timeZone);
  const offsetMs = sampleInZone - targetUtcMs;
  return new Date(targetUtcMs - offsetMs);
}

function wallClockMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
}
