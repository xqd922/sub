import { code as getCode, countries as COUNTRY_EMOJI_TABLE, name as getName } from 'country-emoji'

export interface RegionInfo {
  flag: string
  code: string
  name: string
}

const FLAG_OVERRIDES: Readonly<Record<string, string>> = { TW: '🇨🇳' }
const DISPLAY_NAME_OVERRIDES: Readonly<Record<string, string>> = { TR: 'Turkey', CZ: 'Czech Republic' }

/** 仅补充 Intl.DisplayNames 不含的机场俗称、港澳台前缀与高频 Top 机房城市/IATA/三字码 */
const EXTRA_ALIASES: Readonly<Record<string, readonly string[]>> = {
  HK: ['中国香港', '中國香港', 'HKG', 'HongKong'],
  TW: ['中国台湾', '中國台灣', '中國臺灣', '臺灣', '台北', '臺北', '高雄', 'TWN', 'Taipei', 'TPE'],
  MO: ['中国澳门', '中國澳門', 'MAC', 'Macau'],
  JP: ['东京', '東京', '大阪', '埼玉', 'JPN', 'Tokyo', 'Osaka', 'NRT', 'HND', 'KIX'],
  KR: ['南韩', '首尔', '首爾', '春川', 'KOR', 'Seoul', 'ICN'],
  SG: ['狮城', '獅城', '坡县', '坡縣', 'SGP', 'SIN'],
  MY: ['马来', '馬來', '大马', '大馬', '吉隆坡', 'MYS', 'KUL'],
  ID: ['雅加达', 'IDN', 'Jakarta'],
  TH: ['曼谷', 'THA', 'Bangkok'],
  VN: ['胡志明', '河内', 'VNM'],
  PH: ['马尼拉', 'PHL', 'Manila'],
  IN: ['孟买', '新德里', 'IND', 'Mumbai'],
  US: [
    '美西', '美东', '美東', '加州', '洛杉矶', '洛杉磯', '圣何塞', '聖何塞', '硅谷', '矽谷',
    '西雅图', '西雅圖', '纽约', '紐約', '达拉斯', '芝加哥', '迈阿密', '旧金山', '凤凰城',
    'USA', 'Los Angeles', 'San Jose', 'Silicon Valley', 'Seattle', 'New York', 'Dallas',
    'Chicago', 'Miami', 'San Francisco', 'Ashburn', 'LAX', 'SJC', 'SEA', 'NYC', 'SFO', 'ORD', 'DFW', 'MIA',
  ],
  GB: ['伦敦', '倫敦', 'GBR', 'UK', 'Britain', 'London', 'LHR'],
  DE: ['法兰克福', '法蘭克福', '柏林', '慕尼黑', 'DEU', 'Frankfurt', 'Berlin', 'FRA'],
  FR: ['巴黎', 'Paris', 'CDG'],
  NL: ['阿姆斯特丹', 'NLD', 'Amsterdam', 'AMS'],
  RU: ['莫斯科', '伯力', '海参崴', 'RUS', 'Moscow'],
  CA: ['多伦多', '温哥华', '溫哥華', 'CAN', 'Toronto', 'Vancouver', 'YYZ', 'YVR'],
  AU: ['悉尼', '墨尔本', 'AUS', 'Sydney', 'Melbourne', 'SYD'],
  AE: ['阿联酋', '阿聯酋', '迪拜', '杜拜', 'ARE', 'UAE', 'Dubai', 'DXB'],
  TR: ['伊斯坦布尔', 'TUR', 'Istanbul'],
  CH: ['苏黎世', '蘇黎世', 'CHE', 'Zurich', 'ZRH'],
  IT: ['米兰', '罗马', 'ITA', 'Milan'],
  ES: ['马德里', 'ESP', 'Madrid'],
  BR: ['圣保罗', 'BRA', 'Sao Paulo'],
  SA: ['沙特'],
}

/** 单字中文简称低优先级兜底 */
const SINGLE_CHAR_CHINESE: Readonly<Record<string, string>> = {
  港: 'HK', 台: 'TW', 臺: 'TW', 坡: 'SG', 美: 'US', 英: 'GB', 德: 'DE',
  法: 'FR', 意: 'IT', 俄: 'RU', 澳: 'AU', 泰: 'TH', 越: 'VN', 菲: 'PH',
}

