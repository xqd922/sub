/**
 * Cloudflare Worker bindings and environment variables.
 *
 * Bindings come from wrangler.toml; secrets come from `wrangler secret put`
 * or `.dev.vars` for local development.
 */
export interface Env {
  // ── Storage bindings ────────────────────────────────────────────
  /** KV namespace for records, shortlinks, stats and indexes. */
  LINKS_KV: KVNamespace;
  /** Static assets (built SPA). */
  ASSETS: Fetcher;

  // ── Public vars ─────────────────────────────────────────────────
  /** Canonical site URL — used as default backend for generated subscriptions. */
  SITE_URL: string;
  /** Admin login username. */
  ADMIN_USERNAME: string;

  // ── Secrets ─────────────────────────────────────────────────────
  /** Admin login password (compared in constant time). */
  ADMIN_PASSWORD?: string;
  /** Pre-shared admin token; if set, bypasses login. */
  ADMIN_TOKEN?: string;

  // ── Short-link provider tokens ──────────────────────────────────
  SINK_URL?: string;
  SINK_TOKEN?: string;
  BITLY_TOKEN?: string;
  CUTTLY_TOKEN?: string;
}

/** Hono variable map — request-scoped state attached via c.set(). */
export interface Variables {
  /** Stable request id for tracing. */
  requestId: string;
  /** Authenticated session subject (admin routes only). */
  authSubject?: string;
}

/** Hono environment generic shorthand for route modules. */
export interface AppEnv {
  Bindings: Env;
  Variables: Variables;
}
