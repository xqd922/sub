import { describe, expect, it } from 'vitest'
import type { Proxy } from '@/modules/proxy/proxy.types'
import {
  formatProxiesIfNeeded,
  shouldFormatNodeNames,
} from '@/modules/subscription/proxy-namer'
import {
  parseSubscriptionResponse,
  parseSubscriptionText,
} from '@/modules/subscription/subscription.parser'
import { encodeBase64Utf8 } from '@/shared/base64.utils'

const SS_URI = 'ss://YWVzLTEyOC1nY206cGFzcw@proxy.example.net:8388#Node%201'

describe('subscription.parser', () => {
  it('parses base64, Clash YAML, and deduplicated plain URI lists', () => {
    expect(parseSubscriptionText(encodeBase64Utf8(SS_URI))[0].name).toBe('Node 1')

    const yamlText = `proxies:\n  - name: YAML Node\n    type: ss\n    server: proxy.example.net\n    port: 8388\n    cipher: aes-128-gcm\n    password: pass\n`
    expect(parseSubscriptionText(yamlText)[0].name).toBe('YAML Node')

    const deduped = parseSubscriptionText(`${SS_URI}\n${SS_URI}`)
    expect(deduped).toHaveLength(1)
  })

  it('preserves full node names when fragments contain unencoded spaces', () => {
    const text = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#香港 BGP 01',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=iosapps.itunes.apple.com#新加坡 高速 01',
    ].join('\r\n')

    const names = parseSubscriptionText(text).map((proxy) => proxy.name)
    expect(names).toEqual(['香港 BGP 01', '新加坡 高速 01'])
  })

  it('filters info-style nodes and decodes mixed base64 subscriptions', () => {
    const withInfo = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#%E5%89%A9%E4%BD%99%E6%B5%81%E9%87%8F%EF%BC%9A656.91%20GB',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=x.com#JP 高速 01',
    ].join('\n')

    const filtered = parseSubscriptionText(withInfo)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('JP 高速 01')

    const mixed = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#JP 01',
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes2.7770006.xyz:443?type=ws&security=tls#JP 02',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=x.com#SG 01',
    ].join('\n')

    expect(parseSubscriptionText(encodeBase64Utf8(mixed))).toHaveLength(3)
  })

  it('rejects oversized subscription responses before reading the body', async () => {
    const response = new Response(SS_URI, {
      headers: { 'content-length': String(10 * 1024 * 1024 + 1) },
    })

    await expect(parseSubscriptionResponse(response)).rejects.toThrow('超过10MB限制')
  })

  it('handles conditional formatting and formatting decision helper', () => {
    const proxies: Proxy[] = [{ name: 'A', type: 'socks5', server: 'proxy.example.net', port: 1080 }]
    const copied = formatProxiesIfNeeded(proxies, false)
    expect(copied).toEqual(proxies)
    expect(copied).not.toBe(proxies)

    expect(shouldFormatNodeNames('https://gist.github.com/demo')).toBe(true)
    expect(shouldFormatNodeNames('https://gist.githubusercontent.com/user/id/raw')).toBe(false)
    expect(shouldFormatNodeNames('snell://example.net:443?psk=abc')).toBe(false)
  })
})
