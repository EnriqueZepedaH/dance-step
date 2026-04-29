# AGENTS.md

## Project Context

DanceStep is a Next.js app for Latin dancers. It recently pivoted from a single-purpose Cuban Casino move analyzer into a broader v1 platform:

- **Library:** YouTube-powered video search, bookmarks, and playlists.
- **Scene:** Mapbox-backed Chicago event explorer.
- **Lab:** Deferred research preview for the original analyzer. In v1, `/upload` becomes a waitlist page. Do not build pose tracking, video uploads, FastAPI, MediaPipe, or Claude Vision in v1.

The current app is mostly a polished static landing page plus a placeholder upload page. The v1 goal is an account-bearing deployable product with Library + Scene functional, and Lab honestly framed as "coming in v2."

Important proposal alignment: the original `PROJECT_PROPOSAL.md` Week 5 goal still mentions an end-to-end analyzer POC. Phase 6 must update the proposal so Week 5 reflects "Library + Scene live, Lab waitlist published" and explains the analyzer deferral.

## Current Baseline

- Framework: Next.js App Router.
- Current installed versions include Next 16 and React 19. Use **`proxy.ts`**, not `middleware.ts`.
- Styling is custom CSS in `app/globals.css`. Do not migrate to Tailwind unless explicitly requested.
- Existing files:
  - `app/page.jsx`
  - `app/upload/page.jsx`
  - `app/layout.jsx`
  - `app/globals.css`
  - `PROJECT_PROPOSAL.md`
  - `package.json`
  - `next.config.mjs`
- `.gitignore` should ignore `node_modules/`, `.next/`, `out/`, env files, Vercel metadata, logs, caches, and local assistant metadata.

## Locked Decisions

- Auth: Clerk.
- Database/storage: Supabase Postgres + RLS.
- Supabase auth integration: Clerk native Supabase third-party auth. No custom JWT template.
- Map: Mapbox GL JS via `react-map-gl`.
- Events: manual Chicago seed data plus admin-only `/admin/events`.
- Language: migrate current JSX files to TypeScript first; new code should be `.ts`/`.tsx`.
- Hosting: Vercel frontend only for v1.
- Edge auth file: `proxy.ts`, because this project is on Next 16.

## Implementation Rules

- Make focused commits by phase. Do not mix TypeScript migration, auth setup, schema, and feature work in one change.
- Preserve the landing page visual output when extracting shared components.
- Keep v1 scope disciplined. Do not add scrapers, comments, profiles, shared playlists, PWA/mobile, video upload, Supabase Storage, or analyzer backend work.
- Do not put DB queries in `proxy.ts`. Use it only for Clerk route gating.
- Use explicit server-side admin checks in `app/admin/layout.tsx` and admin API handlers.
- Keep service-role Supabase usage isolated in `lib/supabase/admin.ts` and narrow helpers only. Never import service-role code into client components.
- The normal browser/server Supabase clients must be RLS-bound.
- Use UTC timestamps in the database; render event times for `America/Chicago`.
- Restrict the public Mapbox token in Mapbox account settings to local/dev and Vercel domains.
- YouTube search must be cached and quota-aware. Friendly quota limit UI, never a crash.

## Phase -1: Git Baseline

Goal: establish a clean baseline commit before implementation.

Tasks:

1. Confirm the repo is initialized.
2. Confirm `.gitignore` covers generated files and env secrets.
3. Commit only the current baseline: `app/`, `public/`, configs, `package.json`, `package-lock.json`, `PROJECT_PROPOSAL.md`, `.gitignore`, and this file.
4. Do not include TypeScript migration in the baseline commit.
5. Create/push `main`, connect Vercel, and confirm the existing landing page deploys.

Verification:

- `git log --oneline` shows one baseline commit.
- Vercel deploys the existing landing page from `main`.

## Phase 0: Foundation

Goal: TypeScript, Clerk, and Supabase client shells exist. No business logic yet.

Commit A: TypeScript migration only.

- Add `tsconfig.json` with strict TypeScript and temporary `allowJs: true`.
- Install `typescript`, `@types/react`, `@types/react-dom`, `@types/node`.
- Rename:
  - `app/layout.jsx` -> `app/layout.tsx`
  - `app/page.jsx` -> `app/page.tsx`
  - `app/upload/page.jsx` -> `app/upload/page.tsx`
