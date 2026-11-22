import type { SystemConfigFlags } from '@/shared/types/admin.types'

export const DEFAULT_SITE_URL = 'https://sub.xqd.pp.ua'

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getSiteUrl(): string {
  return process.env.SITE_URL || DEFAULT_SITE_URL
}

export function getAdminCredentials(): { username?: string; password?: string } {
  return {
    username: process.env.ADMIN_USERNAME || undefined,
    password: process.env.ADMIN_PASSWORD || undefined,
  }
}

export function getSessionSecret(): string {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''
}

export function getRemoteKvConfig(): {
  accountId: string
  namespaceId: string
  apiToken: string
} | null {
  const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || ''
  const namespaceId = process.env.CF_KV_NAMESPACE_ID || process.env.CLOUDFLARE_KV_NAMESPACE_ID || ''
  const apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''

  if (!accountId || !namespaceId || !apiToken) {
    return null
  }

  return { accountId, namespaceId, apiToken }
}

export function getSinkConfig(): { url: string; token: string } | null {
  const url = process.env.SINK_URL || ''
  const token = process.env.SINK_TOKEN || ''
  return url && token ? { url, token } : null
}

export function getBitlyTokens(): string[] {
  const raw = process.env.BITLY_API_TOKEN || ''
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

export function getCuttlyToken(): string | null {
  return process.env.CUTTLY_TOKEN || null
}

export function getPublicConfigFlags(): SystemConfigFlags {
  return {
    adminUsername: Boolean(process.env.ADMIN_USERNAME),
    adminPassword: Boolean(process.env.ADMIN_PASSWORD),
    adminSecret: Boolean(process.env.ADMIN_SECRET),
    sink: Boolean(process.env.SINK_URL && process.env.SINK_TOKEN),
    bitly: Boolean(process.env.BITLY_API_TOKEN),
    cuttly: Boolean(process.env.CUTTLY_TOKEN),
    siteUrl: Boolean(process.env.SITE_URL),
  }
}
