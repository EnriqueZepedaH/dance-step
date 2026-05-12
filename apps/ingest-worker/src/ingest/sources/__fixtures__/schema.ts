import { z } from "zod";

// Runtime schema mirroring FetchedEvent + NormalizedEvent. Used by
// the fixture validation test so a malformed JSON fixture fails at
// `npm run test`, not in production. The TS types in ../types.ts
// remain the build-time source of truth; this is the
// fixture-validation companion.

const NormalizedVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().min(1),
  country: z.string().min(1),
  timezone: z.string().min(1),
});

const NormalizedEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  startsUtc: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "startsUtc must parse as a Date",
  }),
  endsUtc: z
    .string()
    .nullable()
    .refine((s) => s === null || !Number.isNaN(Date.parse(s)), {
      message: "endsUtc must parse as a Date when present",
    }),
  recurrenceRule: z.string().nullable(),
  venue: NormalizedVenueSchema,
  sourceUrl: z.string().nullable(),
  kind: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

const JsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValue),
    z.record(z.string(), JsonValue),
  ]),
);

export const FetchedEventSchema = z.object({
  sourceEventId: z.string().min(1),
  rawPayload: JsonValue,
  sequence: z.number().int().nonnegative().optional(),
  normalized: NormalizedEventSchema,
});

export const FetchedEventArraySchema = z.array(FetchedEventSchema);
