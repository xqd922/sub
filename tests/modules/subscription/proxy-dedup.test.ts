import { describe, expect, it } from 'vitest'
import type { Proxy, SSProxy } from '@/modules/proxy/proxy.types'
import { deduplicateProxies } from '@/modules/subscription/proxy-dedup'

function makeProxy(overrides: Partial<SSProxy> = {}): SSProxy {
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
  const opts = { verbose: false }

  it('handles empty input and single valid proxy', () => {
    expect(deduplicateProxies([], opts)).toEqual([])
    const result = deduplicateProxies([makeProxy()], opts)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('test-node')
  })

  it('filters Chinese and English info nodes unless disabled', () => {
    const valid = makeProxy({ name: 'good-node' })
    const infoNodes = [
      makeProxy({ name: '剩余流量: 50GB' }),
      makeProxy({ name: '套餐到期时间 2025-12' }),
      makeProxy({ name: '官网: example.com' }),
      makeProxy({ name: 'expire: 2025-01-01' }),
    ]

    expect(deduplicateProxies([valid, ...infoNodes], opts)).toHaveLength(1)
    expect(
      deduplicateProxies([infoNodes[0]], { ...opts, filterInfoNodes: false }),
    ).toHaveLength(1)
  })

  it('filters invalid servers, private IPs, DNS IPs, and invalid ports', () => {
    const invalidNodes = [
      makeProxy({ server: '' }),
      makeProxy({ port: 0 }),
      makeProxy({ server: 'localhost' }),
      makeProxy({ server: '127.0.0.1' }),
      makeProxy({ server: '192.168.1.1' }),
      makeProxy({ server: '10.0.0.1' }),
      makeProxy({ server: '172.16.0.1' }),
      makeProxy({ server: '8.8.8.8' }),
      makeProxy({ server: 'example.com' }),
    ]
    expect(deduplicateProxies(invalidNodes, opts)).toHaveLength(0)
  })

  it('deduplicates according to keepStrategy without mutating input alpn arrays', () => {
    const alpn = ['h2', 'http/1.1']
    const longer = makeProxy({ name: 'a-very-long-node-name', alpn })
    const shorter = makeProxy({ name: 'short', alpn: ['http/1.1', 'h2'] })

    const shorterResult = deduplicateProxies([longer, shorter], { ...opts, keepStrategy: 'shorter' })
    expect(shorterResult).toHaveLength(1)
    expect(shorterResult[0].name).toBe('short')
    expect(alpn).toEqual(['h2', 'http/1.1'])

    expect(
      deduplicateProxies([makeProxy({ name: 'first' }), makeProxy({ name: 'last' })], {
        ...opts,
        keepStrategy: 'last',
      })[0].name,
    ).toBe('last')

    expect(
      deduplicateProxies([makeProxy({ name: 'first' }), makeProxy({ name: 'second' })], {
        ...opts,
        keepStrategy: 'first',
      })[0].name,
    ).toBe('first')
  })

  it('keeps distinct proxies and skips null entries', () => {
    expect(
      deduplicateProxies(
        [makeProxy({ name: 'a', password: 'p1' }), makeProxy({ name: 'b', password: 'p2' })],
        opts,
      ),
    ).toHaveLength(2)

    expect(
      deduplicateProxies([null as unknown as Proxy, makeProxy()], opts),
    ).toHaveLength(1)
  })

  it('handles realistic mixed lists correctly', () => {
    const result = deduplicateProxies(
      [
        makeProxy({ name: 'HK-1', server: '100.1.1.1' }),
        makeProxy({ name: 'JP-1', server: '100.2.2.2', password: 'other' }),
        makeProxy({ name: 'HK-1-dup', server: '100.1.1.1' }),
        makeProxy({ name: '流量重置时间: 每月1日' }),
        makeProxy({ name: 'bad', server: '0.0.0.0' }),
      ],
      opts,
    )

    expect(result.map((proxy) => proxy.name).sort()).toEqual(['HK-1', 'JP-1'])
  })
})
