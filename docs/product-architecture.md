# Product Architecture

## Management View

SubOps is structured around four operating concerns:

- Acquisition: `/sub` accepts subscription URLs, single-node links, and remote node sources.
- Conversion: `src/application/conversion` coordinates parsing, formatting, config generation, and response headers.
- Retention: `src/infrastructure/storage/kv` records conversions and short links for admin visibility.
- Operations: `/admin` gives operators usage, diagnostics, short-link management, and record controls.

## User View

The public flow is intentionally small:

1. Paste a subscription or node URL.
2. Generate a stable converted subscription URL.
3. Copy it directly or generate a managed short link.
4. Use client User-Agent detection to receive Clash YAML, Sing-box JSON, v2rayNG Base64, or an HTML preview.

## Code Ownership

- `app/`: Next.js route entrypoints only.
- `src/domain/`: protocol, proxy, region, parsing, deduplication, and naming rules.
- `src/application/`: use cases that orchestrate domain and infrastructure modules.
- `src/infrastructure/`: auth, Cloudflare KV, network, logging, and error reporting.
- `src/presentation/`: generated config formats and preview rendering assets.
- `src/ui/`: public workspace, admin console, shared visual components.

## Deployment Target

Cloudflare Workers with OpenNext is the primary target. Build with `bun run cf:build`, then deploy with `bun run deploy:cf`. Bind a KV namespace named `LINKS_KV` and configure `ADMIN_PASSWORD` before production use.
