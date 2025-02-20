import { Proxy } from '@/lib/types'

export function generateSingboxConfig(proxies: Proxy[]) {
  // 转换代理节点格式
  const outbounds = proxies.map(proxy => {
    switch (proxy.type) {
      case 'ss':
        return {
          type: 'shadowsocks',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          method: proxy.cipher,
          password: proxy.password
        }
      case 'vmess':
        return {
          type: 'vmess',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          uuid: proxy.uuid,
          security: proxy.cipher || 'auto',
          alter_id: proxy.alterId || 0,
          tls: proxy.tls,
          transport: {
            type: proxy.network,
            path: proxy.wsPath,
            headers: proxy.wsHeaders
          }
        }
      case 'trojan':
        return {
          type: 'trojan',
          tag: proxy.name,
          server: proxy.server,
          server_port: proxy.port,
          password: proxy.password,
          tls: {
            enabled: true,
            server_name: proxy.sni,
            insecure: proxy.skipCertVerify
          }
        }
      default:
        return null
    }
  }).filter(Boolean)

  // 修改 outbounds 数组的使用方式
  const validOutbounds = outbounds.filter((o): o is NonNullable<typeof o> => o !== null)

  // 生成基础配置
  const config = {
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
          geosite: "category-ads-all",
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
          geosite: "cn",
          server: "local"
        }
      ],
      strategy: "prefer_ipv4"
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
        outbounds: ["Auto", ...validOutbounds.map(o => o.tag)],
        default: "Auto"
      },
      {
        type: "urltest",
        tag: "Auto",
        outbounds: validOutbounds.map(o => o.tag),
        url: "https://www.gstatic.com/generate_204",
        interval: 300
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
          geosite: "category-ads-all",
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
          geoip: ["cn", "private"],
          outbound: "direct"
        },
        {
          geosite: "cn",
          outbound: "direct"
        }
      ],
      auto_detect_interface: true
    }
  }

  return config
} 