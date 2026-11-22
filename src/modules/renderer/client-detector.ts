import type { ClientType } from '@/modules/renderer/renderer.types'

const SINGBOX_UA_RE = /sing-box|SFA|SFI|SFM|SFT/i
const V2RAY_UA_RE = /v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i
const BROWSER_UA_RE = /mozilla|chrome|safari|firefox|edge/i
const PROXY_CLIENT_UA_RE =
  /sing-box|SFA|SFI|SFM|SFT|clash|mihomo|stash|flclash|karing|verge|v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i

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

  const isSingBox = SINGBOX_UA_RE.test(userAgent)
  const isV2rayNG = V2RAY_UA_RE.test(userAgent)
  const isBrowser = BROWSER_UA_RE.test(userAgent) && !PROXY_CLIENT_UA_RE.test(userAgent)

  let clientType: ClientType
  if (isSingBox) {
    clientType = 'singbox'
  } else if (isV2rayNG) {
    clientType = 'v2rayng'
  } else if (isBrowser) {
    clientType = 'browser'
  } else {
    clientType = 'clash'
  }

  return { isSingBox, isV2rayNG, isBrowser, clientType }
}
