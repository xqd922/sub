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
    dns: {
      servers: [
        {
          type: "local",
          tag: "local"
        },
        {
          type: "udp",
          tag: "remote",
          server: "1.1.1.1"
        },
        {
          type: "udp",
          tag: "cn",
          server: "223.5.5.5"
        }
      ],
      rules: [
        {
          rule_set: "geosite-cn",
          server: "cn"
        }
      ],
      final: "remote"
    },
    inbounds: [
      {
        type: "tun",
        tag: "tun-in",
        mtu: 9000,
        address: [
          "172.19.0.1/30",
          "2001:470:f9da:fdfa::1/64"
        ],
        auto_route: true,
        strict_route: true,
        route_exclude_address_set: "geoip-cn",
        stack: "system"
      },
      {
        type: "socks",
        tag: "socks-in",
        listen: "127.0.0.1",
        listen_port: 2333
      },
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: 2334
      }
    ],
    outbounds: [
      {
        type: "direct",
        tag: "DIRECT",
        domain_resolver: "local"
      },
      {
        type: "selector",
        tag: "节点选择",
        outbounds: [
          "自动选择",
          ...validOutbounds.map(o => o.tag)
        ],
        interrupt_exist_connections: true
      },
      {
        type: "urltest",
        tag: "自动选择",
        outbounds: validOutbounds.map(o => o.tag),
        url: "https://www.gstatic.com/generate_204",
        interval: "10m0s",
        tolerance: 50,
        idle_timeout: "30m0s"
      },
      ...validOutbounds
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
          rule_set: "category-ads-all",
          action: "reject"
        },
        {
          ip_is_private: true,
          outbound: "DIRECT"
        },
        {
          clash_mode: "关闭代理",
          outbound: "DIRECT"
        },
        {
          clash_mode: "全局代理",
          outbound: "节点选择"
        },
        {
          rule_set: [
            "geosite-cn",
            "geoip-cn"
          ],
          outbound: "DIRECT"
        }
      ],
      rule_set: [
        {
          type: "remote",
          tag: "geosite-geolocation-!cn",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-!cn.srs",
          download_detour: "节点选择"
        },
        {
          type: "remote",
          tag: "geoip-cn",
          url: "https://raw.githubusercontent.com/Loyalsoldier/geoip/release/srs/cn.srs",
          download_detour: "节点选择"
        },
        {
          type: "remote",
          tag: "geosite-cn",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs",
          download_detour: "节点选择"
        },
        {
          type: "remote",
          tag: "category-ads-all",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs",
          download_detour: "节点选择"
        }
      ],
      final: "节点选择",
      auto_detect_interface: true,
      default_domain_resolver: "remote"
    },
    experimental: {
      cache_file: {
        enabled: true
      },
      clash_api: {
        external_controller: "127.0.0.1:9090",
        default_mode: "海外代理"
      }
    }
  }
} 