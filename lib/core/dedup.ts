import { Proxy } from './types'
import { logger } from './logger'

/**
 * 信息节点过滤关键词
 * 用于过滤机场订阅中的非代理节点（如流量信息、官网链接等）
 */
const INFO_NODE_KEYWORDS = [
  '官网', '剩余流量', '距离下次重置', '套餐到期',
  '订阅', '过期时间', '流量重置', '官网','建议',
  '到期', '更新','重置', '流量', 'expire', 'traffic'
] as const

/**
 * 无效服务器地址
 * 这些地址无法用于代理连接
 */
const INVALID_SERVERS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '::1',
  '1.1.1.1',        // Cloudflare DNS，不是有效代理
  '8.8.8.8',        // Google DNS
  '8.8.4.4',        // Google DNS
  '114.114.114.114', // 国内 DNS
  '223.5.5.5',      // 阿里 DNS
  '223.6.6.6',      // 阿里 DNS
] as const

/**
 * 无效服务器地址正则模式
 */
const INVALID_SERVER_PATTERNS = [
  /^192\.168\.\d+\.\d+$/,    // 私有地址 192.168.x.x
  /^10\.\d+\.\d+\.\d+$/,     // 私有地址 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 私有地址 172.16-31.x.x
  /^169\.254\.\d+\.\d+$/,    // 链路本地地址
  /^fc00:/i,                  // IPv6 私有地址
  /^fe80:/i,                  // IPv6 链路本地地址
  /^::$/,                     // IPv6 未指定地址
  /^example\./i,             // 示例域名
  /^test\./i,                // 测试域名
  /^localhost$/i,            // localhost
  /\.local$/i,               // 本地域名
  /\.example$/i,             // 示例顶级域名
  /\.test$/i,                // 测试顶级域名
  /\.invalid$/i,             // 无效顶级域名
]

/**
 * 检查是否为信息节点
 */
function isInfoNode(proxy: Proxy): boolean {
  const name = proxy.name.toLowerCase()
  return INFO_NODE_KEYWORDS.some(keyword =>
    name.includes(keyword.toLowerCase())
  )
}

/**
 * 检查是否为无效节点（无效服务器地址或端口）
 */
function isInvalidNode(proxy: Proxy): boolean {
  const server = proxy.server?.trim().toLowerCase()

  // 检查服务器是否为空
  if (!server) return true

  // 检查端口是否有效
  if (!proxy.port || proxy.port <= 0 || proxy.port > 65535) return true

  // 检查是否在无效服务器列表中
  if (INVALID_SERVERS.some(s => s.toLowerCase() === server)) return true

  // 检查是否匹配无效模式
  if (INVALID_SERVER_PATTERNS.some(pattern => pattern.test(server))) return true

  return false
}

/**
 * 生成节点唯一标识符
 * 根据协议类型和所有连接相关字段生成，确保完全相同才判定为重复
 */
function generateProxyKey(proxy: Proxy): string {
  // 基础标识：协议类型 + 服务器 + 端口
  const base = [proxy.type, proxy.server, String(proxy.port)]

  // 通用字段（所有协议都可能有）
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
        proxy.ports || '',              // 端口跳跃
        proxy.mport || '',              // 多端口
        String(proxy.up ?? ''),         // 上行带宽
        String(proxy.down ?? ''),       // 下行带宽
        String(proxy.up_mbps ?? ''),
        String(proxy.down_mbps ?? ''),
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
        // Reality 配置
        proxy['reality-opts']?.['public-key'] || '',
        proxy['reality-opts']?.['short-id'] || '',
        // WebSocket 配置
        proxy['ws-opts']?.path || proxy.path || '',
        proxy['ws-opts']?.headers?.Host || proxy.host || '',
        // gRPC 配置
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
        // WebSocket 配置
        proxy.wsPath || proxy['ws-opts']?.path || proxy.path || '',
        proxy.wsHeaders?.Host || proxy['ws-opts']?.headers?.Host || proxy.host || '',
        // gRPC 配置
        proxy['grpc-opts']?.['grpc-service-name'] || '',
        proxy['grpc-opts']?.['grpc-mode'] || '',
        ...common,
      ].join(':')

    case 'ss':
      return [...base,
        proxy.cipher || proxy['encrypt-method'] || '',
        proxy.password || '',
        // 插件配置
        proxy.plugin || '',
        proxy['plugin-opts']?.mode || '',
        proxy['plugin-opts']?.host || '',
        // obfs 配置 (Clash 格式)
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
        // WebSocket 配置
        proxy['ws-opts']?.path || proxy.path || '',
        proxy['ws-opts']?.headers?.Host || proxy.host || '',
        // gRPC 配置
        proxy['grpc-opts']?.['grpc-service-name'] || '',
        proxy['grpc-opts']?.['grpc-mode'] || '',
        ...common,
      ].join(':')

    default:
      // 未知协议：序列化所有字段（排除 name）
      return serializeProxy(proxy)
  }
}

