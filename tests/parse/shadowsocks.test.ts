import { describe, it, expect } from 'vitest'
import { parse, toUri } from '@/node/proto/shadowsocks'

/**
 * Helper: encode method:password@server:port into SIP002 base64 format
 * SIP002: ss://BASE64(method:password)@server:port#remark
 */
function buildSIP002Uri(
  method: string,
  password: string,
  server: string,
  port: number,
  remark?: string,
  plugin?: string
): string {
  const userInfo = Buffer.from(`${method}:${password}`).toString('base64').replace(/=/g, '')
  let uri = `ss://${userInfo}@${server}:${port}`
  if (plugin) {
    uri += `/?plugin=${encodeURIComponent(plugin)}`
  }
  if (remark) {
    uri += `#${encodeURIComponent(remark)}`
  }
  return uri
}

/**
 * Helper: encode the entire "method:password@server:port" string as legacy base64
 * Legacy: ss://BASE64(method:password@server:port)#remark
 */
function buildLegacyUri(
  method: string,
  password: string,
  server: string,
  port: number,
  remark?: string
): string {
  const full = `${method}:${password}@${server}:${port}`
  const encoded = Buffer.from(full).toString('base64')
  let uri = `ss://${encoded}`
  if (remark) {
    uri += `#${encodeURIComponent(remark)}`
  }
  return uri
}

describe('parse (shadowsocks)', () => {
  // --- SIP002 format ---

  it('parses a basic SIP002 URI', () => {
    const uri = buildSIP002Uri('aes-256-gcm', 'mypassword', '1.2.3.4', 8388)
    const proxy = parse(uri)

    expect(proxy.type).toBe('ss')
    expect(proxy.server).toBe('1.2.3.4')
    expect(proxy.port).toBe(8388)
    expect(proxy.cipher).toBe('aes-256-gcm')
    expect(proxy.password).toBe('mypassword')
  })

  it('parses SIP002 URI with a remark', () => {
    const uri = buildSIP002Uri('chacha20-ietf-poly1305', 'pass123', '5.6.7.8', 443, 'HK-Node')
    const proxy = parse(uri)

    expect(proxy.name).toBe('HK-Node')
    expect(proxy.cipher).toBe('chacha20-ietf-poly1305')
  })

  it('uses server as name when no remark is provided', () => {
    const uri = buildSIP002Uri('aes-128-gcm', 'pw', 'example.com', 1234)
    const proxy = parse(uri)

    expect(proxy.name).toBe('example.com')
  })

  it('parses SIP002 URI with obfs plugin', () => {
    const plugin = 'obfs-local;obfs=http;obfs-host=www.bing.com'
    const uri = buildSIP002Uri('aes-256-gcm', 'pw', '1.2.3.4', 443, 'obfs-node', plugin)
    const proxy = parse(uri)

    expect(proxy.plugin).toBe('obfs')
    expect(proxy['plugin-opts']?.mode).toBe('http')
    expect(proxy['plugin-opts']?.host).toBe('www.bing.com')
  })

  // --- Legacy base64 format ---

  it('parses a legacy base64 URI', () => {
    const uri = buildLegacyUri('aes-256-cfb', 'legacyPass', '9.8.7.6', 1080)
    const proxy = parse(uri)

    expect(proxy.type).toBe('ss')
    expect(proxy.server).toBe('9.8.7.6')
    expect(proxy.port).toBe(1080)
    expect(proxy.cipher).toBe('aes-256-cfb')
    expect(proxy.password).toBe('legacyPass')
  })

  it('parses a legacy base64 URI with remark', () => {
    const uri = buildLegacyUri('chacha20-ietf-poly1305', 'pass', '10.0.0.1', 8888, 'Legacy-Node')
    const proxy = parse(uri)

    expect(proxy.name).toBe('Legacy-Node')
  })

  // --- Password edge cases ---

  it('handles password containing colons', () => {
    const method = 'aes-256-gcm'
    const password = 'part1:part2:part3'
    const userInfo = Buffer.from(`${method}:${password}`).toString('base64').replace(/=/g, '')
    const uri = `ss://${userInfo}@1.2.3.4:443`
    const proxy = parse(uri)

    expect(proxy.cipher).toBe(method)
    expect(proxy.password).toBe(password)
  })

  it('parses Shadowsocks 2022 multi-user keys without changing a hyphenated server', () => {
    const method = '2022-blake3-aes-256-gcm'
    const serverKey = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
    const userKey = Buffer.from('fedcba9876543210fedcba9876543210').toString('base64')
    const password = `${serverKey}:${userKey}`
    const uri = buildSIP002Uri(method, password, 'edge-iepl.example.com', 65011, 'Hong Kong 1')

    const proxy = parse(uri)

    expect(proxy.cipher).toBe(method)
    expect(proxy.password).toBe(password)
    expect(proxy.server).toBe('edge-iepl.example.com')
    expect(proxy.port).toBe(65011)
    expect(proxy.name).toBe('Hong Kong 1')
  })

  it('round-trips Shadowsocks 2022 multi-user keys using URL-safe SIP002 user info', () => {
    const method = '2022-blake3-aes-256-gcm'
    const password = 'c2VydmVyLWtleQ==:dXNlci1rZXk='
    const proxy = parse(buildSIP002Uri(method, password, 'ss-2022.example.com', 443, 'SS 2022'))

    const generatedUri = toUri(proxy)

    expect(generatedUri).not.toBeNull()
    const encodedUserInfo = generatedUri!.substring(5, generatedUri!.lastIndexOf('@'))
    expect(encodedUserInfo).not.toMatch(/[+/=]/)
    expect(parse(generatedUri!)).toEqual(proxy)
  })

  // --- Remark encoding ---

  it('decodes URL-encoded remark', () => {
    const uri = buildSIP002Uri('aes-256-gcm', 'pw', '1.2.3.4', 443, '%F0%9F%87%AD%F0%9F%87%B0-HK')
    const proxy = parse(uri)

    // The remark should be decoded
    expect(proxy.name).toContain('-HK')
  })

  // --- client-fingerprint ---

  it('sets client-fingerprint to chrome by default', () => {
    const uri = buildSIP002Uri('aes-256-gcm', 'pw', '1.2.3.4', 443)
    const proxy = parse(uri)

    expect(proxy['client-fingerprint']).toBe('chrome')
  })

  // --- Error cases ---

  it('throws on empty URI after ss:// prefix', () => {
    expect(() => parse('ss://')).toThrow()
  })

  // --- IPv6 support ---

  it('parses IPv6 server address', () => {
    const method = 'aes-256-gcm'
    const password = 'testpw'
    const userInfo = Buffer.from(`${method}:${password}`).toString('base64').replace(/=/g, '')
    const uri = `ss://${userInfo}@[::1]:8388`
    const proxy = parse(uri)

    expect(proxy.server).toBe('::1')
    expect(proxy.port).toBe(8388)
  })
})
