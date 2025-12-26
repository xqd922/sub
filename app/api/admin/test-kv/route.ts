import { NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * GET /api/admin/test-kv - 测试 KV 是否可用
 */
export async function GET() {
  try {
    // 动态导入
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as { LINKS_KV?: KVNamespace }

    if (!env.LINKS_KV) {
      return NextResponse.json({
        success: false,
        error: 'LINKS_KV 未绑定',
        env: Object.keys(env)
      })
    }

    // 测试写入
    const testKey = 'test:kv:check'
    const testValue = { time: Date.now(), test: true }
    await env.LINKS_KV.put(testKey, JSON.stringify(testValue))

    // 测试读取
    const read = await env.LINKS_KV.get(testKey, 'json')

    // 清理
    await env.LINKS_KV.delete(testKey)

    return NextResponse.json({
      success: true,
      message: 'KV 工作正常',
      wrote: testValue,
      read: read
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
