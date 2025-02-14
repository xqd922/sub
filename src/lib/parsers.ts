import { Proxy, ProxyConfig } from './types'
import yaml from 'js-yaml'

export async function parseSubscription(url: string): Promise<Proxy[]> {
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('flag', 'meta')
    urlObj.searchParams.set('types', 'all')
    
    // 添加重试逻辑
    const fetchWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(urlObj.toString(), {
            headers: {
              'User-Agent': 'ClashX/1.95.1',
              'Accept': '*/*',
              'Cache-Control': 'no-cache'
            },
            next: { revalidate: 0 } // 禁用缓存
          })

          if (!response.ok) {
            throw new Error(`订阅获取失败: ${response.status}`)
          }

          return await response.text()
        } catch (e) {
          if (i === retries - 1) throw e
          await new Promise(r => setTimeout(r, 1000 * (i + 1)))
        }
      }
      throw new Error('所有重试都失败了')
    }

    const text = await fetchWithRetry()
    
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
  const seen = new Map<string, Proxy>()  // 改用 Map 来存储节点
  let infoNodesCount = 0
  
  // 先过滤掉信息节点
  const filteredProxies = proxies.filter(proxy => {
    // 排除包含以下关键词的节点
    const excludeKeywords = [
      '官网',
      '剩余流量',
      '距离下次重置',
      '套餐到期',
      '订阅'
    ]
    
    // 如果节点名称包含任何排除关键词，则跳过
    if (excludeKeywords.some(keyword => proxy.name.includes(keyword))) {
      console.log(`排除信息节点: ${proxy.name}`)
      infoNodesCount++
      return false
    }

    // 生成更详细的唯一标识
    let key = `${proxy.type}:${proxy.server}:${proxy.port}`
    
    // 根据不同协议添加额外的识别字段
    switch (proxy.type) {
      case 'hysteria2':
        key += `:${proxy.ports || ''}:${proxy.mport || ''}:${proxy.password || ''}:${proxy.sni || ''}`
        break
      case 'vless':
        key += `:${proxy.uuid || ''}:${proxy.flow || ''}`
        if (proxy['reality-opts']) {
          key += `:${proxy['reality-opts']['public-key'] || ''}:${proxy['reality-opts']['short-id'] || ''}`
        }
        break
      case 'vmess':
        key += `:${proxy.uuid || ''}:${proxy.network || ''}:${proxy.wsPath || ''}`
        break
      case 'ss':
        key += `:${proxy.cipher || ''}:${proxy.password || ''}`
        break
      case 'trojan':
        key += `:${proxy.password || ''}:${proxy.sni || ''}`
        break
    }

    // 存储节点，如果是重复的会覆盖之前的
    seen.set(key, proxy)
    return true
  })

  console.log(`总节点数: ${proxies.length}`)
  console.log(`排除信息节点: ${infoNodesCount} 个`)
  console.log(`去重后节点数: ${seen.size}`)
  
  // 返回 Map 中的所有值（最后遇到的节点）
  return Array.from(seen.values())
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