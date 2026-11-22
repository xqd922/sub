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
    // Intl.DisplayNames 自动覆盖的冷门国家（简/繁/英文）与港澳台前缀
    ['卢森堡 01', 'LU', 'Luxembourg'],
    ['爱沙尼亚节点', 'EE', 'Estonia'],
    ['塞浦路斯 01', 'CY', 'Cyprus'],
    ['賽普勒斯 BGP', 'CY', 'Cyprus'],
    ['喬治亞 01', 'GE', 'Georgia'],
    ['塞尔维亚', 'RS', 'Serbia'],
    ['白俄罗斯', 'BY', 'Belarus'],
    ['乌兹别克斯坦', 'UZ', 'Uzbekistan'],
    ['Luxembourg-01', 'LU', 'Luxembourg'],
    ['Estonia-Node', 'EE', 'Estonia'],
    ['中国香港 01', 'HK', 'Hong Kong'],
    ['中国台湾 01', 'TW', 'Taiwan'],
    // 仅写机房城市或 IATA 机场代码
    ['圣何塞 BGP', 'US', 'United States'],
    ['硅谷 01', 'US', 'United States'],
    ['LAX-01', 'US', 'United States'],
    ['东京 02', 'JP', 'Japan'],
    ['NRT-01', 'JP', 'Japan'],
    ['法兰克福 01', 'DE', 'Germany'],
    ['Frankfurt-01', 'DE', 'Germany'],
    ['迪拜专线', 'AE', 'United Arab Emirates'],
    ['苏黎世 01', 'CH', 'Switzerland'],
    ['IN-01', 'IN', 'India'],
    ['LU-01', 'LU', 'Luxembourg'],
  ])('detects "%s" as %s (%s)', (input, expectedCode, expectedName) => {
    const region = detectRegion(input)
    expect(region).not.toBeNull()
    expect(region!.code).toBe(expectedCode)
    expect(region!.name).toBe(expectedName)
  })

  it('avoids false positives on ambiguous 2-letter tokens like AI/SS/WS/Me/TV/CF/NF/TG/ms and lowercase words', () => {
    expect(detectRegion('AI 专线 01')).toBeNull()
    expect(detectRegion('SS Node 01')).toBeNull()
    expect(detectRegion('WS Relay 01')).toBeNull()
    expect(detectRegion('Me')).toBeNull()
    expect(detectRegion('TV 流媒体')).toBeNull()
    expect(detectRegion('CF 优选节点')).toBeNull()
    expect(detectRegion('NF 解锁专线')).toBeNull()
    expect(detectRegion('TG 频道节点')).toBeNull()
    expect(detectRegion('relay 50 ms')).toBeNull()
    expect(detectRegion('node in relay')).toBeNull()
    expect(detectRegion('random-server-xyz')).toBeNull()
    expect(detectRegion('')).toBeNull()
  })
})
