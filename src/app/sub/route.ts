import { CoreService } from '@/services'

export const runtime = 'nodejs'

/**
 * 处理 GET 请求 - 订阅转换主入口
 */
export async function GET(request: Request) {
  return CoreService.handleRequest(request)
}