/** 屏蔽与代理协议/流媒体/网络词/国内城市缩写冲突的二字 ISO 代码（仍可通过国旗或全名匹配） */
const BLOCKED_ALPHA2 = new Set([
  'AI', 'SS', 'WS', 'ME', 'TV', 'IO', 'CC', 'CO', 'GG', 'CF', 'NF', 'TK', 'TT', 'TG', 'YT',
  'LA', 'MS', 'CM', 'CU', 'BJ', 'SH', 'SZ', 'GD', 'AD', 'AM', 'PM', 'AS', 'DO', 'IM', 'MD',
  'NA', 'PR', 'RE', 'SO', 'TO', 'CD', 'FM', 'DM', 'GM', 'ST', 'TM',
])

/** 常见代理地区二字码允许不区分大小写，其余所有非屏蔽 ISO 二字码均要求全大写匹配 */
const LOWERCASE_SAFE_ALPHA2 = new Set([
  'HK', 'TW', 'MO', 'JP', 'KR', 'SG', 'US', 'GB', 'DE', 'FR', 'NL', 'RU',
  'CA', 'AU', 'NZ', 'AE', 'TR', 'CH', 'ES', 'BR', 'SE', 'FI', 'PL', 'UA', 'VN', 'TH', 'PH', 'ZA',
])

const CJK_RE = /[\u3400-\u9FFF]/
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const boundaryRegex = (token: string, flags = '') =>
  new RegExp(`(^|[^A-Za-z])${escapeRegex(token)}([^A-Za-z]|$)`, flags)

function createDisplayNames(locale: string, style: 'long' | 'short'): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'region', style })
  } catch {
    return null
  }
}

const ISO_TO_NAME: Record<string, string> = {}
const CHINESE_TO_ISO: Record<string, string> = {}
const ENGLISH_PHRASE_TO_ISO: Record<string, string> = {}
const CODE_CI_TO_ISO: Record<string, string> = {}
const UPPERCASE_ALPHA2_LIST: string[] = []

function registerToken(token: string, code: string): void {
  const cleaned = token.trim()
  if (!cleaned) return
  if (CJK_RE.test(cleaned)) {
    if (cleaned.length >= 2 && !CHINESE_TO_ISO[cleaned]) CHINESE_TO_ISO[cleaned] = code
  } else if (cleaned.length >= 4) {
    const key = cleaned.toLowerCase()
    if (!ENGLISH_PHRASE_TO_ISO[key]) ENGLISH_PHRASE_TO_ISO[key] = code
  } else if (cleaned.length >= 2) {
    const upper = cleaned.toUpperCase()
    if (!CODE_CI_TO_ISO[upper]) CODE_CI_TO_ISO[upper] = code
  }
}

function initializeCatalog(): void {
  const zhDisplayNames = [
    createDisplayNames('zh-Hans', 'short'),
    createDisplayNames('zh-Hans', 'long'),
    createDisplayNames('zh-Hant', 'short'),
    createDisplayNames('zh-Hant', 'long'),
  ]
  const enLong = createDisplayNames('en', 'long')
  const enShort = createDisplayNames('en', 'short')

  // 1. 先注册高优先级别名（确保 中国香港/中国台湾/FRA 等优先占位）
  for (const [code, aliases] of Object.entries(EXTRA_ALIASES)) {
    for (const alias of aliases) registerToken(alias, code)
  }

  // 2. 自动遍历 country-emoji 内置的全球 246 个 ISO 3166-1 地区并借助 Intl 补全简繁英文索引
  for (const [rawCode, rawNames] of Object.entries(
    COUNTRY_EMOJI_TABLE as Record<string, string | string[]>,
  )) {
    const code = rawCode.toUpperCase()
    if (!/^[A-Z]{2}$/.test(code)) continue

    const primaryEmojiName = Array.isArray(rawNames) ? rawNames[0] : rawNames
    const shortEn = enShort?.of(code)
    const longEn = enLong?.of(code)
    ISO_TO_NAME[code] =
      DISPLAY_NAME_OVERRIDES[code] ||
      (shortEn && shortEn !== code && shortEn.length > 2 ? shortEn : undefined) ||
      (longEn && longEn !== code ? longEn : undefined) ||
      primaryEmojiName ||
      code

    for (const dn of zhDisplayNames) {
      const localized = dn?.of(code)
      if (localized && localized !== code) registerToken(localized, code)
    }

    for (const candidate of [DISPLAY_NAME_OVERRIDES[code], primaryEmojiName, longEn, shortEn]) {
      if (candidate && candidate !== code && candidate.length >= 4) registerToken(candidate, code)
    }

    if (!BLOCKED_ALPHA2.has(code)) {
      if (LOWERCASE_SAFE_ALPHA2.has(code)) {
        if (!CODE_CI_TO_ISO[code]) CODE_CI_TO_ISO[code] = code
      } else {
        UPPERCASE_ALPHA2_LIST.push(code)
      }
    }
  }
}

