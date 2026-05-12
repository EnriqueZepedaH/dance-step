import type { SourceFetcher } from "../types.js";

// Source registry. New sources land here as additional entries. The
// orchestrator iterates this map and matches against event_sources
// rows by key. Branch F ships the registry empty; branch P wires in
// gcal + lsd.

export const SOURCES: Record<string, SourceFetcher> = {};
