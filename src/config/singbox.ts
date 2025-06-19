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
          address: "https://1.1.1.1/dns-query",
          detour: "节点选择"
        },
        {
          tag: "local",
          address: "https://223.5.5.5/dns-query",
          detour: "direct"
        },
        {
          tag: "block",
          address: "rcode://success"
        }
      ],
      rules: [
        {
          outbound: "any",
          server: "local"
        },
        {
          clash_mode: "global",
          server: "remote"
        },
        {
          clash_mode: "direct",
          server: "local"
        },
        {
          rule_set: "geosite-cn",
          server: "local"
        }
      ],
      strategy: "prefer_ipv4"
    },
    inbounds: [
      {
        type: "tun",
        mtu: 9000,
        address: [
          "172.19.0.1/30", 
          "2001:470:f9da:fdfa::1/64"
        ],
        auto_route: true,
        strict_route: true,
        endpoint_independent_nat: true,
        stack: "system",
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4"
      },
      {
        type: "socks",
        tag: "socks-in",
        listen: "127.0.0.1",
        listen_port: 2333,
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4"
      },
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: 2334,
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4"
      }
    ],
    outbounds: [
      {
        type: "selector",
        tag: "节点选择",
        outbounds: [
          "自动选择", 
          ...validOutbounds.map(o => o.tag)
        ],
        default: "自动选择"
      },
      {
        type: "direct",
        tag: "direct"
      },
      {
        type: "block",
        tag: "block"
      },
      {
        type: "dns",
        tag: "dns-out"
      },
      {
        type: "urltest",
        tag: "自动选择",
        outbounds: validOutbounds.map(o => o.tag)
      },
      ...validOutbounds
    ],
    route: {
      rules: [
        {
          protocol: "dns",
          outbound: "dns-out"
        },
        {
          clash_mode: "direct",
          outbound: "direct"
        },
        {
          clash_mode: "global",
          outbound: "节点选择"
        },
        {
          ip_is_private: true,
          outbound: "direct"
        },
        {
          rule_set: [
            "geosite-cn", 
            "geoip-cn"
          ],
          outbound: "direct"
        }
      ],
      rule_set: [
        {
          type: "remote",
          tag: "geosite-cn",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-cn.srs",
          download_detour: "自动选择"
        },
        {
          type: "remote",
          tag: "geoip-cn",
          format: "binary",
          url: "https://cdn.jsdelivr.net/gh/SagerNet/sing-geoip@rule-set/geoip-cn.srs",
          download_detour: "自动选择"
        }
      ],
      auto_detect_interface: true
    },
    experimental: {
      cache_file: {
        enabled: true,
        path: "cache.db",
        cache_id: "cache_db",
        store_fakeip: true
      }
    }
  }
} 