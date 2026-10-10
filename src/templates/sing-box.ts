import { Proxy } from '@/protocols/types'
import { proxyToSingboxOutbound } from '@/protocols/index'

type SingboxOutbound = NonNullable<ReturnType<typeof proxyToSingboxOutbound>>

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

    return uniqueTag === outbound.tag
      ? outbound
      : { ...outbound, tag: uniqueTag }
  })

  return uniqueOutbounds.map(outbound => {
    const detour = outbound.detour
    if (typeof detour !== 'string' || RESERVED_OUTBOUND_TAGS.has(detour)) {
      return outbound
    }

    const mappedDetour = firstTagByOriginalTag.get(detour)
    return mappedDetour && mappedDetour !== detour
      ? { ...outbound, detour: mappedDetour }
      : outbound
  })
}

export function generateSingboxConfig(proxies: Proxy[]) {
  const convertedOutbounds = proxies.map(proxy => proxyToSingboxOutbound(proxy))
    .filter((o): o is NonNullable<typeof o> => o !== null)

  if (convertedOutbounds.length === 0) {
    throw new Error('无法生成 sing-box 配置：没有可用的代理节点')
  }

  const validOutbounds = makeOutboundTagsUnique(convertedOutbounds)

  return {
    $schema: "https://sing-box.sagernet.org/schema.json",
    log: {
      disabled: false,
      level: "info",
      output: "box.log",
      timestamp: true
    },
    http_clients: [
      {
        tag: "rule-set-download",
        detour: "Manual"
      }
    ],
    dns: {
      servers: [
        {
          tag: "remote",
          type: "https",
          server: "8.8.8.8",
          detour: "Manual"
        },
        {
          tag: "local",
          type: "https",
          server: "223.5.5.5"
        },
        {
          type: "fakeip",
          tag: "fakeip",
          inet4_range: "198.18.0.0/15",
          inet6_range: "fc00::/18"
        }
      ],
      timeout: "5s",
      rules: [
        {
          rule_set: ["AdGuardSDNSFilter", "chrome-doh"],
          action: "reject"
        },
        {
          query_type: "HTTPS",
          action: "predefined"
        },
        {
          clash_mode: "Direct",
          action: "route",
          server: "local"
        },
        {
          clash_mode: "Global",
          action: "route",
          server: "remote"
        },
        {
          rule_set: "geosite-cn",
          action: "route",
          server: "local"
        },
        {
          rule_set: "ext-cn-domain",
          action: "route",
          server: "local"
        },
        {
          query_type: ["A", "AAAA"],
          action: "route",
          rewrite_ttl: 60,
          server: "fakeip"
        }
      ],
      final: "remote",
      strategy: "prefer_ipv4",
      optimistic: true
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        strict_route: true,
        mtu: 9000,
        auto_route: true,
        endpoint_independent_nat: true
      },
      {
        type: "socks",
        tag: "socks-in",
        listen: "127.0.0.1",
        listen_port: 2333,
        users: []
      },
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: 2334,
        users: []
      }
    ],
    outbounds: [
      ...validOutbounds,
      {
        type: "selector",
        tag: "Manual",
        outbounds: ["Auto", ...validOutbounds.map(o => o.tag)],
        default: "Auto",
        interrupt_exist_connections: true
      },
      {
        type: "urltest",
        tag: "Auto",
        outbounds: validOutbounds.map(o => o.tag),
        url: "https://www.gstatic.com/generate_204",
        interval: "300s",
        tolerance: 50,
        idle_timeout: "30m",
        interrupt_exist_connections: false
      },
      {
        type: "direct",
        tag: "direct"
      }
    ],
    route: {
      rules: [
        {
          // 仅拦截国外 QUIC，国内域名/IP 豁免（B站、抖音等走 QUIC 直连）
          type: "logical",
          mode: "and",
          rules: [
            { network: "udp", port: 443 },
            { invert: true, rule_set: ["geosite-cn", "ext-cn-domain", "geoip-cn"] }
          ],
          action: "reject"
        },
        {
          // Telegram 直连路由，置于 sniff 之前：MTProto 私有协议无法被嗅探，
          // 放在嗅探后会让每条连接白等 sniff timeout
          rule_set: ["telegram", "telegram-ip"],
          action: "route",
          outbound: "Manual"
        },
        {
          action: "sniff",
          timeout: "50ms"
        },
        {
          protocol: "dns",
          action: "hijack-dns"
        },
        {
          rule_set: ["AdGuardSDNSFilter"],
          action: "reject"
        },
        {
          clash_mode: "Direct",
          action: "route",
          outbound: "direct"
        },
        {
          clash_mode: "Global",
          action: "route",
          outbound: "Manual"
        },
        {
          domain: ["speedtest-half.gegeselect.hk"],
          action: "route",
          outbound: "direct"
        },
        {
          domain_suffix: [
            "apple-cdn.net",
            "sharepoint.com"
          ],
          action: "route",
          outbound: "direct"
        },
        {
          rule_set: ["geosite-cn", "ext-cn-domain"],
          action: "route",
          outbound: "direct"
        },
        {
          rule_set: "geoip-cn",
          action: "route",
          outbound: "direct"
        },
        {
          ip_is_private: true,
          action: "route",
          outbound: "direct"
        }
      ],
      final: "Manual",
      auto_detect_interface: true,
      // 规则集与 dashboard 下载走代理（http_clients.rule-set-download）
      default_http_client: "rule-set-download",
      default_domain_resolver: {
        server: "local"
      },
      rule_set: [
        {
          tag: "geoip-cn",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs"
        },
        {
          tag: "geosite-cn",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/xmdhs/sing-geosite/rule-set-Loyalsoldier/geosite-geolocation-cn.srs"
        },
        {
          tag: "AdGuardSDNSFilter",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/xmdhs/sing-box-ruleset/rule-set/AdGuardSDNSFilterSingBox.srs"
        },
        {
          tag: "chrome-doh",
          type: "remote",
          format: "source",
          url: "https://gist.githubusercontent.com/xmdhs/71fc5ff6ef29f5ecaf2c52b8de5c3172/raw/chrome-doh.json"
        },
        {
          tag: "telegram",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/telegram.srs"
        },
        {
          tag: "telegram-ip",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/telegram.srs"
        },
        {
          tag: "ext-cn-domain",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/xmdhs/cn-domain-list/rule-set/ext-cn-list.srs"
        }
      ]
    },
    services: [
      {
        type: "api",
        listen: "127.0.0.1",
        listen_port: 9090,
        secret: "",
        dashboard: {
          enabled: true,
          http_client: "rule-set-download"
        }
      }
    ],
    experimental: {
      cache_file: {
        enabled: true,
        store_fakeip: true,
        store_dns: true
      }
    }
  }
}
