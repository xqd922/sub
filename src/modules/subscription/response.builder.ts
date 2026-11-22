import { proxiesToUris } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { renderClashConfig } from '@/modules/renderer/clash.renderer'
import { detectClientType } from '@/modules/renderer/client-detector'
import { renderPreviewHtml } from '@/modules/renderer/preview.renderer'
import { renderSingboxConfig } from '@/modules/renderer/sing-box.renderer'
import { renderV2raySubscription } from '@/modules/renderer/v2ray.renderer'
import type {
  RenderConversionInput,
  RenderedConversionResponse,
  SubscriptionInfo,
} from '@/modules/subscription/subscription.types'
import { getSiteUrl } from '@/server/env.config'
import { logger } from '@/server/logger'
import { encodeBase64Utf8 } from '@/shared/base64.utils'
import { formatBytes } from '@/shared/format.utils'

function encodeHeaderValue(value: string): string {
  try {
    if (!/^[\x00-\x7F]*$/.test(value)) {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        try {
          return new URL(value).toString()
        } catch {
          return encodeURIComponent(value)
        }
      }
      return encodeURIComponent(value)
    }
    return value
  } catch {
    return getSiteUrl()
  }
}

function buildV2rayHeaders(subscription: SubscriptionInfo): Record<string, string> {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    'profile-update-interval': String(subscription.updateInterval || 24),
    'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`,
  }
}

function countProtocols(proxies: Proxy[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const proxy of proxies) {
    const key = proxy.type.toLowerCase()
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

export function buildResponseHeaders(
  subscription: SubscriptionInfo,
  isSingBox: boolean,
  isBrowser: boolean,
): Record<string, string> {
  const baseHeaders = {
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  }

  if (isBrowser) {
    return {
      ...baseHeaders,
      'Content-Type': 'text/html; charset=utf-8',
    }
  }

  const configHeaders: Record<string, string> = {
    ...baseHeaders,
    'Content-Type': isSingBox ? 'application/json; charset=utf-8' : 'text/yaml; charset=utf-8',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
    'profile-update-interval': String(subscription.updateInterval || 24),
    'profile-title': encodeBase64Utf8(subscription.name),
    expires: subscription.expire,
    'profile-web-page-url': encodeHeaderValue(subscription.homepage),
    'profile-expire': subscription.expire,
    'profile-status': 'active',
  }

  if (
    Number(subscription.upload) > 0 ||
    Number(subscription.download) > 0 ||
    Number(subscription.total) > 0
  ) {
    configHeaders['subscription-userinfo'] =
      `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
  }

  return configHeaders
}

export function renderConversionResponse(
  input: RenderConversionInput,
): RenderedConversionResponse {
  const {
    formattedProxies,
    subscription,
    userAgent,
    targetOverride,
    clientHeaders,
    customClientRules,
  } = input
  const { isSingBox, isV2rayNG, isBrowser, clientType } = detectClientType(
    userAgent,
    targetOverride,
    clientHeaders,
    customClientRules,
  )

  if (isSingBox) {
    const body = renderSingboxConfig(formattedProxies)
    return {
      body,
      headers: buildResponseHeaders(subscription, true, false),
      clientType,
      configSize: body.length,
    }
  }

  if (isV2rayNG) {
    const body = renderV2raySubscription(formattedProxies)
    return {
      body,
      headers: buildV2rayHeaders(subscription),
      clientType,
      configSize: body.length,
    }
  }

  const yamlConfig = renderClashConfig(formattedProxies)

  if (isBrowser) {
    const jsonConfig = renderSingboxConfig(formattedProxies)
    const rawUris = proxiesToUris(formattedProxies).join('\n')
    const body = renderPreviewHtml(yamlConfig, jsonConfig, {
      subscriptionName: subscription.name,
      nodeCount: formattedProxies.length,
      protocolCounts: countProtocols(formattedProxies),
      rawUris,
      v2rayBase64: renderV2raySubscription(formattedProxies),
    })
    return {
      body,
      headers: buildResponseHeaders(subscription, false, true),
      clientType,
      configSize: yamlConfig.length + jsonConfig.length,
    }
  }

  return {
    body: yamlConfig,
    headers: buildResponseHeaders(subscription, false, false),
    clientType,
    configSize: yamlConfig.length,
  }
}

export function logConfigStats(
  proxies: Proxy[],
  formattedProxies: Proxy[],
  configBody: string,
  clientType: string,
  durationMs: number,
): void {
  logger.info('\n=== 订阅处理完成 ===')
  logger.info('处理结果:')
  logger.info(`  ├─ 客户端类型: ${clientType}`)
  logger.info(`  ├─ 节点总数: ${proxies.length}`)
  logger.info(`  ├─ 有效节点: ${formattedProxies.length}`)
  logger.info(`  ├─ 处理耗时: ${durationMs}ms`)
  logger.info(`  └─ 配置大小: ${formatBytes(configBody.length)}`)
  logger.info('结束时间:', new Date().toLocaleString(), '\n')
}
