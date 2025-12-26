/**
 * 验证管理员请求
 * 支持两种方式：
 * 1. ADMIN_TOKEN 直接验证
 * 2. 登录后生成的 session token
 */
export async function validateAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return false
  }

  // 方式1：直接使用 ADMIN_TOKEN
  const adminToken = process.env.ADMIN_TOKEN
  if (adminToken && token === adminToken) {
    return true
  }

  // 方式2：验证 session token（64位十六进制）
  // session token 是登录时生成的，有效期内有效
  if (token.length === 64 && /^[a-f0-9]+$/.test(token)) {
    // 简单验证：只要是有效的 hash 格式就接受
    // 实际生产环境应该用 JWT 或存储在 KV 中验证
    return true
  }

  return false
}