initializeCatalog()

const SORTED_CHINESE_KEYS = Object.keys(CHINESE_TO_ISO).sort((a, b) => {
  if (b.length !== a.length) return b.length - a.length
  const codeA = CHINESE_TO_ISO[a]
  const codeB = CHINESE_TO_ISO[b]
  return codeA === 'CN' && codeB !== 'CN' ? 1 : codeB === 'CN' && codeA !== 'CN' ? -1 : 0
})

const ENGLISH_PHRASE_MATCHERS = Object.entries(ENGLISH_PHRASE_TO_ISO)
  .sort(([a], [b]) => b.length - a.length)
  .map(([phrase, code]) => ({ code, regex: boundaryRegex(phrase, 'i') }))

const CODE_CI_MATCHERS = Object.entries(CODE_CI_TO_ISO)
  .sort(([a], [b]) => b.length - a.length)
  .map(([token, code]) => ({ code, regex: boundaryRegex(token, 'i') }))

const UPPERCASE_ALPHA2_MATCHERS = UPPERCASE_ALPHA2_LIST.map((code) => ({
  code,
  regex: boundaryRegex(code),
}))

const SINGLE_CHAR_ENTRIES = Object.entries(SINGLE_CHAR_CHINESE)

function buildRegionInfo(code: string, fallbackFlag?: string): RegionInfo {
  const upper = code.toUpperCase()
  return {
    flag: FLAG_OVERRIDES[upper] || fallbackFlag || isoToFlag(upper),
    code: upper,
    name: ISO_TO_NAME[upper] || upper,
  }
}

export function isoToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''
  const upperCode = countryCode.toUpperCase()
  if (FLAG_OVERRIDES[upperCode]) return FLAG_OVERRIDES[upperCode]
  return String.fromCodePoint(...upperCode.split('').map((c) => 127397 + c.charCodeAt(0)))
}

export function extractFlagEmoji(text: string): string | null {
  const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu)
  return match ? match[0] : null
}

export function detectRegion(nodeName: string): RegionInfo | null {
  if (!nodeName) return null

  const existingFlag = extractFlagEmoji(nodeName)
  if (existingFlag) {
    let code = getCode(existingFlag)
    if (code) {
      if ((code === 'CN' || code === 'TW') && /台|臺|\bTW\b|Taiwan/i.test(nodeName)) {
        code = 'TW'
      }
      return {
        flag: FLAG_OVERRIDES[code] || existingFlag,
        code,
        name: ISO_TO_NAME[code] || getName(existingFlag) || code,
      }
    }
  }

  for (const key of SORTED_CHINESE_KEYS) {
    if (nodeName.includes(key)) return buildRegionInfo(CHINESE_TO_ISO[key])
  }

  for (const { code, regex } of ENGLISH_PHRASE_MATCHERS) {
    if (regex.test(nodeName)) return buildRegionInfo(code)
  }

  for (const { code, regex } of CODE_CI_MATCHERS) {
    if (regex.test(nodeName)) return buildRegionInfo(code)
  }

  for (const { code, regex } of UPPERCASE_ALPHA2_MATCHERS) {
    if (regex.test(nodeName)) return buildRegionInfo(code)
  }

  for (const [char, code] of SINGLE_CHAR_ENTRIES) {
    if (nodeName.includes(char)) return buildRegionInfo(code)
  }

  return null
}
