import { isProxyUri, parseProxyUri } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { deduplicateProxies } from '@/modules/subscription/proxy-dedup'
import { formatProxyNames } from '@/modules/subscription/proxy-namer'
import { parseSubscriptionResponse } from '@/modules/subscription/subscription.parser'
import { fetchWithRetry } from '@/server/http/fetch.client'
import { logger } from '@/server/logger/logger'

const HTTP_PREFIXES = ['http://', 'https://'] as const
const CHAIN_SUFFIX_RE = /\|(dialer-proxy|detour|chain):\s*(.+?)$/i

function parseSingleRemoteNode(line: string): Proxy | null {
  try {
    const chainMatch = line.match(CHAIN_SUFFIX_RE)
    let cleanLine = line
    let chainType = ''
    let chainTarget = ''

    if (chainMatch) {
      chainType = chainMatch[1].toLowerCase()
      chainTarget = chainMatch[2].trim()
      cleanLine = line.replace(CHAIN_SUFFIX_RE, '')
      logger.info(`节点指定前置代理 (${chainType}): ${chainTarget}`)
    }

    const proxy = parseProxyUri(cleanLine)
    if (proxy && chainTarget) {
      if (chainType === 'dialer-proxy') {
        proxy['dialer-proxy'] = chainTarget
      } else if (chainType === 'detour') {
        proxy.detour = chainTarget
      } else if (chainType === 'chain') {
        proxy['dialer-proxy'] = chainTarget
        proxy.detour = chainTarget
      }
    }

    return proxy
  } catch (error) {
    logger.error(`解析节点失败: ${line}`, error)
    return null
  }
}

export async function fetchNodesFromRemote(
  url: string,
  fetchSubscription: (subUrl: string) => Promise<Response>,
): Promise<{ proxies: Proxy[] }> {
  try {
    const response = await fetchWithRetry(url, {
      retries: 2,
      timeoutMs: 15_000,
      rotateUserAgent: true,
      headers: { 'Cache-Control': 'no-cache' },
    })

    const content = await response.text()
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const singleNodeLines: string[] = []
    const subscriptionLines: string[] = []
    const lineOrder: Array<{ type: 'single' | 'sub'; index: number }> = []

    for (const line of lines) {
      if (isProxyUri(line)) {
        lineOrder.push({ type: 'single', index: singleNodeLines.length })
        singleNodeLines.push(line)
      } else if (HTTP_PREFIXES.some((prefix) => line.startsWith(prefix))) {
        lineOrder.push({ type: 'sub', index: subscriptionLines.length })
        subscriptionLines.push(line)
      }
    }

    const subscriptionResults: Proxy[][] = []
    const subCounters: Record<string, number> = {}

    for (const line of subscriptionLines) {
      try {
        const subResponse = await fetchSubscription(line)
        const parsed = await parseSubscriptionResponse(subResponse)
        subscriptionResults.push(formatProxyNames(parsed, subCounters))
      } catch (error) {
        logger.warn(`订阅解析失败，跳过: ${line}`, error)
        subscriptionResults.push([])
      }
    }

    const subscriptionProxies = subscriptionResults.flat()
    const subNames = new Set(subscriptionProxies.map((proxy) => proxy.name))
    logger.info(`Gist 订阅节点: ${subscriptionProxies.length} 个（已格式化名称）`)

    const validSingleNodes = singleNodeLines
      .map(parseSingleRemoteNode)
      .filter((proxy): proxy is Proxy => proxy !== null)

    const conflictNodes = validSingleNodes.filter((proxy) => subNames.has(proxy.name))
    const formattedConflicts = formatProxyNames(conflictNodes)
    if (conflictNodes.length > 0) {
      logger.info(`自建节点名称冲突: ${conflictNodes.length} 个，已重新格式化`)
    }

    const conflictMap = new Map<Proxy, Proxy>()
    conflictNodes.forEach((node, idx) => {
      conflictMap.set(node, formattedConflicts[idx])
    })

    const processedSingleNodes = validSingleNodes.map((proxy) => conflictMap.get(proxy) ?? proxy)
    logger.info(`Gist 自建节点: ${processedSingleNodes.length} 个`)

    const orderedProxies: Proxy[] = []
    let singleIdx = 0

    for (const item of lineOrder) {
      if (item.type === 'single') {
        if (singleIdx < processedSingleNodes.length) {
          orderedProxies.push(processedSingleNodes[singleIdx++])
        }
      } else {
        const subResult = subscriptionResults[item.index]
        if (subResult) orderedProxies.push(...subResult)
      }
    }

    const deduplicated = deduplicateProxies(orderedProxies, {
      keepStrategy: 'first',
      verbose: true,
    })

    logger.info(`Gist 最终节点: ${deduplicated.length} 个`)
    return { proxies: deduplicated }
  } catch (error) {
    logger.error('获取远程节点失败:', error)
    throw error
  }
}
