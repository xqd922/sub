# Architecture Refactor Design

Date: 2026-07-05
Status: approved for planning

## Goal

Refactor the conversion architecture without changing behavior. The work deepens four modules in sequence so each step stays testable and reversible.

## Non-goals

- No new dependencies.
- No provider order changes.
- No UI redesign.
- No class-based repository layer unless a real second implementation requires it.

## Design

### 1. Deepen config rendering

`src/convert/response.ts` becomes the config rendering module.

Its interface should accept the formatted Proxy Nodes, Subscription metadata, original proxy count, User-Agent, and airport-subscription flag. Its implementation owns client detection, body rendering, response headers, and render metadata used for logging.

`src/convert/handler.ts` should stop branching on Clash, sing-box, v2rayNG, and browser preview. It should call the rendering interface and return the rendered response.

Files:

- `src/convert/handler.ts`
- `src/convert/response.ts`
- `src/config/clash.ts`
- `src/config/singbox.ts`
- `src/preview.ts`

### 2. Deepen subscription intake

Subscription intake owns source detection and parsing for remote subscriptions, single proxy URIs, and mixed remote lists.

Its interface should return:

```ts
{
  proxies,
  subscription,
  isAirportSubscription
}
```

The implementation absorbs duplicated YAML/Base64 parsing from `convert/subscription.ts` and `parse/subscription.ts`. Nested remote subscriptions should use the same parser path where practical, so fixes gain locality.

Files:

- `src/convert/subscription.ts`
- `src/parse/subscription.ts`
- `src/parse/remote.ts`
- `src/parse/node.ts`
- `src/network/client.ts`

### 3. Shrink the KV interface

KV keeps the existing adapter seam: Cloudflare KV in production and local KV in development/tests.

The public interface should expose business operations only:

- Conversion record operations
- Short Link operations
- availability checks

Raw key helpers, index helpers, TTL details, and hash mapping stay inside the KV implementation. `src/kv/index.ts` should stop exporting raw store helpers used only internally.

Files:

- `src/kv/index.ts`
- `src/kv/env.ts`
- `src/kv/local.ts`
- `src/kv/store.ts`
- `src/kv/records.ts`
- `src/kv/short_link.ts`
- `src/kv/types.ts`

### 4. Light cleanup of short-link providers

`src/shorten/service.ts` already has a deep interface: callers use `generate(url)` and the implementation handles provider fallback.

Do not split providers into files during this pass. Only remove unused provider metadata, reuse existing network helpers when that reduces code, and keep provider behavior unchanged.

Files:

- `src/shorten/service.ts`
- `src/app/api/shorten/route.ts`

## Data flow

1. Request enters `handleRequest`.
2. Handler validates URL and disabled-record status.
3. Subscription intake returns Proxy Nodes and Subscription metadata.
4. Name formatting runs once.
5. Config rendering returns the response and render metadata.
6. Handler schedules Conversion record logging.
7. Handler returns the response.

## Error handling

Existing `AppError` and reporter behavior stays. The refactor should move code, not alter user-facing error responses. Any newly exposed intake or rendering interface should throw existing errors or ordinary errors that `handleRequest` already normalizes.

## Testing

Use the interface as the test surface.

Minimum checks:

- Existing tests continue to pass.
- Build succeeds.
- Add focused tests only where a new interface absorbs non-trivial branching.

Run after each major step:

```bash
bun run test
bun run build
```

## Implementation order

1. Config rendering
2. Subscription intake
3. KV interface shrink
4. Short-link cleanup

This order keeps the first step in-process and leaves external adapters until the main conversion path is stable.
