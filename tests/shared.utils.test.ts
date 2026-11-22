import { describe, expect, it } from 'vitest'
import { assertPublicHttpUrl, isPublicHttpUrl } from '@/server/fetch.client'
import {
  base64ToBytes,
  bytesToBase64Url,
  decodeBase64Utf8,
  encodeBase64UrlUtf8,
  encodeBase64Utf8,
} from '@/shared/base64.utils'
import { escapeCsvCell, formatBytes, formatCount, formatShortDate } from '@/shared/format.utils'
import {
  buildConversionUrl,
  extractFileNameFromUrlPath,
  extractNameFromUrl,
  isAllowedSubscriptionInput,
  isValidUrl,
  parsePort,
  splitSubscriptionSources,
  unwrapConversionUrl,
} from '@/shared/url.utils'

describe('base64.utils', () => {
  it('roundtrips UTF-8 strings including CJK and emoji', () => {
    const sample = '🇭🇰 香港 BGP 01 — 测试:password'
    expect(decodeBase64Utf8(encodeBase64Utf8(sample))).toBe(sample)
    expect(decodeBase64Utf8(encodeBase64UrlUtf8(sample))).toBe(sample)
  })

  it('produces URL-safe base64 without padding', () => {
    const encoded = encodeBase64UrlUtf8('2022-blake3-aes-256-gcm:c2VydmVyLWtleQ==:dXNlci1rZXk=')
    expect(encoded).not.toMatch(/[+/=]/)
    expect(decodeBase64Utf8(encoded)).toBe('2022-blake3-aes-256-gcm:c2VydmVyLWtleQ==:dXNlci1rZXk=')
  })

  it('roundtrips raw byte arrays through base64url', () => {
    const input = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
    const encoded = bytesToBase64Url(input)
    expect(Array.from(base64ToBytes(encoded))).toEqual(Array.from(input))
  })
})

describe('parsePort', () => {
  it('parses valid strings and numbers', () => {
    expect(parsePort('8080')).toBe(8080)
    expect(parsePort(443)).toBe(443)
    expect(parsePort(1)).toBe(1)
    expect(parsePort(65535)).toBe(65535)
    expect(parsePort('1')).toBe(1)
    expect(parsePort('8080abc')).toBe(8080)
  })

  it('returns default port for invalid or out-of-range values', () => {
    expect(parsePort(undefined)).toBe(443)
    expect(parsePort(null)).toBe(443)
    expect(parsePort('')).toBe(443)
    expect(parsePort('abc')).toBe(443)
    expect(parsePort(0)).toBe(443)
    expect(parsePort(-1)).toBe(443)
    expect(parsePort(70000)).toBe(443)
    expect(parsePort(undefined, 8080)).toBe(8080)
  })
})

