import { describe, expect, it } from 'vitest'
import { renderConversionResponse } from '@/fetch/response'
import { generateSingboxConfig as buildSingboxConfig } from '@/config/singbox'
import type { Proxy } from '@/node/types'
import type { SubscriptionInfo } from '@/fetch/subscription'

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

    const config = JSON.parse(result.body)
    expect(config.dns).not.toHaveProperty('independent_cache')
    expect(config.http_clients).toEqual([
      {
        tag: 'rule-set-download',
        detour: 'Manual'
      }
    ])
    expect(config.dns.final).toBe('remote')
    expect(config.dns.rules
      .filter((rule: { server?: string }) => rule.server)
      .every((rule: { action?: string }) => rule.action === 'route')).toBe(true)
    expect(config.dns.rules.find((rule: { server?: string }) => rule.server === 'fakeip').rewrite_ttl).toBe(60)
    expect(config.inbounds[0]).not.toHaveProperty('endpoint_independent_nat')
    expect(config.inbounds[0].tag).toBe('tun-in')
    expect(config.route.rules
      .filter((rule: { outbound?: string }) => rule.outbound)
      .every((rule: { action?: string }) => rule.action === 'route')).toBe(true)
    expect(config.route.default_http_client).toBe('rule-set-download')
    expect(config.experimental.cache_file).toEqual({
      enabled: true,
      store_fakeip: true,
      store_dns: true
    })
  })

  it('keeps generated outbound tags unique and rejects empty configs', () => {
    const config = buildSingboxConfig([
      { ...proxy, name: 'Auto', server: 'auto.example.com' },
      { ...proxy, name: 'Duplicate', server: 'first.example.com' },
      { ...proxy, name: 'Duplicate', server: 'second.example.com', detour: 'Duplicate' }
    ])

    expect(config.outbounds.slice(0, 3).map(outbound => outbound.tag)).toEqual([
      'Auto (2)',
      'Duplicate',
      'Duplicate (2)'
    ])
    expect(config.outbounds[2]).toMatchObject({ detour: 'Duplicate' })
    expect(() => buildSingboxConfig([])).toThrow('没有可用的代理节点')
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
