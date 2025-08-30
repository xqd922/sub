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
      level: "info",
      timestamp: true
    },
    dns: {
      servers: [
        {
          tag: "remote",
          address: "https://1.1.1.1/dns-query",
          detour: "Manual"
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
          rule_set: "geosite-category-ads-all",
          server: "block",
          disable_cache: true
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
      strategy: "prefer_ipv4",
      disable_cache: false,
      disable_expire: false
    },
    inbounds: [
      {
        type: "tun",
        mtu: 9000,
        auto_route: true,
        strict_route: true,
        stack: "system",
        sniff: true,
        sniff_override_destination: true,
        domain_strategy: "prefer_ipv4",
        inet4_address: "172.19.0.1/30",
        inet6_address: "2001:470:f9da:fdfa::1/64",
        endpoint_independent_nat: true
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
      ...validOutbounds,
      {
        type: "selector",
        tag: "Manual",
        outbounds: ["Auto",...validOutbounds.map(o => o.tag)],
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
      },
      {
        type: "block",
        tag: "block"
      },
      {
        type: "dns",
        tag: "dns-out"
      }
    ],
    route: {
      rules: [
        {
          rule_set: "geosite-category-ads-all",
          outbound: "block"
        },
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
          outbound: "Manual"
        },
        {
          rule_set: "geoip-cn",
          outbound: "direct"
        },
        {
          ip_is_private: true,
          outbound: "direct"
        },
        {
          rule_set: "geosite-cn",
          outbound: "direct"
        }
      ],
      rule_set: [
        {
          tag: "geosite-category-ads-all",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs"
        },
        {
          tag: "geosite-cn",
          type: "remote", 
          format: "binary",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs"
        },
        {
          tag: "geoip-cn",
          type: "remote",
          format: "binary",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs"
        }
      ],
      auto_detect_interface: true,
      override_android_vpn: true
    },
    experimental: {
      cache_file: {
        enabled: true
      }
    }
  }
} 