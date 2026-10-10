# Subscription Conversion

This context names the subscription conversion domain: it accepts proxy subscription inputs and emits client-ready configuration outputs.

## Language

**Subscription**:
A source of proxy nodes. It can be a remote subscription URL, a single proxy URI, or a mixed remote list.
_Avoid_: feed, source link

**Proxy Node**:
One usable proxy endpoint with protocol-specific connection data.
_Avoid_: server, item

**Conversion**:
The act of turning a Subscription into a client-ready configuration response.
_Avoid_: processing, transform job

**Client Configuration**:
The rendered output consumed by Clash, sing-box, v2rayNG-compatible clients, or the browser preview.
_Avoid_: config blob, generated file

**Short Link**:
A stable compact URL that resolves back to a Subscription or Conversion URL.
_Avoid_: alias, redirect record

## Directory map (post-refactor)

The codebase is grouped by responsibility under `src/`:

- `protocols/`        — One file per proxy protocol parser + shared `types.ts` + the `index.ts` barrel (`parseProxyUri` / `proxyToUri` / `proxyToSingboxOutbound` / etc).
- `templates/`        — Client configuration generators: `clash.ts`, `sing-box.ts`, `preview.ts`, plus `types.ts`.
- `conversion/`       — The pipeline that turns a Subscription into proxies, formats them, and renders the client response:
  - `subscription.ts`      — main entry, picks Gist/single-node/regular-subscription flows
  - `parse-subscription.ts`— low-level parsing helpers
  - `remote-nodes.ts`      — Gist remote-node handling
  - `proxy-format.ts`, `proxy-dedup.ts`, `region.ts` — proxy presentation/identity helpers
  - `response.ts`, `handler.ts` — outgoing response assembly + /sub HTTP handler
- `links/`            — `service.ts` multi-provider short-link generation.
- `auth/`             — `password.ts`, `session.ts`, `guard.ts`, `login-log.ts`; admin session cookie helpers.
- `infra/`            — Everything below the business domain:
  - `logger.ts`, `error.ts`, `error-reporter.ts`
  - `network.ts` (fetchWithRetry, UA rotation)
  - `utils.ts`, `client.ts` (client-type detection), `url-rules.ts`
  - `kv/` — `adapter.ts` (LocalKV/RemoteKV), `store.ts` (env-aware factory), `operations.ts`, `records.ts`, `short_link.ts`, `maintenance.ts`, `types.ts`, `index.ts` (barrel).
- `components/`       — All React UI components and their hooks (these are client code; nothing in here should reach into `infra/*` or below).

Cross-cutting rules:
- `infra` is the bottom layer; nothing above imports *lower* than `infra` except `app`.
- `protocols` never touches `infra` except `logger`.
- `templates` depends only on `protocols` and `lib`-style helpers.
- `conversion` orchestrates `protocols` + `templates` + `infra` — it owns the /sub pipeline.
- `links` is the short-link domain (KV-backed).
- `components/*` are React/Tailwind UI pieces. Hooks live alongside components, not in a separate `hooks/`.
