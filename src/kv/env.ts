import { getLocalKV, type KVStoreAdapter } from '@/kv/local'

export interface CloudflareEnv {
  LINKS_KV?: KVNamespace
}

export function isLocalDev(): boolean {
  return process.env.NODE_ENV === 'development'
}

export async function getKV(): Promise<KVStoreAdapter | null> {

  if (isLocalDev()) {
    return getLocalKV()
  }

  try {

    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    const env = ctx.env as CloudflareEnv

    return env.LINKS_KV || null
  } catch {

    return getLocalKV()
  }
}