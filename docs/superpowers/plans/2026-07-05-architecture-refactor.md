# Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor conversion architecture while preserving observable behavior.

**Architecture:** Deepen config rendering first, then subscription intake, then shrink the KV public interface, then lightly clean short-link provider fallback. Each step keeps the existing function-module style and avoids new dependencies.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, React 19, Bun 1.3, Vitest.

---

## File map

- `src/convert/response.ts`: Own client detection, response body, headers, and render metadata behind `renderConversionResponse`.
- `src/convert/handler.ts`: Validate request, load Subscription, format Proxy Nodes, call renderer, schedule Conversion record logging.
- `tests/convert/response.test.ts`: Tests for the config rendering interface.
- `src/convert/subscription.ts`: Own Subscription intake and shared text parsing helpers.
- `src/parse/subscription.ts`: Delegate remote Subscription parsing to intake helpers instead of duplicating YAML/Base64 parsing.
- `src/parse/remote.ts`: Keep mixed remote list ordering while using the shared remote Subscription parser path.
- `tests/convert/subscription.test.ts`: Tests for shared Subscription text parsing and formatting guard.
- `src/kv/index.ts`: Export only business operations and adapter availability.
- `src/shorten/service.ts`: Remove unused provider metadata and use the existing timeout helper shape without changing provider order.

---

### Task 1: Baseline check

**Files:**
- Read: `docs/superpowers/specs/2026-07-05-architecture-refactor-design.md`
- Read: `CONTEXT.md`

- [ ] **Step 1: Confirm branch and status**

Run:

```bash
git branch --show-current
git status --short
```

Expected: branch is `architecture-refactor`; status is clean except the plan file before its commit.

- [ ] **Step 2: Run baseline tests**

Run:

```bash
bun run test
```

Expected: `5 passed`, `110 passed`.

- [ ] **Step 3: Commit plan**

Run:

```bash
git add docs/superpowers/plans/2026-07-05-architecture-refactor.md
git commit -m "docs: add architecture refactor plan"
```

Expected: commit succeeds.

---

### Task 2: Deepen config rendering

**Files:**
- Create: `tests/convert/response.test.ts`
- Modify: `src/convert/response.ts`
- Modify: `src/convert/handler.ts`

- [ ] **Step 1: Write failing renderer tests**

Create `tests/convert/response.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { renderConversionResponse } from '@/convert/response'
import type { Proxy } from '@/types'
import type { SubscriptionInfo } from '@/convert/subscription'

const proxy: Proxy = {
  name: 'HK 01',
  type: 'ss',
  server: 'example.com',
  port: 8388,
  cipher: 'aes-128-gcm',
  password: 'secret'
}

const subscription: SubscriptionInfo = {
  name: 'Demo',
  upload: '1',
  download: '2',
  total: '3',
  expire: '4',
  homepage: 'https://example.com',
  updateInterval: 12
}

describe('renderConversionResponse', () => {
  it('renders sing-box JSON for sing-box user agents', async () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'sing-box/1.10',
      isAirportSubscription: true
    })

    expect(result.clientType).toBe('singbox')
    expect(result.body).toContain('"outbounds"')
    expect(result.headers['Content-Type']).toContain('application/json')
  })

  it('renders browser preview HTML for browser user agents', () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'Mozilla/5.0 Chrome/120 Safari/537.36',
      isAirportSubscription: true
    })

    expect(result.clientType).toBe('browser')
    expect(result.body).toContain('<!DOCTYPE html>')
    expect(result.headers['Content-Type']).toContain('text/html')
  })

  it('renders Clash YAML by default', () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'curl/8',
      isAirportSubscription: true
    })

    expect(result.clientType).toBe('clash')
    expect(result.body).toContain('proxies:')
    expect(result.headers['Content-Type']).toContain('text/yaml')
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
bunx vitest run tests/convert/response.test.ts
```

Expected: FAIL because `renderConversionResponse` is not exported.

- [ ] **Step 3: Implement renderer interface**

In `src/convert/response.ts`, add these exports near the existing response helpers and reuse existing generator functions:

