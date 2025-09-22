import { NextResponse } from 'next/server'
import { MetricsService } from '@/features'
import { logger } from '@/lib/core/logger'

export const runtime = 'nodejs'

/**
 * 获取系统性能指标
 */
export async function GET() {
  try {
    const stats = MetricsService.getStats()
    const report = MetricsService.getPerformanceReport()

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        performanceReport: report,
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: unknown) {
    logger.error('获取性能指标失败:', error)
    
    return NextResponse.json({
      success: false,
      error: '获取性能指标失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * 重置性能统计
 */
export async function DELETE() {
  try {
    MetricsService.resetStats()
    
    return NextResponse.json({
      success: true,
      message: '性能统计已重置',
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    logger.error('重置性能统计失败:', error)
    
    return NextResponse.json({
      success: false,
      error: '重置性能统计失败',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}