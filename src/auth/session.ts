// TODO: 管理面板认证逻辑
// 后续实现：session 验证、token 管理、密码哈希

export interface Session {
  username: string
  expiresAt: number
}

// TODO: 实现 session 创建和验证
export function validateSession(token: string): Session | null {
  return null
}
