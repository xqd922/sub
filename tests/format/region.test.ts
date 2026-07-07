import { describe, it, expect } from 'vitest'
import { detectRegion, isoToFlag, extractFlagEmoji } from '@/node/region'

describe('isoToFlag', () => {
  it('converts US to its flag emoji', () => {
    const flag = isoToFlag('US')
    // Each regional indicator symbol is a surrogate pair (length 2 in UTF-16), so total length is 4
    expect([...flag].length).toBe(2) // Two code points
  })

  it('converts JP to its flag emoji', () => {
    const flag = isoToFlag('JP')
    expect([...flag].length).toBe(2)
  })

  it('returns empty string for empty input', () => {
    expect(isoToFlag('')).toBe('')
  })

  it('returns empty string for single character', () => {
    expect(isoToFlag('U')).toBe('')
  })

  it('returns empty string for three characters', () => {
    expect(isoToFlag('USA')).toBe('')
  })

  it('is case-insensitive', () => {
    const upper = isoToFlag('US')
    const lower = isoToFlag('us')
    expect(upper).toBe(lower)
  })
})

describe('extractFlagEmoji', () => {
  it('extracts a flag emoji from a string', () => {
    const result = extractFlagEmoji('🇺🇸 United States')
    expect(result).toBe('🇺🇸')
  })

  it('extracts a flag embedded in text', () => {
    const result = extractFlagEmoji('node-🇯🇵-Tokyo')
    expect(result).toBe('🇯🇵')
  })

  it('returns null when no flag is present', () => {
    expect(extractFlagEmoji('no flag here')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractFlagEmoji('')).toBeNull()
  })
})

describe('detectRegion', () => {
  // --- Chinese keyword detection ---

  it('detects Hong Kong from Chinese keyword "香港"', () => {
    const region = detectRegion('香港节点01')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('HK')
    expect(region!.name).toBe('Hong Kong')
  })

  it('detects Taiwan from Chinese keyword "台湾"', () => {
    const region = detectRegion('台湾台北')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('TW')
  })

  it('detects Japan from Chinese keyword "日本"', () => {
    const region = detectRegion('日本东京')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('JP')
    expect(region!.name).toBe('Japan')
  })

  it('detects Singapore from Chinese keyword "新加坡"', () => {
    const region = detectRegion('新加坡节点')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('SG')
  })

  it('detects South Korea from Chinese keyword "韩国"', () => {
    const region = detectRegion('韩国首尔')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('KR')
  })

  it('detects United States from Chinese keyword "美国"', () => {
    const region = detectRegion('美国洛杉矶')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('US')
  })

  it('detects United Kingdom from Chinese keyword "英国"', () => {
    const region = detectRegion('英国伦敦')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('GB')
  })

  it('detects Germany from Chinese keyword "德国"', () => {
    const region = detectRegion('德国法兰克福')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('DE')
  })

  it('detects from short Chinese alias "港"', () => {
    const region = detectRegion('港-IPLC')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('HK')
  })

  it('detects from short Chinese alias "美"', () => {
    const region = detectRegion('美-01')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('US')
  })

  // --- English / ISO code detection ---

  it('detects US from ISO code in node name', () => {
    const region = detectRegion('US-Node-01')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('US')
  })

  it('detects JP from ISO code', () => {
    const region = detectRegion('JP-Tokyo-01')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('JP')
  })

  it('detects HK from ISO code', () => {
    const region = detectRegion('HK-HKBN')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('HK')
  })

  it('detects GB from alias "UK"', () => {
    const region = detectRegion('UK-London')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('GB')
  })

  it('detects from 3-letter alias "HKG"', () => {
    const region = detectRegion('HKG-01')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('HK')
  })

  it('detects from 3-letter alias "JPN"', () => {
    const region = detectRegion('JPN-Node')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('JP')
  })

  it('detects from alias "USA"', () => {
    const region = detectRegion('USA-West')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('US')
  })

  // --- Edge cases ---

  it('returns null for an unrecognizable name', () => {
    expect(detectRegion('random-server-xyz')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectRegion('')).toBeNull()
  })

  it('does not falsely match "US" inside "RUS"', () => {
    // "RUS" should match Russia, not US
    const region = detectRegion('RUS-01')
    if (region) {
      expect(region.code).toBe('RU')
    }
  })

  it('detects flag emoji directly in the name', () => {
    const region = detectRegion('🇺🇸 US-Node')
    expect(region).not.toBeNull()
    expect(region!.code).toBe('US')
  })
})
