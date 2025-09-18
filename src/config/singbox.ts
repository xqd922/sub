import { Proxy } from '@/lib/types'
import { SingleNodeParser } from '@/lib/singleNode'
import { filterNodes } from '@/lib/nodeUtils'

export function generateSingboxConfig(proxies: Proxy[], shouldFormatNames: boolean = true) {
  // 根据shouldFormatNames参数决定是否进行名称格式化
  const formattedProxies = shouldFormatNames ? filterNodes(proxies) : proxies

  // 直接使用SingleNodeParser.toSingboxOutbound生成出站配置
  const validOutbounds = formattedProxies.map(proxy => SingleNodeParser.toSingboxOutbound(proxy))
    .filter((o): o is NonNullable<typeof o> => o !== null)

  return {
    log: {
      level: "error"
    },
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
          query_type: ["A", "AAAA"],
          rewrite_ttl: 1,
          server: "fakeip"
        },
        {
          clash_mode: "Direct",
          server: "local"
        },
        {
          clash_mode: "Global",
          server: "remote"
        },
        {
          rule_set: "geosite-cn",
          server: "local"
        },
        {
          rule_set: "ext-cn-domain",
          server: "local"
        }
      ],
      strategy: "prefer_ipv4",
      independent_cache: true
    },
    inbounds: [
      {
        type: "tun",
        address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        strict_route: true,
        mtu: 9000,
        endpoint_independent_nat: true,
        auto_route: true
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
        interrupt_exist_connections: false
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
          action: "sniff"
        },
        {
          protocol: "dns",
          action: "hijack-dns"
        },
        {
          action: "resolve",
          strategy: "prefer_ipv4"
        },
        {
          rule_set: ["AdGuardSDNSFilter"],
          action: "reject"
        },
        {
          clash_mode: "Direct",
          outbound: "direct"
        },
        {
          clash_mode: "Global",
          outbound: "Manual"
        },
        {
          rule_set: ["geosite-cn", "ext-cn-domain"],
          outbound: "direct"
        },
        {
          rule_set: "geoip-cn",
          outbound: "direct"
        },
        {
          ip_is_private: true,
          outbound: "direct"
        }
      ],
      final: "Manual",
      auto_detect_interface: true,
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
          tag: "ext-cn-domain",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/xmdhs/cn-domain-list/rule-set/ext-cn-list.srs"
        }
      ]
    },
    experimental: {
      cache_file: {
        enabled: true
      },
      clash_api: {
        external_controller: "127.0.0.1:9090",
        secret: ""
      }
    }
  }
} 