import { describe, expect, it } from 'vitest'
import { renderConversionResponse } from '@/fetch/response'
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
