import * as cheerio from "cheerio";
import type {
  FetchedEvent,
  FetchWindow,
  NormalizedEvent,
  SourceFetcher,
} from "../types.js";
import { SourceFetchError } from "../types.js";
import { localToUtcDate } from "../lib/timezone.js";
import slugifyLib from "slugify";
const slugify = (slugifyLib as unknown as { default?: typeof slugifyLib })
  .default ?? slugifyLib;

// Latin Street Dancing source. Custom WordPress (GymClub theme, NOT
// The Events Calendar plugin — confirmed in branch F's investigation
// at apps/ingest-worker/src/ingest/sources/lsd.fixtures.md). HTML
// scrape of /events/ with pagination.
//
// All selectors live in SELECTORS so a future site redesign is a
// one-diff fix. If something breaks, ingest_runs.status will land
// 'failed' for this source; the orchestrator continues with gcal.
//
// Lucky bonus: each event card's "+ Google Map" link embeds
// `daddr=LAT,LNG` so we capture coords directly and skip Mapbox
// geocoding for these venues. The downstream clean.ts will use the
// cached coords when present.

const SOURCE_KEY = "lsd";
const TIMEZONE = "America/Chicago";

const SELECTORS = {
  // Each event card on the listing page.
  card: "article.gymclub_event",
  title: ".post-title a",
  // The two un-classed spans in .entry-meta carry the time range and
  // the venue + map link respectively. Index 0 = price block; spans
  // 1+ = the rest.
  metaSpans: ".entry-meta .entry-meta-content > div > span",
  price: ".event-price",
  mapLink: ".event-view-map",
  image: ".entry-featured img",
  // Pagination's "next" anchor.
  nextPage: "a.next.page-numbers",
};

// "May 12, 2026 @ 8:00 PM - May 13, 2026 @ 1:00 AM"
// The em-dash variant " — " sometimes appears in the wild too;
// match both. We also tolerate extra whitespace around the
// separator, which the rendered HTML often has thanks to inline
// SVG/text wrapping.
const RANGE_RE = /\s+[-–—]\s+/;
const DATE_RE =
  /^(?<mon>[A-Za-z]+) (?<day>\d{1,2}),\s+(?<year>\d{4})\s+@\s+(?<hour>\d{1,2}):(?<min>\d{2})\s+(?<ampm>AM|PM)/;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MAP_COORDS_RE = /[?&]daddr=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

export function makeLsdFetcher(opts: {
  url: string;
  maxPages?: number; // safety stop; defaults to 10
}): SourceFetcher {
  const maxPages = opts.maxPages ?? 10;
  return {
    key: SOURCE_KEY,
    async fetch(window: FetchWindow): Promise<FetchedEvent[]> {
      let url: string | null = opts.url;
      const out: FetchedEvent[] = [];
      let visited = 0;
      while (url && visited < maxPages) {
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            "User-Agent": "DanceStep-IngestWorker/0.1 (+chicago events)",
          },
        });
        if (!res.ok) {
          throw new SourceFetchError(
            SOURCE_KEY,
            `${url} returned ${res.status} ${res.statusText}`,
          );
        }
        const html = await res.text();
        const { events, nextUrl } = parseLsdHtml(html, window);
        out.push(...events);
        url = nextUrl;
        visited++;
      }
      return out;
    },
  };
}

