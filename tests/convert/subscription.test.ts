import { describe, expect, it } from 'vitest'
import { parseSubscriptionText, shouldFormatNames, formatProxies } from '@/fetch/subscription'
import { parseSubscriptionResponse } from '@/fetch/parse_subscription'
import type { Proxy } from '@/node/types'

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

