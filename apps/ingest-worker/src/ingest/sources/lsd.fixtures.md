# Latin Street Dancing — source surface investigation

Investigated 2026-05-13 as part of branch `revamp-scene-foundation`.
The Scene ingest pipeline needs a stable surface to scrape; this
note records the decision and the representative payload shape so
the actual `lsd.ts` fetcher in branch P has a starting point.

## Surfaces checked

| URL | Result |
|---|---|
| `https://www.latinstreetdancing.com/upcoming-events/` | ~11 events, card grid, single page, no pagination. Does not show full time ranges or cover prices reliably. |
| `https://www.latinstreetdancing.com/events/` | **Winner.** Card grid + pagination (`/events/page/2/`, `/events/page/3/`, …). Each card carries title, cover charge, full start → end timestamps, venue name + neighborhood, Google Maps link. |
| `https://www.latinstreetdancing.com/wp-json/tribe/events/v1/events` | 404. The Events Calendar plugin is **not** installed. |
| `https://www.latinstreetdancing.com/wp-json/wp/v2/...` | Not investigated — no `tribe-*` markers anywhere on the page, suggesting a custom theme with no public WordPress REST endpoints for events. |

## Decision

**Scrape `https://www.latinstreetdancing.com/events/` with cheerio,
walking pagination links until no `?page=` or `/page/N/` link is
found.** All HTML selectors live in a single `SELECTORS` constant
at the top of `lsd.ts` so a future redesign is a one-diff fix.

The `event_sources.url` seeded in migration 0005 currently points at
`/upcoming-events/`; branch F updates this row to `/events/` so the
pipeline lands on the richer surface from day one.

## Representative event card (paraphrased from observed HTML)

```html
<article class="event-card">
  <a href="/event/baila-tuesdays-may-12-2026/" class="event-title">
    Baila Tuesdays | Barcocina
  </a>
  <div class="cover">$10</div>
  <div class="when">May 12, 2026 @ 8:00 PM - May 13, 2026 @ 1:00 AM</div>
  <div class="venue">Barcocina West Town</div>
  <a href="https://maps.google.com/?q=..." class="maps">Map</a>
</article>
```

(Exact class names confirmed when branch P writes the real fetcher;
this is the shape, not literal markup.)

## NormalizedEvent mapping

| Source field | NormalizedEvent field |
|---|---|
| Title text | `title` |
| Start of "When" range | `startsUtc` (parse in `America/Chicago`, then convert to UTC) |
| End of "When" range | `endsUtc` |
| Venue text (split on first comma if present) | `venue.name` + `venue.address` |
| Cover charge | not mapped in v1 — could go into `description` or a future `price` field |
| Detail-page URL | `sourceUrl` |
| (no neighborhood field exposed) | `venue.neighborhood` left null; Mapbox `context` will fill it in `clean.ts` |

## Deferred

- `enrich: true` flag that follows each `/event/<slug>/` detail page
  for richer descriptions. The card layout already gives us start +
  end + venue + price, so detail-page fetches double the request
  count without adding pipeline-critical fields. Add only if branch P
  finds the card descriptions too thin in practice.
- Cover-charge persistence (would require an `events.price_text` or
  similar column — out of scope for v1 revamp).
