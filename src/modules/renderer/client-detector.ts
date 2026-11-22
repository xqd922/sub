import type { ClientType } from '@/modules/renderer/renderer.types'

const SINGBOX_UA_RE = /sing-box|SFA|SFI|SFM|SFT/i
const V2RAY_UA_RE = /v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i
const BROWSER_UA_RE = /mozilla|chrome|safari|firefox|edge/i
const PROXY_CLIENT_UA_RE = /sing-box|SFA|SFI|SFM|SFT|clash|v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i

export function detectClientType(userAgent: string): {
  isSingBox: boolean
  isV2rayNG: boolean
  isBrowser: boolean
  clientType: ClientType
} {
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
