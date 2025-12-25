import { NextResponse } from 'next/server'
import { Proxy } from '@/lib/core/types'
import { SubService, SubscriptionInfo } from './processor'
import { ConfigService } from './builder'
import { logger } from '@/lib/core/logger'
import { AppError, ErrorCode, ErrorFactory } from '@/lib/error/errors'
import { handleError, createErrorResponse } from '@/lib/error/reporter'
import { RecordService } from '@/lib/kv'

/**
 * 核心请求处理器 - 统一处理所有订阅转换请求
 */
export class CoreService {
  
  /**
   * 处理订阅转换请求的主入口
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

      // 检查 URL 是否被禁用
      const isEnabled = await RecordService.isUrlEnabled(url)
      if (!isEnabled) {
        throw AppError.validation('该订阅链接已被禁用', 'url', undefined)
      }

      // 2. 检测客户端类型
      const { isSingBox, isV2rayNG, isBrowser, clientType } = ConfigService.detectClientType(userAgent)

      // 记录客户端信息
      logger.info('\n=== 客户端信息 ===')
      logger.info(`类型: ${clientType}`)
      logger.info(`User-Agent: ${userAgent}`)
      logger.info('===================\n')

      // 3. 处理订阅（核心异步操作）
      const { proxies, subscription, isAirportSubscription } = await SubService.processSubscription(url, userAgent)

      // 4. 格式化节点名称（同步操作）
      const shouldFormat = SubService.shouldFormatNames(url)
      const formattedProxies = SubService.formatProxies(proxies, shouldFormat)

      // 记录订阅统计
      SubService.logSubscriptionStats(subscription, proxies)

      // 5. 生成配置并返回响应
      const response = this.generateResponse(
        proxies,
        formattedProxies,
        subscription,
        isSingBox,
        isV2rayNG,
        isBrowser,
        shouldFormat,
        isAirportSubscription
      )

      // 6. 记录转换到 KV（异步，不阻塞响应）
      RecordService.logConversion({
        originalUrl: url,
        clientType,
        nodeCount: proxies.length,
        clientIp
      }).catch(err => {
        logger.warn('记录转换失败:', err)
      })

      // 7. 记录处理统计
      const duration = Date.now() - startTime
      ConfigService.logConfigStats(proxies, formattedProxies, '', clientType, duration)

      return response

    } catch (error: unknown) {
      return this.handleError(error, request, startTime, userAgent, clientIp)
    }
  }

  /**
   * 生成响应内容
   */
  private static generateResponse(
    proxies: Proxy[],
    formattedProxies: Proxy[],
    subscription: SubscriptionInfo,
    isSingBox: boolean,
    isV2rayNG: boolean,
    isBrowser: boolean,
    shouldFormatNames: boolean,
    isAirportSubscription: boolean
  ): NextResponse {

    if (isSingBox) {
      // Sing-box JSON 配置
      const jsonConfig = ConfigService.generateSingboxConfig(proxies, shouldFormatNames)
      const headers = ConfigService.generateResponseHeaders(subscription, true, false)
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

    if (isBrowser) {
      // 浏览器预览，生成两种配置
      const yamlConfig = ConfigService.generateClashConfig(formattedProxies, isAirportSubscription)
      const jsonConfig = ConfigService.generateSingboxConfig(proxies, shouldFormatNames)
      const headers = ConfigService.generateResponseHeaders(subscription, false, true)
      const html = ConfigService.generatePreviewHtml(yamlConfig, jsonConfig)
      return new NextResponse(html, { headers })
    }

    // Clash YAML 配置
    const yamlConfig = ConfigService.generateClashConfig(formattedProxies, isAirportSubscription)
    const headers = ConfigService.generateResponseHeaders(subscription, false, false)
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