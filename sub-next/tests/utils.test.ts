import { describe, it, expect } from 'vitest'
import { parsePort, formatBytes, extractNameFromUrl } from '@/utils'

describe('parsePort', () => {
  it('parses a valid numeric string', () => {
    expect(parsePort('8080')).toBe(8080)
  })

  it('parses a valid number directly', () => {
    expect(parsePort(443)).toBe(443)
  })

  it('returns the default port for undefined', () => {
    expect(parsePort(undefined)).toBe(443)
  })

  it('returns the default port for null', () => {
    expect(parsePort(null)).toBe(443)
  })

  it('returns the default port for empty string', () => {
    expect(parsePort('')).toBe(443)
  })

  it('returns the default port for NaN input', () => {
    expect(parsePort('abc')).toBe(443)
  })

  it('returns the default port for port 0', () => {
    expect(parsePort(0)).toBe(443)
  })

  it('returns the default port for negative numbers', () => {
    expect(parsePort(-1)).toBe(443)
  })

  it('returns the default port for values above 65535', () => {
    expect(parsePort(70000)).toBe(443)
  })

  it('accepts a custom default port', () => {
    expect(parsePort(undefined, 8080)).toBe(8080)
  })

  it('accepts boundary port 1', () => {
    expect(parsePort(1)).toBe(1)
  })

  it('accepts boundary port 65535', () => {
    expect(parsePort(65535)).toBe(65535)
  })

  it('handles string "1" as valid port', () => {
    expect(parsePort('1')).toBe(1)
  })

  it('handles string with leading/trailing spaces via parseInt', () => {
    // parseInt ignores trailing non-numeric characters
    expect(parsePort('8080abc')).toBe(8080)
  })
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500.00 B')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB')
  })

  it('formats terabytes correctly', () => {
    expect(formatBytes(1099511627776)).toBe('1.00 TB')
  })

  it('formats fractional values with two decimal places', () => {
    expect(formatBytes(1536)).toBe('1.50 KB')
  })

  it('formats a small number of bytes', () => {
    expect(formatBytes(1)).toBe('1.00 B')
  })

  it('formats 1.5 GB', () => {
    expect(formatBytes(1610612736)).toBe('1.50 GB')
  })
})

describe('extractNameFromUrl', () => {
  it('extracts name from query param', () => {
    expect(extractNameFromUrl('https://example.com/sub?name=MyNode')).toBe('MyNode')
  })

  it('extracts remarks param', () => {
    expect(extractNameFromUrl('https://example.com/sub?remarks=备注')).toBe('备注')
  })

  it('falls back to hostname', () => {
    expect(extractNameFromUrl('https://example.com/sub')).toBe('example.com')
  })

  it('extracts name from inner url param', () => {
    const inner = encodeURIComponent('https://api.test.com/link?name=Inner')
    expect(extractNameFromUrl(`https://example.com/sub?url=${inner}`)).toBe('Inner')
  })

  it('returns fallback for invalid URL', () => {
    expect(extractNameFromUrl('not-a-url')).toBe('未知订阅')
    expect(extractNameFromUrl('not-a-url', '自定义')).toBe('自定义')
  })
})
