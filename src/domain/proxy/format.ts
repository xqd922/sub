/**
 * 节点格式化模块
 * 将节点名称格式化为统一格式
 */

import { Proxy } from './types'
import { detectRegion } from './region'

/**
 * 检测节点名称中是否包含 IPv6 标识
 */
function isIPv6Node(name: string): boolean {
  return /ipv6|ip6|v6|双栈/i.test(name)
}

/**
 * 从节点名称中提取倍率
 */
function extractMultiplier(name: string): number | undefined {
  const patterns = [
    /倍率[：:](\d+\.?\d*)/,              // 倍率:1.5、倍率：2
    /[【\[\(](\d+\.?\d*)[xX×][】\]\)]/,  // [2x]、【2x】、(2x)
    /(\d+\.?\d*)[xX×倍]/,                 // 2x、2×、2倍
    /[xX×*](\d+\.?\d*)/,                  // x2、*2
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }

  return undefined
}

/**
 * 格式化单个节点名称
 * @param useShortCode 是否使用短格式（如 HK 而不是 Hong Kong）
 */
function formatProxyName(
  proxy: Proxy,
  counters: Record<string, number>,
  useShortCode: boolean = false
): Proxy {
  // 使用 detectRegion 函数检测地区
  const region = detectRegion(proxy.name)

  if (!region) {
    return proxy
  }

  const { flag, code: countryCode, name: regionName } = region

  // 提取倍率和 IPv6 标识
  const multiplier = extractMultiplier(proxy.name)
  const ipv6 = isIPv6Node(proxy.name)

  let displayName: string
  let counterKey: string

  if (useShortCode) {
    // 短格式：直接使用国家代码 → 🇭🇰 HK 01
    displayName = `${flag} ${countryCode}`
    counterKey = `short-${countryCode}`
  } else {
    // 所有国家统一格式 → 🇯🇵 Japan 01
    displayName = `${flag} ${regionName}`
    counterKey = regionName
  }

  // 使用传入的计数器
  counters[counterKey] = counters[counterKey] || 0
  const num = String(++counters[counterKey]).padStart(2, '0')

  // 拼接后缀标记
  const tags: string[] = []
  if (ipv6) tags.push('IPv6')
  if (multiplier && multiplier !== 1) tags.push(`${multiplier}x`)
  const suffix = tags.length > 0 ? ` [${tags.join('·')}]` : ''

  return {
    ...proxy,
    name: `${displayName} ${num}${suffix}`
  }
}

/**
 * 批量格式化节点名称
 * @param proxies 节点列表
 * @param counters 可选的外部计数器（用于跨批次保持编号连续）
 * @returns 格式化后的节点列表
 */
export function formatProxies(
  proxies: Proxy[],
  counters?: Record<string, number>
): Proxy[] {
  const useCounters = counters || {}
  return proxies.map(proxy => formatProxyName(proxy, useCounters, false))
}

/**
 * 批量格式化节点名称（短格式）
 * 使用国家/地区代码而非全名，如 🇭🇰 HK 01
 * @param proxies 节点列表
 * @param counters 可选的外部计数器
 * @returns 格式化后的节点列表
 */
export function formatProxiesShort(
  proxies: Proxy[],
  counters?: Record<string, number>
): Proxy[] {
  const useCounters = counters || {}
  return proxies.map(proxy => formatProxyName(proxy, useCounters, true))
}
