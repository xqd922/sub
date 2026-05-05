import type { Env } from "../env";

/**
 * Cloudflare context helpers.
 *
 * Single source of truth for Worker primitives — replaces three near-duplicate
 * `getKV()` / `getExecutionContext()` implementations.
 *
 * In a Worker, both are passed to the fetch handler directly, so we just
 * thread them via Hono's context. No magic globals.
 */

/**
 * Convenience type — Hono's ExecutionContext shim. We keep this loose because
 * Hono types it as `unknown` in some versions but the runtime contract is stable.
 */
export interface ExecCtx {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Schedule a promise to outlive the request without blocking the response. */
export function fireAndForget(ctx: ExecCtx | undefined, promise: Promise<unknown>): void {
  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    // No execution context (e.g. in tests) — let it run free.
    promise.catch(() => void 0);
  }
}

/** Type-narrowing helper for KV value reads. */
export async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  return env.LINKS_KV.get<T>(key, "json");
}

/** Type-narrowing helper for KV value writes. */
export function kvPutJson(
  env: Env,
  key: string,
  value: unknown,
  options?: KVNamespacePutOptions,
): Promise<void> {
  return env.LINKS_KV.put(key, JSON.stringify(value), options);
}
