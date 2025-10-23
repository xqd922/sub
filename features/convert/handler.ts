import { NextResponse } from 'next/server'
import { Proxy } from '@/lib/core/types'
import { SubService, SubscriptionInfo } from './processor'
import { ConfigService } from './builder'
import { MetricsService } from '../metrics/metrics'
import { logger } from '@/lib/core/logger'
import { AppError, ErrorCode, ErrorFactory } from '@/lib/error/errors'
import { handleError, createErrorResponse } from '@/lib/error/reporter'

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
      const chainRules = searchParams.get('chain') || '' // 获取链式代理规则

      if (!url) {
        throw AppError.validation('缺少订阅链接参数', 'url', undefined)
      }

      try {
        new URL(url)
      } catch {
        throw ErrorFactory.subscription.invalidUrl(url)
      }

      // 记录链式代理规则
      if (chainRules) {
        logger.info('\n=== 链式代理规则 ===')
        logger.info(`规则: ${chainRules}`)
        logger.info('===================\n')
      }

      // 3. 检测客户端类型
      const { isSingBox, isBrowser, clientType } = ConfigService.detectClientType(userAgent)
      
      logger.info('\n=== 客户端信息 ===')
      logger.info(`类型: ${clientType}`)
      logger.info(`User-Agent: ${userAgent}`)
      logger.info('===================\n')

      // 4. 处理订阅（传递客户端 User-Agent 和链式代理规则）
      const { proxies, subscription, isAirportSubscription } = await SubService.processSubscription(url, userAgent, chainRules)

      // 5. 记录订阅统计信息
      SubService.logSubscriptionStats(subscription, proxies)

      // 6. 格式化节点名称
      const shouldFormat = SubService.shouldFormatNames(url)
      const formattedProxies = SubService.formatProxies(proxies, shouldFormat)

      // 7. 生成配置
      const response = await this.generateResponse(
        proxies,
        formattedProxies,
        subscription,
        isSingBox,
        isBrowser,
        shouldFormat,
        isAirportSubscription  // 传递订阅类型标识
      )

      // 8. 记录处理统计
      const duration = Date.now() - startTime
      ConfigService.logConfigStats(proxies, formattedProxies, '', clientType, duration)

      // 9. 记录性能指标
      MetricsService.recordApiCall('/sub', duration, true)

      // 10. 直接返回结果（移除缓存）
      return response

    } catch (error: unknown) {
      return this.handleError(error, request, startTime, userAgent, clientIp)
    }
  }

  /**
   * 生成响应内容
   */
  private static async generateResponse(
    proxies: Proxy[],
    formattedProxies: Proxy[],
    subscription: SubscriptionInfo,
    isSingBox: boolean,
    isBrowser: boolean,
    shouldFormatNames: boolean,
    isAirportSubscription: boolean  // 新增参数
  ): Promise<NextResponse> {

    if (isSingBox) {
      // Sing-box JSON 配置
      const jsonConfig = ConfigService.generateSingboxConfig(proxies, shouldFormatNames)
      const headers = ConfigService.generateResponseHeaders(subscription, true, false)

      return new NextResponse(jsonConfig, { headers })
    }

    // 生成配置内容（传递订阅类型）
    const yamlConfig = ConfigService.generateClashConfig(formattedProxies, isAirportSubscription)
    const jsonConfig = ConfigService.generateSingboxConfig(proxies, shouldFormatNames)

    if (isBrowser) {
      // 浏览器预览页面
      const html = ConfigService.generatePreviewHtml(yamlConfig, jsonConfig)
      const headers = ConfigService.generateResponseHeaders(subscription, false, true)

      return new NextResponse(html, { headers })
    }

    // Clash YAML 配置
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

    // 记录错误性能指标
    MetricsService.recordApiCall('/sub', duration, false, enhancedError.code)

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