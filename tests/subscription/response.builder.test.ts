import { describe, expect, it } from 'vitest'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { renderConversionResponse } from '@/modules/subscription/response.builder'
import type { SubscriptionInfo } from '@/modules/subscription/subscription.types'

const proxy: Proxy = {
  name: 'HK 01',
  type: 'ss',
  server: 'node.example.net',
  port: 8388,
  cipher: 'aes-128-gcm',
  password: 'secret',
}

const subscription: SubscriptionInfo = {
  name: 'Demo',
  upload: '1',
  download: '2',
  total: '3',
  expire: '4',
  homepage: 'https://example.com',
  updateInterval: 12,
}

describe('renderConversionResponse', () => {
  it('renders sing-box 1.14 JSON for sing-box user agents', () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'sing-box/1.14',
    })

    expect(result.clientType).toBe('singbox')
    expect(result.headers['Content-Type']).toContain('application/json')

    const config = JSON.parse(result.body)
    expect(config.dns).not.toHaveProperty('independent_cache')
    expect(config.http_clients).toEqual([{ tag: 'rule-set-download', detour: 'Manual' }])
    expect(config.dns.final).toBe('remote')
    expect(
      config.dns.rules
        .filter((rule: { server?: string }) => rule.server)
        .every((rule: { action?: string }) => rule.action === 'route'),
    ).toBe(true)
    expect(
      config.dns.rules.find((rule: { server?: string }) => rule.server === 'fakeip').rewrite_ttl,
    ).toBe(60)
    expect(config.inbounds[0]).toMatchObject({
      tag: 'tun-in',
      endpoint_independent_nat: true,
    })
    expect(config.route.default_http_client).toBe('rule-set-download')
    expect(config.services).toEqual([
      {
        type: 'api',
        listen: '127.0.0.1',
        listen_port: 9090,
        secret: '',
        dashboard: { enabled: true, http_client: 'rule-set-download' },
      },
    ])
    expect(config.experimental.cache_file).toEqual({
      enabled: true,
      store_fakeip: true,
      store_dns: true,
    })
  })

  it('renders base64 subscription for v2rayNG user agents', () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'v2rayNG/1.9',
    })

    expect(result.clientType).toBe('v2rayng')
    expect(result.headers['Content-Type']).toContain('text/plain')
    expect(result.body.length).toBeGreaterThan(0)
  })

  it('renders browser preview HTML for browser user agents', () => {
    const result = renderConversionResponse({
      proxies: [proxy],
      formattedProxies: [proxy],
      subscription,
      userAgent: 'Mozilla/5.0 Chrome/120 Safari/537.36',
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
    })

    expect(result.clientType).toBe('clash')
    expect(result.body).toContain('proxies:')
    expect(result.headers['Content-Type']).toContain('text/yaml')
  })
})
