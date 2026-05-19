import { z } from "zod";

// Zod schema for the structured output Claude vision returns from a
// flyer. Validated twice: once by Anthropic's tool-use input_schema
// (defined in extractFlyer.ts as a JSON-schema mirror of this Zod),
// and once by `ExtractedSchema.parse` after the response lands —
// defense in depth against schema drift between the two definitions.
//
// `confidence` is a free-form map so the model can emit any subset of
// fields it actually populated; the form UX reads `confidence[field]`
// when rendering the per-field badge.

export const EXTRACTED_KINDS = [
  "class",
  "social",
  "workshop",
  "festival",
  "concert",
  "rueda",
  "other",
] as const;

export const ExtractedSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  startsLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
  endsLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
  venueName: z.string().nullable(),
  venueAddress: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().length(2).nullable(),
  timezone: z.string().nullable(),
  kind: z.enum(EXTRACTED_KINDS).nullable(),
  sourceUrl: z.string().url().nullable(),
  confidence: z.record(z.string(), z.number().min(0).max(1)),
  warnings: z.array(z.string()),
});

export type ExtractedEvent = z.infer<typeof ExtractedSchema>;
