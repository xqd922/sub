import { ClashConfig, Proxy } from '@/lib/types'

// 生成代理组配置
export function generateProxyGroups(proxies: Proxy[]) {
  const proxyNames = proxies.map(proxy => proxy.name);
  
  return [
    {
      name: 'Manual',
      type: 'select',
      proxies: ['Auto', 'DIRECT', 'HK', 'Min', ...proxyNames]
    },
    {
      name: 'Auto',
      type: 'url-test',
      proxies: proxyNames,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    },
    {
      name: 'Emby',
      type: 'select',
      proxies: ['Manual', 'Min', ...proxyNames]
    },
    {
      name: 'HK',
      type: 'url-test',
      proxies: (() => {
        const filtered = proxyNames.filter(p => /香港|HK|Hong Kong|HKG/.test(p) && !/家宽|Home/.test(p)).map(p => p)
        return filtered.length > 0 ? filtered : ['DIRECT']
      })(),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    },
    {
      name: 'Min',
      type: 'url-test',
      proxies: (() => {
        const filtered = proxyNames.filter(p => /0\.[0-3](?:[0-9]*)?/.test(p)).map(p => p)
        return filtered.length > 0 ? filtered : ['DIRECT']
      })(),
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50
    }
  ]
}

// 默认配置
export const defaultConfig: ClashConfig = {
  port: 7890,
  'socks-port': 7891,
  'allow-lan': true,
  mode: 'Rule',
  'log-level': 'info',
  'external-controller': ':9090',
  sniffer: {
    sniff: {
      TLS: { ports: [1, 65535], 'override-destination': true },
      HTTP: { ports: [1, 65535], 'override-destination': true }
    },
    enable: true,
    'skip-domain': ['Mijia Cloud', 'dlg.io.mi.com'],
    'parse-pure-ip': true,
    'force-dns-mapping': true,
    'override-destination': true
  },
  dns: {
    ipv6: false,
    enable: true,
    listen: '0.0.0.0:1053',
    'use-hosts': false,
    'default-nameserver': ['119.28.28.28', '119.29.29.29', '223.5.5.5', '223.6.6.6'],
    nameserver: ['119.29.29.29', '223.5.5.5', 'tls://dot.pub:853', 'tls://dns.alidns.com:853', 'https://doh.pub:443/dns-query', 'https://dns.alidns.com:443/dns-query'],
    'fake-ip-range': '198.18.0.1/15',
    'fake-ip-filter': [
      '*.lan', '*.localdomain', '*.example', '*.invalid', '*.localhost', '*.test', '*.local', '*.home.arpa',
      'time.*.com', 'time.*.gov', 'time.*.edu.cn', 'time.*.apple.com',
      'time1.*.com', 'time2.*.com', 'time3.*.com', 'time4.*.com', 'time5.*.com', 'time6.*.com', 'time7.*.com',
      'ntp.*.com', 'ntp1.*.com', 'ntp2.*.com', 'ntp3.*.com', 'ntp4.*.com', 'ntp5.*.com', 'ntp6.*.com', 'ntp7.*.com',
      '*.time.edu.cn', '*.ntp.org.cn', '+.pool.ntp.org', 'time1.cloud.tencent.com',
      'stun.*.*', 'stun.*.*.*', 'swscan.apple.com', 'mesu.apple.com',
      'music.163.com', '*.music.163.com', '*.126.net', 'musicapi.taihe.com', 'music.taihe.com',
      'songsearch.kugou.com', 'trackercdn.kugou.com', '*.kuwo.cn',
      'api-jooxtt.sanook.com', 'api.joox.com',
      'y.qq.com', '*.y.qq.com', 'streamoc.music.tc.qq.com', 'mobileoc.music.tc.qq.com',
      'isure.stream.qqmusic.qq.com', 'dl.stream.qqmusic.qq.com', 'aqqmusic.tc.qq.com', 'amobile.music.tc.qq.com',
      'localhost.ptlogin2.qq.com', '*.msftconnecttest.com', '*.msftncsi.com', '*.xiami.com',
      '*.music.migu.cn', 'music.migu.cn', '+.wotgame.cn', '+.wggames.cn', '+.wowsgame.cn', '+.wargaming.net',
      '*.*.*.srv.nintendo.net', '*.*.stun.playstation.net', 'xbox.*.*.microsoft.com', '*.*.xboxlive.com',
      '*.ipv6.microsoft.com', 'teredo.*.*.*', 'teredo.*.*', 'speedtest.cros.wr.pvp.net',
      '+.jjvip8.com', 'www.douyu.com', 'activityapi.huya.com', 'activityapi.huya.com.w.cdngslb.com',
      'www.bilibili.com', 'api.bilibili.com', 'a.w.bilicdn1.com', 'eud.cn','*.eud.cn'
    ]
  },
  proxies: [],
  'proxy-groups': [],
  rules: [
    'DOMAIN,1001.pp.ua,DIRECT',
    'DOMAIN-SUFFIX,sudugu.com,DIRECT',
    'DOMAIN,chat.qwen.ai,DIRECT',
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
    // Emby
    'DOMAIN,cftest1.mobai.sbs,Emby',
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
    'DOMAIN-SUFFIX,lilyemby.my,Emby',
    'DOMAIN,tv.811861.xyz,Emby',
    'IP-CIDR,207.211.186.139/32,Emby',
    'DOMAIN-SUFFIX,029902.xyz,Emby',
    'DOMAIN-SUFFIX,yhemby.top,Emby',
    'DOMAIN-SUFFIX,nanflix.net,Emby',
    'DOMAIN-SUFFIX,alphatvapp.top,Emby',
    'DOMAIN,emby.my,Emby',
    'DOMAIN,cfemby.lilyya.xyz,Emby',
    'DOMAIN-SUFFIX,emby.awatv.de,Emby',
    'DOMAIN-SUFFIX,jsq.mooguu.top,Emby',
    'DOMAIN-SUFFIX,sfcj.org,Emby',
    'DOMAIN-KEYWORD,mius,Emby',
    'DOMAIN,embymv.link,Emby',
    'DOMAIN,onatoshi.114514.quest,Emby',
    'DOMAIN-SUFFIX,emby.feiniul.lol,Emby',
    'DOMAIN-SUFFIX,tanhuatv.site,Emby',
    'DOMAIN-SUFFIX,hkb-emby.aliz.work,Emby',
    'DOMAIN-SUFFIX,onatoshi.114514.quest,Emby',
    'DOMAIN-SUFFIX,tufei.de,Emby',
    'DOMAIN-SUFFIX,cf.5msky.com,Emby',
    'DOMAIN-SUFFIX,oceancloud.asia,Emby',
    'IP-CIDR,152.53.81.68/32,Emby',
    'DOMAIN-KEYWORD,emby,Emby',
    // 默认
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