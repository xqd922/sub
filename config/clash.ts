import { ClashConfig, Proxy, ProxyGroup } from '@/lib/core/types'

// 生成代理组配置
export function generateProxyGroups(proxies: Proxy[], isAirportSubscription: boolean = true): ProxyGroup[] {
  const proxyNames = proxies.map(proxy => proxy.name);

  // 筛选 HK 节点
  const hkProxies = proxyNames.filter(p => /香港|HK|Hong Kong|HKG/.test(p) && !/家宽|Home/.test(p))

  // 筛选低延迟节点
  const minProxies = proxyNames.filter(p => /0\.[0-3](?:[0-9]*)?/.test(p))

  // 动态构建 Manual 的 proxies 列表
  const manualProxies = ['Auto', 'DIRECT']
  if (hkProxies.length > 0) {
    manualProxies.push('HK')
    // 只有当为机场订阅且有 HK 组和 Min 节点时，才添加 Min 组到 Manual
    if (isAirportSubscription && minProxies.length > 0) manualProxies.push('Min')
  }
  manualProxies.push(...proxyNames)

  // 动态构建 Emby 的 proxies 列表
  const embyProxies = ['Manual', 'DIRECT']
  if (isAirportSubscription && minProxies.length > 0) embyProxies.push('Min')
  embyProxies.push(...proxyNames)

  // 构建代理组数组
  const groups: ProxyGroup[] = [
    {
      name: 'Manual',
      type: 'select',
      proxies: manualProxies
    },
    {
      name: 'Auto',
      type: 'url-test',
      proxies: proxyNames,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    },
    {
      name: 'Emby',
      type: 'select',
      proxies: embyProxies
    },
    {
      name: 'AI',
      type: 'select',
      proxies: ['Manual', ...proxyNames]
    }
  ]

  // 只要存在 HK 节点就添加 HK 代理组
  if (hkProxies.length > 0) {
    groups.push({
      name: 'HK',
      type: 'url-test',
      proxies: hkProxies,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    })
  }

  // 只有为机场订阅且存在低延迟节点时才添加 Min 代理组
  if (isAirportSubscription && minProxies.length > 0) {
    groups.push({
      name: 'Min',
      type: 'url-test',
      proxies: minProxies,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    })
  }

  return groups
}

