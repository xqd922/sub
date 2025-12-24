/**
 * 远程节点获取模块
 * 从远程 URL 获取节点列表，支持单节点和订阅链接
 */

import { parseSubscription } from './subscription'
import { SingleNodeParser } from './node'
import { Proxy } from '../core/types'
import { logger } from '../core/logger'
import { NetService } from '@/features'

/** 支持的单节点协议前缀 */
const SINGLE_NODE_PREFIXES = [
  'ss://', 'vmess://', 'trojan://',
  'vless://', 'hysteria2://', 'hy2://', 'socks://', 'anytls://'
]

/** 支持的订阅链接前缀 */
const SUBSCRIPTION_PREFIXES = ['http://', 'https://']

/**
 * 解析单个节点或订阅链接
 * @param line 节点链接或订阅链接
 * @returns 解析后的节点或节点数组
 */
async function parseNodeOrSubscription(line: string): Promise<Proxy | Proxy[] | null> {
  try {
    // 检查链式代理标记 (|dialer-proxy: / |detour: / |chain:)
    const proxyMatch = line.match(/\|(dialer-proxy|detour|chain):\s*(.+?)$/i)
    let dialerProxy = ''
    let cleanLine = line

    if (proxyMatch) {
      const proxyType = proxyMatch[1].toLowerCase()
      dialerProxy = proxyMatch[2].trim()
      cleanLine = line.replace(/\|(dialer-proxy|detour|chain):.+$/i, '')
      logger.info(`节点指定前置代理 (${proxyType}): ${dialerProxy}`)
    }

    let proxy: Proxy | Proxy[] | null = null

    if (SINGLE_NODE_PREFIXES.some(prefix => cleanLine.startsWith(prefix))) {
      proxy = SingleNodeParser.parse(cleanLine)

      // 添加链式代理字段
      if (proxyMatch && dialerProxy && proxy && !Array.isArray(proxy)) {
        const proxyType = proxyMatch[1].toLowerCase()
        if (proxyType === 'dialer-proxy') {
          proxy['dialer-proxy'] = dialerProxy
        } else if (proxyType === 'detour') {
          proxy['detour'] = dialerProxy
        } else if (proxyType === 'chain') {
          proxy['dialer-proxy'] = dialerProxy
          proxy['detour'] = dialerProxy
        }
      }
    } else if (SUBSCRIPTION_PREFIXES.some(prefix => cleanLine.startsWith(prefix))) {
      proxy = await parseSubscription(cleanLine)
    }

    return proxy
  } catch (error) {
    logger.error(`解析节点失败: ${line}`, error)
    return null
  }
}

/**
 * 从远程 URL 获取节点列表
 * @param url 远程 URL
 * @returns 节点列表和是否包含订阅链接的标识
 */
export async function fetchNodesFromRemote(url: string): Promise<{
  proxies: Proxy[]
  hasSubscriptionUrls: boolean
}> {
  try {
    const response = await NetService.fetchRemoteNodes(url)

    if (!response.ok) {
      throw new Error(`获取节点信息失败: ${response.status}`)
    }

    const content = await response.text()
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean)

    // 检测是否包含订阅链接
    const hasSubscriptionUrls = lines.some(line =>
      SUBSCRIPTION_PREFIXES.some(prefix => line.startsWith(prefix))
    )

    const proxies = await Promise.all(lines.map(parseNodeOrSubscription))

    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item])

    return { proxies: filteredProxies, hasSubscriptionUrls }
  } catch (error) {
    logger.error('获取远程节点失败:', error)
    throw error
  }
}
