import type { ExtractedEvent } from "@/lib/llm/extractedSchema";

// The set of form fields that map 1:1 to an ExtractedEvent key. The
// EventForm tracks each of these in its own piece of state; on submit
// we diff `current` against `original` (the untouched extraction) and
// ship the field names that changed to /api/admin/events for the
// flyer_extractions.fields_edited audit column.
//
// Why JSON.stringify for the diff: extracted values are scalars
// (strings, null) so structural equality is cheap and `null`/`""`
// don't collapse the way a `===` check would after defaulting.
export const TRACKED_FIELDS = [
  "title",
  "description",
  "startsLocal",
  "endsLocal",
  "venueName",
  "venueAddress",
  "city",
  "country",
  "timezone",
  "kind",
  "sourceUrl",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

export type EditableSnapshot = Partial<Record<TrackedField, unknown>>;

export function computeFieldsEdited(
  original: ExtractedEvent,
  current: EditableSnapshot,
): TrackedField[] {
  return TRACKED_FIELDS.filter((field) => {
    const a = JSON.stringify(original[field] ?? null);
    const b = JSON.stringify(current[field] ?? null);
    return a !== b;
  });
}
