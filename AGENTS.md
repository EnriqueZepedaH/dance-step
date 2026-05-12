# AGENTS.md

## Repository Layout

This repository is a **monorepo**. The Next.js frontend lives at **`apps/web/`**. Future services (e.g., the deferred Lab pipeline) will land in sibling `apps/*` directories.

When file paths appear in this document or in the v1 plan (`~/.claude/plans/purrfect-doodling-pearl.md`) — `app/...`, `lib/...`, `components/...`, `proxy.ts`, `package.json`, `tsconfig.json`, `next.config.mjs`, `.env.local`, `supabase/...` — read them as **relative to `apps/web/`**, not to the repo root. Root-level files are: `AGENTS.md`, `PROJECT_PROPOSAL.md`, `.gitignore`.

Run `npm` commands (`install`, `run dev`, `run build`, `run lint`) from `apps/web/`. The `.env.local` file lives at `apps/web/.env.local`.

## Repo Structure — Deferred Until Triggered

The following monorepo conventions are **intentionally not adopted in v1**. Each one is real engineering value once a second consumer exists, but for a single-app repo they pay configuration tax (build/types/lint/paths) for benefits that don't activate yet. Pull each one forward only when its trigger fires; do not adopt preemptively.

| Deferred | Adopt when (trigger) | Notes |
|---|---|---|
| **`packages/ui`** (extract design system) | A second app needs to render DanceStep components. | Today: one consumer (`apps/web`). Components live in `apps/web/components/`. Move to a workspace package only when the import graph crosses an app boundary. |
| **`packages/db`** (Database type + query helpers) | A non-Next consumer needs DB access — e.g., a worker, an edge function outside Next, or `apps/mobile`. | Today: `apps/web/lib/db/types.ts` is the single source. Moving the file is mechanical when the trigger fires. |
| **`packages/utils`** (shared helpers) | At least 2 packages would import the same helper. | Today: zero shared utils. `useDebouncedValue` will land in `apps/web/hooks/`. The first true cross-package helper triggers extraction. |
| **`packages/tsconfig`** (base TS config) | A second package needs to extend the same `tsconfig.json`. | One consumer = the file IS the shared config. Extraction adds indirection for nothing. |
| **`packages/eslint-config`** (shared lint rules) | A second package needs the same rule set. | Same logic. Next 16's default `eslint.config.mjs` lives in `apps/web/`. |
| **Turborepo + remote caching** | Cold `next build` exceeds ~30s, OR a second app/package lands in the workspace graph. | Designed for multi-app graphs. For 1 app, plain `npm run` is fast and adds no config. Adopting Turbo prematurely means `turbo.json`, filter syntax, and a remote-cache provider for no measurable speedup. |
| **Local Supabase containers in `npm run dev`** | Offline development becomes a real pain point, OR a parallel test database is needed for CI. | We use hosted Supabase with Clerk's third-party auth (JWKS hosted by Clerk). Local containers mean duplicating env, maintaining a parallel schema, and fighting Clerk JWKS locally. Net cost > benefit until the trigger fires. |
| **Migration dry-run in CI** | We move off hosted Supabase or want preview-branch DBs per PR. | CI today validates code (typecheck + lint + build). Schema correctness is validated via Supabase MCP `apply_migration` against the hosted project. |

**What we *did* adopt in v1 (Tier 1 — done or pending):** root npm workspaces with delegated scripts, zod-validated env at module load (`apps/web/lib/env.ts`), `db:types` script wrapping the typegen call, `apps/web/.env.example`, GitHub Actions running typecheck + lint + build on PR.

**Rule of thumb:** if you find yourself proposing one of the deferred items, point at the trigger row first. If the trigger hasn't fired, don't adopt — write a one-paragraph note in the relevant phase doc explaining what would have triggered it, and move on.

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
- Existing files (under `apps/web/` unless noted):
  - `app/page.tsx`
  - `app/upload/page.tsx`
  - `app/layout.tsx`
  - `app/globals.css`
  - `package.json`
  - `next.config.mjs`
  - `tsconfig.json`
  - `PROJECT_PROPOSAL.md` (repo root)
  - `AGENTS.md` (repo root)
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
- Keep v1 scope disciplined. The ingest-worker MAY scrape public event sources (e.g. WordPress event pages) when no structured surface exists, per the Scene ingestion plan; *otherwise* do not add scrapers, comments, profiles, shared playlists, PWA/mobile, video upload, Supabase Storage, or analyzer backend work.
- Do not put DB queries in `proxy.ts`. Use it only for Clerk route gating.
- Use explicit server-side admin checks in `app/admin/layout.tsx` and admin API handlers.
- Keep service-role Supabase usage isolated in `lib/supabase/admin.ts` and narrow helpers only. Never import service-role code into client components.
- The normal browser/server Supabase clients must be RLS-bound.
- Use UTC timestamps in the database; render event times for `America/Chicago`.
- Restrict the public Mapbox token in Mapbox account settings to local/dev and Vercel domains.
- YouTube search must be cached and quota-aware. Friendly quota limit UI, never a crash.

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

