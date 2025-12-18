import { NextResponse } from 'next/server'
import { Proxy } from '@/lib/core/types'
import { SubService, SubscriptionInfo } from './processor'
import { ConfigService } from './builder'
import { logger } from '@/lib/core/logger'
import { AppError, ErrorCode, ErrorFactory } from '@/lib/error/errors'
import { handleError, createErrorResponse } from '@/lib/error/reporter'

/**
 * 核心请求处理器 - 统一处理所有订阅转换请求
 */
export class CoreService {
  
  /**
   * 处理订阅转换请求的主入口 - 优化并行处理版本
   */
  static async handleRequest(request: Request): Promise<NextResponse> {
    const startTime = Date.now()
    const userAgent = request.headers.get('user-agent') || ''
    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    try {
      // 1. 验证和解析请求参数
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

      // 2. 并行执行客户端检测和日志记录
      const { isSingBox, isV2rayNG, isBrowser, clientType } = ConfigService.detectClientType(userAgent)

      // 异步记录客户端信息（不阻塞主流程）
      Promise.resolve().then(() => {
        logger.info('\n=== 客户端信息 ===')
        logger.info(`类型: ${clientType}`)
        logger.info(`User-Agent: ${userAgent}`)
        logger.info('===================\n')
      })

      // 3. 处理订阅（核心操作，不能并行）
      const { proxies, subscription, isAirportSubscription } = await SubService.processSubscription(url, userAgent)

      // 4. 批量并行处理所有独立操作
      const shouldFormat = SubService.shouldFormatNames(url)

      // 并行处理多个独立任务
      const [formattedProxies] = await Promise.all([
        // 格式化节点名称
        Promise.resolve(SubService.formatProxies(proxies, shouldFormat)),
        // 异步记录订阅统计（不阻塞返回）
        Promise.resolve().then(() => SubService.logSubscriptionStats(subscription, proxies))
      ])

      // 5. 生成配置（已优化并行处理）
      const response = await this.generateResponse(
        proxies,
        formattedProxies,
        subscription,
        isSingBox,
        isV2rayNG,
        isBrowser,
        shouldFormat,
        isAirportSubscription
      )

      // 6. 异步记录处理统计（不阻塞响应返回）
      const duration = Date.now() - startTime
      Promise.resolve().then(() => {
        ConfigService.logConfigStats(proxies, formattedProxies, '', clientType, duration)
      })

      // 7. 立即返回结果
      return response

    } catch (error: unknown) {
      return this.handleError(error, request, startTime, userAgent, clientIp)
    }
  }

  /**
   * 生成响应内容 - 优化并行处理
   */
  private static async generateResponse(
    proxies: Proxy[],
    formattedProxies: Proxy[],
    subscription: SubscriptionInfo,
    isSingBox: boolean,
    isV2rayNG: boolean,
    isBrowser: boolean,
    shouldFormatNames: boolean,
    isAirportSubscription: boolean
  ): Promise<NextResponse> {

    if (isSingBox) {
      // Sing-box JSON 配置 - 并行生成配置和头部
      const [jsonConfig, headers] = await Promise.all([
        Promise.resolve(ConfigService.generateSingboxConfig(proxies, shouldFormatNames)),
        Promise.resolve(ConfigService.generateResponseHeaders(subscription, true, false))
      ])

      return new NextResponse(jsonConfig, { headers })
    }

    if (isV2rayNG) {
      // v2rayNG base64 订阅
      const base64Config = ConfigService.generateV2rayNGConfig(proxies)
      const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
        'profile-update-interval': String(subscription.updateInterval || 24),
        'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
      }
      return new NextResponse(base64Config, { headers })
    }

    // 对于浏览器预览，需要同时生成两种配置 - 并行处理
    if (isBrowser) {
      const [yamlConfig, jsonConfig, headers] = await Promise.all([
        Promise.resolve(ConfigService.generateClashConfig(formattedProxies, isAirportSubscription)),
        Promise.resolve(ConfigService.generateSingboxConfig(proxies, shouldFormatNames)),
        Promise.resolve(ConfigService.generateResponseHeaders(subscription, false, true))
      ])

      const html = ConfigService.generatePreviewHtml(yamlConfig, jsonConfig)
      return new NextResponse(html, { headers })
    }

    // Clash YAML 配置 - 并行生成配置和头部
    const [yamlConfig, headers] = await Promise.all([
      Promise.resolve(ConfigService.generateClashConfig(formattedProxies, isAirportSubscription)),
      Promise.resolve(ConfigService.generateResponseHeaders(subscription, false, false))
    ])

    return new NextResponse(yamlConfig, { headers })
  }

  /**
   * 统一错误处理
   */
  private static async handleError(
    error: unknown,
    request: Request,
    startTime: number,
    userAgent: string,
    clientIp: string
  ): Promise<NextResponse> {
    const duration = Date.now() - startTime
    const url = new URL(request.url).searchParams.get('url') || 'unknown'
    
    let appError: AppError

    // 转换各种错误为 AppError
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

    // 增强错误信息
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

    // 报告错误
    await handleError(enhancedError, {
      url,
      userAgent,
      clientIp,
      additionalData: {
        duration,
        processingTime: `${duration}ms`
      }
    })

    // 返回错误响应
    const { status, body } = createErrorResponse(enhancedError)
    return new NextResponse(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}