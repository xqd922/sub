import { proxyToSingboxOutbound } from '@/modules/proxy/proxy.registry'
import type { Proxy, SingboxOutbound } from '@/modules/proxy/proxy.types'
import { SINGBOX_STATIC_SECTIONS } from '@/modules/renderer/sing-box/sing-box.rules'

const RESERVED_OUTBOUND_TAGS = new Set(['Auto', 'Manual', 'direct'])

function makeOutboundTagsUnique(outbounds: SingboxOutbound[]): SingboxOutbound[] {
  const usedTags = new Set(RESERVED_OUTBOUND_TAGS)
  const firstTagByOriginalTag = new Map<string, string>()

  const uniqueOutbounds = outbounds.map((outbound, index) => {
    const originalTag = outbound.tag || `Proxy ${index + 1}`
    let uniqueTag = originalTag
    let suffix = 2

    while (usedTags.has(uniqueTag)) {
      uniqueTag = `${originalTag} (${suffix++})`
    }

    usedTags.add(uniqueTag)
    if (!firstTagByOriginalTag.has(originalTag)) {
      firstTagByOriginalTag.set(originalTag, uniqueTag)
    }

    return uniqueTag === outbound.tag ? outbound : { ...outbound, tag: uniqueTag }
  })

  return uniqueOutbounds.map((outbound) => {
    const detour = outbound.detour
    if (typeof detour !== 'string' || RESERVED_OUTBOUND_TAGS.has(detour)) {
      return outbound
    }

    const mappedDetour = firstTagByOriginalTag.get(detour)
    return mappedDetour && mappedDetour !== detour ? { ...outbound, detour: mappedDetour } : outbound
  })
}

export function buildSingboxConfig(proxies: Proxy[]) {
  const convertedOutbounds = proxies
    .map((proxy) => proxyToSingboxOutbound(proxy))
    .filter((outbound): outbound is SingboxOutbound => outbound !== null)

  if (convertedOutbounds.length === 0) {
    throw new Error('无法生成 sing-box 配置：没有可用的代理节点')
  }

  const validOutbounds = makeOutboundTagsUnique(convertedOutbounds)
  const outboundTags = validOutbounds.map((outbound) => outbound.tag)

  return {
    $schema: SINGBOX_STATIC_SECTIONS.$schema,
    log: SINGBOX_STATIC_SECTIONS.log,
    http_clients: SINGBOX_STATIC_SECTIONS.http_clients,
    dns: SINGBOX_STATIC_SECTIONS.dns,
    inbounds: SINGBOX_STATIC_SECTIONS.inbounds,
    outbounds: [
      ...validOutbounds,
      {
        type: 'selector',
        tag: 'Manual',
        outbounds: ['Auto', ...outboundTags],
        default: 'Auto',
        interrupt_exist_connections: true,
      },
      {
        type: 'urltest',
        tag: 'Auto',
        outbounds: outboundTags,
        url: 'https://www.gstatic.com/generate_204',
        interval: '300s',
        tolerance: 50,
        idle_timeout: '30m',
        interrupt_exist_connections: false,
      },
      {
        type: 'direct',
        tag: 'direct',
      },
    ],
    route: SINGBOX_STATIC_SECTIONS.route,
    services: SINGBOX_STATIC_SECTIONS.services,
    experimental: SINGBOX_STATIC_SECTIONS.experimental,
  }
}

export function renderSingboxConfig(proxies: Proxy[]): string {
  return JSON.stringify(buildSingboxConfig(proxies), null, 2)
}
