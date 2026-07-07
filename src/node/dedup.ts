import { Proxy } from '@/node/types'
import { logger } from '@/lib/logger'

const INFO_NODE_KEYWORDS = [
  '官网', '剩余流量', '距离下次重置', '套餐到期', '套餐时间', '订阅',
  '过期时间', '流量重置', '建议', '到期', '更新', '重置',
  '流量', 'expire', 'traffic'
] as const

const INVALID_SERVERS = [
  '127.0.0.1', 'localhost', '0.0.0.0', '::1',
  '1.1.1.1', '8.8.8.8', '8.8.4.4',           
  '114.114.114.114', '223.5.5.5', '223.6.6.6' 
] as const

const INVALID_SERVER_PATTERNS = [
  /^192\.168\.\d+\.\d+$/,                      
  /^10\.\d+\.\d+\.\d+$/,                       
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,       
  /^169\.254\.\d+\.\d+$/,                      
  /^fc00:/i, /^fe80:/i, /^::$/,               
  /^example\./i, /^test\./i, /^localhost$/i,  
  /\.local$/i, /\.example$/i, /\.test$/i, /\.invalid$/i
]

function isInfoNode(proxy: Proxy): boolean {
  const name = proxy.name.toLowerCase()
  return INFO_NODE_KEYWORDS.some(keyword => name.includes(keyword.toLowerCase()))
}

function isInvalidNode(proxy: Proxy): boolean {
  const server = proxy.server?.trim().toLowerCase()
  if (!server) return true
  if (!proxy.port || proxy.port <= 0 || proxy.port > 65535) return true
  if (INVALID_SERVERS.some(s => s.toLowerCase() === server)) return true
  if (INVALID_SERVER_PATTERNS.some(pattern => pattern.test(server))) return true
  return false
}

function generateProxyKey(proxy: Proxy): string {
  const base = [proxy.type, proxy.server, String(proxy.port)]
  const common = [
    String(proxy.tls ?? ''),
    String(proxy['skip-cert-verify'] ?? ''),
    String(proxy.udp ?? ''),
    String(proxy.tfo ?? ''),
    proxy['client-fingerprint'] || '',
    normalizeAlpn(proxy.alpn),
  ]

  switch (proxy.type) {
    case 'hysteria2':
      return [...base,
        proxy.password || '',
        proxy.sni || proxy.servername || '',
        proxy.obfs || '',
        proxy['obfs-password'] || '',
        proxy.ports || '', proxy.mport || '',
        String(proxy.up ?? ''), String(proxy.down ?? ''),
        String(proxy.up_mbps ?? ''), String(proxy.down_mbps ?? ''),
        String(proxy.insecure ?? ''),
        ...common,
      ].join(':')

    case 'vless':
      return [...base,
        proxy.uuid || '',
        proxy.flow || '',
        proxy.network || '',
        proxy.servername || proxy.sni || '',
        proxy.encryption || '',
        proxy.fp || '',
        String(proxy.reality ?? ''),
        proxy['reality-opts']?.['public-key'] || '',
        proxy['reality-opts']?.['short-id'] || '',
        proxy['ws-opts']?.path || proxy.path || '',
        proxy['ws-opts']?.headers?.Host || proxy.host || '',
        proxy['grpc-opts']?.['grpc-service-name'] || '',
        proxy['grpc-opts']?.['grpc-mode'] || '',
        ...common,
      ].join(':')

    case 'vmess':
      return [...base,
        proxy.uuid || '',
        String(proxy.alterId ?? 0),
        proxy.cipher || 'auto',
        proxy.network || '',
        proxy.servername || proxy.sni || '',
        proxy.wsPath || proxy['ws-opts']?.path || proxy.path || '',
        proxy.wsHeaders?.Host || proxy['ws-opts']?.headers?.Host || proxy.host || '',
        proxy['grpc-opts']?.['grpc-service-name'] || '',
        proxy['grpc-opts']?.['grpc-mode'] || '',
        ...common,
      ].join(':')

    case 'ss':
      return [...base,
        proxy.cipher || proxy['encrypt-method'] || '',
        proxy.password || '',
        proxy.plugin || '',
        proxy['plugin-opts']?.mode || '',
        proxy['plugin-opts']?.host || '',
        proxy.obfs || '',
        proxy['obfs-host'] || '',
        ...common,
      ].join(':')

    case 'trojan':
      return [...base,
        proxy.password || '',
        proxy.sni || proxy.servername || '',
        proxy.network || '',
        proxy.fp || '',
        proxy['ws-opts']?.path || proxy.path || '',
        proxy['ws-opts']?.headers?.Host || proxy.host || '',
        proxy['grpc-opts']?.['grpc-service-name'] || '',
        proxy['grpc-opts']?.['grpc-mode'] || '',
        ...common,
      ].join(':')

    default:
      return serializeProxy(proxy)
  }
}

function normalizeAlpn(alpn: string[] | string | undefined): string {
  if (!alpn) return ''
  if (Array.isArray(alpn)) return alpn.sort().join(',')
  return alpn
}

function serializeProxy(proxy: Proxy): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, ...rest } = proxy
  return JSON.stringify(rest, Object.keys(rest).sort())
}

export interface DeduplicateOptions {

  filterInfoNodes?: boolean

  verbose?: boolean

  keepStrategy?: 'shorter' | 'first' | 'last'
}

export function deduplicateProxies(
  proxies: Proxy[],
  options: DeduplicateOptions = {}
): Proxy[] {
  const {
    filterInfoNodes = true,
    verbose = true,
    keepStrategy = 'shorter'
  } = options

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

    const key = generateProxyKey(proxy)

    if (seen.has(key)) {
      duplicateCount++
      const existing = seen.get(key)!

      switch (keepStrategy) {
        case 'shorter':
          if (proxy.name.length < existing.name.length) {
            seen.set(key, proxy)
          }
          break
        case 'last':
          seen.set(key, proxy)
          break
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