- Fix TypeScript errors.
- Flip `allowJs: false`.

Commit B: Clerk auth skeleton.

- Install `@clerk/nextjs`.
- Wrap root layout body in `ClerkProvider`.
- Add Clerk sign-in and sign-up pages:
  - `app/sign-in/[[...sign-in]]/page.tsx`
  - `app/sign-up/[[...sign-up]]/page.tsx`
- Add `proxy.ts` with explicit route gating:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/scene(.*)",
  "/upload",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/lab-waitlist",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
```

- Everything else, including `/library`, `/admin`, bookmark APIs, playlist APIs, and admin APIs, is implicitly protected.
- Do not query Supabase from `proxy.ts`.
- Replace the static header "Enter the Floor" button with Clerk signed-in/signed-out controls.
- Hero CTA should point signed-in users to `/library` and signed-out users to `/sign-up`.

Commit C: Supabase clients.

- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Create:
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
  - `lib/supabase/admin.ts`
- Configure Clerk native Supabase third-party auth in the Supabase dashboard.
- Server client should pass Clerk's session token through Supabase's `accessToken` callback.
- Service-role client belongs only in `lib/supabase/admin.ts`.

Required env vars:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Verification:

- `/`, `/sign-in`, `/sign-up` work.
- Signed-out `/library` redirects to sign-in.
- Signed-out `/scene` renders publicly.
- A debug server route can read Clerk auth and call Supabase with the RLS-bound server client.

## Phase 1: Schema, RLS, and User Sync

Goal: database and RLS are real, and Clerk users reliably become `users` rows.

Create `supabase/migrations/0001_init.sql` with:

- `users`
- `bookmarks`
- `playlists`
- `playlist_items`
- `venues`
- `events`
- `youtube_cache`
- `lab_waitlist`

Enable RLS on every table.

Required policy shape:

- `users`: select own row only.
- `bookmarks`: full CRUD only where `user_id = auth.jwt() ->> 'sub'`.
- `playlists`: full CRUD only where `user_id = auth.jwt() ->> 'sub'`.
- `playlist_items`: gate through owned parent playlist. It has no direct `user_id`.
- `venues` and `events`: public select, admin-only writes.
- `youtube_cache`: no public policies. Server/service-role only.
- `lab_waitlist`: anonymous insert, admin-only select.

User sync:

- Add `lib/db/users.ts`.
- Implement explicit `ensureUser()` helper, server-only.
- `ensureUser()` reads Clerk session claims and uses service-role Supabase to upsert the `users` row idempotently.
- Call `ensureUser()` from:
  - `app/api/webhooks/clerk/route.ts`
  - `app/(app)/layout.tsx`
- Do not hide this upsert inside the generic Supabase server client.

Verification:

- New signup creates a `users` row via webhook or first protected route hit.
- Anon cannot read or write another user's library data.
- Anon can insert into `lab_waitlist` but cannot select from it.
- Non-admin cannot insert/update/delete `events` or `venues`.

## Phase 2: Shared Shell and Component Extraction

Goal: reusable app chrome without changing landing-page pixels.

Extract from `app/page.tsx`:

- `components/SiteHeader.tsx`
- `components/Footer.tsx`
- `components/Button.tsx`
- `components/Eyebrow.tsx`

Keep landing-only decorative sections inline:

- hero collage
- marquee
- three-room preview cards and local constants
- manifesto
- finale sun

Add `app/(app)/layout.tsx` to wrap Library, Scene, and app pages with shared header/footer. This layout should call `ensureUser()` for protected routes. If `/scene` stays in this route group while public, make sure `ensureUser()` does not force auth for public scene browsing; split layouts if needed.

Verification:

- Landing page renders identically.
- Empty `/library` and `/scene` render shared chrome.

## Phase 3: Library MVP

Goal: authenticated users can search YouTube, bookmark videos, and organize playlists.

Files:

- `app/api/youtube/search/route.ts`
- `hooks/useDebouncedValue.ts`
- `app/(app)/library/page.tsx`
- `app/(app)/library/my/page.tsx`
- `app/(app)/library/playlists/[id]/page.tsx`
- `components/library/VideoCard.tsx`
- `components/library/PlaylistPicker.tsx`
- `app/api/bookmarks/route.ts`
- `app/api/playlists/route.ts`
- `app/api/playlists/[id]/items/route.ts`

YouTube route requirements:

- Hash `q + pageToken`.
- Use `youtube_cache` with 24h TTL via service-role client.
- On cache miss call YouTube `search.list` with `part=snippet`, `type=video`, `videoEmbeddable=true`, `maxResults=12`.
- Return minimal fields.
- On quota exceeded return `200` with `{ rateLimited: true }` and show a friendly message.

Mutation API requirements:

- Use RLS-bound server client.
- Let RLS enforce ownership.
- Signed-out access should be blocked by `proxy.ts`.

Verification:

- Search "casino dance".
- Save a result.
- Create playlist "drills".
- Add bookmark to playlist.
- Open playlist and play `youtube-nocookie.com` embed.
- Show fallback link for unembeddable videos.

## Phase 4: Scene MVP

Goal: public Chicago map with seeded events and event details.

Files:

- `supabase/seeds/events.sql`
- `app/(app)/scene/page.tsx`
- `components/scene/EventsMap.tsx`
- `app/(app)/scene/events/[id]/page.tsx`

Tasks:

- Install `mapbox-gl` and `react-map-gl`.
- Include Mapbox GL CSS.
- Seed roughly 12 Chicago event rows with manually geocoded lat/lng.
- Expand recurring events in seed data for the next 8 weeks. Do not build recurrence parsing.
- Use Mapbox style `mapbox://styles/mapbox/light-v11` initially.
- Render client-side map centered around Chicago: lng `-87.65`, lat `41.88`, zoom `11`.
- Event detail page includes title, venue, time, description, source URL, and "Open in Maps".

