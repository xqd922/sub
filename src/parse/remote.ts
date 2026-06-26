import { parseSubscription } from '@/parse/subscription'
import { parseProxyUri } from '@/parse/node'
import { Proxy } from '@/types'
import { logger } from '@/logger'
import { fetchRemoteNodes } from '@/network/client'
import { deduplicateProxies } from '@/dedup'
import { formatProxies } from '@/format/proxy'

const SINGLE_NODE_PREFIXES = [
  'ss://', 'vmess://', 'trojan://',
  'vless://', 'hysteria2://', 'hy2://', 'socks://', 'anytls://'
]

const SUBSCRIPTION_PREFIXES = ['http://', 'https://']

export async function fetchNodesFromRemote(url: string): Promise<{
  proxies: Proxy[]
  hasSubscriptionUrls: boolean
}> {
  try {
    const response = await fetchRemoteNodes(url)

    if (!response.ok) {
      throw new Error(`获取节点信息失败: ${response.status}`)
    }

    const content = await response.text()
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean)

    const hasSubscriptionUrls = lines.some(line =>
      SUBSCRIPTION_PREFIXES.some(prefix => line.startsWith(prefix))
    )

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

    const subscriptionResults: Proxy[][] = []
    const subCounters: Record<string, number> = {}  
    for (const line of subscriptionLines) {
      try {
        const proxies = await parseSubscription(line)

        const formatted = formatProxies(proxies, subCounters)
        subscriptionResults.push(formatted)
      } catch (error) {
        logger.warn(`订阅解析失败，跳过: ${line}`, error)
        subscriptionResults.push([])  
      }
    }
    const subscriptionProxies = subscriptionResults.flat()
    const subNames = new Set(subscriptionProxies.map(p => p.name))
    logger.info(`Gist 订阅节点: ${subscriptionProxies.length} 个（已格式化名称）`)

    const singleNodeProxies = await Promise.all(
      singleNodeLines.map(line => parseSingleNode(line))
    )
    const validSingleNodes = singleNodeProxies.filter((p): p is Proxy => p !== null)

    const conflictNodes: Proxy[] = []

    for (const proxy of validSingleNodes) {
      if (subNames.has(proxy.name)) {
        conflictNodes.push(proxy)
      }
    }

    const formattedConflictNodes = formatProxies(conflictNodes)
    if (conflictNodes.length > 0) {
      logger.info(`自建节点名称冲突: ${conflictNodes.length} 个，已格式化为短格式`)
    }

    const processedSingleNodes = validSingleNodes.map(proxy => {
      const conflictIndex = conflictNodes.indexOf(proxy)
      if (conflictIndex !== -1) {
        return formattedConflictNodes[conflictIndex]
      }
      return proxy
    })
    logger.info(`Gist 自建节点: ${processedSingleNodes.length} 个`)

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

async function parseSingleNode(line: string): Promise<Proxy | null> {
  try {

    const proxyMatch = line.match(/\|(dialer-proxy|detour|chain):\s*(.+?)$/i)
    let dialerProxy = ''
    let cleanLine = line

    if (proxyMatch) {
      const proxyType = proxyMatch[1].toLowerCase()
      dialerProxy = proxyMatch[2].trim()
      cleanLine = line.replace(/\|(dialer-proxy|detour|chain):.+$/i, '')
      logger.info(`节点指定前置代理 (${proxyType}): ${dialerProxy}`)
    }

    const proxy = parseProxyUri(cleanLine)

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