import { NextResponse } from 'next/server'
import { NetService } from '@/features'

export const runtime = 'nodejs'

/**
 * 获取网络统计信息 - 用于监控和调试
 */
export async function GET() {
  try {
    const stats = NetService.getStats()
    
    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * 重置网络统计信息
 */
export async function DELETE() {
  try {
    NetService.resetStats()
    
    return NextResponse.json({
      success: true,
      message: '网络统计已重置'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}