Verification:

- `/scene` is publicly viewable.
- Map renders at least 10 pins.
- Clicking a pin opens a popup.
- Details link routes to event page.

## Phase 5: Admin Events

Goal: admin UI for creating and editing events.

Files:

- `app/admin/layout.tsx`
- `app/admin/events/page.tsx`
- `app/admin/events/new/page.tsx`
- `app/admin/events/[id]/edit/page.tsx`
- `app/api/admin/events/route.ts`

Rules:

- Promote admin manually in SQL: `update users set role='admin' where id='user_xxx';`
- `app/admin/layout.tsx` calls `ensureUser()`, checks `role === 'admin'`, and redirects non-admins to `/`.
- Admin API handlers must re-check role and return `403` for non-admins.
- New venue creation may call Mapbox Geocoding server-side to fill `lat`/`lng`.
- Admin gating belongs in layout/handlers, not in `proxy.ts`.

Verification:

- Admin can list/create/edit/delete events.
- Normal user is redirected from `/admin/events`.
- Direct non-admin POST to `/api/admin/events` returns `403`.

## Phase 6: Lab Waitlist, Proposal Sync, and Polish

Goal: deferred Lab is deliberate and documented.

Tasks:

- Rewrite `app/upload/page.tsx` as a research-preview waitlist.
- Add `app/api/lab-waitlist/route.ts`, public insert only.
- Update landing page Lab tile copy to "Research preview — join the waitlist" and link to `/upload`.
- Repoint "Enter the Floor" CTA:
  - signed-out -> `/sign-up`
  - signed-in -> `/library`
- Update `PROJECT_PROPOSAL.md` Week 5 goal to reflect v1 reality:
  - Library + Scene live in production
  - Lab waitlist published
  - analyzer pipeline rescheduled to v2 because classification accuracy is unproven
- Run Lighthouse/manual polish pass.

Verification:

- Every landing page link resolves.
- `/upload` looks intentional, not broken.
- Waitlist submissions persist.
- Proposal matches actual v1 scope.

## End-to-End Verification

Before calling v1 done:

1. Anon can browse `/` and `/scene`; `/library` redirects to sign-in.
2. Signup works and creates a Supabase `users` row.
3. Library search/save/playlist flow works.
4. Scene map pins and event details work.
5. Admin event creation works for admin and is forbidden for non-admin.
6. Lab waitlist insert works.
7. YouTube quota failure shows a friendly message.
8. RLS audit passes for bookmarks, playlists, playlist items, events, venues, and lab waitlist.

