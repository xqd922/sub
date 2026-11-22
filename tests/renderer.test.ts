import { describe, expect, it } from 'vitest'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { buildClashProxyGroups, renderClashConfig } from '@/modules/renderer/clash.renderer'
import {
  detectClientType,
  parseShortLinkPathSegment,
  parseTargetOverride,
} from '@/modules/renderer/client-detector'
import { renderPreviewHtml } from '@/modules/renderer/preview.renderer'
import { buildSingboxConfig } from '@/modules/renderer/sing-box.renderer'

const baseProxy: Proxy = {
  name: 'HK 01',
  type: 'ss',
  server: 'node.example.net',
  port: 8388,
  cipher: 'aes-128-gcm',
  password: 'secret',
}

describe('client-detector', () => {
  it('classifies sing-box, Clash/Mihomo, Base64/V2Ray clients and target overrides accurately', () => {
    // sing-box 家族
    expect(detectClientType('sing-box/1.14').clientType).toBe('singbox')
    expect(detectClientType('SFI/1.12.0').clientType).toBe('singbox')
    expect(detectClientType('SFA/1.11.4').clientType).toBe('singbox')
    expect(detectClientType('HiddifyNext/2.0.5 (Linux; Android)').clientType).toBe('singbox')
    expect(detectClientType('GUI.for.SingBox/1.9').clientType).toBe('singbox')

    // Clash / Mihomo 家族
    expect(detectClientType('clash.meta/v1.19').clientType).toBe('clash')
    expect(detectClientType('clash-verge-rev/2.2.3').clientType).toBe('clash')
    expect(detectClientType('Mihomo/1.18 Mozilla/5.0').clientType).toBe('clash')
    expect(detectClientType('Stash/2.5 Mozilla/5.0').clientType).toBe('clash')
    expect(detectClientType('FlClash/0.8 Mozilla/5.0').clientType).toBe('clash')
    expect(detectClientType('Sparkle/1.5.0').clientType).toBe('clash')
    expect(detectClientType('ClashMi/1.0.2').clientType).toBe('clash')
    expect(detectClientType('Karing/1.1.0').clientType).toBe('clash')
    expect(detectClientType('GUI.for.Clash/1.9').clientType).toBe('clash')
    expect(detectClientType('curl/8').clientType).toBe('clash')

    // Base64 / V2Ray / 多核壳家族
    expect(detectClientType('v2rayNG/1.9').clientType).toBe('v2rayng')
    expect(detectClientType('v2rayN/7.0').clientType).toBe('v2rayng')
    expect(detectClientType('NekoBoxForAndroid/1.3.0').clientType).toBe('v2rayng')
    expect(detectClientType('Throne/1.0.2').clientType).toBe('v2rayng')
    expect(detectClientType('Exclave/0.14').clientType).toBe('v2rayng')
    expect(detectClientType('Shadowrocket/2200').clientType).toBe('v2rayng')
    expect(detectClientType('Happ/2.1.0').clientType).toBe('v2rayng')
    expect(detectClientType('Streisand/1.6').clientType).toBe('v2rayng')
    expect(detectClientType('V2Box/5.0').clientType).toBe('v2rayng')

    // 显式参数覆盖
    expect(parseTargetOverride('sing-box')).toBe('singbox')
    expect(parseTargetOverride('preview')).toBe('browser')
    expect(parseTargetOverride('v2ray')).toBe('v2rayng')
    expect(parseTargetOverride('auto')).toBeNull()

    expect(detectClientType('Mozilla/5.0 Chrome/120', 'clash').clientType).toBe('clash')
    expect(detectClientType('clash.meta/v1.19', 'singbox').clientType).toBe('singbox')
  })

  it('distinguishes real browsers from spoofed Mozilla/5.0 proxy clients via Accept and Sec-Fetch headers', () => {
    // 无头信息时兼容旧行为
    expect(detectClientType('Mozilla/5.0 Chrome/120 Safari/537.36').clientType).toBe('browser')

    // 真实浏览器：带 text/html 或 Sec-Fetch-Dest: document
    expect(
      detectClientType('Mozilla/5.0 Chrome/120 Safari/537.36', null, {
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        secFetchDest: 'document',
        secFetchMode: 'navigate',
      }).clientType,
    ).toBe('browser')

    // 伪装 Mozilla/5.0 但发 Accept: */* 的代理客户端：不再误返 HTML 预览
    expect(
      detectClientType('Mozilla/5.0 Chrome/120 Safari/537.36', null, {
        accept: '*/*',
      }).clientType,
    ).toBe('clash')

    // 已知代理客户端即使带 Accept: text/html 也优先按对应内核输出
    expect(
      detectClientType('HiddifyNext/2.0.5', null, {
        accept: 'text/html,*/*',
      }).clientType,
    ).toBe('singbox')

    // Safari 不能误触发 SFA
    expect(
      detectClientType('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15', null, {
        accept: 'text/html',
      }).clientType,
    ).toBe('browser')
  })

  it('applies custom KV UA rules above built-in rules and parses short-link format suffixes', () => {
    const customRules = [
      { keyword: 'MyCustomBox', target: 'singbox' as const },
      { keyword: 'Karing', target: 'singbox' as const },
    ]

    expect(detectClientType('MyCustomBox/0.1', null, undefined, customRules).clientType).toBe(
      'singbox',
    )
    // 自定义规则可以覆写内置规则
    expect(detectClientType('Karing/1.2', null, undefined, customRules).clientType).toBe('singbox')
    // 显式 ?target= 依然高于自定义 UA 规则
    expect(detectClientType('MyCustomBox/0.1', 'clash', undefined, customRules).clientType).toBe(
      'clash',
    )

    expect(parseShortLinkPathSegment('hk-main.yaml')).toEqual({
      id: 'hk-main',
      suffixTarget: 'clash',
    })
    expect(parseShortLinkPathSegment('hk-main.json')).toEqual({
      id: 'hk-main',
      suffixTarget: 'singbox',
    })
    expect(parseShortLinkPathSegment('hk-main.txt')).toEqual({
      id: 'hk-main',
      suffixTarget: 'v2rayng',
    })
    expect(parseShortLinkPathSegment('hk-main')).toEqual({
      id: 'hk-main',
      suffixTarget: null,
    })
  })
})

