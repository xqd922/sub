import { NextResponse } from 'next/server'
import { CoreService } from '@/features'
import { RecordService } from '@/lib/kv'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /sub/[id] - 通过记录 ID 访问订阅转换
 * 查找记录的原始 URL，然后转发给 CoreService 处理
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params

  try {
    const record = await RecordService.getRecord(id)

    if (!record || record.deleted) {
      return NextResponse.json(
        { error: '订阅记录不存在或已被删除' },
        { status: 404 }
      )
    }

    // 构造带 url 参数的新请求，转发给 CoreService
    const originalUrl = new URL(request.url)
    originalUrl.pathname = '/sub'
    originalUrl.searchParams.set('url', record.originalUrl)

    const newRequest = new Request(originalUrl.toString(), {
      headers: request.headers
    })

    return CoreService.handleRequest(newRequest)
  } catch (error) {
    console.error('通过 ID 访问订阅失败:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
