import { describe, expect, it } from 'vitest'
import { parseSubscriptionText, shouldFormatNames, formatProxies } from '@/conversion/subscription'
import { parseSubscriptionResponse } from '@/conversion/parse-subscription'
import type { Proxy } from '@/protocols/model'

const ssUri = 'ss://YWVzLTEyOC1nY206cGFzcw@proxy.example.net:8388#Node%201'

describe('subscription intake helpers', () => {
  it('parses base64 subscription text once for all intake paths', () => {
    const text = Buffer.from(ssUri).toString('base64')
    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('Node 1')
  })

  it('parses Clash YAML subscription text once for all intake paths', () => {
    const text = `proxies:\n  - name: YAML Node\n    type: ss\n    server: proxy.example.net\n    port: 8388\n    cipher: aes-128-gcm\n    password: pass\n`
    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('YAML Node')
  })

  it('parses and deduplicates plain proxy URI lists', () => {
    const proxies = parseSubscriptionText(`${ssUri}\n${ssUri}`)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('Node 1')
  })

  it('preserves full node names when fragment contains unencoded spaces', () => {
    // 真实订阅里机场节点名常含未编码空格，split(/\s+/) 会截断 fragment
    const text = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#香港 BGP 01',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=iosapps.itunes.apple.com#新加坡 高速 01',
    ].join('\r\n')

    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(2)
    const names = proxies.map(p => p.name)
    expect(names).toContain('香港 BGP 01')
    expect(names).toContain('新加坡 高速 01')
  })

  it('drops info-style nodes (流量/到期提示) from subscriptions', () => {
    // 机场埋进订阅里的流量/到期/官网提示节点，应被过滤
    const text = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#%E5%89%A9%E4%BD%99%E6%B5%81%E9%87%8F%EF%BC%9A656.91%20GB',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=x.com#JP 高速 01',
    ].join('\n')

    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('JP 高速 01')
  })

  it('parses base64 subscription bodies with mixed vless/hysteria2 nodes', () => {
    const decoded = [
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes.7770006.xyz:443?type=ws&security=tls#JP 01',
      'vless://eee3c0be-4cd2-4ac8-84da-0346d0072dfb@cfyes2.7770006.xyz:443?type=ws&security=tls#JP 02',
      'hysteria2://pw@aws-linkhy9.lxyun.xyz:60000/?sni=x.com#SG 01',
    ].join('\n')
    const text = Buffer.from(decoded, 'utf-8').toString('base64')

    const proxies = parseSubscriptionText(text)

    expect(proxies).toHaveLength(3)
  })

  it('rejects oversized subscription responses before reading the body', async () => {
    const response = new Response(ssUri, {
      headers: { 'content-length': String(10 * 1024 * 1024 + 1) }
    })

    await expect(parseSubscriptionResponse(response)).rejects.toThrow('超过10MB限制')
  })

  it('returns a copy when formatting is disabled', () => {
    const proxies: Proxy[] = [{ name: 'A', type: 'socks5', server: 'proxy.example.net', port: 1080 }]
    const formatted = formatProxies(proxies, false)

    expect(formatted).toEqual(proxies)
    expect(formatted).not.toBe(proxies)
  })

  it('keeps existing formatting decision helper', () => {
    expect(shouldFormatNames('https://gist.github.com/demo')).toBe(true)
  })
})

