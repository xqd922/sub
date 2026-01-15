import { ClashConfig, Proxy } from '@/lib/core/types'

// 生成代理组配置
export function generateProxyGroups(proxies: Proxy[], isAirportSubscription: boolean = true) {
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
  const groups: any[] = [
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
      proxies: ['Manual', 'Auto', 'DIRECT', ...proxyNames]
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
  mode: 'Rule',
  'log-level': 'info',
  ipv6: true,
  'unified-delay': true,
  'tcp-concurrent': true,
  'find-process-mode': 'off',
  'external-controller': '0.0.0.0:9090',
  'external-ui': 'ui',
  'external-ui-url': 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
  secret: '',
  profile: {
    'store-selected': true,
    'store-fake-ip': true
  },
  sniffer: {
    enable: true,
    'force-dns-mapping': true,
    'parse-pure-ip': true,
    'override-destination': false,
    sniff: {
      HTTP: { ports: [80, '8080-8880'], 'override-destination': true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] }
    },
    'skip-domain': ['Mijia Cloud', '+.push.apple.com']
  },
  dns: {
    enable: true,
    ipv6: true,
    'cache-algorithm': 'arc',
    listen: '0.0.0.0:1053',
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'proxy-server-nameserver': ['https://doh.pub/dns-query'],
    nameserver: ['https://dns.alidns.com/dns-query'],
    'nameserver-policy': {
      '*': 'system',
      '+.arpa': 'system',
      'rule-set:gfw': ['https://dns.google/dns-query#Manual']
    },
    'use-hosts': true,
    'fake-ip-filter': [
      '+.market.xiaomi.com',
      'lancache.steamcontent.com'
    ]
  },
  proxies: [],
  'proxy-groups': [],
  'rule-providers': {
    private: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.mrs',
      path: './rule_providers/private.mrs',
      interval: 86400
    },
    ai: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/JohnsonRan/CRules/mihomo/resources/rules/ai.mrs',
      path: './rule_providers/ai.mrs',
      interval: 86400
    },
    telegram: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.mrs',
      path: './rule_providers/telegram.mrs',
      interval: 86400
    },
    'telegram-ip': {
      type: 'http',
      behavior: 'ipcidr',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.mrs',
      path: './rule_providers/telegram_ip.mrs',
      interval: 86400
    },
    github: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/github.mrs',
      path: './rule_providers/github.mrs',
      interval: 86400
    },
    twitter: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/twitter.mrs',
      path: './rule_providers/twitter.mrs',
      interval: 86400
    },
    youtube: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs',
      path: './rule_providers/youtube.mrs',
      interval: 86400
    },
    google: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/google.mrs',
      path: './rule_providers/google.mrs',
      interval: 86400
    },
    gfw: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/gfw.mrs',
      path: './rule_providers/gfw.mrs',
      interval: 86400
    },
    cn: {
      type: 'http',
      behavior: 'domain',
      format: 'mrs',
      url: 'https://raw.githubusercontent.com/YiXuanZX/rules/main/cn-additional-list.mrs',
      path: './rule_providers/cn.mrs',
      interval: 86400
    },
    'cn-ip': {
      type: 'http',
      behavior: 'ipcidr',
      format: 'mrs',
      url: 'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-ruleset/cnip.mrs',
      path: './rule_providers/cn_ip.mrs',
      interval: 86400
    }
  },
  rules: [
    'DOMAIN,1001.pp.ua,DIRECT',
    'DOMAIN-SUFFIX,sudugu.com,DIRECT',
    'DOMAIN,chat.qwen.ai,DIRECT',
    'DOMAIN-KEYWORD,zijieapi,REJECT',
    'IP-CIDR,1.1.1.1/32,Manual,no-resolve',
    'IP-CIDR,8.8.8.8/32,Manual,no-resolve',
    'DOMAIN-SUFFIX,dns.cloudflare.com,Manual',
    'DOMAIN-SUFFIX,sub.xqd.pp.ua,DIRECT',
    'DOMAIN-SUFFIX,douyin.com,DIRECT',
    'DOMAIN,lf3-static.bytednsdoc.com,DIRECT',
    'DOMAIN,v5-dy-o-abtest.zjcdn.com,DIRECT',
    'DOMAIN-SUFFIX,amemv.com,DIRECT',
    'DOMAIN-SUFFIX,douyincdn.com,DIRECT',
    'DOMAIN-SUFFIX,douyinpic.com,DIRECT',
    'DOMAIN-SUFFIX,douyinstatic.com,DIRECT',
    'DOMAIN-SUFFIX,douyinvod.com,DIRECT',
    'DOMAIN-SUFFIX,idouyinvod.com,DIRECT',
    'DOMAIN-SUFFIX,ixigua.com,DIRECT',
    'DOMAIN-SUFFIX,ixiguavideo.com,DIRECT',
    'DOMAIN-SUFFIX,pstatp.com,DIRECT',
    'DOMAIN-SUFFIX,snssdk.com,DIRECT',
    'DOMAIN-SUFFIX,toutiao.com,DIRECT',
    'DOMAIN-SUFFIX,edu.cn,DIRECT',
    'IP-CIDR,95.161.76.100/31,REJECT,no-resolve',
    'DOMAIN-SUFFIX,steamcontent.com,DIRECT',
    'DOMAIN,shanghai.meby.my,DIRECT',
    'DOMAIN-SUFFIX,nodeseek.com,Manual',
    'DOMAIN-SUFFIX,mefun.org,Manual',
    'DOMAIN-SUFFIX,1009.com.cn,DIRECT',
    'DOMAIN,msmp.abchina.com.cn,REJECT',
    'IP-CIDR,192.168.0.0/16,DIRECT',
    'DOMAIN-SUFFIX,msmp.abchina.com.cn,REJECT',
    'DOMAIN-SUFFIX,sharepoint.com,DIRECT',

    // Emby
    'DOMAIN,ll.sdxya.top,DIRECT',
    'DOMAIN-SUFFIX,apple-cdn.net,DIRECT',
    'DOMAIN-SUFFIX,cf.feiyue.lol,Emby',
    'DOMAIN-SUFFIX,jsq.vban.xyz,Emby',
    'DOMAIN-KEYWORD,embyvip,Emby',
    'DOMAIN,cdn.lyrebirdemby.com,Emby',
    'DOMAIN-SUFFIX,emby.tnx.one,Emby',
    'DOMAIN-SUFFIX,misty.cx,Emby',
    'DOMAIN-SUFFIX,jh.reddust.link,Emby',
    'DOMAIN-SUFFIX,tanhuatv.site,Emby',
    'DOMAIN-KEYWORD,pilipiliultra,Emby',
    'DOMAIN-KEYWORD,pilipili,Emby',
    'DOMAIN,sg.886318.xyz,Emby',
    'IP-CIDR,202.189.5.63/32,Emby',
    'DOMAIN,media.micu.hk,Emby',
    'DOMAIN-SUFFIX,mooguu.top,Emby',
    'DOMAIN-SUFFIX,lilyemby.my,Emby',
    'DOMAIN,tv.811861.xyz,Emby',
    'IP-CIDR,207.211.186.139/32,Emby',
    'DOMAIN-SUFFIX,029902.xyz,Emby',
    'DOMAIN-SUFFIX,yhemby.top,Emby',
    'DOMAIN-SUFFIX,alphatvapp.top,Emby',
    'DOMAIN,emby.my,Emby',
    'DOMAIN-SUFFIX,emby.awatv.de,Emby',
    'DOMAIN-SUFFIX,jsq.mooguu.top,Emby',
    'DOMAIN-SUFFIX,sfcj.org,Emby',
    'DOMAIN-KEYWORD,mius,Emby',
    'DOMAIN,embymv.link,Emby',
    'DOMAIN,onatoshi.114514.quest,Emby',
    'DOMAIN,emby.feiniul.lol,Emby',
    'DOMAIN-SUFFIX,tanhuatv.site,Emby',
    'DOMAIN-SUFFIX,hkb-emby.aliz.work,Emby',
    'DOMAIN-SUFFIX,onatoshi.114514.quest,Emby',
    'DOMAIN-SUFFIX,tufei.de,Emby',
    'DOMAIN-SUFFIX,cf.5msky.com,Emby',
    'DOMAIN-SUFFIX,oceancloud.asia,Emby',
    'IP-CIDR,152.53.81.68/32,Emby',
    'DOMAIN,zoxfree.3767483.xyz,Emby',
    'DOMAIN,lite.cn2gias.uk,Emby',
    'DOMAIN,lite.liminalnet.com,Emby',
    'DOMAIN,yezi.my,Emby',
    'DOMAIN-KEYWORD,emby,Emby',

    // AI Services - 使用 rule-providers
    'RULE-SET,ai,AI',

    // 国际服务 - 使用 rule-providers
    'RULE-SET,private,DIRECT',
    'RULE-SET,telegram,Manual',
    'RULE-SET,telegram-ip,Manual,no-resolve',
    'RULE-SET,github,Manual',
    'RULE-SET,twitter,Manual',
    'RULE-SET,youtube,Manual',
    'RULE-SET,google,Manual',
    'RULE-SET,gfw,Manual',
    'RULE-SET,cn,DIRECT',
    'RULE-SET,cn-ip,DIRECT,no-resolve',
    'DOMAIN,injections.adguard.org,DIRECT',
    'DOMAIN,local.adguard.org,DIRECT',
    'DOMAIN-SUFFIX,local,DIRECT',
    'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
    'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
    'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
    'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
    'IP-CIDR,169.254.0.0/16,DIRECT,no-resolve',
    'IP-CIDR,17.0.0.0/8,DIRECT',
    'IP-CIDR,100.64.0.0/10,DIRECT',
    'IP-CIDR,224.0.0.0/4,DIRECT',
    'IP-CIDR6,fe80::/10,DIRECT',
    'DOMAIN-SUFFIX,cn,DIRECT',
    'DOMAIN-KEYWORD,-cn,DIRECT',
    'GEOIP,CN,DIRECT',
    'MATCH,Manual'
  ],
} as const 