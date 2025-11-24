import { Proxy, ProxyConfig } from '../core/types'
import yaml from 'js-yaml'
import { logger } from '../core/logger'
import { NetService } from '@/features'
import { VLessProtocol } from './protocols/vless'
import { Hysteria2Protocol } from './protocols/hysteria2'
import { deduplicateProxies } from '../core/dedup'

export async function parseSubscription(url: string, clientUserAgent?: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    // 使用专用的订阅网络请求方法，传递客户端 User-Agent
    const response = await NetService.fetchSubscription(url, clientUserAgent)

    // 检查响应大小，避免内存溢出
    const contentLength = response.headers.get('content-length')
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB 限制

    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error(`订阅文件过大 (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`)
    }

    const text = await response.text()
    if (!text || text.length === 0) {
      throw new Error('订阅内容为空，请检查订阅链接是否正确')
    }

    // 再次检查实际大小
    if (text.length > MAX_SIZE) {
      logger.warn(`订阅文件较大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，处理时间可能较长`)
    }

    // 检测订阅格式
    if (text.includes('proxies:')) {
      return parseYamlSubscription(text)
    }

    return parseBase64Subscription(text)
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('\n=== 订阅解析失败 ===')
    logger.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    logger.error(`处理耗时: ${duration}ms`)
    logger.error('===================\n')
    throw error
  }
}

/**
 * 解析 YAML 格式订阅
 * 优化：使用 safeLoad 提高安全性
 */
function parseYamlSubscription(text: string): Proxy[] {
  const config = yaml.load(text, { schema: yaml.FAILSAFE_SCHEMA }) as ProxyConfig
  const proxies = config.proxies || []

  // 使用统一的去重函数
  return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
}

/**
 * 解析 Base64 格式订阅
 * 优化：批量处理、减少错误日志、使用 Set 跟踪失败
 */
function parseBase64Subscription(text: string): Proxy[] {
  const decodedText = Buffer.from(text, 'base64').toString()
  const lines = decodedText.split('\n')
  const proxies: Proxy[] = []
  let failedCount = 0
  const failedTypes = new Set<string>()

  // 批量解析节点
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue

    try {
      let proxy: Proxy | null = null

      if (line.startsWith('ss://')) {
        proxy = parseSS(line)
      } else if (line.startsWith('vmess://')) {
        proxy = parseVmess(line)
      } else if (line.startsWith('trojan://')) {
        proxy = parseTrojan(line)
      } else if (line.startsWith('vless://')) {
        proxy = parseVless(line)
      } else if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) {
        proxy = parseHysteria2(line)
      }

      if (proxy) {
        proxies.push(proxy)
      }
    } catch (e) {
      failedCount++
      const protocol = line.split('://')[0] || 'unknown'
      failedTypes.add(protocol)

      // 只在调试模式下打印详细错误
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`节点解析失败 [${protocol}]: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  // 汇总失败统计
  if (failedCount > 0) {
    logger.warn(`节点解析完成: 成功 ${proxies.length} 个, 失败 ${failedCount} 个 (协议: ${Array.from(failedTypes).join(', ')})`)
  }

  return proxies
}

/**
 * 解析 VLESS 节点
 */
function parseVless(line: string): Proxy {
  return VLessProtocol.parse(line)
}

/**
 * 解析 Hysteria2 节点
 */
function parseHysteria2(line: string): Proxy {
  return Hysteria2Protocol.parse(line)
}

export function parseSS(line: string): Proxy {
  const url = new URL(line)
  const [method, password] = Buffer.from(url.username, 'base64')
    .toString()
    .split(':')

  return {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'ss',
    server: url.hostname,
    port: parseInt(url.port),
    cipher: method || 'aes-256-gcm',
    password: password || ''
  }
}

export function parseVmess(line: string): Proxy {
  const config = JSON.parse(Buffer.from(line.slice(8), 'base64').toString())
  
  const proxy: Proxy = {
    name: config.ps || `${config.add}:${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid),
    cipher: 'auto',
    tls: config.tls === 'tls',
    network: config.net,
    wsPath: config.path
  }

  if (config.host) {
    proxy.wsHeaders = { Host: config.host }
  }

  return proxy
}

export function parseTrojan(line: string): Proxy {
  const url = new URL(line)
  const params = url.searchParams
  
  const proxy: Proxy = {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    sni: params.get('sni') || url.hostname,
    'skip-cert-verify': params.get('allowInsecure') === '1'
  }

  // 处理传输协议
  const transportType = params.get('type')
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || ''
    }
    if (params.get('mode') === 'gun') {
      proxy['grpc-opts']['grpc-mode'] = 'gun'
    }
  } else if (transportType === 'ws') {
    proxy.network = 'ws'
    proxy['ws-opts'] = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host')! } : {}
    }
  }

  return proxy
} 