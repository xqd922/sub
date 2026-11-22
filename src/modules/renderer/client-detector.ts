import type { ClientType } from '@/modules/renderer/renderer.types'
import type { CustomClientRule } from '@/shared/admin.types'

export interface ClientDetectionHeaders {
  accept?: string | null
  secFetchDest?: string | null
  secFetchMode?: string | null
}

const SHORT_LINK_SUFFIX_MAP: Readonly<Record<string, ClientType>> = {
  yaml: 'clash',
  yml: 'clash',
  clash: 'clash',
  json: 'singbox',
  singbox: 'singbox',
  txt: 'v2rayng',
  b64: 'v2rayng',
  v2ray: 'v2rayng',
  html: 'browser',
}

/**
 * 解析短链路径上的格式后缀（如 `hk.yaml` → `{ id: 'hk', suffixTarget: 'clash' }`）。
 */
export function parseShortLinkPathSegment(rawSegment: string): {
  id: string
  suffixTarget: ClientType | null
} {
  const dotIdx = rawSegment.lastIndexOf('.')
  if (dotIdx <= 0 || dotIdx === rawSegment.length - 1) {
    return { id: rawSegment, suffixTarget: null }
  }

  const ext = rawSegment.slice(dotIdx + 1).toLowerCase()
  const mapped = SHORT_LINK_SUFFIX_MAP[ext]
  if (!mapped) {
    return { id: rawSegment, suffixTarget: null }
  }

  return {
    id: rawSegment.slice(0, dotIdx),
    suffixTarget: mapped,
  }
}

/**
 * 按目标订阅格式分组的主流客户端 UA 指纹库：
 * - singbox: 消费完整 sing-box JSON 配置的客户端
 * - clash:   消费 Clash / Mihomo YAML 规则配置的客户端
 * - v2rayng: 消费标准 Base64 节点列表的客户端（含多核 GUI 壳，避免完整 sing-box 模板跨版本报错）
 */
const SINGBOX_CLIENT_PATTERNS: readonly RegExp[] = [
  /sing[-_]?box/i,
  /\b(?:SFA|SFI|SFM|SFT|SFW)\b/,
  /hiddify/i,
  /gui\.for\.singbox/i,
]

const CLASH_CLIENT_PATTERNS: readonly RegExp[] = [
  /clash/i,
  /mihomo/i,
  /metacubex/i,
  /stash/i,
  /verge/i,
  /nyanpasu/i,
  /sparkle/i,
  /nikki/i,
  /karing/i,
]

const V2RAY_CLIENT_PATTERNS: readonly RegExp[] = [
  /v2rayn|v2rayng|v2rayu|v2ray/i,
  /nekobox|nekoray|matsuri|throne|exclave/i,
  /shadowrocket|quantumult|surge|loon/i,
  /streisand|foxray|v2box|happ|mahsang|fairvpn|invisibleman|wingsx/i,
  /passwall|ssrplus/i,
]

const BROWSER_UA_RE = /mozilla|chrome|safari|firefox|edg(?:e|a|ios)?|opera|opr\//i

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value))
}

function isLikelyRealBrowser(userAgent: string, headers?: ClientDetectionHeaders): boolean {
  const secFetchDest = headers?.secFetchDest?.trim().toLowerCase()
  const secFetchMode = headers?.secFetchMode?.trim().toLowerCase()
  const accept = headers?.accept?.trim().toLowerCase()

  // 现代浏览器导航请求明确携带 Sec-Fetch 标记
  if (secFetchDest === 'document' || secFetchMode === 'navigate') {
    return true
  }

  if (!BROWSER_UA_RE.test(userAgent)) {
    return false
  }

  // 当请求携带了 Accept 或 Sec-Fetch 头时，仅在明确接受 HTML 文档时判定为浏览器，
  // 防止伪装 Mozilla/5.0 但发 `Accept: */*` 的代理客户端被误返回 HTML 预览页
  if (accept || secFetchDest || secFetchMode) {
    return Boolean(accept && (accept.includes('text/html') || accept.includes('application/xhtml')))
  }

  // 无请求头上下文时退回纯 UA 判断（兼容离线/单测调用）
  return true
}

export function extractClientHeaders(headers: Headers): ClientDetectionHeaders {
  return {
    accept: headers.get('accept'),
    secFetchDest: headers.get('sec-fetch-dest'),
    secFetchMode: headers.get('sec-fetch-mode'),
  }
}

export function parseTargetOverride(raw?: string | null): ClientType | null {
  if (!raw) return null
  switch (raw.trim().toLowerCase()) {
    case 'clash':
    case 'mihomo':
    case 'yaml':
      return 'clash'
    case 'singbox':
    case 'sing-box':
    case 'json':
      return 'singbox'
    case 'v2rayng':
    case 'v2ray':
    case 'base64':
      return 'v2rayng'
    case 'browser':
    case 'preview':
    case 'html':
      return 'browser'
    default:
      return null
  }
}

export function detectClientType(
  userAgent: string,
  targetOverride?: string | null,
  headers?: ClientDetectionHeaders,
  customRules?: ReadonlyArray<Pick<CustomClientRule, 'keyword' | 'target'>>,
): {
  isSingBox: boolean
  isV2rayNG: boolean
  isBrowser: boolean
  clientType: ClientType
} {
  const forced = parseTargetOverride(targetOverride)
  if (forced) {
    return {
      isSingBox: forced === 'singbox',
      isV2rayNG: forced === 'v2rayng',
      isBrowser: forced === 'browser',
      clientType: forced,
    }
  }

  const ua = userAgent || ''
  const lowerUa = ua.toLowerCase()

  // 管理员在 KV 中配置的自定义 UA 规则优先于内置指纹库，方便免发版覆盖或适配新软件
  if (customRules && customRules.length > 0 && lowerUa) {
    for (const rule of customRules) {
      const keyword = rule.keyword.trim().toLowerCase()
      if (keyword && lowerUa.includes(keyword)) {
        const matchedTarget = parseTargetOverride(rule.target)
        if (matchedTarget) {
          return {
            isSingBox: matchedTarget === 'singbox',
            isV2rayNG: matchedTarget === 'v2rayng',
            isBrowser: matchedTarget === 'browser',
            clientType: matchedTarget,
          }
        }
      }
    }
  }

  let clientType: ClientType
  if (matchesAny(ua, SINGBOX_CLIENT_PATTERNS)) {
    clientType = 'singbox'
  } else if (matchesAny(ua, CLASH_CLIENT_PATTERNS)) {
    clientType = 'clash'
  } else if (matchesAny(ua, V2RAY_CLIENT_PATTERNS)) {
    clientType = 'v2rayng'
  } else if (isLikelyRealBrowser(ua, headers)) {
    clientType = 'browser'
  } else {
    clientType = 'clash'
  }

  return {
    isSingBox: clientType === 'singbox',
    isV2rayNG: clientType === 'v2rayng',
    isBrowser: clientType === 'browser',
    clientType,
  }
}
