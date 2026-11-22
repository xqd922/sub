import { isProxyUri } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { detectRegion } from '@/modules/subscription/region.catalog'

const MULTIPLIER_PATTERNS = [
  /倍率[：:](\d+\.?\d*)/,
  /[【[(](\d+\.?\d*)[xX×][】\])]/,
  /(\d+\.?\d*)[xX×倍]/,
  /[xX×*](\d+\.?\d*)/,
] as const

export function isGistUrl(url: string): boolean {
  return url.includes('gist.githubusercontent.com')
}

export function shouldFormatNodeNames(url: string): boolean {
  return !isProxyUri(url) && !isGistUrl(url)
}

function isIPv6Node(name: string): boolean {
  return /ipv6|ip6|v6|双栈/i.test(name)
}

function extractMultiplier(name: string): number | undefined {
  for (const pattern of MULTIPLIER_PATTERNS) {
    const match = name.match(pattern)
    if (match) return parseFloat(match[1])
  }
  return undefined
}

function formatSingleProxyName(
  proxy: Proxy,
  counters: Record<string, number>,
  useShortCode = false,
): Proxy {
  const region = detectRegion(proxy.name)
  if (!region) return proxy

  const { flag, code: countryCode, name: regionName } = region
  const multiplier = extractMultiplier(proxy.name)
  const ipv6 = isIPv6Node(proxy.name)

  const displayName = useShortCode ? `${flag} ${countryCode}` : `${flag} ${regionName}`
  const counterKey = useShortCode ? `short-${countryCode}` : regionName

  counters[counterKey] = (counters[counterKey] || 0) + 1
  const sequence = String(counters[counterKey]).padStart(2, '0')

  const tags: string[] = []
  if (ipv6) tags.push('IPv6')
  if (multiplier && multiplier !== 1) tags.push(`${multiplier}x`)
  const suffix = tags.length > 0 ? ` [${tags.join('·')}]` : ''

  return {
    ...proxy,
    name: `${displayName} ${sequence}${suffix}`,
  }
}

export function formatProxyNames(
  proxies: Proxy[],
  counters: Record<string, number> = {},
): Proxy[] {
  return proxies.map((proxy) => formatSingleProxyName(proxy, counters, false))
}

export function formatProxiesIfNeeded(proxies: Proxy[], shouldFormat: boolean): Proxy[] {
  return shouldFormat ? formatProxyNames(proxies) : [...proxies]
}
