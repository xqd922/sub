import { describe, expect, it } from 'vitest'
import {
  detectRegion,
  extractFlagEmoji,
  isoToFlag,
} from '@/modules/subscription/region.catalog'

describe('isoToFlag', () => {
  it('converts ISO codes case-insensitively and rejects invalid lengths', () => {
    expect([...isoToFlag('US')].length).toBe(2)
    expect([...isoToFlag('JP')].length).toBe(2)
    expect(isoToFlag('US')).toBe(isoToFlag('us'))
    expect(isoToFlag('')).toBe('')
    expect(isoToFlag('U')).toBe('')
    expect(isoToFlag('USA')).toBe('')
  })
})

describe('extractFlagEmoji', () => {
  it('extracts flag emojis or returns null', () => {
    expect(extractFlagEmoji('🇺🇸 United States')).toBe('🇺🇸')
    expect(extractFlagEmoji('node-🇯🇵-Tokyo')).toBe('🇯🇵')
    expect(extractFlagEmoji('no flag here')).toBeNull()
    expect(extractFlagEmoji('')).toBeNull()
  })
})

describe('detectRegion', () => {
  it.each([
    ['香港节点01', 'HK', 'Hong Kong'],
    ['台湾台北', 'TW', 'Taiwan'],
    ['日本东京', 'JP', 'Japan'],
    ['新加坡节点', 'SG', 'Singapore'],
    ['韩国首尔', 'KR', 'South Korea'],
    ['美国洛杉矶', 'US', 'United States'],
    ['英国伦敦', 'GB', 'United Kingdom'],
    ['德国法兰克福', 'DE', 'Germany'],
    ['港-IPLC', 'HK', 'Hong Kong'],
    ['美-01', 'US', 'United States'],
    ['US-Node-01', 'US', 'United States'],
    ['JP-Tokyo-01', 'JP', 'Japan'],
    ['HK-HKBN', 'HK', 'Hong Kong'],
    ['UK-London', 'GB', 'United Kingdom'],
    ['HKG-01', 'HK', 'Hong Kong'],
    ['JPN-Node', 'JP', 'Japan'],
    ['USA-West', 'US', 'United States'],
    ['RUS-01', 'RU', 'Russia'],
    ['🇺🇸 US-Node', 'US', 'United States'],
  ])('detects "%s" as %s (%s)', (input, expectedCode, expectedName) => {
    const region = detectRegion(input)
    expect(region).not.toBeNull()
    expect(region!.code).toBe(expectedCode)
    expect(region!.name).toBe(expectedName)
  })

  it('returns null for unrecognizable or empty names', () => {
    expect(detectRegion('random-server-xyz')).toBeNull()
    expect(detectRegion('')).toBeNull()
  })
})
