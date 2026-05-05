import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db/types";
import { env } from "@/lib/env";

// Server-side proxy for YouTube search.list. Caches results in
// public.youtube_cache for 24h to keep the free 10k-units/day quota
// usable. search.list = 100 units per call; with cache + 400ms client
// debounce we comfortably stay under quota during a class.
//
// Contract:
//   GET /api/youtube/search?q=<query>&pageToken=<optional>
//   200 { items: TrimmedItem[]; nextPageToken?: string; cached: boolean }
//   200 { rateLimited: true }                     ← quota exceeded
//   400 { error: "missing q" }                    ← empty query
//   503 { error: "YOUTUBE_API_KEY not configured" }
//
// Cache miss -> trim YouTube response to {videoId,title,channelTitle,
// thumbnail}, then upsert into youtube_cache via the service-role
// client (RLS-bypassing because youtube_cache has no public policies).

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_QUERY_LENGTH = 200;

export type TrimmedItem = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
};

type CachedPayload = {
  items: TrimmedItem[];
  nextPageToken?: string;
};

type YouTubeSnippet = {
  title?: string;
  channelTitle?: string;
  thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: YouTubeSnippet;
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
  error?: { code?: number; errors?: { reason?: string }[] };
};

function hashKey(q: string, pageToken: string): string {
  return createHash("sha256").update(`${q}::${pageToken}`).digest("hex");
}

function trim(items: YouTubeSearchItem[]): TrimmedItem[] {
  return items
    .map((item): TrimmedItem | null => {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title) return null;
      return {
        videoId,
        title: snippet.title,
        channelTitle: snippet.channelTitle ?? "",
        thumbnail:
          snippet.thumbnails?.medium?.url ??
          snippet.thumbnails?.default?.url ??
          "",
      };
    })
    .filter((x): x is TrimmedItem => x !== null);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const pageToken = url.searchParams.get("pageToken") ?? "";

  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  if (!env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY not configured" },
      { status: 503 },
    );
  }

  const queryHash = hashKey(q, pageToken);
  const admin = getSupabaseAdminClient();

  // Cache lookup. A miss or expired entry both fall through to the
  // network call; the upsert below replaces stale rows.
  const { data: cached } = await admin
    .from("youtube_cache")
    .select("results, fetched_at")
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      const payload = cached.results as unknown as CachedPayload;
      return NextResponse.json({ ...payload, cached: true });
    }
  }

  const ytUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  ytUrl.searchParams.set("part", "snippet");
  ytUrl.searchParams.set("type", "video");
  ytUrl.searchParams.set("videoEmbeddable", "true");
  ytUrl.searchParams.set("maxResults", "12");
  ytUrl.searchParams.set("q", q);
  if (pageToken) ytUrl.searchParams.set("pageToken", pageToken);
  ytUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

  const ytRes = await fetch(ytUrl.toString(), { cache: "no-store" });
  const body = (await ytRes.json()) as YouTubeSearchResponse;

  if (!ytRes.ok) {
    const reason = body.error?.errors?.[0]?.reason ?? "";
    if (
      ytRes.status === 403 &&
      (reason === "quotaExceeded" || reason === "rateLimitExceeded")
    ) {
      return NextResponse.json({ rateLimited: true });
    }
    console.error("youtube search failed", ytRes.status, body);
    return NextResponse.json(
      { error: "youtube search failed" },
      { status: 502 },
    );
  }

  const payload: CachedPayload = {
    items: trim(body.items ?? []),
    nextPageToken: body.nextPageToken,
  };

  const { error: cacheError } = await admin.from("youtube_cache").upsert({
    query_hash: queryHash,
    query: q,
    page_token: pageToken || null,
    results: payload as unknown as Json,
    fetched_at: new Date().toISOString(),
  });
  if (cacheError) {
    // Cache write is best-effort; serve the live result even if it failed.
    console.error("youtube_cache upsert failed", cacheError);
  }

  return NextResponse.json({ ...payload, cached: false });
}