describe('clash.renderer', () => {
  it('creates HK group only with 3+ HK nodes and adds Min to Manual independently of HK count', () => {
    const twoHk = buildClashProxyGroups([
      { ...baseProxy, name: '🇭🇰 Hong Kong 01 [0.2x]' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 02' },
    ])
    expect(twoHk.some((g) => g.name === 'HK')).toBe(false)
    expect(twoHk.some((g) => g.name === 'Min')).toBe(true)
    expect(twoHk.find((g) => g.name === 'Manual')?.proxies).toContain('Min')
    expect(twoHk.find((g) => g.name === 'Manual')?.proxies).not.toContain('HK')

    const threeHk = buildClashProxyGroups([
      { ...baseProxy, name: '🇭🇰 Hong Kong 01 [0.2x]' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 02' },
      { ...baseProxy, name: '🇭🇰 Hong Kong 03' },
    ])
    expect(threeHk.some((g) => g.name === 'HK')).toBe(true)
    expect(threeHk.find((g) => g.name === 'Manual')?.proxies).toContain('HK')
    expect(threeHk.find((g) => g.name === 'Manual')?.proxies).toContain('Min')
  })

  it('strips sing-box detour field and normalizes socks type when dumping Clash YAML', () => {
    const yamlText = renderClashConfig([
      { ...baseProxy, detour: 'relay-node' },
      { name: 'Socks', type: 'socks' as 'socks5', server: '1.2.3.4', port: 1080 },
    ])
    expect(yamlText).toContain('proxies:')
    expect(yamlText).not.toContain('detour:')
    expect(yamlText).toContain('type: socks5')
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
  it('escapes HTML tags inside rendered YAML, JSON, URI, and metadata blocks', () => {
    const html = renderPreviewHtml('<script>alert(1)</script>', '{"tag":"<b>x</b>"}', {
      subscriptionName: '<img onerror=alert(1)>',
      nodeCount: 2,
      protocolCounts: { ss: 1, vless: 1 },
      rawUris: 'ss://abc@1.2.3.4:443#<svg>',
      v2rayBase64: 'c3M6Ly9hYmM=',
    })
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('&lt;img onerror=alert(1)&gt;')
    expect(html).toContain('&lt;svg&gt;')
    expect(html).toContain('共 2 个节点')
    expect(html).toContain('ss: 1')
  })
})
