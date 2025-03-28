import { Proxy } from '@/lib/types'
import { convertNodes } from './singnode'

export function generateSingboxConfig(proxies: Proxy[]) {
  const validOutbounds = convertNodes(proxies)

  return {
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
        outbounds: ["Auto",...validOutbounds.map(o => o.tag)],
        default: "Auto"
      },
      {
        type: "urltest",
        tag: "Auto",
        outbounds: validOutbounds.map(o => o.tag),
        url: "https://www.gstatic.com/generate_204",
        interval: "300s"
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
} 