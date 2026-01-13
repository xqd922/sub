/**
 * 生成 session token（基于用户名和密码的固定 hash）
 */
export async function generateSessionToken(): Promise<string | null> {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) return null

  const encoder = new TextEncoder()
  const data = encoder.encode(`${adminUsername}:${adminPassword}:session`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 验证管理员请求
 * 支持两种方式：
 * 1. ADMIN_TOKEN 直接验证
 * 2. 登录后生成的 session token（重新计算 hash 对比）
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

  // 方式2：验证 session token - 重新计算并对比
  const expectedToken = await generateSessionToken()
  if (expectedToken && token === expectedToken) {
    return true
  }

  return false
}
