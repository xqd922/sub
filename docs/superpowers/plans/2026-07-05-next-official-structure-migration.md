# Next Official Structure Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `sub-next/` as a fresh Next.js latest app and migrate the current app into the official `src/app` project structure.

**Architecture:** Use `create-next-app` as the base, keep Next special files in `src/app`, move page-only files into private `_components` and `_hooks`, and keep business modules under `src/*`. Do not move generated files, dependencies, agent skill folders, or untracked data files.

**Tech Stack:** Next.js latest, React latest, React DOM latest, TypeScript, Tailwind CSS, Bun, Vitest.

---

### Task 1: Scaffold

- [ ] Verify `sub-next/` does not exist.
- [ ] Run `bun create next-app@latest sub-next --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun --disable-git --yes`.
- [ ] Run `bun add next@latest react@latest react-dom@latest` inside `sub-next/`.

### Task 2: Migrate files

- [ ] Copy current `src/` into `sub-next/src/`.
- [ ] Move `sub-next/src/app/(user)/page.tsx` to `sub-next/src/app/page.tsx`.
- [ ] Move `sub-next/src/app/(user)/home.tsx` to `sub-next/src/app/_components/home.tsx`.
- [ ] Move `sub-next/src/app/(user)/use_convert.ts` and `use_short_link.ts` to `sub-next/src/app/_hooks/`.
- [ ] Remove the empty `sub-next/src/app/(user)/` route group.
- [ ] Move shared page-only UI/hook files used only by the page into `src/app/_components` and `src/app/_hooks` only if imports show they are not shared elsewhere.
- [ ] Copy `tests/`, `vitest.config.ts`, `next.config.ts`, `postcss.config.mjs`, `CLAUDE.md`, `CONTEXT.md`, and `LICENSE`.
- [ ] Do not copy `.next`, `node_modules`, `tsconfig.tsbuildinfo`, `.claude`, `.agents`, `docs/superpowers`, `skills-lock.json`, or untracked yaml/txt data files.

### Task 3: Fix imports and dependencies

- [ ] Update imports from `@/app/(user)/...` or old component/hook paths to `@/app/_components/...` and `@/app/_hooks/...`.
- [ ] Merge package scripts and dependencies required by current app: `js-yaml`, `country-emoji`, `vitest`, `@types/js-yaml`, `@cloudflare/next-on-pages`, `@cloudflare/workers-types`, `wrangler`.
- [ ] Keep Next/React/React DOM at latest.

### Task 4: Verify

- [ ] Run `bun run test` in `sub-next/`.
- [ ] Run `bun run build` in `sub-next/`.
- [ ] Report final tree and any warnings.