```ts
export type ClientType = 'clash' | 'singbox' | 'v2rayng' | 'browser'

export interface RenderConversionInput {
  proxies: Proxy[]
  formattedProxies: Proxy[]
  subscription: SubscriptionInfo
  userAgent: string
  isAirportSubscription: boolean
}

export interface RenderedConversionResponse {
  body: string
  headers: Record<string, string>
  clientType: ClientType
  configSize: number
}

export function renderConversionResponse(input: RenderConversionInput): RenderedConversionResponse {
  const { proxies, formattedProxies, subscription, userAgent, isAirportSubscription } = input
  const { isSingBox, isV2rayNG, isBrowser, clientType } = detectClientType(userAgent)

  if (isSingBox) {
    const body = generateSingboxConfig(formattedProxies)
    return {
      body,
      headers: generateResponseHeaders(subscription, true, false),
      clientType,
      configSize: body.length
    }
  }

  if (isV2rayNG) {
    const body = generateV2rayNGConfig(formattedProxies)
    return {
      body,
      headers: generateV2rayNGHeaders(subscription),
      clientType,
      configSize: body.length
    }
  }

  const yamlConfig = generateClashConfig(formattedProxies, isAirportSubscription)

  if (isBrowser) {
    const jsonConfig = generateSingboxConfig(formattedProxies)
    const body = generatePreviewHtml(yamlConfig, jsonConfig)
    return {
      body,
      headers: generateResponseHeaders(subscription, false, true),
      clientType,
      configSize: yamlConfig.length + jsonConfig.length
    }
  }

  return {
    body: yamlConfig,
    headers: generateResponseHeaders(subscription, false, false),
    clientType,
    configSize: yamlConfig.length
  }
}
```

Also add this helper in the same file:

```ts
function generateV2rayNGHeaders(subscription: SubscriptionInfo): Record<string, string> {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    'profile-update-interval': String(subscription.updateInterval || 24),
    'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
  }
}
```

Remove no existing exports yet.

- [ ] **Step 4: Verify GREEN for renderer tests**

Run:

```bash
bunx vitest run tests/convert/response.test.ts
```

Expected: PASS.

- [ ] **Step 5: Thin handler**

In `src/convert/handler.ts`:

- Remove the local `generateResponse` function.
- Remove imports of `Proxy`, `SubscriptionInfo`, `detectClientType`, `generateClashConfig`, `generateSingboxConfig`, `generateV2rayNGConfig`, `generatePreviewHtml`, and `generateResponseHeaders`.
- Import `renderConversionResponse` and keep `logConfigStats`.
- Replace client detection and local response generation with:

```ts
const rendered = renderConversionResponse({
  proxies,
  formattedProxies,
  subscription,
  userAgent,
  isAirportSubscription
})

logger.info('\n=== 客户端信息 ===')
logger.info(`类型: ${rendered.clientType}`)
logger.info(`User-Agent: ${userAgent}`)
logger.info('===================\n')

const response = new NextResponse(rendered.body, { headers: rendered.headers })
```

- Replace `clientType` in `logConversion` and `logConfigStats` with `rendered.clientType`.
- Replace the empty config size passed to `logConfigStats` with `rendered.body`.

- [ ] **Step 6: Verify handler still passes tests and build**

Run:

```bash
bun run test
bun run build
```

Expected: tests pass; build exits 0.

- [ ] **Step 7: Commit config rendering**

Run:

```bash
git add src/convert/response.ts src/convert/handler.ts tests/convert/response.test.ts
git commit -m "refactor: deepen config rendering"
```

Expected: commit succeeds.

---

### Task 3: Deepen subscription intake

**Files:**
- Create: `tests/convert/subscription.test.ts`
- Modify: `src/convert/subscription.ts`
- Modify: `src/parse/subscription.ts`
- Modify: `src/parse/remote.ts`

- [ ] **Step 1: Write failing shared parser tests**

Create `tests/convert/subscription.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSubscriptionText, shouldFormatNames, formatProxies } from '@/convert/subscription'
import type { Proxy } from '@/types'

const ssUri = 'ss://YWVzLTEyOC1nY206cGFzcw@example.com:8388#Node%201'

describe('subscription intake helpers', () => {
  it('parses base64 subscription text once for all intake paths', () => {
    const text = Buffer.from(ssUri).toString('base64')
    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('Node 1')
  })

  it('parses Clash YAML subscription text once for all intake paths', () => {
    const text = `proxies:\n  - name: YAML Node\n    type: ss\n    server: example.com\n    port: 8388\n    cipher: aes-128-gcm\n    password: pass\n`
    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('YAML Node')
  })

  it('returns a copy when formatting is disabled', () => {
    const proxies: Proxy[] = [{ name: 'A', type: 'socks5', server: 'example.com', port: 1080 }]
    const formatted = formatProxies(proxies, false)

    expect(formatted).toEqual(proxies)
    expect(formatted).not.toBe(proxies)
  })

  it('keeps existing formatting decision helper', () => {
    expect(shouldFormatNames('https://gist.github.com/demo')).toBe(true)
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
bunx vitest run tests/convert/subscription.test.ts
```

Expected: FAIL because `parseSubscriptionText` is not exported.

- [ ] **Step 3: Export shared text parser from intake**

In `src/convert/subscription.ts`:

