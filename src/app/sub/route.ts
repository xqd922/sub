import { NextResponse } from 'next/server'
import yaml from 'js-yaml'
import { parseSubscription } from '@/lib/parsers'
import type { ClashConfig, Proxy } from '@/lib/types'

export const runtime = 'edge'

// 国家/地区表情映射
const REGION_MAP: Record<string, { flag: string, name: string }> = {
  // 东亚地区
  '香港': { flag: '🇭🇰', name: '香港' },
  'HK': { flag: '🇭🇰', name: '香港' },
  '台湾': { flag: '🇹🇼', name: '台湾' },
  'TW': { flag: '🇹🇼', name: '台湾' },
  '日本': { flag: '🇯🇵', name: '日本' },
  'JP': { flag: '🇯🇵', name: '日本' },
  '韩国': { flag: '🇰🇷', name: '韩国' },
  'KR': { flag: '🇰🇷', name: '韩国' },
  
  // 东南亚地区
  '新加坡': { flag: '🇸🇬', name: '狮城' },
  'SG': { flag: '🇸🇬', name: '狮城' },
  '马来西亚': { flag: '🇲🇾', name: '马来西亚' },
  'MY': { flag: '🇲🇾', name: '马来西亚' },
  '印度尼西亚': { flag: '🇮🇩', name: '印尼' },
  'ID': { flag: '🇮🇩', name: '印度尼西亚' },
  '泰国': { flag: '🇹🇭', name: '泰国' },
  'TH': { flag: '🇹🇭', name: '泰国' },
  '越南': { flag: '🇻🇳', name: '越南' },
  'VN': { flag: '🇻🇳', name: '越南' },
  '菲律宾': { flag: '🇵🇭', name: '菲律宾' },
  'PH': { flag: '🇵🇭', name: '菲律宾' },
  '柬埔寨': { flag: '🇰🇭', name: '柬埔寨' },
  'KH': { flag: '🇰🇭', name: '柬埔寨' },
  
  // 北美地区
  '美国': { flag: '🇺🇸', name: '美国' },
  'US': { flag: '🇺🇸', name: '美国' },
  '加拿大': { flag: '🇨🇦', name: '加拿大' },
  'CA': { flag: '🇨🇦', name: '加拿大' },
  '墨西哥': { flag: '🇲🇽', name: '墨西哥' },
  'MX': { flag: '🇲🇽', name: '墨西哥' },
  
  // 欧洲地区
  '英国': { flag: '🇬🇧', name: '英国' },
  'UK': { flag: '🇬🇧', name: '英国' },
  '德国': { flag: '🇩🇪', name: '德国' },
  'DE': { flag: '🇩🇪', name: '德国' },
  '法国': { flag: '🇫🇷', name: '法国' },
  'FR': { flag: '🇫🇷', name: '法国' },
  '意大利': { flag: '🇮🇹', name: '意大利' },
  'IT': { flag: '🇮🇹', name: '意大利' },
  '西班牙': { flag: '🇪🇸', name: '西班牙' },
  'ES': { flag: '🇪🇸', name: '西班牙' },
  '荷兰': { flag: '🇳🇱', name: '荷兰' },
  'NL': { flag: '🇳🇱', name: '荷兰' },
  '波兰': { flag: '🇵🇱', name: '波兰' },
  'PL': { flag: '🇵🇱', name: '波兰' },
  '俄罗斯': { flag: '🇷🇺', name: '俄罗斯' },
  'RU': { flag: '🇷🇺', name: '俄罗斯' },
  '乌克兰': { flag: '🇺🇦', name: '乌克兰' },
  'UA': { flag: '🇺🇦', name: '乌克兰' },
  '土耳其': { flag: '🇹🇷', name: '土耳其' },
  'TR': { flag: '🇹🇷', name: '土耳其' },
  
  // 大洋洲
  '澳大利亚': { flag: '🇦🇺', name: '澳大利亚' },
  'AU': { flag: '🇦🇺', name: '澳大利亚' },
  '新西兰': { flag: '🇳🇿', name: '新西兰' },
  'NZ': { flag: '🇳🇿', name: '新西兰' },
  
  // 其他地区
  '印度': { flag: '🇮🇳', name: '印度' },
  'IN': { flag: '🇮🇳', name: '印度' },
  '巴西': { flag: '🇧🇷', name: '巴西' },
  'BR': { flag: '🇧🇷', name: '巴西' },
  '阿根廷': { flag: '🇦🇷', name: '阿根廷' },
  'AR': { flag: '🇦🇷', name: '阿根廷' },
  '南非': { flag: '🇿🇦', name: '南非' },
  'ZA': { flag: '🇿🇦', name: '南非' },
  '以色列': { flag: '🇮🇱', name: '以色列' },
  'IL': { flag: '🇮🇱', name: '以色列' },

  // 中亚地区
  '哈萨克斯坦': { flag: '🇰🇿', name: '哈萨克斯坦' },
  'KZ': { flag: '🇰🇿', name: '哈萨克斯坦' },
  '乌兹别克斯坦': { flag: '🇺🇿', name: '乌兹别克斯坦' },
  'UZ': { flag: '🇺🇿', name: '乌兹别克斯坦' },
  '吉尔吉斯斯坦': { flag: '🇰🇬', name: '吉尔吉斯斯坦' },
  'KG': { flag: '🇰🇬', name: '吉尔吉斯斯坦' },

  // 中东地区
  '阿联酋': { flag: '🇦🇪', name: '阿联酋' },
  'AE': { flag: '🇦🇪', name: '阿联酋' },
  '沙特': { flag: '🇸🇦', name: '沙特' },
  'SA': { flag: '🇸🇦', name: '沙特' },
  '卡塔尔': { flag: '🇶🇦', name: '卡塔尔' },
  'QA': { flag: '🇶🇦', name: '卡塔尔' },
  '伊朗': { flag: '🇮🇷', name: '伊朗' },
  'IR': { flag: '🇮🇷', name: '伊朗' },

  // 北欧地区
  '瑞典': { flag: '🇸🇪', name: '瑞典' },
  'SE': { flag: '🇸🇪', name: '瑞典' },
  '挪威': { flag: '🇳🇴', name: '挪威' },
  'NO': { flag: '🇳🇴', name: '挪威' },
  '芬兰': { flag: '🇫🇮', name: '芬兰' },
  'FI': { flag: '🇫🇮', name: '芬兰' },
  '丹麦': { flag: '🇩🇰', name: '丹麦' },
  'DK': { flag: '🇩🇰', name: '丹麦' },
  '冰岛': { flag: '🇮🇸', name: '冰岛' },
  'IS': { flag: '🇮🇸', name: '冰岛' },

  // 南美洲更多国家
  '智利': { flag: '🇨🇱', name: '智利' },
  'CL': { flag: '🇨🇱', name: '智利' },
  '秘鲁': { flag: '🇵🇪', name: '秘鲁' },
  'PE': { flag: '🇵🇪', name: '秘鲁' },
  '哥伦比亚': { flag: '🇨🇴', name: '哥伦比亚' },
  'CO': { flag: '🇨🇴', name: '哥伦比亚' },

  // 非洲更多国家
  '埃及': { flag: '🇪🇬', name: '埃及' },
  'EG': { flag: '🇪🇬', name: '埃及' },
  '摩洛哥': { flag: '🇲🇦', name: '摩洛哥' },
  'MA': { flag: '🇲🇦', name: '摩洛哥' },
  '肯尼亚': { flag: '🇰🇪', name: '肯尼亚' },
  'KE': { flag: '🇰🇪', name: '肯尼亚' },
  // 特殊地区
  '直布罗陀': { flag: '🇬🇮', name: '直布罗陀' },
  'GI': { flag: '🇬🇮', name: '直布罗陀' },
  '摩纳哥': { flag: '🇲🇨', name: '摩纳哥' },
  'MC': { flag: '🇲🇨', name: '摩纳哥' },
  '列支敦士登': { flag: '🇱🇮', name: '列支敦士登' },
  'LI': { flag: '🇱🇮', name: '列支敦士登' },
  '梵蒂冈': { flag: '🇻🇦', name: '梵蒂冈' },
  'VA': { flag: '🇻🇦', name: '梵蒂冈' },

  // 加勒比海地区
  '巴哈马': { flag: '🇧🇸', name: '巴哈马' },
  'BS': { flag: '🇧🇸', name: '巴哈马' },
  '牙买加': { flag: '🇯🇲', name: '牙买加' },
  'JM': { flag: '🇯🇲', name: '牙买加' },
  '巴巴多斯': { flag: '🇧🇧', name: '巴巴多斯' },
  'BB': { flag: '🇧🇧', name: '巴巴多斯' },
  
  // 尼日利亚
  '尼日利亚': { flag: '🇳🇬', name: '尼日利亚' },
  'NG': { flag: '🇳🇬', name: '尼日利亚' },

  // 其他地区
  '澳门': { flag: '🇲🇴', name: '澳门' },
  'MO': { flag: '🇲🇴', name: '澳门' },
  
  // 伊拉克
  '伊拉克': { flag: '🇮🇶', name: '伊拉克' },
  'IQ': { flag: '🇮🇶', name: '伊拉克' }
}

