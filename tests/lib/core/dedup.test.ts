import { describe, it, expect } from 'vitest'
import { deduplicateProxies } from '@/lib/core/dedup'
import type { Proxy } from '@/lib/core/types'

/** Helper to build a minimal valid SS proxy */
function makeProxy(overrides: Partial<Proxy> = {}): Proxy {
  return {
    type: 'ss',
    name: 'test-node',
    server: '1.2.3.4',
    port: 443,
    cipher: 'aes-256-gcm',
    password: 'pass',
    ...overrides,
  }
}

describe('deduplicateProxies', () => {
  // Suppress verbose logging in tests
  const opts = { verbose: false }

  it('returns an empty array for empty input', () => {
    expect(deduplicateProxies([], opts)).toEqual([])
  })

  it('passes through a single valid proxy unchanged', () => {
    const proxy = makeProxy()
    const result = deduplicateProxies([proxy], opts)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('test-node')
  })

  // --- Info node filtering ---

  it('filters info nodes containing Chinese keywords', () => {
    const valid = makeProxy({ name: 'good-node' })
    const info1 = makeProxy({ name: '剩余流量: 50GB' })
    const info2 = makeProxy({ name: '套餐到期时间 2025-12' })
    const info3 = makeProxy({ name: '官网: example.com' })

    const result = deduplicateProxies([valid, info1, info2, info3], opts)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('good-node')
  })

  it('filters info nodes with English keywords', () => {
    const valid = makeProxy({ name: 'node-us' })
    const info = makeProxy({ name: 'expire: 2025-01-01' })

    const result = deduplicateProxies([valid, info], opts)
    expect(result).toHaveLength(1)
  })

  it('keeps info nodes when filterInfoNodes is false', () => {
    const info = makeProxy({ name: '剩余流量: 10GB' })
    const result = deduplicateProxies([info], { ...opts, filterInfoNodes: false })
    expect(result).toHaveLength(1)
  })

  // --- Invalid node filtering ---

  it('filters nodes with empty server', () => {
    const invalid = makeProxy({ server: '' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters nodes with port 0', () => {
    const invalid = makeProxy({ port: 0 })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters localhost nodes', () => {
    const invalid = makeProxy({ server: 'localhost' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters 127.0.0.1 nodes', () => {
    const invalid = makeProxy({ server: '127.0.0.1' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters private IP 192.168.x.x nodes', () => {
    const invalid = makeProxy({ server: '192.168.1.1' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters private IP 10.x.x.x nodes', () => {
    const invalid = makeProxy({ server: '10.0.0.1' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters private IP 172.16.x.x nodes', () => {
    const invalid = makeProxy({ server: '172.16.0.1' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters DNS server IPs', () => {
    const invalid = makeProxy({ server: '8.8.8.8' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  it('filters example. domains', () => {
    const invalid = makeProxy({ server: 'example.com' })
    const result = deduplicateProxies([invalid], opts)
    expect(result).toHaveLength(0)
  })

  // --- Duplicate handling ---

  it('removes exact duplicates', () => {
    const a = makeProxy({ name: 'node-a' })
    const b = makeProxy({ name: 'node-b' }) // same server/port/type/cipher/password

    const result = deduplicateProxies([a, b], opts)
    expect(result).toHaveLength(1)
  })

  it('keeps shorter name when keepStrategy is "shorter" (default)', () => {
    const longer = makeProxy({ name: 'a-very-long-node-name' })
    const shorter = makeProxy({ name: 'short' })

    const result = deduplicateProxies([longer, shorter], { ...opts, keepStrategy: 'shorter' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('short')
  })

  it('keeps the last duplicate when keepStrategy is "last"', () => {
    const first = makeProxy({ name: 'first' })
    const last = makeProxy({ name: 'last' })

    const result = deduplicateProxies([first, last], { ...opts, keepStrategy: 'last' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('last')
  })

  it('keeps the first duplicate when keepStrategy is "first"', () => {
    const first = makeProxy({ name: 'first' })
    const second = makeProxy({ name: 'second' })

    const result = deduplicateProxies([first, second], { ...opts, keepStrategy: 'first' })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('first')
  })

  it('does not deduplicate proxies with different passwords', () => {
    const a = makeProxy({ name: 'a', password: 'pass1' })
    const b = makeProxy({ name: 'b', password: 'pass2' })

    const result = deduplicateProxies([a, b], opts)
    expect(result).toHaveLength(2)
  })

  it('does not deduplicate proxies with different servers', () => {
    const a = makeProxy({ name: 'a', server: '1.2.3.4' })
    const b = makeProxy({ name: 'b', server: '5.6.7.8' })

    const result = deduplicateProxies([a, b], opts)
    expect(result).toHaveLength(2)
  })

  // --- Null / falsy handling ---

  it('skips null entries in the input array', () => {
    const valid = makeProxy()
    // Use type assertion to test runtime guard against null entries
    const result = deduplicateProxies([null as unknown as Proxy, valid], opts)
    expect(result).toHaveLength(1)
  })

  // --- Mixed scenario ---

  it('handles a realistic mixed list correctly', () => {
    const validA = makeProxy({ name: 'HK-1', server: '100.1.1.1' })
    const validB = makeProxy({ name: 'JP-1', server: '100.2.2.2', password: 'other' })
    const dupA = makeProxy({ name: 'HK-1-dup', server: '100.1.1.1' })
    const infoNode = makeProxy({ name: '流量重置时间: 每月1日' })
    const invalidNode = makeProxy({ name: 'bad', server: '0.0.0.0' })

    const result = deduplicateProxies(
      [validA, validB, dupA, infoNode, invalidNode],
      opts
    )
    expect(result).toHaveLength(2)
    const names = result.map(r => r.name).sort()
    expect(names).toEqual(['HK-1', 'JP-1'])
  })
})
