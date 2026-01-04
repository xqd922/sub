/**
 * 认证模块
 * 支持两种方式：
 * 1. ADMIN_TOKEN 直接验证（用于 API 调用）
 * 2. Session token 验证（用于登录后的会话）
 */

import { validateSession, refreshSession } from './session'

export * from './session'

/**
 * 验证管理员请求
 */
export async function validateAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return false
  }

  // 方式1：直接使用 ADMIN_TOKEN（用于 API 集成）
  const adminToken = process.env.ADMIN_TOKEN
  if (adminToken && token === adminToken) {
    return true
  }

  // 方式2：验证 session token（从 KV 中验证）
  const session = await validateSession(token)
  if (session) {
    // 自动刷新 session 过期时间（活跃用户保持登录）
    await refreshSession(token)
    return true
  }

  return false
}
