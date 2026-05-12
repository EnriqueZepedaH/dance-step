import type { SourceFetcher } from "../types.js";
import { makeGcalFetcher } from "./gcal.js";
import { makeLsdFetcher } from "./lsd.js";

// Source registry: factories keyed by event_sources.key. The
// orchestrator reads each row from event_sources, looks up the
// matching factory here, and constructs the fetcher with the URL
// from the DB. Adding a new source = add a row in event_sources +
// add a factory line here. No other code change.

export type SourceFactory = (opts: { url: string }) => SourceFetcher;

export const SOURCE_FACTORIES: Record<string, SourceFactory> = {
  gcal: makeGcalFetcher,
  lsd: makeLsdFetcher,
};
