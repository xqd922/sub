import { Proxy } from '@/types'
import { detectRegion, CITY_MAP, MULTI_CITY_COUNTRIES } from '@/format/region'

function isIPv6Node(name: string): boolean {
  return /ipv6|ip6|v6|双栈/i.test(name)
}

function extractMultiplier(name: string): number | undefined {
  const patterns = [
    /倍率[：:](\d+\.?\d*)/,              
    /[【\[\(](\d+\.?\d*)[xX×][】\]\)]/,  
    /(\d+\.?\d*)[xX×倍]/,                 
    /[xX×*](\d+\.?\d*)/,                  
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }

  return undefined
}

function formatProxyName(
  proxy: Proxy,
  counters: Record<string, number>,
  useShortCode: boolean = false
): Proxy {

  const cityMatch = Object.keys(CITY_MAP).find(key =>
    proxy.name.includes(key)
  )

  const region = detectRegion(proxy.name)

  if (!region) {
    return proxy
  }

  const { flag, code: countryCode, name: regionName } = region
  const isMultiCityCountry = countryCode in MULTI_CITY_COUNTRIES

  const multiplier = extractMultiplier(proxy.name)
  const ipv6 = isIPv6Node(proxy.name)

  let displayName: string
  let counterKey: string

  if (useShortCode) {

    displayName = `${flag} ${countryCode}`
    counterKey = `short-${countryCode}`
  } else {

    displayName = `${flag} ${regionName}`
    counterKey = regionName
  }

  counters[counterKey] = counters[counterKey] || 0
  const num = String(++counters[counterKey]).padStart(2, '0')

  const tags: string[] = []
  if (ipv6) tags.push('IPv6')
  if (multiplier && multiplier !== 1) tags.push(`${multiplier}x`)
  const suffix = tags.length > 0 ? ` [${tags.join('·')}]` : ''

  return {
    ...proxy,
    name: `${displayName} ${num}${suffix}`
  }
}

export function formatProxies(
  proxies: Proxy[],
  counters?: Record<string, number>
): Proxy[] {
  const useCounters = counters || {}
  return proxies.map(proxy => formatProxyName(proxy, useCounters, false))
}