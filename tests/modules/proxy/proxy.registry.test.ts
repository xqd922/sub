import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_PROTOCOL_PREFIXES,
  encodeBase64Subscription,
  isProxyUri,
  parseProxyUri,
  proxyToSingboxOutbound,
  proxyToUri,
  validateProxy,
} from '@/modules/proxy/proxy.registry'
import { decodeBase64Utf8 } from '@/shared/utils/base64.utils'

describe('proxy.registry', () => {
  it('recognizes every supported protocol prefix including snell://', () => {
    expect(SUPPORTED_PROTOCOL_PREFIXES).toContain('snell://')
    expect(isProxyUri('trojan://pw@example.net:443#TJ')).toBe(true)
    expect(isProxyUri('vless://uuid@example.net:443#VL')).toBe(true)
    expect(isProxyUri('hy2://pw@example.net:443#HY2')).toBe(true)
    expect(isProxyUri('hysteria2://pw@example.net:443#HY2')).toBe(true)
    expect(isProxyUri('socks://user:pass@example.net:1080#SK')).toBe(true)
    expect(isProxyUri('anytls://pw@example.net:443#AT')).toBe(true)
    expect(isProxyUri('snell://example.net:8443?psk=secret&version=4#SN')).toBe(true)
    expect(isProxyUri('https://example.net/sub')).toBe(false)
  })

  it('parses, validates, serializes, and converts Trojan / VLESS / Hysteria2 / AnyTLS / Snell / SOCKS', () => {
    const trojan = parseProxyUri(
      'trojan://secret@tj.example.net:443?sni=tj.example.net&type=ws&path=%2Fws&host=cdn.example.net#Trojan%2001',
    )
    expect(trojan).toMatchObject({ type: 'trojan', name: 'Trojan 01', network: 'ws' })
    expect(validateProxy(trojan!)).toBe(true)
    expect(proxyToSingboxOutbound(trojan!)).toMatchObject({
      type: 'trojan',
      tag: 'Trojan 01',
      transport: { type: 'ws', path: '/ws', headers: { Host: 'cdn.example.net' } },
    })

    const vless = parseProxyUri(
      'vless://11111111-1111-1111-1111-111111111111@vl.example.net:443?security=reality&pbk=pub123&sid=ab&sni=www.apple.com&flow=xtls-rprx-vision#VLESS%2001',
    )
    expect(vless).toMatchObject({ type: 'vless', name: 'VLESS 01', tls: true, flow: 'xtls-rprx-vision' })
    expect(validateProxy(vless!)).toBe(true)
    expect(proxyToSingboxOutbound(vless!)).toMatchObject({
      type: 'vless',
      packet_encoding: 'xudp',
      tls: { reality: { enabled: true, public_key: 'pub123', short_id: 'ab' } },
    })

    const hy2 = parseProxyUri('hy2://pw@hy.example.net:8443?sni=hy.example.net&obfs=salamander&obfs-password=opw#HY2%2001')
    expect(hy2).toMatchObject({ type: 'hysteria2', name: 'HY2 01', obfs: 'salamander' })
    expect(validateProxy(hy2!)).toBe(true)
    expect(proxyToSingboxOutbound(hy2!)).toMatchObject({
      type: 'hysteria2',
      obfs: { type: 'salamander', password: 'opw' },
    })

    const anytls = parseProxyUri('anytls://pw@at.example.net:443?sni=at.example.net&tfo=1&idle-session-timeout=60#AnyTLS')
    expect(anytls).toMatchObject({ type: 'anytls', name: 'AnyTLS', tfo: true })
    expect(validateProxy(anytls!)).toBe(true)
    expect(proxyToUri(anytls!)).toContain('anytls://')
    expect(proxyToSingboxOutbound(anytls!)).toMatchObject({
      type: 'anytls',
      idle_session_timeout: 60,
    })

    const snell = parseProxyUri('snell://sn.example.net:6160?psk=mypsk&version=4&obfs=http&obfs-host=bing.com#Snell%2001')
    expect(snell).toMatchObject({ type: 'snell', name: 'Snell 01', psk: 'mypsk', version: 4 })
    expect(validateProxy(snell!)).toBe(true)
    expect(proxyToSingboxOutbound(snell!)).toMatchObject({
      type: 'snell',
      psk: 'mypsk',
      obfs_mode: 'http',
      obfs_host: 'bing.com',
    })

    const socks = parseProxyUri('socks://user:pass@sk.example.net:1080#Socks%2001')
    expect(socks).toMatchObject({ type: 'socks5', name: 'Socks 01', username: 'user', password: 'pass' })
    expect(validateProxy(socks!)).toBe(true)
    expect(proxyToSingboxOutbound(socks!)).toMatchObject({
      type: 'socks',
      version: '5',
      username: 'user',
    })

    const encodedSub = encodeBase64Subscription([trojan!, vless!, hy2!])
    const lines = decodeBase64Utf8(encodedSub).split('\n')
    expect(lines).toHaveLength(3)
  })

  it('returns null for unsupported schemes', () => {
    expect(parseProxyUri('unknown://host:1234')).toBeNull()
  })
})
