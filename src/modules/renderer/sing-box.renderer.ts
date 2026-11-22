import { proxyToSingboxBundle } from '@/modules/proxy/proxy.registry'
import type { Proxy, SingboxEndpoint, SingboxOutbound } from '@/modules/proxy/proxy.types'
import { SINGBOX_STATIC_SECTIONS } from '@/modules/renderer/sing-box.rules'
import type { CustomRoutingRule } from '@/shared/admin.types'

const RESERVED_OUTBOUND_TAGS = new Set(['Auto', 'Manual', 'direct'])

function allocateUniqueTag(usedTags: Set<string>, baseTag: string): string {
  let candidate = baseTag
  let suffix = 2
  while (usedTags.has(candidate)) {
    candidate = `${baseTag} (${suffix++})`
  }
  usedTags.add(candidate)
  return candidate
}

function remapDetourTag(
  detour: unknown,
  tagMap: Map<string, string>,
): string | undefined {
  if (typeof detour !== 'string' || !detour) return undefined
  if (RESERVED_OUTBOUND_TAGS.has(detour)) return detour
  return tagMap.get(detour) ?? detour
}

function formatSingboxCustomRule(rule: CustomRoutingRule): Record<string, unknown> {
  const matcher =
    rule.type === 'DOMAIN'
      ? { domain: [rule.value] }
      : rule.type === 'DOMAIN-SUFFIX'
        ? { domain_suffix: [rule.value] }
        : rule.type === 'DOMAIN-KEYWORD'
          ? { domain_keyword: [rule.value] }
          : { ip_cidr: [rule.value] }

  if (rule.action === 'REJECT') {
    return { ...matcher, action: 'reject' }
  }
  if (rule.action === 'DIRECT') {
    return { ...matcher, action: 'route', outbound: 'direct' }
  }
  return { ...matcher, action: 'route', outbound: 'Manual' }
}

export function buildSingboxConfig(
  proxies: Proxy[],
  customRoutingRules: CustomRoutingRule[] = [],
) {
  const usedTags = new Set(RESERVED_OUTBOUND_TAGS)
  const firstTagByOriginalTag = new Map<string, string>()

  const userOutbounds: SingboxOutbound[] = []
  const extraOutbounds: SingboxOutbound[] = []
  const endpoints: SingboxEndpoint[] = []
  const selectableTags: string[] = []

  proxies.forEach((proxy, index) => {
    const bundle = proxyToSingboxBundle(proxy)
    if (!bundle) return

    // 先为附属前置出站（例如 shadowtls detour）分配不冲突 tag，并建立局部映射
    const localExtraTagMap = new Map<string, string>()
    if (bundle.extraOutbounds?.length) {
      for (const extra of bundle.extraOutbounds) {
        const originalExtraTag = extra.tag || `Helper ${index + 1}`
        const uniqueExtraTag = allocateUniqueTag(usedTags, originalExtraTag)
        localExtraTagMap.set(originalExtraTag, uniqueExtraTag)
        extraOutbounds.push(
          uniqueExtraTag === extra.tag ? extra : { ...extra, tag: uniqueExtraTag },
        )
      }
    }

    if (bundle.outbound) {
      const originalTag = bundle.outbound.tag || `Proxy ${index + 1}`
      const uniqueTag = allocateUniqueTag(usedTags, originalTag)
      if (!firstTagByOriginalTag.has(originalTag)) {
        firstTagByOriginalTag.set(originalTag, uniqueTag)
      }
      const nextDetour =
        typeof bundle.outbound.detour === 'string'
          ? localExtraTagMap.get(bundle.outbound.detour) ?? bundle.outbound.detour
          : bundle.outbound.detour
      userOutbounds.push({
        ...bundle.outbound,
        tag: uniqueTag,
        ...(nextDetour ? { detour: nextDetour } : {}),
      })
      selectableTags.push(uniqueTag)
    }

    if (bundle.endpoint) {
      const originalTag = bundle.endpoint.tag || `Endpoint ${index + 1}`
      const uniqueTag = allocateUniqueTag(usedTags, originalTag)
      if (!firstTagByOriginalTag.has(originalTag)) {
        firstTagByOriginalTag.set(originalTag, uniqueTag)
      }
      endpoints.push({
        ...bundle.endpoint,
        tag: uniqueTag,
      })
      selectableTags.push(uniqueTag)
    }
  })

  if (selectableTags.length === 0) {
    throw new Error('无法生成 sing-box 配置：没有可用的代理节点')
  }

  // 解析用户出站与附属出站之间引用其他用户节点时的 detour tag 重命名
  const finalizeOutbound = (ob: SingboxOutbound): SingboxOutbound => {
    const mapped = remapDetourTag(ob.detour, firstTagByOriginalTag)
    return mapped && mapped !== ob.detour ? { ...ob, detour: mapped } : ob
  }

  const finalOutbounds = [
    ...userOutbounds.map(finalizeOutbound),
    ...extraOutbounds.map(finalizeOutbound),
  ]

  const finalEndpoints = endpoints.map((ep) => {
    const mapped = remapDetourTag(ep.detour, firstTagByOriginalTag)
    return mapped && mapped !== ep.detour ? { ...ep, detour: mapped } : ep
  })

  const baseRouteRules = SINGBOX_STATIC_SECTIONS.route.rules
  const formattedCustomRules = customRoutingRules.map(formatSingboxCustomRule)
  // 插入到 sniff + hijack-dns 之后，确保域名嗅探生效且自定义规则优先于内置规则
  const hijackIdx = baseRouteRules.findIndex(
    (item) => 'action' in item && item.action === 'hijack-dns',
  )
  const insertAt = hijackIdx >= 0 ? hijackIdx + 1 : 0
  const mergedRouteRules =
    formattedCustomRules.length > 0
      ? [
          ...baseRouteRules.slice(0, insertAt),
          ...formattedCustomRules,
          ...baseRouteRules.slice(insertAt),
        ]
      : baseRouteRules

  return {
    $schema: SINGBOX_STATIC_SECTIONS.$schema,
    log: SINGBOX_STATIC_SECTIONS.log,
    http_clients: SINGBOX_STATIC_SECTIONS.http_clients,
    dns: SINGBOX_STATIC_SECTIONS.dns,
    inbounds: SINGBOX_STATIC_SECTIONS.inbounds,
    ...(finalEndpoints.length > 0 ? { endpoints: finalEndpoints } : {}),
    outbounds: [
      ...finalOutbounds,
      {
        type: 'selector',
        tag: 'Manual',
        outbounds: ['Auto', ...selectableTags],
        default: 'Auto',
        interrupt_exist_connections: true,
      },
      {
        type: 'urltest',
        tag: 'Auto',
        outbounds: selectableTags,
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
    route: {
      ...SINGBOX_STATIC_SECTIONS.route,
      rules: mergedRouteRules,
    },
    services: SINGBOX_STATIC_SECTIONS.services,
    experimental: SINGBOX_STATIC_SECTIONS.experimental,
  }
}

export function renderSingboxConfig(
  proxies: Proxy[],
  customRoutingRules: CustomRoutingRule[] = [],
): string {
  return JSON.stringify(buildSingboxConfig(proxies, customRoutingRules), null, 2)
}
