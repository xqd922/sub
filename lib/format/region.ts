/**
 * 地区检测与格式化模块
 * 使用混合方案：
 * 1. 优先检测已有的国旗 emoji
 * 2. 中文关键词映射到 ISO 码
 * 3. 使用 country-emoji 库匹配英文
 * 4. ISO 码转国旗 emoji（无依赖算法）
 */

import { flag as getFlag, code as getCode } from 'country-emoji'

/** 地区信息 */
export interface RegionInfo {
  flag: string
  code: string
  name: string
}

/**
 * 特殊旗帜覆盖映射
 * 用于覆盖某些地区的默认旗帜
 */
const FLAG_OVERRIDES: Record<string, string> = {
  'TW': '🇨🇳',  // 台湾使用中国国旗
}

/**
 * ISO 3166-1 alpha-2 国家码转国旗 emoji
 * 原理：国旗 emoji 由两个 Regional Indicator Symbol 组成
 * 'A' 的 Unicode 是 65，Regional Indicator 'A' 是 127462
 * 所以偏移量是 127462 - 65 = 127397
 */
export function isoToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''
  const upperCode = countryCode.toUpperCase()
  // 检查是否有特殊覆盖
  if (FLAG_OVERRIDES[upperCode]) {
    return FLAG_OVERRIDES[upperCode]
  }
  const codePoints = upperCode
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

/**
 * 检测字符串中的国旗 emoji
 * 国旗 emoji 由两个 Regional Indicator Symbol (U+1F1E6 到 U+1F1FF) 组成
 */
export function extractFlagEmoji(text: string): string | null {
  // 匹配国旗 emoji（两个连续的 Regional Indicator Symbol）
  const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/gu
  const match = text.match(flagRegex)
  return match ? match[0] : null
}

/**
 * 中文地区名到 ISO 码的映射（精简版，只保留常用的）
 */
const CHINESE_TO_ISO: Record<string, string> = {
  // 东亚
  '香港': 'HK', '港': 'HK',
  '台湾': 'TW', '台': 'TW',
  '澳门': 'MO',
  '日本': 'JP',
  '韩国': 'KR', '南韩': 'KR',

  // 东南亚
  '新加坡': 'SG', '狮城': 'SG', '坡': 'SG',
  '马来西亚': 'MY', '马来': 'MY', '大马': 'MY',
  '印尼': 'ID', '印度尼西亚': 'ID',
  '泰国': 'TH', '泰': 'TH',
  '越南': 'VN', '越': 'VN',
  '菲律宾': 'PH', '菲': 'PH',
  '柬埔寨': 'KH',

  // 南亚
  '印度': 'IN',
  '巴基斯坦': 'PK',

  // 欧洲
  '英国': 'GB', '英': 'GB',
  '德国': 'DE', '德': 'DE',
  '法国': 'FR', '法': 'FR',
  '意大利': 'IT', '意': 'IT',
  '西班牙': 'ES',
  '荷兰': 'NL',
  '波兰': 'PL',
  '乌克兰': 'UA',
  '瑞士': 'CH',
  '瑞典': 'SE',
  '挪威': 'NO',
  '芬兰': 'FI',
  '丹麦': 'DK',
  '冰岛': 'IS',
  '奥地利': 'AT',
  '爱尔兰': 'IE',
  '匈牙利': 'HU',
  '保加利亚': 'BG',
  '摩尔多瓦': 'MD',
  '罗马尼亚': 'RO',
  '捷克': 'CZ',
  '葡萄牙': 'PT',
  '比利时': 'BE',
  '希腊': 'GR',

  // 北美
  '美国': 'US', '美': 'US',
  '加拿大': 'CA',
  '墨西哥': 'MX',

  // 南美
  '巴西': 'BR',
  '阿根廷': 'AR',
  '智利': 'CL',

  // 大洋洲
  '澳大利亚': 'AU', '澳洲': 'AU', '澳': 'AU',
  '新西兰': 'NZ',

  // 中亚/西亚
  '俄罗斯': 'RU', '俄': 'RU',
  '土耳其': 'TR',
  '哈萨克斯坦': 'KZ', '哈萨克': 'KZ', '哈国': 'KZ',
  '以色列': 'IL',
  '阿联酋': 'AE',
  '沙特': 'SA', '沙特阿拉伯': 'SA',
  '伊拉克': 'IQ',

  // 非洲
  '南非': 'ZA',
  '尼日利亚': 'NG',
  '埃及': 'EG',
}

