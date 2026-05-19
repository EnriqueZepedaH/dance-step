import { z } from "zod";

// Single source of truth for required environment variables. Imported at
// module load by the Supabase clients and the Clerk webhook handler, so
// a missing key fails fast with a named error instead of a surprise
// undefined deep inside a request handler.
//
// Server-only variables MUST NOT be referenced from client components;
// the split below mirrors Next.js's NEXT_PUBLIC_ convention.

const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  // Optional today, but required once Phase 3/4 land. Mark .optional() so
  // the build does not break before the keys are provisioned.
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  // Flyer extraction (Phase 6 onwards). Optional so dev environments
  // without the key still build; the extract route returns 503 when
  // absent.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  FLYER_EXTRACT_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
  FLYER_EXTRACT_DAILY_CAP: z.coerce.number().int().positive().default(100),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1).optional(),
});

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

const clientParsed = clientSchema.safeParse({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
});

if (!clientParsed.success) {
  throw new Error(
    `Invalid client environment variables:\n${format(clientParsed.error)}`,
  );
}

// Server-only parse runs only when this module is evaluated on the
// server. Next.js strips server-only env vars from the client bundle,
// so referencing them in a client component throws at runtime.
const isServer = typeof window === "undefined";

const serverParsed = isServer
  ? serverSchema.safeParse({
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      FLYER_EXTRACT_MODEL: process.env.FLYER_EXTRACT_MODEL,
      FLYER_EXTRACT_DAILY_CAP: process.env.FLYER_EXTRACT_DAILY_CAP,
    })
  : ({ success: true, data: {} as z.infer<typeof serverSchema> } as const);

if (isServer && !serverParsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${format(serverParsed.error)}`,
  );
}

// On the client, server-only fields are absent at runtime — but Next.js
// strips any actual reference to them from the client bundle, so the
// typing fiction below is safe in practice. Server code reads server
// fields normally without nullable narrowing.
type ServerEnv = z.infer<typeof serverSchema>;
const serverData: ServerEnv =
  isServer && serverParsed.success
    ? serverParsed.data
    : ({} as ServerEnv);

export const env = {
  ...clientParsed.data,
  ...serverData,
};

export type Env = typeof env;
