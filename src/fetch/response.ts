import { Proxy } from '@/node/types'
import { generateClashConfig, generateSingboxConfig, generateV2rayNGConfig, generatePreviewHtml } from '@/config/clash'
import { SubscriptionInfo } from '@/fetch/subscription'
import { detectClientType } from '@/lib/client'
import { logger } from '@/lib/logger'
import { formatBytes } from '@/lib/utils'

export type { ClientType } from '@/lib/client'

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
  clientType: 'clash' | 'singbox' | 'v2rayng' | 'browser'
  configSize: number
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