/**
 * 标准化 ALPN 字段
 */
function normalizeAlpn(alpn: string[] | string | undefined): string {
  if (!alpn) return ''
  if (Array.isArray(alpn)) return alpn.sort().join(',')
  return alpn
}

/**
 * 序列化节点（用于未知协议的完整比较）
 */
function serializeProxy(proxy: Proxy): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, ...rest } = proxy
  return JSON.stringify(rest, Object.keys(rest).sort())
}

/**
 * 去重选项
 */
export interface DeduplicateOptions {
  /** 是否过滤信息节点，默认 true */
  filterInfoNodes?: boolean
  /** 是否输出日志，默认 true */
  verbose?: boolean
  /** 重复时的保留策略：'shorter' 保留名称更短的，'first' 保留先出现的，'last' 保留后出现的 */
  keepStrategy?: 'shorter' | 'first' | 'last'
}

/**
 * 去重结果统计
 */
export interface DeduplicateStats {
  /** 原始节点数 */
  original: number
  /** 信息节点数 */
  infoNodes: number
  /** 无效节点数 */
  invalidNodes: number
  /** 重复节点数 */
  duplicates: number
  /** 有效节点数 */
  valid: number
}

/**
 * 节点去重
 * 统一的去重函数，合并了 subscription.ts 和 processor.ts 中的逻辑
 *
 * @param proxies 原始节点列表
 * @param options 去重选项
 * @returns 去重后的节点列表
 */
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

    // 先过滤无效节点（服务器地址、端口无效）
    if (isInvalidNode(proxy)) {
      invalidNodesCount++
      continue
    }

    // 再过滤信息节点（名称包含关键词）
    if (filterInfoNodes && isInfoNode(proxy)) {
      infoNodesCount++
      continue
    }

    const key = generateProxyKey(proxy)

    if (seen.has(key)) {
      duplicateCount++
      const existing = seen.get(key)!

      // 根据策略决定是否替换
      switch (keepStrategy) {
        case 'shorter':
          // 保留名称更短的节点（通常更简洁规范）
          if (proxy.name.length < existing.name.length) {
            seen.set(key, proxy)
          }
          break
        case 'last':
          // 保留后出现的节点
          seen.set(key, proxy)
          break
        case 'first':
        default:
          // 保留先出现的节点，不做任何操作
          break
      }
    } else {
      seen.set(key, proxy)
    }
  }

  // 输出统计日志
  if (verbose && (infoNodesCount > 0 || invalidNodesCount > 0 || duplicateCount > 0)) {
    logger.log('\n节点去重统计:')
    logger.log(`  ├─ 原始节点: ${proxies.length}`)
    if (invalidNodesCount > 0) {
      logger.log(`  ├─ 无效节点: ${invalidNodesCount} (已过滤)`)
    }
    if (infoNodesCount > 0) {
      logger.log(`  ├─ 信息节点: ${infoNodesCount} (已过滤)`)
    }
    if (duplicateCount > 0) {
      logger.log(`  ├─ 重复节点: ${duplicateCount} (已去重)`)
    }
    logger.log(`  └─ 有效节点: ${seen.size}`)
  }

  return Array.from(seen.values())
}

/**
 * 获取去重统计信息（不执行去重）
 */
export function getDeduplicateStats(proxies: Proxy[]): DeduplicateStats {
  const seen = new Set<string>()
  let infoNodes = 0
  let invalidNodes = 0
  let duplicates = 0

  for (const proxy of proxies) {
    if (!proxy) continue

    // 先过滤无效节点
    if (isInvalidNode(proxy)) {
      invalidNodes++
      continue
    }

    // 再过滤信息节点
    if (isInfoNode(proxy)) {
      infoNodes++
      continue
    }

    const key = generateProxyKey(proxy)
    if (seen.has(key)) {
      duplicates++
    } else {
      seen.add(key)
    }
  }

  return {
    original: proxies.length,
    infoNodes,
    invalidNodes,
    duplicates,
    valid: seen.size
  }
}
