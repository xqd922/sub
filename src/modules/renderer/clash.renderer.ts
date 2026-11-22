import yaml from 'js-yaml'
import type { Proxy } from '@/modules/proxy/proxy.types'
import { CLASH_BASE_CONFIG } from '@/modules/renderer/clash.rules'
import type { ProxyGroup } from '@/modules/renderer/renderer.types'

const URL_TEST_DEFAULTS = {
  url: 'https://www.gstatic.com/generate_204',
  interval: 300,
  tolerance: 50,
  lazy: true,
} as const

export function buildClashProxyGroups(proxies: Proxy[]): ProxyGroup[] {
  const proxyNames = proxies.map((proxy) => proxy.name)
  const hkProxies = proxyNames.filter((name) => /香港|HK|Hong Kong|HKG/i.test(name))
  const minProxies = proxyNames.filter((name) => /0\.[0-3](?:[0-9]*)?/.test(name))

  const manualProxies = ['Auto', 'DIRECT']
  if (hkProxies.length >= 3) manualProxies.push('HK')
  if (minProxies.length > 0) manualProxies.push('Min')
  manualProxies.push(...proxyNames)

  const embyProxies = ['Manual', 'DIRECT']
  if (minProxies.length > 0) embyProxies.push('Min')
  embyProxies.push(...proxyNames)

  const groups: ProxyGroup[] = [
    {
      name: 'Manual',
      type: 'select',
      proxies: manualProxies,
    },
    {
      name: 'Auto',
      type: 'url-test',
      proxies: proxyNames,
      ...URL_TEST_DEFAULTS,
    },
    {
      name: 'Emby',
      type: 'select',
      proxies: embyProxies,
    },
    {
      name: 'AI',
      type: 'select',
      proxies: ['Manual', ...proxyNames],
    },
  ]

  if (hkProxies.length >= 3) {
    groups.push({
      name: 'HK',
      type: 'url-test',
      proxies: hkProxies,
      ...URL_TEST_DEFAULTS,
    })
  }

  if (minProxies.length > 0) {
    groups.push({
      name: 'Min',
      type: 'url-test',
      proxies: minProxies,
      ...URL_TEST_DEFAULTS,
    })
  }

  return groups
}

export function renderClashConfig(proxies: Proxy[]): string {
  const clashProxies: Proxy[] = proxies.map((proxy) => {
    const { detour: _omitted, ...rest } = proxy
    void _omitted
    if (rest.type === 'socks') {
      return { ...rest, type: 'socks5' } as Proxy
    }
    return rest as Proxy
  })

  const clashConfig = {
    ...CLASH_BASE_CONFIG,
    proxies: clashProxies,
    'proxy-groups': buildClashProxyGroups(clashProxies),
  }

  const dumped = yaml.dump(clashConfig, {
    flowLevel: 2,
    lineWidth: -1,
    indent: 2,
    noRefs: true,
    forceQuotes: false,
    quotingType: '"',
    styles: {
      '!!null': 'lowercase',
    },
  })

  return dumped.replace(/path: ([^,}"'\n]+)/g, (match, value: string) => {
    if (/[?:&]/.test(value) && !value.startsWith('"')) {
      return `path: "${value}"`
    }
    return match
  })
}
