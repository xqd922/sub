import yaml from 'js-yaml'
import { Proxy } from '@/types'
import { defaultConfig, generateProxyGroups } from '@/config/clash'
import { generateSingboxConfig as buildSingboxConfig } from '@/config/singbox'
import { generateBase64Subscription } from '@/parse'
import { previewStyles } from '@/preview'
import { SubscriptionInfo } from '@/convert/subscription'
import { logger } from '@/logger'
import { formatBytes } from '@/utils'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function encodeHeaderValue(value: string): string {
  try {

    if (!/^[\x00-\x7F]*$/.test(value)) {

      if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
          const url = new URL(value)
          return url.toString()
        } catch {
          return encodeURIComponent(value)
        }
      }
      return encodeURIComponent(value)
    }
    return value
  } catch {
    return 'https://sub.xqd.pp.ua'
  }
}

export function generateClashConfig(proxies: Proxy[], isAirportSubscription: boolean = true): string {

  const clashProxies = proxies.map(proxy => {
    const { detour, ...clashProxy } = proxy
    return clashProxy
  })

  const clashConfig = {
    ...defaultConfig,
    proxies: clashProxies,
    'proxy-groups': generateProxyGroups(clashProxies, isAirportSubscription)
  }

  let output = yaml.dump(clashConfig, {
    flowLevel: 2,
    lineWidth: -1,
    indent: 2,
    noRefs: true,
    forceQuotes: false,
    quotingType: '"',
    styles: {
      '!!null': 'lowercase'
    }
  })

  output = output.replace(/path: ([^,}"'\n]+)/g, (match, value) => {
    if (/[?:&]/.test(value) && !value.startsWith('"')) {
      return `path: "${value}"`
    }
    return match
  })

  return output
}

export function generateSingboxConfig(proxies: Proxy[]): string {
  const config = buildSingboxConfig(proxies)
  return JSON.stringify(config, null, 2)
}

export function generateV2rayNGConfig(proxies: Proxy[]): string {
  return generateBase64Subscription(proxies)
}

export function generatePreviewHtml(yamlConfig: string, jsonConfig: string): string {
  const escapedYaml = escapeHtml(yamlConfig)
  const escapedJson = escapeHtml(jsonConfig)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>配置预览</title>
      <style>${previewStyles}</style>
    </head>
    <body>
      <div class="container">
        <h2>Clash 配置</h2>
        <pre>${escapedYaml}</pre>
      </div>
      <div class="container">
        <h2>sing-box 配置</h2>
        <pre>${escapedJson}</pre>
      </div>
    </body>
    </html>
  `
}

export type ClientType = 'clash' | 'singbox' | 'v2rayng' | 'browser'

export interface RenderConversionInput {
  proxies: Proxy[]
  formattedProxies: Proxy[]
  subscription: SubscriptionInfo
  userAgent: string
  isAirportSubscription: boolean
}

export interface RenderedConversionResponse {
  body: string
  headers: Record<string, string>
  clientType: ClientType
  configSize: number
}

function generateV2rayNGHeaders(subscription: SubscriptionInfo): Record<string, string> {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    'profile-update-interval': String(subscription.updateInterval || 24),
    'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
  }
}

export function renderConversionResponse(input: RenderConversionInput): RenderedConversionResponse {
  const { formattedProxies, subscription, userAgent, isAirportSubscription } = input
  const { isSingBox, isV2rayNG, isBrowser, clientType } = detectClientType(userAgent)

  if (isSingBox) {
    const body = generateSingboxConfig(formattedProxies)
    return {
      body,
      headers: generateResponseHeaders(subscription, true, false),
      clientType,
      configSize: body.length
    }
  }

  if (isV2rayNG) {
    const body = generateV2rayNGConfig(formattedProxies)
    return {
      body,
      headers: generateV2rayNGHeaders(subscription),
      clientType,
      configSize: body.length
    }
  }

  const yamlConfig = generateClashConfig(formattedProxies, isAirportSubscription)

  if (isBrowser) {
    const jsonConfig = generateSingboxConfig(formattedProxies)
    const body = generatePreviewHtml(yamlConfig, jsonConfig)
    return {
      body,
      headers: generateResponseHeaders(subscription, false, true),
      clientType,
      configSize: yamlConfig.length + jsonConfig.length
    }
  }

  return {
    body: yamlConfig,
    headers: generateResponseHeaders(subscription, false, false),
    clientType,
    configSize: yamlConfig.length
  }
}


export function generateResponseHeaders(
  subscription: SubscriptionInfo,
  isSingBox: boolean,
  isBrowser: boolean
): Record<string, string> {
  const baseHeaders = {
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  }

  if (isBrowser) {
    return {
      ...baseHeaders,
      'Content-Type': 'text/html; charset=utf-8'
    }
  }

  const configHeaders: Record<string, string> = {
    ...baseHeaders,
    'Content-Type': isSingBox ? 'application/json; charset=utf-8' : 'text/yaml; charset=utf-8',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    'profile-update-interval': String(subscription.updateInterval || 24),
    'profile-title': Buffer.from(subscription.name).toString('base64'),
    'expires': subscription.expire,
    'profile-web-page-url': encodeHeaderValue(subscription.homepage),
    'profile-expire': subscription.expire,
    'profile-status': 'active'
  }

  if (Number(subscription.upload) > 0 || Number(subscription.download) > 0 || Number(subscription.total) > 0) {
    configHeaders['subscription-userinfo'] =
      `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
  }

  return configHeaders
}

export function detectClientType(userAgent: string): {
  isSingBox: boolean
  isV2rayNG: boolean
  isBrowser: boolean
  clientType: 'clash' | 'singbox' | 'v2rayng' | 'browser'
} {

  const isSingBox = /sing-box|SFA|SFI|SFM|SFT/i.test(userAgent)

  const isV2rayNG = /v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

  const isBrowser = /mozilla|chrome|safari|firefox|edge/i.test(userAgent) &&
    !/sing-box|SFA|SFI|SFM|SFT|clash|v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

  let clientType: 'clash' | 'singbox' | 'v2rayng' | 'browser'
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

export function logConfigStats(
  proxies: Proxy[],
  formattedProxies: Proxy[],
  yamlConfig: string,
  clientType: string,
  duration: number
): void {
  logger.info('\n=== 订阅处理完成 ===')
  logger.info('处理结果:')
  logger.info(`  ├─ 客户端类型: ${clientType}`)
  logger.info(`  ├─ 节点总数: ${proxies.length}`)
  logger.info(`  ├─ 有效节点: ${formattedProxies.length}`)
  logger.info(`  ├─ 处理耗时: ${duration}ms`)
  logger.info(`  └─ 配置大小: ${formatBytes(yamlConfig.length)}`)
  logger.info('结束时间:', new Date().toLocaleString(), '\n')
}