/**
 * 英文/缩写到 ISO 码的映射（只保留 country-emoji 可能无法识别的）
 */
const ENGLISH_TO_ISO: Record<string, string> = {
  // 常见缩写
  'HK': 'HK', 'HKG': 'HK',
  'TW': 'TW', 'TWN': 'TW',
  'MO': 'MO',
  'JP': 'JP', 'JPN': 'JP',
  'KR': 'KR', 'KOR': 'KR',
  'SG': 'SG', 'SGP': 'SG',
  'MY': 'MY', 'MYS': 'MY',
  'ID': 'ID', 'IDN': 'ID',
  'TH': 'TH', 'THA': 'TH',
  'VN': 'VN', 'VNM': 'VN',
  'PH': 'PH', 'PHL': 'PH',
  'IN': 'IN', 'IND': 'IN',
  'PK': 'PK', 'PAK': 'PK',
  'GB': 'GB', 'GBR': 'GB', 'UK': 'GB',
  'DE': 'DE', 'DEU': 'DE',
  'FR': 'FR', 'FRA': 'FR',
  'IT': 'IT', 'ITA': 'IT',
  'ES': 'ES', 'ESP': 'ES',
  'NL': 'NL', 'NLD': 'NL',
  'US': 'US', 'USA': 'US',
  'CA': 'CA', 'CAN': 'CA',
  'AU': 'AU', 'AUS': 'AU',
  'NZ': 'NZ', 'NZL': 'NZ',
  'RU': 'RU', 'RUS': 'RU',
  'TR': 'TR', 'TUR': 'TR',
  'BR': 'BR', 'BRA': 'BR',
  'AR': 'AR', 'ARG': 'AR',
  'KZ': 'KZ', 'KAZ': 'KZ',
  'ZA': 'ZA',
  'AE': 'AE', 'UAE': 'AE',
  'CH': 'CH',
  'SE': 'SE', 'SWE': 'SE',
  'NO': 'NO', 'NOR': 'NO',
  'FI': 'FI', 'FIN': 'FI',
  'DK': 'DK', 'DNK': 'DK',
  'IS': 'IS', 'ISL': 'IS',
  'AT': 'AT', 'AUT': 'AT',
  'IE': 'IE', 'IRL': 'IE',
  'HU': 'HU', 'HUN': 'HU',
  'BG': 'BG', 'BGR': 'BG',
  'MD': 'MD', 'MDA': 'MD',
  'PL': 'PL', 'POL': 'PL',
  'UA': 'UA', 'UKR': 'UA',
  'IL': 'IL', 'ISR': 'IL',
  'SA': 'SA', 'SAU': 'SA',
  'IQ': 'IQ', 'IRQ': 'IQ',
  'CL': 'CL', 'CHL': 'CL',
  'MX': 'MX', 'MEX': 'MX',
  'KH': 'KH', 'KHM': 'KH',
  'NG': 'NG', 'NGA': 'NG',
  'EG': 'EG', 'EGY': 'EG',
  'RO': 'RO', 'ROU': 'RO',
  'CZ': 'CZ', 'CZE': 'CZ',
  'PT': 'PT', 'PRT': 'PT',
  'BE': 'BE', 'BEL': 'BE',
  'GR': 'GR', 'GRC': 'GR',
}

/**
 * ISO 码到英文名的映射
 */
