# Project Proposal: DanceStep

## One-Line Description
A go-to web platform for Latin dancers — search and bookmark dance videos, discover the local dance scene, and (experimentally) get an AI-generated move-by-move breakdown of any Cuban Casino video.

## The Problem
Latin dancers — especially in the Cuban Casino (salsa) community — don't have a single home on the web. Tutorial videos are scattered across YouTube with no way to organize favorites by move or figure. Local scene information (socials, festivals, classes) lives in fragmented Facebook groups, Instagram stories, and word-of-mouth. And at parties, dancers constantly see moves they want to learn, but the music is fast, the sequences are complex, and by the time the song ends, the moment is gone — there's no tool that takes a raw dance video and gives you a structured, practiceable breakdown.

DanceStep is a single platform that addresses all three: a curated dance video library, a map of the local scene, and an experimental AI move-analyzer.

## Target User
Intermediate Cuban Casino (salsa) dancers — people who already know the basics (guapea, dile que no, enchufla), attend socials regularly, watch tutorial videos to level up, and want to plug into the broader scene (festivals, congresses, weekly socials). The platform is designed for Casino first but generalizes naturally to other Latin styles (NY-style salsa, bachata, etc.). The first user is me.

## Core Features (v1)

### 1. Dance Video Library (YouTube-powered)
- Search YouTube for dance videos directly from the app (YouTube Data API).
- Bookmark favorite videos and organize them into named playlists (e.g. "Enchufla variations", "Songs I want to dance to", "Festival performances").
- Personal library view — all your saved videos in one place, searchable and filterable.

