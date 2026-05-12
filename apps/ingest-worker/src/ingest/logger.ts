import type { LogLevel } from "./types.js";

// JSON-line logger. One line per event so Railway's log drain (or
// any downstream Logflare/Grafana integration) can parse without
// regex. Fields are flat — no nested objects in the hot path — so
// queries against the log stream stay cheap.

export type LogFields = Record<string, unknown>;

export function makeLogger(base: LogFields) {
  return function log(level: LogLevel, msg: string, fields: LogFields = {}) {
    const line = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...base,
      ...fields,
    };
    const out = JSON.stringify(line);
    if (level === "error" || level === "warn") {
      // Surface to stderr so Railway's UI flags it visually.
      console.error(out);
    } else {
      console.log(out);
    }
  };
}

export type Logger = ReturnType<typeof makeLogger>;
