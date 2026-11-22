import type { Proxy } from '@/modules/proxy/proxy.types'
import { logger } from '@/server/logger'

const INFO_NODE_KEYWORDS = [
  '官网',
  '剩余流量',
  '距离下次重置',
  '套餐到期',
  '套餐时间',
  '订阅',
  '过期时间',
  '流量重置',
  '建议',
  '到期',
  '更新',
  '重置',
  '流量',
  'expire',
  'traffic',
] as const

const INVALID_SERVERS = new Set([
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  '1.1.1.1',
  '8.8.8.8',
  '8.8.4.4',
  '114.114.114.114',
  '223.5.5.5',
  '223.6.6.6',
])

const INVALID_SERVER_PATTERNS = [
  /^192\.168\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^fc00:/i,
  /^fe80:/i,
  /^::$/,
  /^example\./i,
  /^test\./i,
  /^localhost$/i,
  /\.local$/i,
  /\.example$/i,
  /\.test$/i,
  /\.invalid$/i,
]

function isInfoNode(proxy: Proxy): boolean {
  const name = proxy.name.toLowerCase()
  return INFO_NODE_KEYWORDS.some((keyword) => name.includes(keyword.toLowerCase()))
}

function isInvalidNode(proxy: Proxy): boolean {
  const server = proxy.server?.trim().toLowerCase()
  if (!server) return true
  if (!proxy.port || proxy.port <= 0 || proxy.port > 65535) return true
  if (INVALID_SERVERS.has(server)) return true
  return INVALID_SERVER_PATTERNS.some((pattern) => pattern.test(server))
}

function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue)
  }
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = canonicalizeValue((value as Record<string, unknown>)[key])
      if (normalized !== undefined) {
        sorted[key] = normalized
      }
    }
    return sorted
  }
  return value
}

function buildProxyDedupeKey(proxy: Proxy): string {
  const { name: _omitted, ...rest } = proxy
  void _omitted
  const normalized: Record<string, unknown> = { ...rest }
  if (Array.isArray(normalized.alpn)) {
    normalized.alpn = [...normalized.alpn].sort()
  }
  return JSON.stringify(canonicalizeValue(normalized))
}

export interface DeduplicateOptions {
  filterInfoNodes?: boolean
  verbose?: boolean
  keepStrategy?: 'shorter' | 'first' | 'last'
}

export function deduplicateProxies(
  proxies: Proxy[],
  options: DeduplicateOptions = {},
): Proxy[] {
  const { filterInfoNodes = true, verbose = true, keepStrategy = 'shorter' } = options

  const seen = new Map<string, Proxy>()
  let infoNodesCount = 0
  let invalidNodesCount = 0
  let duplicateCount = 0

  for (const proxy of proxies) {
    if (!proxy) continue

    if (isInvalidNode(proxy)) {
      invalidNodesCount++
      continue
    }

    if (filterInfoNodes && isInfoNode(proxy)) {
      infoNodesCount++
      continue
    }

    const key = buildProxyDedupeKey(proxy)
    const existing = seen.get(key)

    if (existing) {
      duplicateCount++
      if (keepStrategy === 'shorter' && proxy.name.length < existing.name.length) {
        seen.set(key, proxy)
      } else if (keepStrategy === 'last') {
        seen.set(key, proxy)
      }
    } else {
      seen.set(key, proxy)
    }
  }

  if (verbose && (infoNodesCount > 0 || invalidNodesCount > 0 || duplicateCount > 0)) {
    logger.log('\n节点去重统计:')
    logger.log(`  ├─ 原始节点: ${proxies.length}`)
    if (invalidNodesCount > 0) logger.log(`  ├─ 无效节点: ${invalidNodesCount} (已过滤)`)
    if (infoNodesCount > 0) logger.log(`  ├─ 信息节点: ${infoNodesCount} (已过滤)`)
    if (duplicateCount > 0) logger.log(`  ├─ 重复节点: ${duplicateCount} (已去重)`)
    logger.log(`  └─ 有效节点: ${seen.size}`)
  }

  return Array.from(seen.values())
}