const ISO_TO_NAME: Record<string, string> = {
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'MO': 'Macao',
  'JP': 'Japan',
  'KR': 'Korea',
  'SG': 'Singapore',
  'MY': 'Malaysia',
  'ID': 'Indonesia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'PH': 'Philippines',
  'KH': 'Cambodia',
  'IN': 'India',
  'PK': 'Pakistan',
  'GB': 'UK',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'PL': 'Poland',
  'UA': 'Ukraine',
  'CH': 'Switzerland',
  'SE': 'Sweden',
  'NO': 'Norway',
  'FI': 'Finland',
  'DK': 'Denmark',
  'IS': 'Iceland',
  'AT': 'Austria',
  'IE': 'Ireland',
  'HU': 'Hungary',
  'BG': 'Bulgaria',
  'MD': 'Moldova',
  'RO': 'Romania',
  'CZ': 'Czechia',
  'PT': 'Portugal',
  'BE': 'Belgium',
  'GR': 'Greece',
  'US': 'USA',
  'CA': 'Canada',
  'MX': 'Mexico',
  'BR': 'Brazil',
  'AR': 'Argentina',
  'CL': 'Chile',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'RU': 'Russia',
  'TR': 'Turkey',
  'KZ': 'Kazakhstan',
  'IL': 'Israel',
  'AE': 'UAE',
  'SA': 'Saudi Arabia',
  'IQ': 'Iraq',
  'ZA': 'South Africa',
  'NG': 'Nigeria',
  'EG': 'Egypt',
}

/**
 * 从节点名称检测地区
 * 返回 { flag, code, name } 或 null
 */
export function detectRegion(nodeName: string): RegionInfo | null {
  // 1. 优先检测已有的国旗 emoji
  const existingFlag = extractFlagEmoji(nodeName)
  if (existingFlag) {
    const code = getCode(existingFlag)
    if (code) {
      return {
        flag: existingFlag,
        code: code,
        name: ISO_TO_NAME[code] || code
      }
    }
  }

  // 2. 检测中文关键词（按长度降序，避免短词误匹配）
  const chineseKeys = Object.keys(CHINESE_TO_ISO).sort((a, b) => b.length - a.length)
  for (const key of chineseKeys) {
    if (nodeName.includes(key)) {
      const code = CHINESE_TO_ISO[key]
      return {
        flag: isoToFlag(code),
        code: code,
        name: ISO_TO_NAME[code] || code
      }
    }
  }

  // 3. 检测英文缩写（需要边界匹配，避免 "US" 匹配到 "RUS"）
  const englishKeys = Object.keys(ENGLISH_TO_ISO).sort((a, b) => b.length - a.length)
  for (const key of englishKeys) {
    // 使用单词边界匹配
    const regex = new RegExp(`(^|[^A-Za-z])${key}([^A-Za-z]|$)`, 'i')
    if (regex.test(nodeName)) {
      const code = ENGLISH_TO_ISO[key]
      return {
        flag: isoToFlag(code),
        code: code,
        name: ISO_TO_NAME[code] || code
      }
    }
  }

  // 4. 使用 country-emoji 库尝试匹配（处理完整国家名）
  const flag = getFlag(nodeName)
  if (flag) {
    const code = getCode(flag)
    if (code) {
      return {
        flag: flag,
        code: code,
        name: ISO_TO_NAME[code] || code
      }
    }
  }

  return null
}

/** 多城市国家配置（需要显示城市名的国家） */
export const MULTI_CITY_COUNTRIES: Record<string, { short: string; full: string }> = {
  'US': { short: 'USA', full: 'United States' },
  'GB': { short: 'UK', full: 'United Kingdom' },
  'RU': { short: 'Russia', full: 'Russia' },
  'AU': { short: 'Australia', full: 'Australia' },
}