// 在每次请求开始时重置计数器
const counters: Record<string, number> = {}

function formatProxyName(proxy: Proxy): Proxy {
  // 只从原始节点名称中提取地区信息
  const regionMatch = Object.keys(REGION_MAP).find(key => 
    proxy.name.toLowerCase().includes(key.toLowerCase())
  )
  
  // 如果找不到匹配的地区，保持原始名称
  if (!regionMatch) {
    return proxy;
  }
  
  const { flag, name } = REGION_MAP[regionMatch]
  
  // 提取倍率信息
  const multiplierMatch = proxy.name.match(/(\d+\.?\d*)[xX倍]/);
  const multiplier = multiplierMatch ? ` | ${multiplierMatch[1]}x` : '';
  
  // 使用计数器生成序号
  counters[name] = (counters[name] || 0) + 1
  const num = String(counters[name]).padStart(2, '0')
  
  // 组合新名称
  const newName = `${flag} ${name} ${num}${multiplier}`
  
  return {
    ...proxy,
    name: newName.trim()
  }
}

// 获取默认配置
async function getDefaultConfig(): Promise<ClashConfig> {
  return {
    'mixed-port': 7890,
    'allow-lan': true,
    'bind-address': '*',
    mode: 'rule',
    'log-level': 'info',
    ipv6: true,
    'tcp-concurrent': true,
    'external-controller': '127.0.0.1:9090',
    dns: {
      enable: true,
      ipv6: false,
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      'enhanced-mode': 'fake-ip',
      'fake-ip-range': '198.18.0.1/16',
      'use-hosts': true,
      nameserver: ['https://sm2.doh.pub/dns-query', 'https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
      fallback: ['https://doh.dns.sb/dns-query', 'https://dns.cloudflare.com/dns-query', 'https://dns.twnic.tw/dns-query', 'tls://8.8.4.4:853'],
      'fallback-filter': { geoip: true, ipcidr: ['240.0.0.0/4', '0.0.0.0/32'] }
    },
    proxies: [],
    'proxy-groups': [],
    rules: [
      'DOMAIN,blog.xqd.us.kg,DIRECT',
      'DOMAIN-SUFFIX,yushe.org,Manual',
      'DOMAIN-SUFFIX,985211.link,DIRECT',
      'DOMAIN-SUFFIX,edu.cn,DIRECT',
      'IP-CIDR,95.161.76.100/31,REJECT,no-resolve',
      'DOMAIN-SUFFIX,steamcontent.com,DIRECT',
      'DOMAIN,shanghai.meby.my,DIRECT',
      'DOMAIN-SUFFIX,nodeseek.com,Manual',
      'DOMAIN-SUFFIX,mefun.org,Manual',
      'DOMAIN,inside.lyrebirdemby.com,Min',
      'DOMAIN-SUFFIX,misakaf.org,Emby',
      'DOMAIN-SUFFIX,niceduck.me,Emby',
      'DOMAIN-SUFFIX,niceduck.lol,Emby',
      'DOMAIN-KEYWORD,embyvip,Emby',
      'DOMAIN,cdn.lyrebirdemby.com,Emby',
      'DOMAIN-SUFFIX,emby.tnx.one,Emby',
      'DOMAIN-SUFFIX,misty.cx,Emby',
      'DOMAIN-SUFFIX,cc.coemn.com,Emby',
      'DOMAIN-SUFFIX,jh.reddust.link,Emby',
      'DOMAIN-SUFFIX,su.viclub.top,Emby',
      'DOMAIN-SUFFIX,tanhuatv.site,Emby',
      'DOMAIN-SUFFIX,cinema.facmata.net,Emby',
      'DOMAIN-SUFFIX,theater.facmata.net,Emby',
      'DOMAIN-SUFFIX,anime.facmata.net,Emby',
      'DOMAIN,e.niceduck.me,Emby',
      'DOMAIN,cf.niceduck.lol,Emby',
      'DOMAIN,vi.niceduck.lol,Emby',
      'DOMAIN,pilicf.niceduck.lol,Emby',
      'DOMAIN-KEYWORD,pilipili,Emby',
      'DOMAIN,sg.886318.xyz,Emby',
      'DOMAIN,emby.apopcloud.live,Emby',
      'IP-CIDR,202.189.5.63/32,Emby',
      'DOMAIN,media.micu.hk,Emby',
      'DOMAIN-SUFFIX,mooguu.top,Emby',
      'DOMAIN-SUFFIX,lilyya.xyz,Emby',
      'DOMAIN,tv.811861.xyz,Emby',
      'IP-CIDR,207.211.186.139/32,Emby',
      'DOMAIN-SUFFIX,029902.xyz,Emby',
      'DOMAIN,581658.best,Emby',
      'DOMAIN-SUFFIX,nanflix.net,Emby',
      'DOMAIN-SUFFIX,alphatvapp.top,Emby',
      'DOMAIN,emby.my,Emby',
      'DOMAIN,cfemby.lilyya.xyz,Emby',
      'DOMAIN-SUFFIX,emby.awatv.de,Emby',
      'DOMAIN-SUFFIX,jsq.mooguu.top,Emby',
      'DOMAIN-SUFFIX,sfcj.org,Emby',
      'DOMAIN-KEYWORD,mius,Emby',
      'DOMAIN,embymv.link,Emby',
      'DOMAIN-KEYWORD,emby,Emby',
      'DOMAIN-SUFFIX,services.googleapis.cn,Manual',
      'DOMAIN-SUFFIX,xn--ngstr-lra8j.com,Manual',
      'DOMAIN,safebrowsing.urlsec.qq.com,DIRECT',
      'DOMAIN,safebrowsing.googleapis.com,DIRECT',
      'DOMAIN,developer.apple.com,Manual',
      'DOMAIN-SUFFIX,digicert.com,Manual',
      'DOMAIN,ocsp.apple.com,Manual',
      'DOMAIN,ocsp.comodoca.com,Manual',
      'DOMAIN,ocsp.usertrust.com,Manual',
      'DOMAIN,ocsp.sectigo.com,Manual',
      'DOMAIN,ocsp.verisign.net,Manual',
      'DOMAIN-SUFFIX,apple-dns.net,Manual',
      'DOMAIN,testflight.apple.com,Manual',
      'DOMAIN,sandbox.itunes.apple.com,Manual',
      'DOMAIN,itunes.apple.com,Manual',
      'DOMAIN-SUFFIX,apps.apple.com,Manual',
      'DOMAIN-SUFFIX,blobstore.apple.com,Manual',
      'DOMAIN,cvws.icloud-content.com,Manual',
      'DOMAIN-SUFFIX,mzstatic.com,DIRECT',
      'DOMAIN-SUFFIX,itunes.apple.com,DIRECT',
      'DOMAIN-SUFFIX,icloud.com,DIRECT',
      'DOMAIN-SUFFIX,icloud-content.com,DIRECT',
      'DOMAIN-SUFFIX,me.com,DIRECT',
      'DOMAIN-SUFFIX,aaplimg.com,DIRECT',
      'DOMAIN-SUFFIX,cdn20.com,DIRECT',
      'DOMAIN-SUFFIX,cdn-apple.com,DIRECT',
      'DOMAIN-SUFFIX,akadns.net,DIRECT',
      'DOMAIN-SUFFIX,akamaiedge.net,DIRECT',
      'DOMAIN-SUFFIX,edgekey.net,DIRECT',
      'DOMAIN-SUFFIX,mwcloudcdn.com,DIRECT',
      'DOMAIN-SUFFIX,mwcname.com,DIRECT',
      'DOMAIN-SUFFIX,apple.com,DIRECT',
      'DOMAIN-SUFFIX,apple-cloudkit.com,DIRECT',
      'DOMAIN-SUFFIX,apple-mapkit.com,DIRECT',
      'DOMAIN-SUFFIX,126.com,DIRECT',
      'DOMAIN-SUFFIX,126.net,DIRECT',
      'DOMAIN-SUFFIX,127.net,DIRECT',
      'DOMAIN-SUFFIX,163.com,DIRECT',
      'DOMAIN-SUFFIX,360buyimg.com,DIRECT',
      'DOMAIN-SUFFIX,36kr.com,DIRECT',
      'DOMAIN-SUFFIX,acfun.tv,DIRECT',
      'DOMAIN-SUFFIX,air-matters.com,DIRECT',
      'DOMAIN-SUFFIX,aixifan.com,DIRECT',
      'DOMAIN-KEYWORD,alicdn,DIRECT',
      'DOMAIN-KEYWORD,alipay,DIRECT',
      'DOMAIN-KEYWORD,taobao,DIRECT',
      'DOMAIN-SUFFIX,amap.com,DIRECT',
      'DOMAIN-SUFFIX,autonavi.com,DIRECT',
      'DOMAIN-KEYWORD,baidu,DIRECT',
      'DOMAIN-SUFFIX,bdimg.com,DIRECT',
      'DOMAIN-SUFFIX,bdstatic.com,DIRECT',
      'DOMAIN-SUFFIX,bilibili.com,DIRECT',
      'DOMAIN-SUFFIX,bilivideo.com,DIRECT',
      'DOMAIN-SUFFIX,caiyunapp.com,DIRECT',
      'DOMAIN-SUFFIX,clouddn.com,DIRECT',
      'DOMAIN-SUFFIX,cnbeta.com,DIRECT',
      'DOMAIN-SUFFIX,cnbetacdn.com,DIRECT',
      'DOMAIN-SUFFIX,cootekservice.com,DIRECT',
      'DOMAIN-SUFFIX,csdn.net,DIRECT',
      'DOMAIN-SUFFIX,ctrip.com,DIRECT',
      'DOMAIN-SUFFIX,dgtle.com,DIRECT',
      'DOMAIN-SUFFIX,dianping.com,DIRECT',
      'DOMAIN-SUFFIX,douban.com,DIRECT',
      'DOMAIN-SUFFIX,doubanio.com,DIRECT',
      'DOMAIN-SUFFIX,duokan.com,DIRECT',
      'DOMAIN-SUFFIX,easou.com,DIRECT',
      'DOMAIN-SUFFIX,ele.me,DIRECT',
      'DOMAIN-SUFFIX,feng.com,DIRECT',
      'DOMAIN-SUFFIX,fir.im,DIRECT',
      'DOMAIN-SUFFIX,frdic.com,DIRECT',
      'DOMAIN-SUFFIX,g-cores.com,DIRECT',
      'DOMAIN-SUFFIX,godic.net,DIRECT',
      'DOMAIN-SUFFIX,gtimg.com,DIRECT',
      'DOMAIN,cdn.hockeyapp.net,DIRECT',
      'DOMAIN-SUFFIX,hongxiu.com,DIRECT',
      'DOMAIN-SUFFIX,hxcdn.net,DIRECT',
      'DOMAIN-SUFFIX,iciba.com,DIRECT',
      'DOMAIN-SUFFIX,ifeng.com,DIRECT',
      'DOMAIN-SUFFIX,ifengimg.com,DIRECT',
      'DOMAIN-SUFFIX,ipip.net,DIRECT',
      'DOMAIN-SUFFIX,iqiyi.com,DIRECT',
      'DOMAIN-SUFFIX,jd.com,DIRECT',
      'DOMAIN-SUFFIX,jianshu.com,DIRECT',
      'DOMAIN-SUFFIX,knewone.com,DIRECT',
      'DOMAIN-SUFFIX,le.com,DIRECT',
      'DOMAIN-SUFFIX,lecloud.com,DIRECT',
      'DOMAIN-SUFFIX,lemicp.com,DIRECT',
      'DOMAIN-SUFFIX,licdn.com,DIRECT',
      'DOMAIN-SUFFIX,luoo.net,DIRECT',
      'DOMAIN-SUFFIX,meituan.com,DIRECT',
      'DOMAIN-SUFFIX,meituan.net,DIRECT',
      'DOMAIN-SUFFIX,mi.com,DIRECT',
      'DOMAIN-SUFFIX,miaopai.com,DIRECT',
      'DOMAIN-SUFFIX,microsoft.com,DIRECT',
      'DOMAIN-SUFFIX,microsoftonline.com,DIRECT',
      'DOMAIN-SUFFIX,miui.com,DIRECT',
      'DOMAIN-SUFFIX,miwifi.com,DIRECT',
      'DOMAIN-SUFFIX,mob.com,DIRECT',
      'DOMAIN-SUFFIX,netease.com,DIRECT',
      'DOMAIN-SUFFIX,office.com,DIRECT',
      'DOMAIN-SUFFIX,office365.com,DIRECT',
      'DOMAIN-KEYWORD,officecdn,DIRECT',
      'DOMAIN-SUFFIX,oschina.net,DIRECT',
      'DOMAIN-SUFFIX,ppsimg.com,DIRECT',
      'DOMAIN-SUFFIX,pstatp.com,DIRECT',
      'DOMAIN-SUFFIX,qcloud.com,DIRECT',
      'DOMAIN-SUFFIX,qdaily.com,DIRECT',
      'DOMAIN-SUFFIX,qdmm.com,DIRECT',
      'DOMAIN-SUFFIX,qhimg.com,DIRECT',
      'DOMAIN-SUFFIX,qhres.com,DIRECT',
      'DOMAIN-SUFFIX,qidian.com,DIRECT',
      'DOMAIN-SUFFIX,qihucdn.com,DIRECT',
      'DOMAIN-SUFFIX,qiniu.com,DIRECT',
      'DOMAIN-SUFFIX,qiniucdn.com,DIRECT',
      'DOMAIN-SUFFIX,qiyipic.com,DIRECT',
      'DOMAIN-SUFFIX,qq.com,DIRECT',
      'DOMAIN-SUFFIX,qqurl.com,DIRECT',
      'DOMAIN-SUFFIX,rarbg.to,DIRECT',
      'DOMAIN-SUFFIX,ruguoapp.com,DIRECT',
      'DOMAIN-SUFFIX,segmentfault.com,DIRECT',
      'DOMAIN-SUFFIX,sinaapp.com,DIRECT',
      'DOMAIN-SUFFIX,smzdm.com,DIRECT',
      'DOMAIN-SUFFIX,snapdrop.net,DIRECT',
      'DOMAIN-SUFFIX,sogou.com,DIRECT',
      'DOMAIN-SUFFIX,sogoucdn.com,DIRECT',
      'DOMAIN-SUFFIX,sohu.com,DIRECT',
      'DOMAIN-SUFFIX,soku.com,DIRECT',
      'DOMAIN-SUFFIX,speedtest.net,DIRECT',
      'DOMAIN-SUFFIX,sspai.com,DIRECT',
      'DOMAIN-SUFFIX,suning.com,DIRECT',
      'DOMAIN-SUFFIX,taobao.com,DIRECT',
      'DOMAIN-SUFFIX,tencent.com,DIRECT',
      'DOMAIN-SUFFIX,tenpay.com,DIRECT',
      'DOMAIN-SUFFIX,tianyancha.com,DIRECT',
      'DOMAIN-SUFFIX,tmall.com,DIRECT',
      'DOMAIN-SUFFIX,tudou.com,DIRECT',
      'DOMAIN-SUFFIX,umetrip.com,DIRECT',
      'DOMAIN-SUFFIX,upaiyun.com,DIRECT',
      'DOMAIN-SUFFIX,upyun.com,DIRECT',
      'DOMAIN-SUFFIX,veryzhun.com,DIRECT',
      'DOMAIN-SUFFIX,weather.com,DIRECT',
      'DOMAIN-SUFFIX,weibo.com,DIRECT',
      'DOMAIN-SUFFIX,xiami.com,DIRECT',
      'DOMAIN-SUFFIX,xiami.net,DIRECT',
      'DOMAIN-SUFFIX,xiaomicp.com,DIRECT',
      'DOMAIN-SUFFIX,ximalaya.com,DIRECT',
      'DOMAIN-SUFFIX,xmcdn.com,DIRECT',
      'DOMAIN-SUFFIX,xunlei.com,DIRECT',
      'DOMAIN-SUFFIX,yhd.com,DIRECT',
      'DOMAIN-SUFFIX,yihaodianimg.com,DIRECT',
      'DOMAIN-SUFFIX,yinxiang.com,DIRECT',
      'DOMAIN-SUFFIX,ykimg.com,DIRECT',
      'DOMAIN-SUFFIX,youdao.com,DIRECT',
      'DOMAIN-SUFFIX,youku.com,DIRECT',
      'DOMAIN-SUFFIX,zealer.com,DIRECT',
      'DOMAIN-SUFFIX,zhihu.com,DIRECT',
      'DOMAIN-SUFFIX,zhimg.com,DIRECT',
      'DOMAIN-SUFFIX,zimuzu.tv,DIRECT',
      'DOMAIN-SUFFIX,zoho.com,DIRECT',
      'DOMAIN-KEYWORD,amazon,Manual',
      'DOMAIN-KEYWORD,google,Manual',
      'DOMAIN-KEYWORD,gmail,Manual',
      'DOMAIN-KEYWORD,youtube,Manual',
      'DOMAIN-KEYWORD,facebook,Manual',
      'DOMAIN-SUFFIX,fb.me,Manual',
      'DOMAIN-SUFFIX,fbcdn.net,Manual',
      'DOMAIN-KEYWORD,twitter,Manual',
      'DOMAIN-KEYWORD,instagram,Manual',
      'DOMAIN-KEYWORD,dropbox,Manual',
      'DOMAIN-SUFFIX,twimg.com,Manual',
      'DOMAIN-KEYWORD,blogspot,Manual',
      'DOMAIN-SUFFIX,youtu.be,Manual',
      'DOMAIN-KEYWORD,whatsapp,Manual',
      'DOMAIN-KEYWORD,admarvel,REJECT',
      'DOMAIN-KEYWORD,admaster,REJECT',
      'DOMAIN-KEYWORD,adsage,REJECT',
      'DOMAIN-KEYWORD,adsmogo,REJECT',
      'DOMAIN-KEYWORD,adsrvmedia,REJECT',
      'DOMAIN-KEYWORD,adwords,REJECT',
      'DOMAIN-KEYWORD,adservice,REJECT',
      'DOMAIN-SUFFIX,appsflyer.com,REJECT',
      'DOMAIN-KEYWORD,domob,REJECT',
      'DOMAIN-SUFFIX,doubleclick.net,REJECT',
      'DOMAIN-KEYWORD,duomeng,REJECT',
      'DOMAIN-KEYWORD,dwtrack,REJECT',
      'DOMAIN-KEYWORD,guanggao,REJECT',
      'DOMAIN-KEYWORD,lianmeng,REJECT',
      'DOMAIN-SUFFIX,mmstat.com,REJECT',
      'DOMAIN-KEYWORD,mopub,REJECT',
      'DOMAIN-KEYWORD,omgmta,REJECT',
      'DOMAIN-KEYWORD,openx,REJECT',
      'DOMAIN-KEYWORD,partnerad,REJECT',
      'DOMAIN-KEYWORD,pingfore,REJECT',
      'DOMAIN-KEYWORD,supersonicads,REJECT',
      'DOMAIN-KEYWORD,uedas,REJECT',
      'DOMAIN-KEYWORD,umeng,REJECT',
      'DOMAIN-KEYWORD,usage,REJECT',
      'DOMAIN-SUFFIX,vungle.com,REJECT',
      'DOMAIN-KEYWORD,wlmonitor,REJECT',
      'DOMAIN-KEYWORD,zjtoolbar,REJECT',
      'DOMAIN-SUFFIX,9to5mac.com,Manual',
      'DOMAIN-SUFFIX,abpchina.org,Manual',
      'DOMAIN-SUFFIX,adblockplus.org,Manual',
      'DOMAIN-SUFFIX,adobe.com,Manual',
      'DOMAIN-SUFFIX,akamaized.net,Manual',
      'DOMAIN-SUFFIX,alfredapp.com,Manual',
      'DOMAIN-SUFFIX,amplitude.com,Manual',
      'DOMAIN-SUFFIX,ampproject.org,Manual',
      'DOMAIN-SUFFIX,android.com,Manual',
      'DOMAIN-SUFFIX,angularjs.org,Manual',
      'DOMAIN-SUFFIX,aolcdn.com,Manual',
      'DOMAIN-SUFFIX,apkpure.com,Manual',
      'DOMAIN-SUFFIX,appledaily.com,Manual',
      'DOMAIN-SUFFIX,appshopper.com,Manual',
      'DOMAIN-SUFFIX,appspot.com,Manual',
      'DOMAIN-SUFFIX,arcgis.com,Manual',
      'DOMAIN-SUFFIX,archive.org,Manual',
      'DOMAIN-SUFFIX,armorgames.com,Manual',
      'DOMAIN-SUFFIX,aspnetcdn.com,Manual',
      'DOMAIN-SUFFIX,att.com,Manual',
      'DOMAIN-SUFFIX,awsstatic.com,Manual',
      'DOMAIN-SUFFIX,azureedge.net,Manual',
      'DOMAIN-SUFFIX,azurewebsites.net,Manual',
      'DOMAIN-SUFFIX,bing.com,Manual',
      'DOMAIN-SUFFIX,bintray.com,Manual',
      'DOMAIN-SUFFIX,bit.com,Manual',
      'DOMAIN-SUFFIX,bit.ly,Manual',
      'DOMAIN-SUFFIX,bitbucket.org,Manual',
      'DOMAIN-SUFFIX,bjango.com,Manual',
      'DOMAIN-SUFFIX,bkrtx.com,Manual',
      'DOMAIN-SUFFIX,blog.com,Manual',
      'DOMAIN-SUFFIX,blogcdn.com,Manual',
      'DOMAIN-SUFFIX,blogger.com,Manual',
      'DOMAIN-SUFFIX,blogsmithmedia.com,Manual',
      'DOMAIN-SUFFIX,blogspot.com,Manual',
      'DOMAIN-SUFFIX,blogspot.hk,Manual',
      'DOMAIN-SUFFIX,bloomberg.com,Manual',
      'DOMAIN-SUFFIX,box.com,Manual',
      'DOMAIN-SUFFIX,box.net,Manual',
      'DOMAIN-SUFFIX,cachefly.net,Manual',
      'DOMAIN-SUFFIX,chromium.org,Manual',
      'DOMAIN-SUFFIX,cl.ly,Manual',
      'DOMAIN-SUFFIX,cloudflare.com,Manual',
      'DOMAIN-SUFFIX,cloudfront.net,Manual',
      'DOMAIN-SUFFIX,cloudmagic.com,Manual',
      'DOMAIN-SUFFIX,cmail19.com,Manual',
      'DOMAIN-SUFFIX,cnet.com,Manual',
      'DOMAIN-SUFFIX,cocoapods.org,Manual',
      'DOMAIN-SUFFIX,comodoca.com,Manual',
      'DOMAIN-SUFFIX,crashlytics.com,Manual',
      'DOMAIN-SUFFIX,culturedcode.com,Manual',
      'DOMAIN-SUFFIX,d.pr,Manual',
      'DOMAIN-SUFFIX,danilo.to,Manual',
      'DOMAIN-SUFFIX,dayone.me,Manual',
      'DOMAIN-SUFFIX,db.tt,Manual',
      'DOMAIN-SUFFIX,deskconnect.com,Manual',
      'DOMAIN-SUFFIX,disq.us,Manual',
      'DOMAIN-SUFFIX,disqus.com,Manual',
      'DOMAIN-SUFFIX,disquscdn.com,Manual',
      'DOMAIN-SUFFIX,dnsimple.com,Manual',
      'DOMAIN-SUFFIX,docker.com,Manual',
      'DOMAIN-SUFFIX,dribbble.com,Manual',
      'DOMAIN-SUFFIX,droplr.com,Manual',
      'DOMAIN-SUFFIX,duckduckgo.com,Manual',
      'DOMAIN-SUFFIX,dueapp.com,Manual',
      'DOMAIN-SUFFIX,dytt8.net,Manual',
      'DOMAIN-SUFFIX,edgecastcdn.net,Manual',
      'DOMAIN-SUFFIX,edgekey.net,Manual',
      'DOMAIN-SUFFIX,edgesuite.net,Manual',
      'DOMAIN-SUFFIX,engadget.com,Manual',
      'DOMAIN-SUFFIX,entrust.net,Manual',
      'DOMAIN-SUFFIX,eurekavpt.com,Manual',
      'DOMAIN-SUFFIX,evernote.com,Manual',
      'DOMAIN-SUFFIX,fabric.io,Manual',
      'DOMAIN-SUFFIX,fast.com,Manual',
      'DOMAIN-SUFFIX,fastly.net,Manual',
      'DOMAIN-SUFFIX,fc2.com,Manual',
      'DOMAIN-SUFFIX,feedburner.com,Manual',
      'DOMAIN-SUFFIX,feedly.com,Manual',
      'DOMAIN-SUFFIX,feedsportal.com,Manual',
      'DOMAIN-SUFFIX,fiftythree.com,Manual',
      'DOMAIN-SUFFIX,firebaseio.com,Manual',
      'DOMAIN-SUFFIX,flexibits.com,Manual',
      'DOMAIN-SUFFIX,flickr.com,Manual',
      'DOMAIN-SUFFIX,flipboard.com,Manual',
      'DOMAIN-SUFFIX,g.co,Manual',
      'DOMAIN-SUFFIX,gabia.net,Manual',
      'DOMAIN-SUFFIX,geni.us,Manual',
      'DOMAIN-SUFFIX,gfx.ms,Manual',
      'DOMAIN-SUFFIX,ggpht.com,Manual',
      'DOMAIN-SUFFIX,ghostnoteapp.com,Manual',
      'DOMAIN-SUFFIX,git.io,Manual',
      'DOMAIN-KEYWORD,github,Manual',
      'DOMAIN-SUFFIX,globalsign.com,Manual',
      'DOMAIN-SUFFIX,gmodules.com,Manual',
      'DOMAIN-SUFFIX,godaddy.com,Manual',
      'DOMAIN-SUFFIX,golang.org,Manual',
      'DOMAIN-SUFFIX,gongm.in,Manual',
      'DOMAIN-SUFFIX,goo.gl,Manual',
      'DOMAIN-SUFFIX,goodreaders.com,Manual',
      'DOMAIN-SUFFIX,goodreads.com,Manual',
      'DOMAIN-SUFFIX,gravatar.com,Manual',
      'DOMAIN-SUFFIX,gstatic.com,Manual',
      'DOMAIN-SUFFIX,gvt0.com,Manual',
      'DOMAIN-SUFFIX,hockeyapp.net,Manual',
      'DOMAIN-SUFFIX,hotmail.com,Manual',
      'DOMAIN-SUFFIX,icons8.com,Manual',
      'DOMAIN-SUFFIX,ifixit.com,Manual',
      'DOMAIN-SUFFIX,ift.tt,Manual',
      'DOMAIN-SUFFIX,ifttt.com,Manual',
      'DOMAIN-SUFFIX,iherb.com,Manual',
      'DOMAIN-SUFFIX,imageshack.us,Manual',
      'DOMAIN-SUFFIX,img.ly,Manual',
      'DOMAIN-SUFFIX,imgur.com,Manual',
      'DOMAIN-SUFFIX,imore.com,Manual',
      'DOMAIN-SUFFIX,instapaper.com,Manual',
      'DOMAIN-SUFFIX,ipn.li,Manual',
      'DOMAIN-SUFFIX,is.gd,Manual',
      'DOMAIN-SUFFIX,issuu.com,Manual',
      'DOMAIN-SUFFIX,itgonglun.com,Manual',
      'DOMAIN-SUFFIX,itun.es,Manual',
      'DOMAIN-SUFFIX,ixquick.com,Manual',
      'DOMAIN-SUFFIX,j.mp,Manual',
      'DOMAIN-SUFFIX,js.revsci.net,Manual',
      'DOMAIN-SUFFIX,jshint.com,Manual',
      'DOMAIN-SUFFIX,jtvnw.net,Manual',
      'DOMAIN-SUFFIX,justgetflux.com,Manual',
      'DOMAIN-SUFFIX,kat.cr,Manual',
      'DOMAIN-SUFFIX,klip.me,Manual',
      'DOMAIN-SUFFIX,libsyn.com,Manual',
      'DOMAIN-SUFFIX,linkedin.com,Manual',
      'DOMAIN-SUFFIX,line-apps.com,Manual',
      'DOMAIN-SUFFIX,linode.com,Manual',
      'DOMAIN-SUFFIX,lithium.com,Manual',
      'DOMAIN-SUFFIX,littlehj.com,Manual',
      'DOMAIN-SUFFIX,live.com,Manual',
      'DOMAIN-SUFFIX,live.net,Manual',
      'DOMAIN-SUFFIX,livefilestore.com,Manual',
      'DOMAIN-SUFFIX,llnwd.net,Manual',
      'DOMAIN-SUFFIX,macid.co,Manual',
      'DOMAIN-SUFFIX,macromedia.com,Manual',
      'DOMAIN-SUFFIX,macrumors.com,Manual',
      'DOMAIN-SUFFIX,mashable.com,Manual',
      'DOMAIN-SUFFIX,mathjax.org,Manual',
      'DOMAIN-SUFFIX,medium.com,Manual',
      'DOMAIN-SUFFIX,mega.co.nz,Manual',
      'DOMAIN-SUFFIX,mega.nz,Manual',
      'DOMAIN-SUFFIX,megaupload.com,Manual',
      'DOMAIN-SUFFIX,microsofttranslator.com,Manual',
      'DOMAIN-SUFFIX,mindnode.com,Manual',
      'DOMAIN-SUFFIX,mobile01.com,Manual',
      'DOMAIN-SUFFIX,modmyi.com,Manual',
      'DOMAIN-SUFFIX,msedge.net,Manual',
      'DOMAIN-SUFFIX,myfontastic.com,Manual',
      'DOMAIN-SUFFIX,name.com,Manual',
      'DOMAIN-SUFFIX,nextmedia.com,Manual',
      'DOMAIN-SUFFIX,nsstatic.net,Manual',
      'DOMAIN-SUFFIX,nssurge.com,Manual',
      'DOMAIN-SUFFIX,nyt.com,Manual',
      'DOMAIN-SUFFIX,nytimes.com,Manual',
      'DOMAIN-SUFFIX,omnigroup.com,Manual',
      'DOMAIN-SUFFIX,onedrive.com,Manual',
      'DOMAIN-SUFFIX,onenote.com,Manual',
      'DOMAIN-SUFFIX,ooyala.com,Manual',
      'DOMAIN-SUFFIX,openvpn.net,Manual',
      'DOMAIN-SUFFIX,openwrt.org,Manual',
      'DOMAIN-SUFFIX,orkut.com,Manual',
      'DOMAIN-SUFFIX,osxdaily.com,Manual',
      'DOMAIN-SUFFIX,outlook.com,Manual',
      'DOMAIN-SUFFIX,ow.ly,Manual',
      'DOMAIN-SUFFIX,paddleapi.com,Manual',
      'DOMAIN-SUFFIX,parallels.com,Manual',
      'DOMAIN-SUFFIX,parse.com,Manual',
      'DOMAIN-SUFFIX,pdfexpert.com,Manual',
      'DOMAIN-SUFFIX,periscope.tv,Manual',
      'DOMAIN-SUFFIX,pinboard.in,Manual',
      'DOMAIN-SUFFIX,pinterest.com,Manual',
      'DOMAIN-SUFFIX,pixelmator.com,Manual',
      'DOMAIN-SUFFIX,pixiv.net,Manual',
      'DOMAIN-SUFFIX,playpcesor.com,Manual',
      'DOMAIN-SUFFIX,playstation.com,Manual',
      'DOMAIN-SUFFIX,playstation.com.hk,Manual',
      'DOMAIN-SUFFIX,playstation.net,Manual',
      'DOMAIN-SUFFIX,playstationnetwork.com,Manual',
      'DOMAIN-SUFFIX,pushwoosh.com,Manual',
      'DOMAIN-SUFFIX,rime.im,Manual',
      'DOMAIN-SUFFIX,servebom.com,Manual',
      'DOMAIN-SUFFIX,sfx.ms,Manual',
      'DOMAIN-SUFFIX,shadowsocks.org,Manual',
      'DOMAIN-SUFFIX,sharethis.com,Manual',
      'DOMAIN-SUFFIX,shazam.com,Manual',
      'DOMAIN-SUFFIX,skype.com,Manual',
      'DOMAIN-SUFFIX,smartdnsManual.com,Manual',
      'DOMAIN-SUFFIX,smartmailcloud.com,Manual',
      'DOMAIN-SUFFIX,sndcdn.com,Manual',
      'DOMAIN-SUFFIX,sony.com,Manual',
      'DOMAIN-SUFFIX,soundcloud.com,Manual',
      'DOMAIN-SUFFIX,sourceforge.net,Manual',
      'DOMAIN-SUFFIX,spotify.com,Manual',
      'DOMAIN-SUFFIX,squarespace.com,Manual',
      'DOMAIN-SUFFIX,sstatic.net,Manual',
      'DOMAIN-SUFFIX,st.luluku.pw,Manual',
      'DOMAIN-SUFFIX,stackoverflow.com,Manual',
      'DOMAIN-SUFFIX,startpage.com,Manual',
      'DOMAIN-SUFFIX,staticflickr.com,Manual',
      'DOMAIN-SUFFIX,steamcommunity.com,Manual',
      'DOMAIN-SUFFIX,symauth.com,Manual',
      'DOMAIN-SUFFIX,symcb.com,Manual',
      'DOMAIN-SUFFIX,symcd.com,Manual',
      'DOMAIN-SUFFIX,tapbots.com,Manual',
      'DOMAIN-SUFFIX,tapbots.net,Manual',
      'DOMAIN-SUFFIX,tdesktop.com,Manual',
      'DOMAIN-SUFFIX,techcrunch.com,Manual',
      'DOMAIN-SUFFIX,techsmith.com,Manual',
      'DOMAIN-SUFFIX,thepiratebay.org,Manual',
      'DOMAIN-SUFFIX,theverge.com,Manual',
      'DOMAIN-SUFFIX,time.com,Manual',
      'DOMAIN-SUFFIX,timeinc.net,Manual',
      'DOMAIN-SUFFIX,tiny.cc,Manual',
      'DOMAIN-SUFFIX,tinypic.com,Manual',
      'DOMAIN-SUFFIX,tmblr.co,Manual',
      'DOMAIN-SUFFIX,todoist.com,Manual',
      'DOMAIN-SUFFIX,trello.com,Manual',
      'DOMAIN-SUFFIX,trustasiassl.com,Manual',
      'DOMAIN-SUFFIX,tumblr.co,Manual',
      'DOMAIN-SUFFIX,tumblr.com,Manual',
      'DOMAIN-SUFFIX,tweetdeck.com,Manual',
      'DOMAIN-SUFFIX,tweetmarker.net,Manual',
      'DOMAIN-SUFFIX,twitch.tv,Manual',
      'DOMAIN-SUFFIX,txmblr.com,Manual',
      'DOMAIN-SUFFIX,typekit.net,Manual',
      'DOMAIN-SUFFIX,ubertags.com,Manual',
      'DOMAIN-SUFFIX,ublock.org,Manual',
      'DOMAIN-SUFFIX,ubnt.com,Manual',
      'DOMAIN-SUFFIX,ulyssesapp.com,Manual',
      'DOMAIN-SUFFIX,urchin.com,Manual',
      'DOMAIN-SUFFIX,usertrust.com,Manual',
      'DOMAIN-SUFFIX,v.gd,Manual',
      'DOMAIN-SUFFIX,v2ex.com,Manual',
      'DOMAIN-SUFFIX,vimeo.com,Manual',
      'DOMAIN-SUFFIX,vimeocdn.com,Manual',
      'DOMAIN-SUFFIX,vine.co,Manual',
      'DOMAIN-SUFFIX,vivaldi.com,Manual',
      'DOMAIN-SUFFIX,vox-cdn.com,Manual',
      'DOMAIN-SUFFIX,vsco.co,Manual',
      'DOMAIN-SUFFIX,vultr.com,Manual',
      'DOMAIN-SUFFIX,w.org,Manual',
      'DOMAIN-SUFFIX,w3schools.com,Manual',
      'DOMAIN-SUFFIX,webtype.com,Manual',
      'DOMAIN-SUFFIX,wikiwand.com,Manual',
      'DOMAIN-SUFFIX,wikileaks.org,Manual',
      'DOMAIN-SUFFIX,wikimedia.org,Manual',
      'DOMAIN-SUFFIX,wikipedia.com,Manual',
      'DOMAIN-SUFFIX,wikipedia.org,Manual',
      'DOMAIN-SUFFIX,windows.com,Manual',
      'DOMAIN-SUFFIX,windows.net,Manual',
      'DOMAIN-SUFFIX,wire.com,Manual',
      'DOMAIN-SUFFIX,wordpress.com,Manual',
      'DOMAIN-SUFFIX,workflowy.com,Manual',
      'DOMAIN-SUFFIX,wp.com,Manual',
      'DOMAIN-SUFFIX,wsj.com,Manual',
      'DOMAIN-SUFFIX,wsj.net,Manual',
      'DOMAIN-SUFFIX,xda-developers.com,Manual',
      'DOMAIN-SUFFIX,xeeno.com,Manual',
      'DOMAIN-SUFFIX,xiti.com,Manual',
      'DOMAIN-SUFFIX,yahoo.com,Manual',
      'DOMAIN-SUFFIX,yimg.com,Manual',
      'DOMAIN-SUFFIX,ying.com,Manual',
      'DOMAIN-SUFFIX,yoyo.org,Manual',
      'DOMAIN-SUFFIX,ytimg.com,Manual',
      'DOMAIN-SUFFIX,telegra.ph,Manual',
      'DOMAIN-SUFFIX,telegram.org,Manual',
      'IP-CIDR,91.108.4.0/22,Manual,no-resolve',
      'IP-CIDR,91.108.8.0/21,Manual,no-resolve',
      'IP-CIDR,91.108.16.0/22,Manual,no-resolve',
      'IP-CIDR,91.108.56.0/22,Manual,no-resolve',
      'IP-CIDR,149.154.160.0/20,Manual,no-resolve',
      'IP-CIDR6,2001:67c:4e8::/48,Manual,no-resolve',
      'IP-CIDR6,2001:b28:f23d::/48,Manual,no-resolve',
      'IP-CIDR6,2001:b28:f23f::/48,Manual,no-resolve',
      'IP-CIDR,120.232.181.162/32,Manual,no-resolve',
      'IP-CIDR,120.241.147.226/32,Manual,no-resolve',
      'IP-CIDR,120.253.253.226/32,Manual,no-resolve',
      'IP-CIDR,120.253.255.162/32,Manual,no-resolve',
      'IP-CIDR,120.253.255.34/32,Manual,no-resolve',
      'IP-CIDR,120.253.255.98/32,Manual,no-resolve',
      'IP-CIDR,180.163.150.162/32,Manual,no-resolve',
      'IP-CIDR,180.163.150.34/32,Manual,no-resolve',
      'IP-CIDR,180.163.151.162/32,Manual,no-resolve',
      'IP-CIDR,180.163.151.34/32,Manual,no-resolve',
      'IP-CIDR,203.208.39.0/24,Manual,no-resolve',
      'IP-CIDR,203.208.40.0/24,Manual,no-resolve',
      'IP-CIDR,203.208.41.0/24,Manual,no-resolve',
      'IP-CIDR,203.208.43.0/24,Manual,no-resolve',
      'IP-CIDR,203.208.50.0/24,Manual,no-resolve',
      'IP-CIDR,220.181.174.162/32,Manual,no-resolve',
      'IP-CIDR,220.181.174.226/32,Manual,no-resolve',
      'IP-CIDR,220.181.174.34/32,Manual,no-resolve',
      'DOMAIN,injections.adguard.org,DIRECT',
      'DOMAIN,local.adguard.org,DIRECT',
      'DOMAIN-SUFFIX,local,DIRECT',
      'IP-CIDR,127.0.0.0/8,DIRECT',
      'IP-CIDR,172.16.0.0/12,DIRECT',
      'IP-CIDR,192.168.0.0/16,DIRECT',
      'IP-CIDR,10.0.0.0/8,DIRECT',
      'IP-CIDR,17.0.0.0/8,DIRECT',
      'IP-CIDR,100.64.0.0/10,DIRECT',
      'IP-CIDR,224.0.0.0/4,DIRECT',
      'IP-CIDR6,fe80::/10,DIRECT',
      'DOMAIN-SUFFIX,cn,DIRECT',
      'DOMAIN-KEYWORD,-cn,DIRECT',
      'GEOIP,CN,DIRECT',
      'MATCH,Manual'
    ]
  }
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return new NextResponse('Missing subscription url', { status: 400 })
    }

    console.log('开始处理订阅:', url)
    
    // 在处理每个新请求前重置计数器
    Object.keys(counters).forEach(key => delete counters[key])
    
    // 获取原始订阅信息
    console.log('获取订阅信息...')
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClashX/1.95.1'
      }
    })

    // 打印完整的响应头
    console.log('\n===== 响应头信息 =====')
    const headers = Object.fromEntries(response.headers.entries())
    console.log(headers)
    console.log('=====================\n')
    
    // 从 content-disposition 获取订阅名称
    const contentDisposition = response.headers.get('content-disposition') || ''
    const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
    const subName = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : '未知订阅'
    
    // 获取订阅到期时间和流量信息
    const userInfo = response.headers.get('subscription-userinfo') || ''
    const subscription = {
      name: subName,
      upload: userInfo.match(/upload=(\d+)/)?.[1] || 0,
      download: userInfo.match(/download=(\d+)/)?.[1] || 0,
      total: userInfo.match(/total=(\d+)/)?.[1] || 0,
      expire: userInfo.match(/expire=(\d+)/)?.[1] || 
              response.headers.get('profile-expire') || 
              response.headers.get('expires') || 
              response.headers.get('expire') || 
              response.headers.get('Subscription-Userinfo')?.match(/expire=(\d+)/)?.[1] ||
              '',
      homepage: response.headers.get('profile-web-page-url') || 'https://sub.xqd.us.kg'  // 获取原始订阅的首页
    }

    // 打印格式化的订阅信息
    console.log('\n=== 订阅基本信息 ===')
    console.log(`名称: ${subscription.name}`)
    console.log(`首页: ${subscription.homepage}`)
    console.log(`流量信息:`)
    console.log(`  ├─ 上传: ${formatBytes(Number(subscription.upload))}`)
    console.log(`  ├─ 下载: ${formatBytes(Number(subscription.download))}`)
    console.log(`  └─ 总量: ${formatBytes(Number(subscription.total))}`)
    console.log(`到期时间: ${subscription.expire ? new Date(Number(subscription.expire) * 1000).toLocaleString() : '未知'}`)
    console.log('===================\n')

    // 解析节点
    const proxies = await parseSubscription(url)
    const formattedProxies = proxies.map(formatProxyName)
    const defaultConfig = await getDefaultConfig()

    // 生成最终配置
    const clashConfig: ClashConfig = {
      'mixed-port': 7890,
      'allow-lan': true,
      'bind-address': '*',
      mode: 'rule',
      'log-level': 'info',
      ipv6: true,
      'tcp-concurrent': true,
      'external-controller': '127.0.0.1:9090',
      
      // DNS 配置
      dns: {
        enable: true,
        ipv6: false,
        'default-nameserver': ['223.5.5.5', '119.29.29.29'],
        'enhanced-mode': 'fake-ip',
        'fake-ip-range': '198.18.0.1/16',
        'use-hosts': true,
        nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
        fallback: ['https://doh.dns.sb/dns-query', 'https://dns.cloudflare.com/dns-query', 'https://dns.twnic.tw/dns-query', 'tls://8.8.4.4:853'],
        'fallback-filter': { geoip: true, ipcidr: ['240.0.0.0/4', '0.0.0.0/32'] }
      },

      // 代理节点
      proxies: formattedProxies.map(p => {
        const base = {
          name: p.name,
          type: p.type,
          server: p.server,
          port: p.port,
          password: p.password
        }

        // 根据不同类型添加特定配置
        switch (p.type) {
          case 'ss':
            return {
              ...base,
              cipher: p.cipher,
              password: p.password,
              ...(p.udp && { udp: true })
            }
          case 'vmess':
            return {
              ...base,
              uuid: p.uuid,
              alterId: p.alterId || 0,
              cipher: p.cipher || 'auto',
              tls: p.tls,
              'skip-cert-verify': p['skip-cert-verify'],
              servername: p.servername || p.sni,
              network: p.network,
              ...(p.network === 'ws' && {
                'ws-opts': {
                  path: p.path || '/',
                  headers: {
                    Host: p.host || p.server
                  }
                }
              }),
              ...(p.udp && { udp: true })
            }
          case 'trojan':
            return {
              ...base,
              password: p.password,
              tls: true,
              'skip-cert-verify': p['skip-cert-verify'],
              sni: p.sni,
              alpn: p.alpn,
              network: p.network,
              ...(p.network === 'ws' && {
                'ws-opts': {
                  path: p.path || '/',
                  headers: {
                    Host: p.host || p.server
                  }
                }
              }),
              ...(p.udp && { udp: true })
            }
          case 'hysteria2':
            return {
              ...base,
              port: p.port,
              ports: p.ports,
              mport: p.mport,
              password: p.password,
              'skip-cert-verify': p['skip-cert-verify'],
              sni: p.sni,
              ...(p.udp && { udp: true })
            }
          case 'vless':
            return {
              ...base,
              uuid: p.uuid,
              tls: p.tls,
              'skip-cert-verify': p['skip-cert-verify'],
              flow: p.flow,
              'client-fingerprint': p['client-fingerprint'],
              servername: p.servername,
              'reality-opts': p['reality-opts'],
              ...(p.udp && { udp: true })
            }
          default:
            return {
              ...base,
              ...(p.udp && { udp: true })
            }
        }
      }),

      // 代理组
      'proxy-groups': [
        {
          name: 'Manual',
          type: 'select',
          proxies: ['Auto', 'DIRECT', 'HK', 'Min', ...formattedProxies.map(p => p.name)]
        },
        {
          name: 'Auto',
          type: 'url-test',
          proxies: formattedProxies.map(p => p.name),
          url: 'http://www.gstatic.com/generate_204',
          interval: 300
        },
        {
          name: 'Emby',
          type: 'select',
          proxies: ['Manual', 'Min', ...formattedProxies.map(p => p.name)]
        },
        {
          name: 'HK',
          type: 'url-test',
          proxies: (() => {
            const filtered = formattedProxies.filter(p => /🇭🇰|香港|HK|Hong Kong|HKG/.test(p.name) && !/家宽|Home/.test(p.name)).map(p => p.name)
            return filtered.length > 0 ? filtered : ['DIRECT']
          })(),
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
          tolerance: 50
        },
        {
          name: 'Min',
          type: 'url-test',
          proxies: (() => {
            const filtered = formattedProxies.filter(p => /0\.[0-3](?:[0-9]*)?/.test(p.name)).map(p => p.name)
            return filtered.length > 0 ? filtered : ['DIRECT']
          })(),
          url: 'http://www.gstatic.com/generate_204',
          interval: 300,
          tolerance: 50
        }
      ],

      // 规则
      rules: defaultConfig.rules
    }
    
    // 转换为 YAML，使用紧凑格式
    console.log('转换为 YAML 格式...')
    const yamlConfig = yaml.dump(clashConfig, {
      flowLevel: 2,      // 对对象使用流式格式
      lineWidth: 1000,   // 设置较大的行宽，确保在一行内
      indent: 2,         // 设置缩进
      noRefs: true,      // 避免引用标记
      forceQuotes: false,// 不强制使用引号
      styles: {
        '!!null': 'empty',  // null 值显示为空
        '!!map': 'flow',    // 对象使用流式格式
        '!!seq': 'flow'     // 数组使用流式格式
      }
    })
    console.log('转换完成')

    return new NextResponse(yamlConfig, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
        'subscription-userinfo': `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`,
        'profile-update-interval': '24',
        'profile-title': Buffer.from(subscription.name).toString('base64'),
        'expires': subscription.expire,
        'profile-web-page-url': subscription.homepage,  // 使用原始订阅的首页
        'profile-expire': subscription.expire,
        'profile-status': 'active'
      }
    })
  } catch (error) {
    console.error('处理订阅时出错:', error)
    return new NextResponse('处理订阅时出错', { status: 500 })
  }
}