- Rename private `parseSubscriptionContent` to exported `parseSubscriptionText`.
- Keep its body behavior the same.
- Update `processSubscription` to call `parseSubscriptionText(text)`.

The exported function must have this shape:

```ts
export function parseSubscriptionText(text: string): Proxy[] {
  if (text.includes('proxies:')) {
    const config = yaml.load(text) as YamlSubscription
    const proxies = config.proxies || []
    return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
  }

  try {
    const decodedText = Buffer.from(text, 'base64').toString()
    const lines = decodedText.split('\n')
    const proxies: Proxy[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const proxy = parseProxyUri(line)
        if (proxy) proxies.push(proxy)
      } catch (e) {
        logger.warn('节点解析失败:', e)
      }
    }

    return proxies
  } catch (e) {
    logger.warn('订阅内容解码失败，非有效的 Base64 或 YAML 格式:', e)
    return []
  }
}
```

- [ ] **Step 4: Delegate parse subscription text**

In `src/parse/subscription.ts`:

- Remove `yaml`, `parseProxyUri`, and `deduplicateProxies` imports.
- Import `parseSubscriptionText` from `@/convert/subscription`.
- Replace the text format branch with:

```ts
return parseSubscriptionText(text)
```

Keep size checks and failure logging in `parseSubscription`.

- [ ] **Step 5: Verify shared parser tests**

Run:

```bash
bunx vitest run tests/convert/subscription.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify all tests and build**

Run:

```bash
bun run test
bun run build
```

Expected: tests pass; build exits 0.

- [ ] **Step 7: Commit subscription intake**

Run:

```bash
git add src/convert/subscription.ts src/parse/subscription.ts tests/convert/subscription.test.ts
git commit -m "refactor: share subscription intake parser"
```

Expected: commit succeeds.

---

### Task 4: Shrink KV public interface

**Files:**
- Modify: `src/kv/index.ts`

- [ ] **Step 1: Check raw KV exports are unused outside KV**

Run:

```bash
rg "@/kv.*(saveRecord|deleteRecordById|getIndex|updateIndex|addToIndex|removeFromIndex|getAllRecords|getDailyStats|incrementDailyHits|getKV|getLocalKV|KVStoreAdapter)" src tests
```

Expected: no output.

- [ ] **Step 2: Shrink barrel exports**

Replace `src/kv/index.ts` with:

```ts
export type { ConvertRecord, ShortLink, StatsData } from '@/kv/types'
export { isAvailable } from '@/kv/store'
export { generateRecordId, logConversion, getRecords, getRecord, updateRecord, deleteRecord, isUrlEnabled, getStats } from '@/kv/records'
export { createShortLink, resolveShortLink, getAllShortLinks, updateShortLink, deleteShortLink, isAvailable as isShortLinkAvailable } from '@/kv/short_link'
```

- [ ] **Step 3: Verify all tests and build**

Run:

```bash
bun run test
bun run build
```

Expected: tests pass; build exits 0.

- [ ] **Step 4: Commit KV interface shrink**

Run:

```bash
git add src/kv/index.ts
git commit -m "refactor: shrink kv public interface"
```

Expected: commit succeeds.

---

### Task 5: Light cleanup of short-link providers

**Files:**
- Modify: `src/shorten/service.ts`

- [ ] **Step 1: Confirm provider metadata is unused**

Run:

```bash
rg "provider\.(timeout|retries)|timeout:|retries:" src/shorten/service.ts
```

Expected: only interface and object literal metadata appear; no runtime use of `provider.timeout` or `provider.retries`.

- [ ] **Step 2: Remove unused metadata**

In `src/shorten/service.ts`:

- Change `ShortProvider` to:

```ts
interface ShortProvider {
  name: string
  handler: (url: string) => Promise<ShortResult>
}
```

- Remove `timeout` and `retries` properties from every entry in `PROVIDERS`.

Provider order remains:

```ts
const SERVICE_ORDER = ['kv', 'tinyurl', 'sink', 'bitly', 'cuttly'] as const
```

- [ ] **Step 3: Verify all tests and build**

Run:

```bash
bun run test
bun run build
```

Expected: tests pass; build exits 0.

- [ ] **Step 4: Commit short-link cleanup**

Run:

```bash
git add src/shorten/service.ts
git commit -m "refactor: trim short link provider metadata"
```

Expected: commit succeeds.

---

### Task 6: Final verification

**Files:**
- Read: `docs/superpowers/specs/2026-07-05-architecture-refactor-design.md`

- [ ] **Step 1: Run final tests**

Run:

```bash
bun run test
```

Expected: all tests pass.

- [ ] **Step 2: Run final build**

Run:

```bash
bun run build
```

Expected: build exits 0.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: status clean; latest commits are the plan and four refactor commits.