/** 城市映射表 */
export const CITY_MAP: Record<string, { country: string; city: string }> = {
  // 美国城市
  '洛杉矶': { country: 'US', city: 'Los Angeles' },
  'Los Angeles': { country: 'US', city: 'Los Angeles' },
  'LA': { country: 'US', city: 'Los Angeles' },
  '西雅图': { country: 'US', city: 'Seattle' },
  'Seattle': { country: 'US', city: 'Seattle' },
  '圣何塞': { country: 'US', city: 'San Jose' },
  'San Jose': { country: 'US', city: 'San Jose' },
  '硅谷': { country: 'US', city: 'Silicon Valley' },
  'Silicon Valley': { country: 'US', city: 'Silicon Valley' },
  '纽约': { country: 'US', city: 'New York' },
  'New York': { country: 'US', city: 'New York' },
  'NYC': { country: 'US', city: 'New York' },
  '芝加哥': { country: 'US', city: 'Chicago' },
  'Chicago': { country: 'US', city: 'Chicago' },
  '达拉斯': { country: 'US', city: 'Dallas' },
  'Dallas': { country: 'US', city: 'Dallas' },
  '迈阿密': { country: 'US', city: 'Miami' },
  'Miami': { country: 'US', city: 'Miami' },
  '旧金山': { country: 'US', city: 'San Francisco' },
  'San Francisco': { country: 'US', city: 'San Francisco' },
  'SF': { country: 'US', city: 'San Francisco' },
  '华盛顿': { country: 'US', city: 'Washington' },
  'Washington': { country: 'US', city: 'Washington' },
  'DC': { country: 'US', city: 'Washington DC' },
  '凤凰城': { country: 'US', city: 'Phoenix' },
  'Phoenix': { country: 'US', city: 'Phoenix' },
  '丹佛': { country: 'US', city: 'Denver' },
  'Denver': { country: 'US', city: 'Denver' },
  '亚特兰大': { country: 'US', city: 'Atlanta' },
  'Atlanta': { country: 'US', city: 'Atlanta' },

  // 英国城市
  '伦敦': { country: 'GB', city: 'London' },
  'London': { country: 'GB', city: 'London' },
  '考文垂': { country: 'GB', city: 'Coventry' },
  'Coventry': { country: 'GB', city: 'Coventry' },
  '曼彻斯特': { country: 'GB', city: 'Manchester' },
  'Manchester': { country: 'GB', city: 'Manchester' },
  '伯明翰': { country: 'GB', city: 'Birmingham' },
  'Birmingham': { country: 'GB', city: 'Birmingham' },

  // 俄罗斯城市
  '莫斯科': { country: 'RU', city: 'Moscow' },
  'Moscow': { country: 'RU', city: 'Moscow' },
  '圣彼得堡': { country: 'RU', city: 'St. Petersburg' },
  'St. Petersburg': { country: 'RU', city: 'St. Petersburg' },
  'Saint Petersburg': { country: 'RU', city: 'St. Petersburg' },

  // 澳大利亚城市
  '悉尼': { country: 'AU', city: 'Sydney' },
  'Sydney': { country: 'AU', city: 'Sydney' },
  '墨尔本': { country: 'AU', city: 'Melbourne' },
  'Melbourne': { country: 'AU', city: 'Melbourne' },
  '布里斯班': { country: 'AU', city: 'Brisbane' },
  'Brisbane': { country: 'AU', city: 'Brisbane' },

  // 日本城市
  '东京': { country: 'JP', city: 'Tokyo' },
  'Tokyo': { country: 'JP', city: 'Tokyo' },
  '大阪': { country: 'JP', city: 'Osaka' },
  'Osaka': { country: 'JP', city: 'Osaka' },
}

// ============ 兼容旧 API（保持向后兼容）============

/** @deprecated 使用 detectRegion 代替 */
export const REGION_MAP = new Proxy({} as Record<string, RegionInfo>, {
  get(_target, prop: string) {
    // 尝试各种方式获取地区信息
    const region = detectRegion(prop)
    if (region) {
      return {
        flag: region.flag,
        name: region.code,
        en: region.name
      }
    }
    return undefined
  },
  has(_target, prop: string) {
    return detectRegion(prop) !== null
  },
  ownKeys() {
    return Object.keys(CHINESE_TO_ISO).concat(Object.keys(ENGLISH_TO_ISO))
  },
  getOwnPropertyDescriptor() {
    return { enumerable: true, configurable: true }
  }
})

/** @deprecated 使用 detectRegion 返回的 code 代替 */
export type RegionCode = string
