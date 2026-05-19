// Flyer extraction endpoint. Admin-only. Accepts a multipart upload
// with a single `flyer` file (≤5 MB, JPEG/PNG/WebP), uploads to the
// private event-flyers Storage bucket, runs Claude vision, persists
// the full audit row to flyer_extractions, and returns a signed
// preview URL plus the extracted event data for the EventForm.
//
// Sequencing matters: the audit row is inserted in status='processing'
// BEFORE the bytes hit Storage and BEFORE the model call. A crash at
// any later step flips that row to 'failed' so we never accumulate
// orphan flyers without a trail.
//
// runtime='nodejs' — Edge can't handle the Buffer + 5 MB body.

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/requireAdmin";
import { env } from "@/lib/env";
import { extractFlyer } from "@/lib/llm/extractFlyer";
import {
  buildFlyerPath,
  signedFlyerUrl,
  uploadFlyer,
  type FlyerExt,
} from "@/lib/storage/uploadFlyer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;

type SupportedMime = "image/jpeg" | "image/png" | "image/webp";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "flyer extraction not configured" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("flyer");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing flyer" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "flyer too large (max 5 MB)" },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(buffer);
  if (!mime) {
    return NextResponse.json(
      { error: "unsupported image type" },
      { status: 415 },
    );
  }

  const supabase = getSupabaseAdminClient();

  // Daily cap (global, UTC day).
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("flyer_extractions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  if ((count ?? 0) >= env.FLYER_EXTRACT_DAILY_CAP) {
    return NextResponse.json(
      { error: "daily extraction cap reached" },
      { status: 429 },
    );
  }

  // Generate path + insert processing row BEFORE upload.
  const ext: FlyerExt =
    mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const storagePath = buildFlyerPath(ext);

  const { data: row, error: insertErr } = await supabase
    .from("flyer_extractions")
    .insert({
      storage_path: storagePath,
      mime,
      bytes: buffer.length,
      model: env.FLYER_EXTRACT_MODEL,
      status: "processing",
      created_by: guard.userId,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("flyer_extractions insert failed", insertErr);
    return NextResponse.json(
      { error: "extraction insert failed" },
      { status: 500 },
    );
  }

  // Upload bytes; flip row to failed on upload error.
  try {
    await uploadFlyer({ path: storagePath, bytes: buffer, mime });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("flyer_extractions")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json(
      { error: "upload failed", extractionId: row.id },
      { status: 500 },
    );
  }

  // Call Claude vision; persist full audit on success or failure.
  try {
    const result = await extractFlyer({
      imageBase64: buffer.toString("base64"),
      mime,
    });

    await supabase
      .from("flyer_extractions")
      .update({
        status: "completed",
        latency_ms: result.latencyMs,
        input_tokens: result.usage.input,
        output_tokens: result.usage.output,
        total_tokens: result.usage.total,
        raw_response: result.rawResponse as never,
        extracted: result.extracted as never,
        warnings: result.extracted.warnings,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    const flyerUrl = await signedFlyerUrl(storagePath);
    return NextResponse.json({
      extractionId: row.id,
      flyerUrl,
      extracted: result.extracted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("flyer_extractions")
      .update({
        status: "failed",
        error: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json(
      { error: message, extractionId: row.id },
      { status: 502 },
    );
  }
}

function sniffImageMime(buf: Buffer): SupportedMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf.slice(1, 4).toString() === "PNG") return "image/png";
  if (
    buf.slice(0, 4).toString() === "RIFF" &&
    buf.slice(8, 12).toString() === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
