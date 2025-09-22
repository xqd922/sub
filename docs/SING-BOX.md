# Sing-box 订阅说明

## 使用方法

### 1. 获取订阅链接
- 在转换后的链接前添加 `/api/sing?url=`
- 例如: `https://sub.example.com/api/sing?url=订阅链接`

### 2. 在 sing-box 中导入
1. 打开 sing-box 客户端
2. 点击右上角 "+" 按钮
3. 选择 "从 URL 导入"
4. 粘贴订阅链接并确认

## 支持协议
- Shadowsocks (SS)
- VMess
- Trojan
- Hysteria2
- VLESS

## 配置说明

### DNS 设置
- 国外域名: Cloudflare (1.1.1.1)
- 国内域名: 阿里 DNS (223.5.5.5)

### 入站端口
- TUN: 系统代理
- SOCKS: 127.0.0.1:2333
- Mixed: 127.0.0.1:2334

### 分流规则
- 国内域名直连
- 国外域名代理
- 广告域名拦截
- DNS 查询分流
- 自动检测网络

### 节点分组
- Manual: 手动选择节点
  - 支持选择: Auto / DIRECT / 所有节点
  - 默认: Auto
- Auto: 自动选择延迟最低节点
  - 测试间隔: 300秒
  - 测试链接: www.gstatic.com/generate_204

### 节点命名格式
- 格式: {国旗} {地区} {序号} | {倍率}
- 示例: 🇭🇰 香港 01 | 0.5x
- 自动添加国旗和序号
- 保留原有倍率信息

## 注意事项
- 建议使用 HTTPS 链接
- 确保订阅链接可以正常访问
- 如遇导入失败，检查原始订阅是否有效
- 配置会自动更新和应用 


2025年6月4日之前版
```json
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
```

2025年6月4日后版 支持singbox 1.10.0版

```json
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
          url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs",
          download_detour: "自动选择"
        },
        {
          type: "remote",
          tag: "geoip-cn",
          format: "binary",
          url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
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
```
后续更新
