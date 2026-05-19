import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Private bucket. Created via the Supabase dashboard alongside
// migration 0006 (Storage bucket creation is not SQL). No select
// policy — service-role uploads + 1-hour signed URLs for admin
// preview are the only access paths.
const BUCKET = "event-flyers";

export type FlyerExt = "jpg" | "png" | "webp";

// Server-generates the storage path. The flyer_extractions row gets
// this value at insert time (status='processing') so the audit row
// exists BEFORE the bytes do — a crash mid-upload still leaves a
// trackable record.
export function buildFlyerPath(ext: FlyerExt): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
}

export async function uploadFlyer(opts: {
  path: string;
  bytes: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp";
}): Promise<{ path: string; bucket: string }> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(opts.path, opts.bytes, {
      contentType: opts.mime,
      upsert: false,
    });
  if (error) {
    throw new Error(`storage upload failed: ${error.message}`);
  }
  return { path: opts.path, bucket: BUCKET };
}

export async function signedFlyerUrl(
  path: string,
  ttlSec = 3600,
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSec);
  if (error || !data) {
    throw new Error(`signed url failed: ${error?.message ?? "no data"}`);
  }
  return data.signedUrl;
}
