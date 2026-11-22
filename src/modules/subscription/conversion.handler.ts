import { NextResponse } from 'next/server'
import { isUrlEnabled, logConversion } from '@/modules/record/record.repository'
import {
  formatProxiesIfNeeded,
  shouldFormatNodeNames,
} from '@/modules/subscription/proxy-namer'
import { logConfigStats, renderConversionResponse } from '@/modules/subscription/response.builder'
import {
  logSubscriptionStats,
  processSubscription,
} from '@/modules/subscription/subscription.service'
import { AppError, ErrorCode, ErrorSeverity } from '@/server/app-error'
import { DEFAULT_SITE_URL, getSiteUrl } from '@/server/env.config'
import { reportError } from '@/server/error-handler'
import { logger } from '@/server/logger'
import { getClientIp, getExecutionContext, jsonError } from '@/server/route.utils'
import { isAllowedSubscriptionInput, unwrapConversionUrl } from '@/shared/url.utils'

function classifyConversionError(error: unknown, durationMs: number, url: string): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    if (error.message.includes('AbortError') || error.message.includes('timeout')) {
      return AppError.timeout('请求超时，请稍后重试')
    }
    if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      return AppError.network('网络连接失败，请检查网络状态')
    }
    return AppError.fromUnknown(error, ErrorCode.UNKNOWN_ERROR, 500, { duration: durationMs, url })
  }

  return AppError.fromUnknown(error, ErrorCode.UNKNOWN_ERROR, 500, { duration: durationMs, url })
}

function handleConversionError(
  error: unknown,
  request: Request,
  startedAt: number,
  userAgent: string,
  clientIp: string,
): NextResponse {
  const durationMs = Date.now() - startedAt
  const url = new URL(request.url).searchParams.get('url') || 'unknown'

  const baseError = classifyConversionError(error, durationMs, url)
  const enhanced = baseError.withMetadata({
    duration: durationMs,
    url,
    userAgent: userAgent.slice(0, 200),
    processingTime: `${durationMs}ms`,
  })

  reportError(enhanced, {
    url,
    userAgent,
    clientIp,
    additionalData: { duration: durationMs, processingTime: `${durationMs}ms` },
  })

  return jsonError(enhanced, {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  })
}

export async function handleConversionRequest(request: Request): Promise<NextResponse> {
  const startedAt = Date.now()
  const userAgent = request.headers.get('user-agent') || ''
  const clientIp = getClientIp(request)

  try {
    const requestUrl = new URL(request.url)
    const rawUrl = requestUrl.searchParams.get('url')?.trim()
    const explicitTarget = requestUrl.searchParams.get('target')?.trim() || undefined

    if (!rawUrl) {
      throw AppError.validation('缺少订阅链接参数', 'url')
    }

    // 如果误传入转换器自身链接，自动解包防止自请求循环
    const unwrapped = unwrapConversionUrl(rawUrl)
    const url = unwrapped.subscriptionUrl
    const targetOverride = explicitTarget || unwrapped.target

    if (!isAllowedSubscriptionInput(url)) {
      throw AppError.invalidSubscriptionUrl(url)
    }

    const enabled = await isUrlEnabled(url)
    if (!enabled) {
      throw AppError.validation('该订阅链接已被禁用', 'url')
    }

    const { proxies, subscription } = await processSubscription(url)

    if (proxies.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        '未解析到任何有效代理节点，请检查订阅链接内容',
        422,
        ErrorSeverity.LOW,
      )
    }

    // 原始订阅缺少 profile-web-page-url 时，使用当前转换器域名作为首页
    const configuredSite = getSiteUrl()
    if (
      !subscription.homepage ||
      subscription.homepage === configuredSite ||
      subscription.homepage === DEFAULT_SITE_URL
    ) {
      subscription.homepage = requestUrl.origin
    }

    const formattedProxies = formatProxiesIfNeeded(proxies, shouldFormatNodeNames(url))
    logSubscriptionStats(subscription, proxies)

    const rendered = renderConversionResponse({
      proxies,
      formattedProxies,
      subscription,
      userAgent,
      targetOverride,
    })

    logger.info('\n=== 客户端信息 ===')
    logger.info(`类型: ${rendered.clientType}`)
    logger.info(`User-Agent: ${userAgent}`)
    logger.info('===================\n')

    const response = new NextResponse(rendered.body, { headers: rendered.headers })

    const ctx = await getExecutionContext()
    const recordPromise = logConversion({
      originalUrl: url,
      clientType: rendered.clientType,
      nodeCount: proxies.length,
      clientIp,
      subscriptionName: subscription.name,
    }).catch((err) => {
      logger.warn('记录转换失败:', err)
    })

    if (ctx?.waitUntil) {
      ctx.waitUntil(recordPromise)
    } else {
      await recordPromise
    }

    logConfigStats(
      proxies,
      formattedProxies,
      rendered.body,
      rendered.clientType,
      Date.now() - startedAt,
    )
    return response
  } catch (error: unknown) {
    return handleConversionError(error, request, startedAt, userAgent, clientIp)
  }
}
