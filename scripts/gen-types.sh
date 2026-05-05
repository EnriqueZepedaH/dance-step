#!/usr/bin/env bash
# Regenerates apps/web/lib/db/types.ts from the live Supabase schema.
# Run after every migration; commit the diff alongside the SQL.
#
# Resolves the project ref in this order:
#   1. $SUPABASE_PROJECT_REF (e.g., set in CI)
#   2. Parsed from $NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local
#
# Inside Claude Code, prefer the Supabase MCP tool
# (mcp__supabase__generate_typescript_types) — it skips the npx download
# and writes the same content. This script exists for non-MCP contexts
# (CI, other contributors).

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_PROJECT_REF:-}" ] && [ -f apps/web/.env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . apps/web/.env.local
  set +a
  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    SUPABASE_PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https?://([^.]+)\..*|\1|')
  fi
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "error: SUPABASE_PROJECT_REF not set, and could not parse it from NEXT_PUBLIC_SUPABASE_URL" >&2
  echo "       set SUPABASE_PROJECT_REF or populate apps/web/.env.local" >&2
  exit 1
fi

mkdir -p apps/web/lib/db
npx -y supabase@latest gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  > apps/web/lib/db/types.ts

echo "wrote apps/web/lib/db/types.ts (project: $SUPABASE_PROJECT_REF)"
