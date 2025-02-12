import { Proxy, ProxyConfig } from './types'
import yaml from 'js-yaml'

export async function parseSubscription(url: string): Promise<Proxy[]> {
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('flag', 'meta')
    urlObj.searchParams.set('types', 'all')
    
    const response = await fetch(urlObj.toString(), {
      headers: {
        'User-Agent': 'ClashX/1.95.1'
      }
    })

    if (!response.ok) {
      throw new Error('订阅获取失败')
    }

    const text = await response.text()
    
    if (text.includes('proxies:')) {
      const config = yaml.load(text) as ProxyConfig
      const proxies = config.proxies || []
      
      // 节点去重
      const uniqueProxies = removeDuplicates(proxies)
      console.log(`去重前节点数: ${proxies.length}, 去重后节点数: ${uniqueProxies.length}`)
      
      return uniqueProxies
    }
    
    const decodedText = Buffer.from(text, 'base64').toString()
    const proxies = []
    const lines = decodedText.split('\n')
    
    for (const line of lines) {
      if (!line) continue
      
      try {
        if (line.startsWith('ss://')) {
          proxies.push(parseSS(line))
        } else if (line.startsWith('vmess://')) {
          proxies.push(parseVmess(line))
        } else if (line.startsWith('trojan://')) {
          proxies.push(parseTrojan(line))
        }
      } catch (e) {
        console.error('节点解析失败:', e)
      }
    }

    return proxies.filter(Boolean) as Proxy[]
  } catch (error) {
    console.error('解析订阅失败:', error)
    throw error
  }
}

// 节点去重函数
function removeDuplicates(proxies: Proxy[]): Proxy[] {
  const seen = new Set<string>()
  
  return proxies.filter(proxy => {
    // 生成更详细的唯一标识
    let key = `${proxy.type}:${proxy.server}:${proxy.port}`
    
    // 根据不同协议添加额外的识别字段
    switch (proxy.type) {
      case 'hysteria2':
        // hysteria2 需要考虑 ports, mport, password, sni
        key += `:${proxy.ports || ''}:${proxy.mport || ''}:${proxy.password || ''}:${proxy.sni || ''}`
        break
      case 'vless':
        // vless 需要考虑 uuid, flow, reality-opts
        key += `:${proxy.uuid || ''}:${proxy.flow || ''}`
        if (proxy['reality-opts']) {
          key += `:${proxy['reality-opts']['public-key'] || ''}:${proxy['reality-opts']['short-id'] || ''}`
        }
        break
      case 'vmess':
        // vmess 需要考虑 uuid, network, path
        key += `:${proxy.uuid || ''}:${proxy.network || ''}:${proxy.wsPath || ''}`
        break
      case 'ss':
        // ss 需要考虑 cipher, password
        key += `:${proxy.cipher || ''}:${proxy.password || ''}`
        break
      case 'trojan':
        // trojan 需要考虑 password, sni
        key += `:${proxy.password || ''}:${proxy.sni || ''}`
        break
    }

    // 如果已存在相同节点，则过滤掉
    if (seen.has(key)) {
      console.log(`发现重复节点: ${proxy.name}`)
      return false
    }
    
    // 记录新节点
    seen.add(key)
    return true
  })
}

export function parseSS(line: string): Proxy {
  const url = new URL(line)
  const [method, password] = Buffer.from(url.username, 'base64')
    .toString()
    .split(':')

  return {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'ss',
    server: url.hostname,
    port: parseInt(url.port),
    cipher: method,
    password: password
  }
}

export function parseVmess(line: string): Proxy {
  const config = JSON.parse(Buffer.from(line.slice(8), 'base64').toString())
  
  return {
    name: config.ps || `${config.add}:${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid),
    cipher: 'auto',
    tls: config.tls === 'tls',
    network: config.net,
    wsPath: config.path,
    wsHeaders: config.host ? { Host: config.host } : undefined
  }
}

export function parseTrojan(line: string): Proxy {
  const url = new URL(line)
  
  return {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    sni: url.searchParams.get('sni') || url.hostname,
    skipCertVerify: url.searchParams.get('allowInsecure') === '1'
  }
} 