import { maskUrl } from "./errors";

/**
 * Lightweight structured logger for the Worker runtime.
 *
 * Real severities (vs the previous "all → console.log" anti-pattern).
 * Output is JSON for Cloudflare Logs ingestion.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let minLevel: Level = "info";

export function setLogLevel(level: Level): void {
  minLevel = level;
}

interface LogFields {
  requestId?: string;
  url?: string;
  /** Free-form structured fields. */
  [key: string]: unknown;
}

function emit(level: Level, msg: string, fields: LogFields = {}): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  // Mask any URL-shaped string field automatically.
  const safe: Record<string, unknown> = { ...fields };
  if (typeof safe.url === "string") safe.url = maskUrl(safe.url);

  const entry = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...safe,
  };

  // Severity routing — Cloudflare Logs uses console.* level.
  switch (level) {
    case "debug":
      console.debug(JSON.stringify(entry));
      break;
    case "info":
      console.log(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    case "error":
      console.error(JSON.stringify(entry));
      break;
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};
