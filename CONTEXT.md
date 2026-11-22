# Subscription Conversion Domain Context

This codebase implements a proxy subscription conversion platform and short-link console running on Next.js 16 (Cloudflare Pages Edge Runtime + Cloudflare KV).

## Ubiquitous Language

- **Subscription**: A proxy node source — remote subscription URL, single proxy URI, or mixed Gist node list.
- **Proxy Node (`Proxy`)**: Normalized protocol-specific proxy model (`ss`, `vmess`, `trojan`, `vless`, `hysteria2`, `socks5`, `anytls`, `snell`).
- **Codec (`ProtocolCodec`)**: Self-contained protocol implementation encapsulating URI prefixes, parser, validator, URI serializer, and Sing-box outbound builder.
- **Renderer**: Pure client configuration generator targeting Clash YAML, sing-box JSON, v2rayNG Base64, or browser HTML preview.
- **Convert Record**: Persisted KV record tracking subscription usage, status (enabled/disabled), node count, and daily hit statistics.
- **Short Link**: Compact `/s/[id]` URL resolving through KV or fallback external shorteners back to a conversion URL.

## Architecture Boundaries

- `src/shared/` — Pure client/server-safe DTO types and stateless utilities (Web-API Base64, URL helpers, formatting).
- `src/server/` — Runtime platform primitives (centralized env config, structured errors, sanitizing logger, retry HTTP client, route utilities, KV adapter).
- `src/modules/` — High-cohesion server domains (`proxy`, `renderer`, `subscription`, `record`, `short-link`, `admin-auth`) with strict one-way dependencies.
- `src/features/` — Client UI sliced by product surface (`shared`, `converter`, `admin`). Never imports from `src/server/` or `src/modules/`.
- `src/components/` — Source-owned BoardUI design system primitives only (`base`, `application`, `foundations`).
- `src/app/` — Thin Next.js App Router pages and Edge route handlers.
- `tests/` — Vitest unit tests mirroring `src/` one-to-one.
