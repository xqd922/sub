/**
 * Cloudflare 环境接口和 KV 绑定工具
 */
import { getLocalKV, type KVStoreAdapter } from '@/kv/local'

/**
 * Cloudflare 环境接口
 */
export interface CloudflareEnv {
  LINKS_KV?: KVNamespace
}

/**
 * 检查是否为本地开发环境
 */
export function isLocalDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * 获取 KV 绑定
 * 在 Cloudflare Pages 中通过 getRequestContext 获取
 * 在本地开发环境中返回 Mock KV
 */
export async function getKV(): Promise<KVStoreAdapter | null> {
  // 本地开发环境，返回 Mock KV
  if (isLocalDev()) {
    return getLocalKV()
  }

  try {
    // 动态导入，避免在非 CF 环境报错
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as CloudflareEnv
    // Cloudflare KVNamespace satisfies KVStoreAdapter
    return env.LINKS_KV || null
  } catch {
    // 如果无法获取 CF 上下文，回退到本地 Mock
    return getLocalKV()
  }
}
