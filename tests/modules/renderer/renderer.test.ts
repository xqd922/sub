import { describe, expect, it } from 'vitest'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { buildClashProxyGroups, renderClashConfig } from '@/modules/renderer/clash/clash.renderer'
import { detectClientType } from '@/modules/renderer/client-detector'
import { renderPreviewHtml } from '@/modules/renderer/preview/preview.renderer'
import { buildSingboxConfig } from '@/modules/renderer/sing-box/sing-box.renderer'

const baseProxy: Proxy = {
  name: 'HK 01',
  type: 'ss',
  server: 'node.example.net',
  port: 8388,
  cipher: 'aes-128-gcm',
  password: 'secret',
}

describe('client-detector', () => {
  it('classifies sing-box, v2rayNG, browser, and Clash user agents', () => {
    expect(detectClientType('sing-box/1.14').clientType).toBe('singbox')
    expect(detectClientType('v2rayNG/1.9').clientType).toBe('v2rayng')
    expect(detectClientType('Mozilla/5.0 Chrome/120 Safari/537.36').clientType).toBe('browser')
    expect(detectClientType('clash.meta/v1.19').clientType).toBe('clash')
    expect(detectClientType('curl/8').clientType).toBe('clash')
  })
})

describe('clash.renderer', () => {
  it('creates HK group only with 3+ HK nodes and generates Min group whenever 0.0-0.3x nodes exist', () => {
    const twoHk = buildClashProxyGroups([
      { ...baseProxy, name: '🇭🇰 Hong Kong 01 [0.2x]' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 02' },
    ])
    expect(twoHk.some((g) => g.name === 'HK')).toBe(false)
    expect(twoHk.some((g) => g.name === 'Min')).toBe(true)

    const threeHk = buildClashProxyGroups([
      { ...baseProxy, name: '🇭🇰 Hong Kong 01 [0.2x]' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 02' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 03' },
    ])
    expect(threeHk.some((g) => g.name === 'HK')).toBe(true)
    expect(threeHk.find((g) => g.name === 'Manual')?.proxies).toContain('HK')
    expect(threeHk.find((g) => g.name === 'Manual')?.proxies).toContain('Min')
  })

  it('strips sing-box detour field when dumping Clash YAML', () => {
    const yamlText = renderClashConfig([{ ...baseProxy, detour: 'relay-node' }])
    expect(yamlText).toContain('proxies:')
    expect(yamlText).not.toContain('detour:')
  })
})

describe('sing-box.renderer', () => {
  it('keeps generated outbound tags unique and rejects empty configs', () => {
    const config = buildSingboxConfig([
      { ...baseProxy, name: 'Auto', server: 'auto.example.net' },
      { ...baseProxy, name: 'Duplicate', server: 'first.example.net' },
      { ...baseProxy, name: 'Duplicate', server: 'second.example.net', detour: 'Duplicate' },
    ])

    expect(config.outbounds.slice(0, 3).map((outbound) => outbound.tag)).toEqual([
      'Auto (2)',
      'Duplicate',
      'Duplicate (2)',
    ])
    expect(config.outbounds[2]).toMatchObject({ detour: 'Duplicate' })
    expect(() => buildSingboxConfig([])).toThrow('没有可用的代理节点')
  })
})

describe('preview.renderer', () => {
  it('escapes HTML tags inside rendered YAML and JSON blocks', () => {
    const html = renderPreviewHtml('<script>alert(1)</script>', '{"tag":"<b>x</b>"}')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
