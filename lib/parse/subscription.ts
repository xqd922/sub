/**
 * 订阅解析模块
 * 支持 YAML 和 Base64 格式的订阅解析
 */

import { Proxy, ProxyConfig } from '../core/types'
import yaml from 'js-yaml'
import { logger } from '../core/logger'
import { NetService } from '@/features'
import { VLessProtocol } from './protocols/vless'
import { Hysteria2Protocol } from './protocols/hysteria2'
import { deduplicateProxies } from '../core/dedup'

/**
 * 解析订阅链接
 * @param url 订阅链接
 * @param clientUserAgent 客户端 User-Agent
 * @returns 解析后的节点列表
 */
export async function parseSubscription(url: string, clientUserAgent?: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    const response = await NetService.fetchSubscription(url, clientUserAgent)

    // 检查响应大小
    const contentLength = response.headers.get('content-length')
    const MAX_SIZE = 10 * 1024 * 1024

    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error(`订阅文件过大 (${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`)
    }

    const text = await response.text()
    if (!text || text.length === 0) {
      throw new Error('订阅内容为空，请检查订阅链接是否正确')
    }

    if (text.length > MAX_SIZE) {
      logger.warn(`订阅文件较大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，处理时间可能较长`)
    }

    // 根据格式选择解析方法
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

/** 解析 YAML 格式订阅 */
function parseYamlSubscription(text: string): Proxy[] {
  const config = yaml.load(text) as ProxyConfig
  const proxies = config.proxies || []
  return deduplicateProxies(proxies, { keepStrategy: 'shorter' })
}

/** 解析 Base64 格式订阅 */
function parseBase64Subscription(text: string): Proxy[] {
  const decodedText = Buffer.from(text, 'base64').toString()
  const lines = decodedText.split('\n')
  const proxies: Proxy[] = []
  let failedCount = 0
  const failedTypes = new Set<string>()

  for (const line of lines) {
    const trimmed = line?.trim()
    if (!trimmed) continue

    try {
      let proxy: Proxy | null = null

      if (trimmed.startsWith('ss://')) {
        proxy = parseSS(trimmed)
      } else if (trimmed.startsWith('vmess://')) {
        proxy = parseVmess(trimmed)
      } else if (trimmed.startsWith('trojan://')) {
        proxy = parseTrojan(trimmed)
      } else if (trimmed.startsWith('vless://')) {
        proxy = VLessProtocol.parse(trimmed)
      } else if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) {
        proxy = Hysteria2Protocol.parse(trimmed)
      }

      if (proxy) proxies.push(proxy)
    } catch (e) {
      failedCount++
      const protocol = trimmed.split('://')[0] || 'unknown'
      failedTypes.add(protocol)

      if (process.env.NODE_ENV === 'development') {
        logger.debug(`节点解析失败 [${protocol}]: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  if (failedCount > 0) {
    logger.warn(`节点解析完成: 成功 ${proxies.length} 个, 失败 ${failedCount} 个 (协议: ${Array.from(failedTypes).join(', ')})`)
  }

  return proxies
}

/** 解析 Shadowsocks 节点 */
export function parseSS(line: string): Proxy {
  const url = new URL(line)
  const [method, password] = Buffer.from(url.username, 'base64').toString().split(':')

  return {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'ss',
    server: url.hostname,
    port: parseInt(url.port),
    cipher: method || 'aes-256-gcm',
    password: password || ''
  }
}

/** 解析 VMess 节点 */
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

/** 解析 Trojan 节点 */
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

  const transportType = params.get('type')
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = { 'grpc-service-name': params.get('serviceName') || '' }
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
