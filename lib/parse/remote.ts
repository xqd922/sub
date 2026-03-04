/**
 * 远程节点获取模块
 * 从远程 URL 获取节点列表，支持单节点和订阅链接
 */

import { parseSubscription } from './subscription'
import { SingleNodeParser } from './node'
import { Proxy } from '../core/types'
import { logger } from '../core/logger'
import { NetService } from '@/features'
import { deduplicateProxies } from '../core/dedup'
import { formatProxies, formatProxiesShort } from '../format/proxy'

/** 支持的单节点协议前缀 */
const SINGLE_NODE_PREFIXES = [
  'ss://', 'vmess://', 'trojan://',
  'vless://', 'hysteria2://', 'hy2://', 'socks://', 'anytls://'
]

/** 支持的订阅链接前缀 */
const SUBSCRIPTION_PREFIXES = ['http://', 'https://']

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

    // 分类处理：单节点和订阅链接
    const singleNodeLines: string[] = []
    const subscriptionLines: string[] = []
    const lineOrder: { type: 'single' | 'sub'; index: number }[] = []

    for (const line of lines) {
      if (SINGLE_NODE_PREFIXES.some(prefix => line.startsWith(prefix))) {
        lineOrder.push({ type: 'single', index: singleNodeLines.length })
        singleNodeLines.push(line)
      } else if (SUBSCRIPTION_PREFIXES.some(prefix => line.startsWith(prefix))) {
        lineOrder.push({ type: 'sub', index: subscriptionLines.length })
        subscriptionLines.push(line)
      }
    }

    // 1. 先解析订阅链接，格式化节点名称（带容错）
    const subscriptionResults: Proxy[][] = []
    const subCounters: Record<string, number> = {}  // 跨订阅共享计数器，保持编号连续
    for (const line of subscriptionLines) {
      try {
        const proxies = await parseSubscription(line)
        // 对订阅节点应用名称格式化，使用共享计数器保持编号连续
        const formatted = formatProxies(proxies, subCounters)
        subscriptionResults.push(formatted)
      } catch (error) {
        logger.warn(`订阅解析失败，跳过: ${line}`, error)
        subscriptionResults.push([])  // 失败时返回空数组
      }
    }
    const subscriptionProxies = subscriptionResults.flat()
    const subNames = new Set(subscriptionProxies.map(p => p.name))
    logger.info(`Gist 订阅节点: ${subscriptionProxies.length} 个（已格式化名称）`)

    // 2. 解析自建单节点（保留原名）
    const singleNodeProxies = await Promise.all(
      singleNodeLines.map(line => parseSingleNode(line))
    )
    const validSingleNodes = singleNodeProxies.filter((p): p is Proxy => p !== null)

    // 3. 检查自建节点名称冲突，冲突时格式化为短格式
    const conflictNodes: Proxy[] = []

    for (const proxy of validSingleNodes) {
      if (subNames.has(proxy.name)) {
        conflictNodes.push(proxy)
      }
    }

    // 格式化冲突的节点（使用短格式：🇭🇰 HK 01）
    const formattedConflictNodes = formatProxiesShort(conflictNodes)
    if (conflictNodes.length > 0) {
      logger.info(`自建节点名称冲突: ${conflictNodes.length} 个，已格式化为短格式`)
    }

    // 合并：无冲突的保持原名，冲突的用格式化后的
    const processedSingleNodes = validSingleNodes.map(proxy => {
      const conflictIndex = conflictNodes.indexOf(proxy)
      if (conflictIndex !== -1) {
        return formattedConflictNodes[conflictIndex]
      }
      return proxy
    })
    logger.info(`Gist 自建节点: ${processedSingleNodes.length} 个`)

    // 4. 按原顺序合并
    const allProxies: Proxy[] = []
    let singleIdx = 0

    for (const item of lineOrder) {
      if (item.type === 'single') {
        if (singleIdx < processedSingleNodes.length) {
          allProxies.push(processedSingleNodes[singleIdx])
          singleIdx++
        }
      } else {
        const subResult = subscriptionResults[item.index]
        if (subResult) {
          allProxies.push(...subResult)
        }
      }
    }

    // 5. 去重（按连接参数，保留先出现的）
    const deduplicated = deduplicateProxies(allProxies, {
      keepStrategy: 'first',
      verbose: true
    })

    logger.info(`Gist 最终节点: ${deduplicated.length} 个`)

    return { proxies: deduplicated, hasSubscriptionUrls }
  } catch (error) {
    logger.error('获取远程节点失败:', error)
    throw error
  }
}

/**
 * 解析单个节点链接
 */
async function parseSingleNode(line: string): Promise<Proxy | null> {
  try {
    // 检查链式代理标记
    const proxyMatch = line.match(/\|(dialer-proxy|detour|chain):\s*(.+?)$/i)
    let dialerProxy = ''
    let cleanLine = line

    if (proxyMatch) {
      const proxyType = proxyMatch[1].toLowerCase()
      dialerProxy = proxyMatch[2].trim()
      cleanLine = line.replace(/\|(dialer-proxy|detour|chain):.+$/i, '')
      logger.info(`节点指定前置代理 (${proxyType}): ${dialerProxy}`)
    }

    const proxy = SingleNodeParser.parse(cleanLine)

    if (proxy && proxyMatch && dialerProxy) {
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

    return proxy
  } catch (error) {
    logger.error(`解析节点失败: ${line}`, error)
    return null
  }
}