### 2. Dance Scene Explorer
- Map-based discovery of dance events, socials, festivals, and classes near the user — modeled on [thelatindancemap.com](https://thelatindancemap.com/).
- Browse upcoming events by date, city, or style.
- Event details page with venue, time, style, and a link to the source.
- v1 seed strategy: launch with a single city (Chicago) and a manually curated set of recurring socials, with a user submission form for new events (moderated).

### 3. Experimental: AI Move Breakdown
- Upload a prerecorded video of a couple dancing Casino (a few seconds up to ~5 minutes).
- Pose estimation pipeline extracts body keypoints for both dancers (MediaPipe).
- Move segmentation detects transition points, splitting the choreography into discrete atomic moves.
- Move classification labels each segment from a vocabulary of ~20-30 Casino atomic moves (guapea, enchufla, dile que no, siete, ocho, etc.) using Claude Vision API.
- Interactive timeline of named moves — tap any move to replay that segment at adjustable speeds (0.25x, 0.5x, 1x).
- Clearly labeled "Experimental" — accuracy is unproven and the feature is positioned as a research preview, not a guarantee.

## Tech Stack
- **Frontend:** Next.js — aligns with the course's recommended stack and pairs well with Claude Code for fast iteration.
- **Styling:** Tailwind CSS — utility-first, fast, idiomatic with Next.js.
- **Auth:** Clerk — handles user accounts, sessions, and social login.
- **Storage & Database:** Supabase — Postgres for structured data (users, bookmarks, playlists, events, analysis results) and Supabase Storage buckets for uploaded videos.
- **Backend/Processing:** FastAPI (Python) — used only by the experimental analysis pipeline (video processing, pose estimation, segmentation, LLM calls). Deployed as a separate service so the rest of the app stays serverless.
- **APIs:**
  - YouTube Data API — video search and metadata for the library.
  - Claude Vision API — move classification in the experimental pipeline.
  - MediaPipe Pose — body keypoint extraction (runs in the Python backend).
  - Map provider (Mapbox or Leaflet + OpenStreetMap) — events map.
- **Deployment:**
  - Vercel for the Next.js frontend.
  - Railway or Render for the FastAPI backend (longer compute times than serverless allows).
- **MCP Servers:**
  - Supabase MCP — schema management and debugging.
  - Playwright MCP — end-to-end UI testing.

## Backlog / Stretch Goals

**Scene & events**
- Realtime weather conditions near upcoming events (so dancers can plan around rain/cold for outdoor or travel-heavy events).
- "How to get there" integrations — Google Maps directions, CTA transit routing for Chicago events, ride-share deep links.
- User-submitted event corrections and reviews ("was this social actually good?").
- Calendar export / iCal feed for saved events.

**Video library**
- Per-move tagging on bookmarked videos (link a YouTube clip to the Casino move vocabulary).
- Tutorial linking — from a detected move in the analyzer to a curated tutorial in the library.
- Shared playlists between users / following other dancers.

**Analyzer (experimental pipeline)**
- Composite figure detection (e.g. enchufla + enchufla + enchufla + dile que no = "setenta/70").
- Move variation recognition (e.g. "dile que no estándar" vs. "dile que no con giro").
- Pose skeleton overlay during playback.
- Side-by-side comparison: record yourself practicing a move and compare to the original.
- Community move corrections — users relabel misclassified moves, gradually building a labeled dataset.

**Platform**
- Additional dance styles (NY-style salsa, bachata, kizomba).
- Mobile app (React Native) for easier in-the-moment recording and on-the-go scene browsing.

## Biggest Risk
The experimental pipeline's **move classification accuracy** is still the highest-risk piece. There is no public labeled dataset of Casino salsa moves, so classification relies on a vision LLM interpreting video frames — and we don't yet know how reliably Claude (or any vision model) can distinguish a "siete" from an "ocho" or an "enchufla" from a "dile que no" in real-world party footage.

**Mitigation by design:** The platform pivot directly addresses this risk. Even if the analyzer underdelivers, the video library and scene explorer give dancers reasons to use the site. The analyzer ships as an explicitly experimental feature — useful when it works, not load-bearing when it doesn't.

Secondary risks:
- **YouTube API quota** — the Data API has a default 10k units/day quota, and search costs 100 units/call. Need caching and possibly debounced search to stay under limits.
- **Events cold-start problem** — a map with no events is dead on arrival. Mitigation: launch in one city (Chicago) with manually curated seed data.
- **Two-person pose estimation** — MediaPipe handles single-person natively; tracking two dancers who frequently touch and overlap is noisy.
- **Video quality** — party footage often has poor lighting and obstructions; the pipeline needs to degrade gracefully.

## Week 5 Goal
A deployed v1 platform whose value does **not** depend on the experimental analyzer working. The Library and Scene must be production-quality; the Lab is published as a research preview with a waitlist instead of an end-to-end demo:

- **Auth & accounts** working via Clerk; Supabase schema deployed with RLS enforced; user sync via webhook + `ensureUser()` fallback.
- **Library (live):** YouTube search proxied with 24-hour caching and quota-aware fallbacks; users can bookmark videos and organize them into named playlists; per-playlist view embeds clips via youtube-nocookie.
- **Scene (live):** Mapbox-backed Chicago map; ~12 seed events expanded across 8 weeks via SQL (~96 rows); admin-only `/admin/events` UI for creating/editing events with server-side Mapbox geocoding for new venues; public event detail pages with Chicago-localized times.
- **Lab (research preview, deferred to v2):** `/upload` rewritten as a research-preview page that explains the planned pipeline (pose extraction → move classification → timeline editor) and captures emails into a `lab_waitlist` table.

### Why the analyzer pipeline is rescheduled to v2

Earlier weeks of this project pivoted from "Casino move analyzer" to "multi-feature dancer hub." That pivot was driven by the same risk this proposal originally called out as the biggest one — **move classification accuracy is unproven**. Building the v1 launch story around a feature whose accuracy we can't yet guarantee would mean shipping a product whose perceived value collapses if the analyzer underdelivers. The v1 split keeps the Library + Scene as the load-bearing value (every dancer gets useful tools whether the analyzer is 90% accurate or 50%) and lets us iterate on the pipeline behind a waitlist gate.

Concretely, v2 work resumes from Week 6:

- **Pose extraction** with MediaPipe on a curated set of 20–30 Casino test clips with known move sequences.
- **Move classification** via Claude Vision against a small hand-labeled vocabulary; honest accuracy reporting (clean / review / beta confidence buckets).
- **Timeline UI** that exposes the labels for verification rather than presenting them as ground truth — the user can correct labels, building a labeled dataset over time.
- The FastAPI service ships only when the above demonstrate ≥70% top-1 accuracy on the test set; otherwise the waitlist stays open and we keep iterating on labeling strategy.
