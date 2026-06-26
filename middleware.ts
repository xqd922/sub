import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// TODO: 管理面板路由保护
// 后续实现：检查 /admin/* 路由的认证状态
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
