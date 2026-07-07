export type ClientType = 'clash' | 'singbox' | 'v2rayng' | 'browser'

export function detectClientType(userAgent: string): {
  isSingBox: boolean
  isV2rayNG: boolean
  isBrowser: boolean
  clientType: ClientType
} {
  const isSingBox = /sing-box|SFA|SFI|SFM|SFT/i.test(userAgent)

  const isV2rayNG = /v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

  const isBrowser = /mozilla|chrome|safari|firefox|edge/i.test(userAgent) &&
    !/sing-box|SFA|SFI|SFM|SFT|clash|v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

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
