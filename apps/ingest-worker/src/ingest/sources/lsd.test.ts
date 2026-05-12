import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLsdHtml } from "./lsd.js";

// Captured from a real /events/ response on 2026-05-12. Trimmed of
// `srcset`, image bytes, theme wrappers — kept enough markup that
// SELECTORS reach what they need to reach. If the live site
// changes structure, this test points at the diff.

const SAMPLE = `<html><body>
<div class="posts-wrap gymclub-events">
  <article id="post-27112" class="v-grid-item gymclub_event type-gymclub_event">
    <div class="entry-featured">
      <img src="https://example.com/baila.jpeg" alt="barcocina" />
      <div class="event-date"><div>May</div><div class="date_start">12</div></div>
    </div>
    <div class="post-content entry-content">
      <header class="post-header">
        <h2 class="post-title">
          <a href="https://www.latinstreetdancing.com/event/baila/" rel="bookmark">Baila Tuesdays 📍 Barcocina West Town</a>
        </h2>
      </header>
      <div class="entry-meta">
        <div class="entry-meta-content">
          <div><span class="event-price">$10</span></div>
          <div><span>May 12, 2026 @ 8:00 PM - May 13, 2026 @ 1:00 AM</span></div>
          <div><span>
            <i class="fa fa-map-marker"></i>
            Barcocina West Town
            <a class="event-view-map" href="http://www.google.com/maps/?saddr=&daddr=41.8962465,-87.67292739999999">+ Google Map</a>
          </span></div>
        </div>
      </div>
    </div>
  </article>
  <article class="v-grid-item gymclub_event">
    <div class="post-content entry-content">
      <header class="post-header">
        <h2 class="post-title">
          <a href="https://www.latinstreetdancing.com/event/100-salsa-social/">100% Salsa Social</a>
        </h2>
      </header>
      <div class="entry-meta">
        <div class="entry-meta-content">
          <div><span class="event-price">$10 - $15</span></div>
          <div><span>May 29, 2026 @ 8:30 PM - May 30, 2026 @ 1:30 AM</span></div>
          <div><span>Latin Street Music &amp; Dancing Studio</span></div>
        </div>
      </div>
    </div>
  </article>
</div>
<a class="next page-numbers" href="https://www.latinstreetdancing.com/events/page/2/">Next</a>
</body></html>`;

const w = {
  fromUtc: new Date("2026-05-01T00:00:00.000Z"),
  toUtc: new Date("2026-07-01T00:00:00.000Z"),
};

test("parseLsdHtml: extracts both event cards", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  assert.equal(events.length, 2);
});

test("parseLsdHtml: first event has correct UTC time range (CDT)", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  const ev = events[0]!;
  // May 12, 2026 8:00 PM CDT (UTC-5) = May 13, 2026 01:00 UTC
  assert.equal(ev.normalized.startsUtc, "2026-05-13T01:00:00.000Z");
  // May 13, 2026 1:00 AM CDT = May 13, 2026 06:00 UTC
  assert.equal(ev.normalized.endsUtc, "2026-05-13T06:00:00.000Z");
});

test("parseLsdHtml: sourceEventId is slug + iso date, lsd-prefixed", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  assert.ok(events[0]!.sourceEventId.startsWith("lsd:"));
  assert.match(events[0]!.sourceEventId, /\d{4}-\d{2}-\d{2}$/);
});

test("parseLsdHtml: title + venue + URL captured", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  assert.equal(events[0]!.normalized.title, "Baila Tuesdays 📍 Barcocina West Town");
  assert.equal(events[0]!.normalized.venue.name, "Barcocina West Town");
  assert.equal(events[0]!.normalized.sourceUrl, "https://www.latinstreetdancing.com/event/baila/");
});

test("parseLsdHtml: extracts lat/lng from Google Maps daddr param", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  const payload = events[0]!.rawPayload as { coords: { lat: number; lng: number } | null };
  assert.ok(payload.coords);
  assert.ok(Math.abs(payload.coords!.lat - 41.8962465) < 1e-6);
  assert.ok(Math.abs(payload.coords!.lng - -87.67292739999999) < 1e-6);
});

test("parseLsdHtml: second event has no coords (no map link)", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  const payload = events[1]!.rawPayload as { coords: unknown };
  assert.equal(payload.coords, null);
});

test("parseLsdHtml: discovers next-page link", () => {
  const { nextUrl } = parseLsdHtml(SAMPLE, w);
  assert.equal(nextUrl, "https://www.latinstreetdancing.com/events/page/2/");
});

test("parseLsdHtml: no next link returns null", () => {
  const html = SAMPLE.replace(/<a class="next page-numbers"[^>]*>[^<]*<\/a>/, "");
  const { nextUrl } = parseLsdHtml(html, w);
  assert.equal(nextUrl, null);
});

test("parseLsdHtml: filters out events outside window", () => {
  const distantFuture = {
    fromUtc: new Date("2030-01-01T00:00:00.000Z"),
    toUtc: new Date("2030-02-01T00:00:00.000Z"),
  };
  const { events } = parseLsdHtml(SAMPLE, distantFuture);
  assert.equal(events.length, 0);
});

test("parseLsdHtml: rawPayload is JSON-serializable", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  assert.doesNotThrow(() => JSON.stringify(events[0]!.rawPayload));
});

test("parseLsdHtml: cover charge appears in description", () => {
  const { events } = parseLsdHtml(SAMPLE, w);
  assert.match(events[0]!.normalized.description ?? "", /Cover \$10/);
  assert.match(events[1]!.normalized.description ?? "", /Cover \$10 - \$15/);
});
