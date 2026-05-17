# Repository Guidelines

## Project Structure & Module Organization

Bun-managed TypeScript app: Vite React SPA (`src/web/`) + Hono Cloudflare Worker (`src/worker/`).

- **Web** (`src/web/`): `App.tsx`, `main.tsx`, `components/`, `hooks/`, `admin/`. Vite root is `src/web`, output to `dist/web`.
- **Worker** (`src/worker/`): entry `index.ts` → `app.ts` (Hono routes). Subdirectories: `protocols/` (parsers), `config/` (Clash/Sing-box generators), `format/` (node formatting, dedup, region), `kv/` (records, shortlinks), `auth/`, `services/convert.ts`, `shorten/`, `parse/`, `core/`, `lib/`.
- **Shared types**: `src/shared/` (aliased as `@shared/*` from web side).
- **Build output**: `dist/web` (SPA) and `dist/worker` (Worker dry-run). Do not edit `dist/`.

## Build, Test, and Development Commands

- `bun install`: install from `bun.lock`.
- `bun run dev`: Vite (5173) + Wrangler dev (8787) via `concurrently`.
- `bun run dev:web`: frontend only. Vite proxies `/sub`, `/api`, `/s` to `:8787`.
- `bun run dev:worker`: Wrangler only. Loads secrets from `.dev.vars` (gitignored).
- `bun run build`: `vite build` → `dist/web`, then `wrangler deploy --dry-run` → `dist/worker`.
- `bun run deploy`: build web + `wrangler deploy` to production.
- `bun run preview`: build + local Wrangler preview.
- `bun run lint`: ESLint (`.ts`, `.tsx`).
- `bun run typecheck`: two-pass — `tsconfig.worker.json` then `tsconfig.web.json`.
- `bun run kv:create`: create `LINKS_KV` namespace via Wrangler.

No test framework configured. Validate with `bun run lint && bun run typecheck && bun run build`.

## Architecture Notes

- **Worker framework**: Hono (`hono`), not Next.js. Routes defined in `src/worker/app.ts`.
- **Client detection**: UA-based in `services/convert.ts` — Clash (YAML), Sing-box (JSON), v2rayNG (Base64), browser (HTML preview).
- **KV binding**: `LINKS_KV` for records, shortlinks, stats. Local dev uses mock; production uses real KV from `wrangler.toml`.
- **Admin auth**: Session token (SHA-256) via `/api/admin/login`. `ADMIN_TOKEN` env bypasses login if set.
- **Short-link providers**: multi-provider fallback chain (KV → TinyURL → Sink → Cuttly → Bitly).
- **ASSETS binding**: `wrangler.toml` binds `dist/web` as `ASSETS` Fetcher; unknown paths fall through to SPA (`single-page-application` mode).

## Path Aliases

- `@web/*` → `src/web/*` (web tsconfig)
- `@shared/*` → `src/shared/*` (web tsconfig)
- `@worker/*` → `src/worker/*` (worker tsconfig)

## Coding Style & Naming Conventions

ESM modules, two-space indent, strict TypeScript (`noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`). React components `PascalCase`, hooks `use*`, backend modules by domain. ESLint enforces `prefer-const`, no `var`, `eqeqeq`, curly braces, no duplicate imports; warns on `any` and `console` (except `warn`/`error`). Underscore-prefixed vars/args are ignored for unused-var checks.

## Commit & Pull Request Guidelines

Concise imperative messages with scopes: `fix(singbox): ...`, `tweak(clash): ...`, `refactor(admin): ...`. PRs need summary, validation commands run, screenshots for UI changes. Flag any KV namespace or secret changes.

## Security & Configuration

Never commit secrets. Use `.env.example` / `.dev.vars.example` as templates. Local dev secrets go in `.dev.vars` (auto-loaded by Wrangler, gitignored). Production secrets via `wrangler secret put`. Review `wrangler.toml` carefully for routes, KV bindings, compatibility flags.

## Stale Docs Warning

`README.md` and `CLAUDE.md` describe an **old Next.js architecture** and are out of date. Trust `package.json`, `wrangler.toml`, `vite.config.ts`, and source code as the real source of truth.
