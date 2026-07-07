import { NextResponse } from 'next/server'
import { processSubscription, shouldFormatNames, formatProxies, logSubscriptionStats } from '@/fetch/subscription'
import { renderConversionResponse, logConfigStats } from '@/fetch/response'
import { logger } from '@/lib/logger'
import { AppError, ErrorCode, ErrorFactory } from '@/error/errors'
import { handleError, createErrorResponse } from '@/error/reporter'
import { isUrlEnabled, logConversion } from '@/kv'

async function getExecutionContext(): Promise<ExecutionContext | null> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    return ctx.ctx
  } catch {
    return null
  }
}

async function processError(
  error: unknown,
  request: Request,
  startTime: number,
  userAgent: string,
  clientIp: string
): Promise<NextResponse> {
  const duration = Date.now() - startTime
  const url = new URL(request.url).searchParams.get('url') || 'unknown'

  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    if (error.message.includes('AbortError') || error.message.includes('timeout')) {
      appError = AppError.timeout('请求超时，请稍后重试')
    } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
      appError = AppError.network('网络连接失败，请检查网络状态')
    } else {
      appError = AppError.fromError(error, ErrorCode.UNKNOWN_ERROR, 500, {
        duration,
        url
      })
    }
  } else {
    appError = new AppError(
      ErrorCode.UNKNOWN_ERROR,
      '发生未知错误',
      500,
      undefined,
      { originalError: String(error), duration }
    )
  }

  const enhancedError = new AppError(
    appError.code,
    appError.message,
    appError.statusCode,
    appError.severity,
    {
      ...appError.metadata,
      duration,
      url,
      userAgent: userAgent.substring(0, 200),
      processingTime: `${duration}ms`
    },
    appError.cause
  )

  await handleError(enhancedError, {
    url,
    userAgent,
    clientIp,
    additionalData: {
      duration,
      processingTime: `${duration}ms`
    }
  })

  const { status, body } = createErrorResponse(enhancedError)
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export async function handleRequest(request: Request): Promise<NextResponse> {
  const startTime = Date.now()
  const userAgent = request.headers.get('user-agent') || ''
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

  try {

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      throw AppError.validation('缺少订阅链接参数', 'url', undefined)
    }

    try {
      new URL(url)
    } catch {
      throw ErrorFactory.subscription.invalidUrl(url)
    }

    const isEnabled = await isUrlEnabled(url)
    if (!isEnabled) {
      throw AppError.validation('该订阅链接已被禁用', 'url', undefined)
    }

    const { proxies, subscription, isAirportSubscription } = await processSubscription(url, userAgent)

    // 如果原始订阅没有 profile-web-page-url，用转换器自身地址作为首页
    const requestOrigin = new URL(request.url).origin
    if (!subscription.homepage || subscription.homepage === 'https://sub.xqd.pp.ua') {
      subscription.homepage = requestOrigin
    }

    const shouldFormat = shouldFormatNames(url)
    const formattedProxies = formatProxies(proxies, shouldFormat)

    logSubscriptionStats(subscription, proxies)

    const rendered = renderConversionResponse({
      proxies,
      formattedProxies,
      subscription,
      userAgent,
      isAirportSubscription
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
      subscriptionName: subscription.name
    }).catch(err => {
      logger.warn('记录转换失败:', err)
    })

    if (ctx?.waitUntil) {
      ctx.waitUntil(recordPromise)
    }

    const duration = Date.now() - startTime
    logConfigStats(proxies, formattedProxies, rendered.body, rendered.clientType, duration)

    return response

  } catch (error: unknown) {
    return processError(error, request, startTime, userAgent, clientIp)
  }
}
