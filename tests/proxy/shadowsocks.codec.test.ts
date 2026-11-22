import { describe, expect, it } from 'vitest'
import {
  parseShadowsocksUri,
  shadowsocksToUri,
} from '@/modules/proxy/codecs/shadowsocks.codec'
import { encodeBase64Utf8 } from '@/shared/base64.utils'

function buildSIP002Uri(
  method: string,
  password: string,
  server: string,
  port: number,
  remark?: string,
  plugin?: string,
): string {
  const userInfo = encodeBase64Utf8(`${method}:${password}`).replace(/=/g, '')
  let uri = `ss://${userInfo}@${server}:${port}`
  if (plugin) uri += `/?plugin=${encodeURIComponent(plugin)}`
  if (remark) uri += `#${encodeURIComponent(remark)}`
  return uri
}

function buildLegacyUri(
  method: string,
  password: string,
  server: string,
  port: number,
  remark?: string,
): string {
  const encoded = encodeBase64Utf8(`${method}:${password}@${server}:${port}`)
  return remark ? `ss://${encoded}#${encodeURIComponent(remark)}` : `ss://${encoded}`
}

describe('shadowsocks.codec', () => {
  it('parses basic SIP002 URIs and remarks', () => {
    const basic = parseShadowsocksUri(buildSIP002Uri('aes-256-gcm', 'mypassword', '1.2.3.4', 8388))
    expect(basic.type).toBe('ss')
    expect(basic.server).toBe('1.2.3.4')
    expect(basic.port).toBe(8388)
    expect(basic.cipher).toBe('aes-256-gcm')
    expect(basic.password).toBe('mypassword')
    expect(basic.name).toBe('1.2.3.4')
    expect(basic['client-fingerprint']).toBe('chrome')

    const withRemark = parseShadowsocksUri(
      buildSIP002Uri('chacha20-ietf-poly1305', 'pass123', '5.6.7.8', 443, 'HK-Node'),
    )
    expect(withRemark.name).toBe('HK-Node')
    expect(withRemark.cipher).toBe('chacha20-ietf-poly1305')
  })

  it('parses SIP002 URI with obfs plugin', () => {
    const uri = buildSIP002Uri(
      'aes-256-gcm',
      'pw',
      '1.2.3.4',
      443,
      'obfs-node',
      'obfs-local;obfs=http;obfs-host=www.bing.com',
    )
    const proxy = parseShadowsocksUri(uri)

    expect(proxy.plugin).toBe('obfs')
    expect(proxy['plugin-opts']?.mode).toBe('http')
    expect(proxy['plugin-opts']?.host).toBe('www.bing.com')

    // 支持不带前导斜杠的 ?plugin= 写法，并验证 shadowsocksToUri 保留插件参数
    const noSlashUri = uri.replace('/?plugin=', '?plugin=')
    const noSlashProxy = parseShadowsocksUri(noSlashUri)
    expect(noSlashProxy.plugin).toBe('obfs')
    expect(noSlashProxy['plugin-opts']?.host).toBe('www.bing.com')

    const serialized = shadowsocksToUri(noSlashProxy)
    expect(serialized).toContain('plugin=')
    const reparsed = parseShadowsocksUri(serialized)
    expect(reparsed.plugin).toBe('obfs')
    expect(reparsed['plugin-opts']).toEqual(noSlashProxy['plugin-opts'])
  })

  it('parses legacy base64 URIs with and without remarks', () => {
    const basic = parseShadowsocksUri(buildLegacyUri('aes-256-cfb', 'legacyPass', '9.8.7.6', 1080))
    expect(basic.server).toBe('9.8.7.6')
    expect(basic.port).toBe(1080)
    expect(basic.cipher).toBe('aes-256-cfb')
    expect(basic.password).toBe('legacyPass')

    const named = parseShadowsocksUri(
      buildLegacyUri('chacha20-ietf-poly1305', 'pass', '10.0.0.1', 8888, 'Legacy-Node'),
    )
    expect(named.name).toBe('Legacy-Node')
  })

  it('handles passwords containing colons and Shadowsocks 2022 multi-user keys', () => {
    const colonUri = buildSIP002Uri('aes-256-gcm', 'part1:part2:part3', '1.2.3.4', 443)
    const colonProxy = parseShadowsocksUri(colonUri)
    expect(colonProxy.password).toBe('part1:part2:part3')

    const method = '2022-blake3-aes-256-gcm'
    const serverKey = encodeBase64Utf8('0123456789abcdef0123456789abcdef')
    const userKey = encodeBase64Utf8('fedcba9876543210fedcba9876543210')
    const password = `${serverKey}:${userKey}`
    const proxy = parseShadowsocksUri(
      buildSIP002Uri(method, password, 'edge-iepl.example.com', 65011, 'Hong Kong 1'),
    )

    expect(proxy.cipher).toBe(method)
    expect(proxy.password).toBe(password)
    expect(proxy.server).toBe('edge-iepl.example.com')
    expect(proxy.port).toBe(65011)
    expect(proxy.name).toBe('Hong Kong 1')
  })

  it('round-trips Shadowsocks 2022 keys using URL-safe SIP002 user info', () => {
    const method = '2022-blake3-aes-256-gcm'
    const password = 'c2VydmVyLWtleQ==:dXNlci1rZXk='
    const proxy = parseShadowsocksUri(
      buildSIP002Uri(method, password, 'ss-2022.example.com', 443, 'SS 2022'),
    )

    const generated = shadowsocksToUri(proxy)
    const encodedUserInfo = generated.slice(5, generated.lastIndexOf('@'))
    expect(encodedUserInfo).not.toMatch(/[+/=]/)
    expect(parseShadowsocksUri(generated)).toEqual(proxy)
  })

  it('decodes URL-encoded remarks, handles IPv6, and throws on empty URI', () => {
    const remarkUri = buildSIP002Uri('aes-256-gcm', 'pw', '1.2.3.4', 443, '%F0%9F%87%AD%F0%9F%87%B0-HK')
    expect(parseShadowsocksUri(remarkUri).name).toContain('-HK')

    const ipv6User = encodeBase64Utf8('aes-256-gcm:testpw').replace(/=/g, '')
    const ipv6Proxy = parseShadowsocksUri(`ss://${ipv6User}@[::1]:8388`)
    expect(ipv6Proxy.server).toBe('::1')
    expect(ipv6Proxy.port).toBe(8388)

    expect(() => parseShadowsocksUri('ss://')).toThrow()
  })
})