export function parseLsdHtml(
  html: string,
  window: FetchWindow,
): { events: FetchedEvent[]; nextUrl: string | null } {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    throw new SourceFetchError(SOURCE_KEY, "cheerio.load failed", err);
  }

  const events: FetchedEvent[] = [];

  $(SELECTORS.card).each((_idx, el) => {
    const $card = $(el);
    const titleAnchor = $card.find(SELECTORS.title).first();
    const title = titleAnchor.text().trim();
    const url = (titleAnchor.attr("href") ?? "").trim() || null;
    if (!title) return;

    // Find the time-range span and the venue span among the
    // un-classed spans. The price block lives in a span with class
    // .event-price; we use that to skip it.
    let rangeText: string | null = null;
    let venueText: string | null = null;
    $card.find(SELECTORS.metaSpans).each((_i, spanEl) => {
      const $span = $(spanEl);
      if ($span.hasClass("event-price")) return; // price; not what we want here
      const raw = $span.text().replace(/\s+/g, " ").trim();
      if (!raw) return;
      if (RANGE_RE.test(raw) || /@\s+\d{1,2}:\d{2}\s+(AM|PM)/.test(raw)) {
        if (rangeText === null) rangeText = raw;
      } else if (venueText === null) {
        // Trim the trailing "+ Google Map" if present in the
        // serialized text.
        venueText = raw.replace(/\s*\+\s*Google Map\s*$/i, "").trim();
      }
    });

    if (!rangeText || !venueText) return;

    const parsed = parseRange(rangeText);
    if (!parsed) return;
    const { startsUtc, endsUtc } = parsed;
    if (startsUtc < window.fromUtc.toISOString()) return;
    if (startsUtc > window.toUtc.toISOString()) return;

    const mapHref = $card.find(SELECTORS.mapLink).attr("href") ?? "";
    const coords = extractCoords(mapHref);
    const imageUrl = $card.find(SELECTORS.image).attr("src") ?? null;
    const price = $card.find(SELECTORS.price).first().text().trim() || null;

    const isoDate = startsUtc.slice(0, 10);
    const sourceEventId =
      `lsd:${slugify(`${title}-${isoDate}`, { lower: true, strict: true })}`;

    const description =
      price ? `${title}. Cover ${price}.` : title;

    const normalized: NormalizedEvent = {
      title,
      description,
      startsUtc,
      endsUtc,
      recurrenceRule: null,
      venue: {
        name: venueText,
        address: venueText,
        city: "Chicago",
        country: "US",
        timezone: TIMEZONE,
      },
      sourceUrl: url,
      kind: null,
      imageUrl,
    };

    events.push({
      sourceEventId,
      rawPayload: {
        title,
        url,
        price,
        when: rangeText,
        venue: venueText,
        mapHref: mapHref || null,
        coords: coords ? { lat: coords.lat, lng: coords.lng } : null,
        imageUrl,
      },
      normalized,
    });
  });

  const nextUrl = $(SELECTORS.nextPage).first().attr("href") ?? null;

  return { events, nextUrl: nextUrl && nextUrl.trim() !== "" ? nextUrl : null };
}

function parseRange(text: string): { startsUtc: string; endsUtc: string | null } | null {
  const parts = text.split(RANGE_RE);
  if (parts.length === 0) return null;
  const startStr = parts[0]?.trim() ?? "";
  const endStr = parts[1]?.trim();
  const start = parseChicagoLocal(startStr);
  if (!start) return null;
  const end = endStr ? parseChicagoLocal(endStr) : null;
  return {
    startsUtc: start.toISOString(),
    endsUtc: end ? end.toISOString() : null,
  };
}

function parseChicagoLocal(s: string): Date | null {
  const m = DATE_RE.exec(s);
  if (!m || !m.groups) return null;
  const monKey = m.groups.mon!.slice(0, 3).toLowerCase();
  const month = MONTHS[monKey];
  if (!month) return null;
  let hour = Number(m.groups.hour);
  const minute = Number(m.groups.min);
  if (m.groups.ampm === "PM" && hour !== 12) hour += 12;
  if (m.groups.ampm === "AM" && hour === 12) hour = 0;
  return localToUtcDate(
    {
      year: Number(m.groups.year),
      month,
      day: Number(m.groups.day),
      hour,
      minute,
    },
    TIMEZONE,
  );
}

function extractCoords(href: string): { lat: number; lng: number } | null {
  const m = MAP_COORDS_RE.exec(href);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
