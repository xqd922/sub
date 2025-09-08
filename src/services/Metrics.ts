interface ApiMetrics {
  requestCount: number
  successCount: number
  errorCount: number
  totalResponseTime: number
  averageResponseTime: number
  errorRate: number
  lastReset: Date
}

interface EndpointStats {
  [endpoint: string]: ApiMetrics
}

interface ErrorStats {
  [errorCode: string]: {
    count: number
    lastOccurred: Date
    samples: Array<{
      timestamp: Date
      userAgent?: string
      url?: string
    }>
  }
}

/**
 * 性能监控服务 - 收集API响应时间和错误率
 */
export class MetricsService {
  private static stats: EndpointStats = {}
  private static errorStats: ErrorStats = {}
  private static readonly MAX_ERROR_SAMPLES = 10

  /**
   * 记录API响应时间
   */
  static recordApiCall(
    endpoint: string, 
    responseTime: number, 
    isSuccess: boolean,
    errorCode?: string
  ): void {
    // 初始化端点统计
    if (!this.stats[endpoint]) {
      this.stats[endpoint] = {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastReset: new Date()
      }
    }

    const stat = this.stats[endpoint]
    
    // 更新基础计数
    stat.requestCount++
    stat.totalResponseTime += responseTime
    stat.averageResponseTime = stat.totalResponseTime / stat.requestCount

    if (isSuccess) {
      stat.successCount++
    } else {
      stat.errorCount++
      
      // 记录错误详情
      if (errorCode) {
        this.recordError(errorCode, endpoint)
      }
    }

    // 更新错误率
    stat.errorRate = (stat.errorCount / stat.requestCount) * 100
  }

  /**
   * 记录错误统计
   */
  static recordError(
    errorCode: string, 
    _endpoint?: string,
    additionalData?: {
      userAgent?: string
      url?: string
    }
  ): void {
    if (!this.errorStats[errorCode]) {
      this.errorStats[errorCode] = {
        count: 0,
        lastOccurred: new Date(),
        samples: []
      }
    }

    const errorStat = this.errorStats[errorCode]
    errorStat.count++
    errorStat.lastOccurred = new Date()

    // 保存错误样本（限制数量）
    const sample: {
      timestamp: Date
      userAgent?: string
      url?: string
    } = {
      timestamp: new Date()
    }
    
    if (additionalData?.userAgent) {
      sample.userAgent = additionalData.userAgent
    }
    if (additionalData?.url) {
      sample.url = additionalData.url
    }
    
    errorStat.samples.push(sample)

    if (errorStat.samples.length > this.MAX_ERROR_SAMPLES) {
      errorStat.samples.shift()
    }
  }

  /**
   * 获取所有统计数据
   */
  static getStats(): {
    endpoints: EndpointStats
    errors: ErrorStats
    summary: {
      totalRequests: number
      totalErrors: number
      overallErrorRate: number
      uptime: string
    }
  } {
    const totalRequests = Object.values(this.stats).reduce((sum, stat) => sum + stat.requestCount, 0)
    const totalErrors = Object.values(this.stats).reduce((sum, stat) => sum + stat.errorCount, 0)
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

    return {
      endpoints: { ...this.stats },
      errors: { ...this.errorStats },
      summary: {
        totalRequests,
        totalErrors,
        overallErrorRate: Math.round(overallErrorRate * 100) / 100,
        uptime: this.getUptime()
      }
    }
  }

  /**
   * 获取特定端点的统计
   */
  static getEndpointStats(endpoint: string): ApiMetrics | null {
    return this.stats[endpoint] || null
  }

  /**
   * 重置统计数据
   */
  static resetStats(): void {
    this.stats = {}
    this.errorStats = {}
  }

  /**
   * 获取系统运行时间
   */
  private static getUptime(): string {
    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)
    
    return `${hours}h ${minutes}m ${seconds}s`
  }

  /**
   * 获取性能报告
   */
  static getPerformanceReport(): {
    slowestEndpoints: Array<{ endpoint: string; avgTime: number }>
    mostErrors: Array<{ endpoint: string; errorRate: number }>
    topErrors: Array<{ code: string; count: number }>
  } {
    // 最慢的端点
    const slowestEndpoints = Object.entries(this.stats)
      .map(([endpoint, stat]) => ({ endpoint, avgTime: stat.averageResponseTime }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5)

    // 错误率最高的端点
    const mostErrors = Object.values(this.stats)
      .filter(stat => stat.requestCount > 0)
      .map(stat => {
        const endpoint = Object.keys(this.stats).find(key => this.stats[key] === stat) || 'unknown'
        return { endpoint, errorRate: stat.errorRate }
      })
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)

    // 最频繁的错误
    const topErrors = Object.entries(this.errorStats)
      .map(([code, stat]) => ({ code, count: stat.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      slowestEndpoints,
      mostErrors,
      topErrors
    }
  }
}