// 默认配置
export const defaultConfig: ClashConfig = {
  'mixed-port': 7890,
  'allow-lan': true,
  'mode': 'Rule',
  'log-level': 'info',
  'ipv6': true,
  'unified-delay': true,
  'tcp-concurrent': true,
  'keep-alive-idle': 300,
  'keep-alive-interval': 75,
  'find-process-mode': 'strict',
  'external-controller': '[::]:9090',
  'external-ui': 'ui',
  'external-ui-url': 'https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.zip',
  'secret': '',
  'profile': {
    'store-selected': true,
    'store-fake-ip': true
  },
  'sniffer': {
    'enable': true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': true,
    'sniff': {
      'HTTP': { 'ports': [80, '8080-8880'], 'override-destination': true },
      'TLS': { 'ports': [443, 8443] },
      'QUIC': { 'ports': [443, 8443] }
    },
    'skip-domain': ['Mijia Cloud', '+.push.apple.com']
  },
  'dns': {
    'enable': true,
    'ipv6': true,
    'cache-algorithm': 'arc',
    'listen': '[::]:1053',
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'proxy-server-nameserver': ['https://doh.pub/dns-query'],
    'nameserver': ['https://dns.alidns.com/dns-query'],
    'nameserver-policy': {
      '*': 'system',
      '+.arpa': 'system',
      'rule-set:gfw': ['https://dns.google/dns-query#Manual']
    },
    'use-hosts': true,
    'direct-nameserver': ['system'],
    'fake-ip-filter': [
      'rule-set:private',
      '+.market.xiaomi.com',
      'lancache.steamcontent.com',
      '+.edu.cn'
    ]
  },
  'hosts': {
    'dns.alidns.com': ['223.5.5.5', '223.6.6.6'],
    'doh.pub': ['1.12.12.21', '120.53.53.53'],
    'dns.google': ['8.8.8.8', '8.8.4.4']
  },
  'proxies': [],
  'proxy-groups': [],
  'rule-providers': {
    'private': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs',
      'path': './rule_providers/private.mrs',
      'interval': 86400
    },
    'private-ip': {
      'type': 'http',
      'behavior': 'ipcidr',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/private.mrs',
      'path': './rule_providers/private_ip.mrs',
      'interval': 86400
    },
    'ads': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/category-ads-all.mrs',
      'path': './rule_providers/ads.mrs',
      'interval': 86400
    },
    'ai': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://github.com/666OS/rules/raw/release/mihomo/domain/AI.mrs',
      'path': './rule_providers/ai.mrs',
      'interval': 86400
    },
    'telegram': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs',
      'path': './rule_providers/telegram.mrs',
      'interval': 86400
    },
    'telegram-ip': {
      'type': 'http',
      'behavior': 'ipcidr',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
      'path': './rule_providers/telegram_ip.mrs',
      'interval': 86400
    },
    'github': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs',
      'path': './rule_providers/github.mrs',
      'interval': 86400
    },
    'twitter': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.mrs',
      'path': './rule_providers/twitter.mrs',
      'interval': 86400
    },
    'youtube': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs',
      'path': './rule_providers/youtube.mrs',
      'interval': 86400
    },
    'google': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs',
      'path': './rule_providers/google.mrs',
      'interval': 86400
    },
    'gfw': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/gfw.mrs',
      'path': './rule_providers/gfw.mrs',
      'interval': 86400
    },
    'cn': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/YiXuanZX/rules/main/cn-additional-list.mrs',
      'path': './rule_providers/cn.mrs',
      'interval': 86400
    },
    'cn-ip': {
      'type': 'http',
      'behavior': 'ipcidr',
      'format': 'mrs',
      'url': 'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/cnip.mrs',
      'path': './rule_providers/cn_ip.mrs',
      'interval': 86400
    },
    'emby': {
      'type': 'http',
      'behavior': 'domain',
      'format': 'mrs',
      'url': 'https://raw.githubusercontent.com/xqd922/rules/main/emby/emby.mrs',
      'path': './rule_providers/emby.mrs',
      'interval': 86400
    }
  },
  'rules': [
    // 私有网络 - 优先直连
    'RULE-SET,private,DIRECT',
    'RULE-SET,private-ip,DIRECT,no-resolve',

    // 起点读书全部直连
    'PROCESS-NAME,com.qidian.QDReader,DIRECT',

    // 银行 & 支付 - 直连
    'PROCESS-NAME,com.icbc,DIRECT',
    'PROCESS-NAME,com.chinamworld.main,DIRECT',
    'PROCESS-NAME,com.android.bankabc,DIRECT',
    'PROCESS-NAME,com.chinamobile.nbc,DIRECT',
    'PROCESS-NAME,cmb.pb,DIRECT',
    'PROCESS-NAME,com.bankcomm.Bankcomm,DIRECT',
    'PROCESS-NAME,com.eg.android.AlipayGphone,DIRECT',
    'PROCESS-NAME,com.tencent.mm,DIRECT',
    'PROCESS-NAME,com.unionpay,DIRECT',

    // 运营商 - 直连
    'PROCESS-NAME,com.greenpoint.android.mc10086.activity,DIRECT',
    'PROCESS-NAME,com.sinovatech.unicom.ui,DIRECT',
    'PROCESS-NAME,com.ct.client,DIRECT',
    'PROCESS-NAME,com.ai.obc.cbn.app,DIRECT',

    'RULE-SET,ads,REJECT',

    'DOMAIN,1001.pp.ua,DIRECT',
    'DOMAIN,cdn.lilyemby.com,DIRECT',
    'DOMAIN-SUFFIX,gegeselect.hk,DIRECT',
    'DOMAIN-SUFFIX,qwen.ai,DIRECT',
    'IP-CIDR,95.161.76.100/31,REJECT,no-resolve',
    'DOMAIN-SUFFIX,steamcontent.com,DIRECT',
    'DOMAIN,msmp.abchina.com.cn,REJECT',
    'DOMAIN-SUFFIX,sharepoint.com,DIRECT',

    // Emby
    'RULE-SET,emby,Emby',

    // AI Services - 使用 rule-providers
    'RULE-SET,ai,AI',

    // 国际服务 - 使用 rule-providers
    'RULE-SET,telegram,Manual',
    'RULE-SET,telegram-ip,Manual,no-resolve',
    'RULE-SET,github,Manual',
    'RULE-SET,twitter,Manual',
    'AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,youtube)),REJECT',
    'RULE-SET,youtube,Manual',
    'RULE-SET,google,Manual',
    'RULE-SET,gfw,Manual',
    'RULE-SET,cn,DIRECT',
    'RULE-SET,cn-ip,DIRECT,no-resolve',
    'DOMAIN,injections.adguard.org,DIRECT',
    'DOMAIN,local.adguard.org,DIRECT',
    'DOMAIN-SUFFIX,local,DIRECT',
    'DOMAIN-SUFFIX,cn,DIRECT',
    'DOMAIN-KEYWORD,-cn,DIRECT',
    'GEOIP,CN,DIRECT',
    'MATCH,Manual'
  ],
} as const 