describe('url.utils', () => {
  it('validates URLs and builds conversion links', () => {
    expect(isValidUrl('https://example.com/sub')).toBe(true)
    expect(isValidUrl('not-a-url')).toBe(false)
    expect(buildConversionUrl('https://sub.example.com', 'https://a.com/x?a=1')).toBe(
      'https://sub.example.com/sub?url=https%3A%2F%2Fa.com%2Fx%3Fa%3D1',
    )
    expect(buildConversionUrl('https://sub.example.com', 'https://a.com/x', 'clash')).toBe(
      'https://sub.example.com/sub?url=https%3A%2F%2Fa.com%2Fx&target=clash',
    )
    expect(buildConversionUrl('https://sub.example.com', 'https://a.com/x', 'auto')).toBe(
      'https://sub.example.com/sub?url=https%3A%2F%2Fa.com%2Fx',
    )
  })

  it('unwraps nested conversion URLs and validates multi-source inputs', () => {
    expect(unwrapConversionUrl('https://a.com/sub')).toEqual({
      subscriptionUrl: 'https://a.com/sub',
      target: undefined,
    })

    const once = buildConversionUrl('https://my.site', 'https://a.com/sub?token=1', 'singbox')
    expect(unwrapConversionUrl(once)).toEqual({
      subscriptionUrl: 'https://a.com/sub?token=1',
      target: 'singbox',
    })

    const twice = buildConversionUrl('https://my.site', once)
    expect(unwrapConversionUrl(twice)).toEqual({
      subscriptionUrl: 'https://a.com/sub?token=1',
      target: 'singbox',
    })

    expect(unwrapConversionUrl('/sub?url=ss%3A%2F%2Fabc%401.2.3.4%3A443&target=clash')).toEqual({
      subscriptionUrl: 'ss://abc@1.2.3.4:443',
      target: 'clash',
    })

    expect(splitSubscriptionSources('https://a.com/1 | https://b.com/2')).toEqual([
      'https://a.com/1',
      'https://b.com/2',
    ])
    expect(isAllowedSubscriptionInput('https://a.com/1|ss://abc@1.2.3.4:443')).toBe(true)
    expect(isAllowedSubscriptionInput('javascript:alert(1)')).toBe(false)
    expect(isAllowedSubscriptionInput('ftp://example.com/file')).toBe(false)
  })

  it('blocks SSRF targets in isPublicHttpUrl / assertPublicHttpUrl', () => {
    expect(isPublicHttpUrl('https://sub.example.com/api')).toBe(true)
    expect(isPublicHttpUrl('http://127.0.0.1:8080/sub')).toBe(false)
    expect(isPublicHttpUrl('http://localhost/sub')).toBe(false)
    expect(isPublicHttpUrl('http://10.0.0.5/sub')).toBe(false)
    expect(isPublicHttpUrl('http://192.168.1.1/sub')).toBe(false)
    expect(isPublicHttpUrl('http://172.16.0.1/sub')).toBe(false)
    expect(isPublicHttpUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isPublicHttpUrl('http://[::1]/sub')).toBe(false)
    expect(isPublicHttpUrl('http://[::ffff:127.0.0.1]/sub')).toBe(false)
    expect(isPublicHttpUrl('http://service.internal/sub')).toBe(false)
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false)
    expect(() => assertPublicHttpUrl('http://127.0.0.1/secret')).toThrow()
  })

  it('extracts name from query params, nested url param, path filename suffix, or hostname', () => {
    expect(extractNameFromUrl('https://example.com/sub?name=MyNode')).toBe('MyNode')
    expect(extractNameFromUrl('https://example.com/sub?remarks=备注')).toBe('备注')
    expect(extractNameFromUrl('https://example.com/sub')).toBe('example.com')

    // Gist / GitHub Raw 路径后缀提取（自动去除常见扩展名、忽略通用路径与 commit hash）
    expect(
      extractNameFromUrl(
        'https://gist.githubusercontent.com/xqd922/9a563c7cdddce77803009d8fe22d7d8b/raw/6757a56570d76ee09259c59d76978d6620afc2b2/Mine',
      ),
    ).toBe('Mine')
    expect(
      extractNameFromUrl('https://gist.githubusercontent.com/u/id/raw/Work.yaml'),
    ).toBe('Work')
    expect(
      extractNameFromUrl(
        'https://raw.githubusercontent.com/user/repo/main/nodes/%E8%87%AA%E5%BB%BA.txt',
      ),
    ).toBe('自建')
    expect(extractFileNameFromUrlPath('https://example.com/api/v1/client/subscribe')).toBeNull()
    expect(
      extractFileNameFromUrlPath(
        'https://gist.githubusercontent.com/xqd922/9a563c7cdddce77803009d8fe22d7d8b/raw/6757a56570d76ee09259c59d76978d6620afc2b2',
      ),
    ).toBeNull()
    expect(extractNameFromUrl('anytls://pw@example.net:443#HK-BestVM')).toBe('HK-BestVM')
    expect(
      extractNameFromUrl('anytls://pw@example.net:443#%F0%9F%87%AD%F0%9F%87%B0%20HK%20BestVM'),
    ).toBe('HK BestVM')

    const inner = encodeURIComponent('https://api.test.com/link?name=Inner')
    expect(extractNameFromUrl(`https://example.com/sub?url=${inner}`)).toBe('Inner')

    expect(extractNameFromUrl('not-a-url')).toBe('未知订阅')
    expect(extractNameFromUrl('not-a-url', '自定义')).toBe('自定义')
  })
})

describe('format.utils', () => {
  it('formats byte sizes across units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1)).toBe('1.00 B')
    expect(formatBytes(500)).toBe('500.00 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(1048576)).toBe('1.00 MB')
    expect(formatBytes(1073741824)).toBe('1.00 GB')
    expect(formatBytes(1610612736)).toBe('1.50 GB')
    expect(formatBytes(1099511627776)).toBe('1.00 TB')
  })

  it('formats counts, short dates, and CSV cells', () => {
    expect(formatCount(12500)).toBe('12.5k')
    expect(formatShortDate('2026-11-22')).toBe('11/22')
    expect(escapeCsvCell('a"b,c')).toBe('"a""b,c"')
  })
})
