// Timezone-aware datetime helpers. Replaces the Chicago-specific
// chicagoLocalToUtcIso that used to live inline in the admin events
// route — now that events can land in non-US zones (Aguascalientes,
// etc.), the converter takes an IANA timezone parameter.
//
// Same single-pass strategy as the prior helper: sample the input
// instant as UTC, then derive the offset between UTC and the target
// zone via Intl.DateTimeFormat. The DST spring-forward "missing hour"
// still falls back to the standard offset (one-hour skew possible at
// that boundary). Acceptable for admin-curated events.

export function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localToUtcIso(local: string, tz: string): string {
  const sample = new Date(local + "Z");
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: zone,
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

  const offsetMs = epoch(fmt("UTC")) - epoch(fmt(tz));
  return new Date(sample.getTime() + offsetMs).toISOString();
}
