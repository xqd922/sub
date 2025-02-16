import { Proxy, ProxyConfig, SubscriptionFetchError } from './types'
import yaml from 'js-yaml'

export async function parseSubscription(url: string): Promise<Proxy[]> {
  const startTime = Date.now()
  console.log(`\n开始解析订阅: ${url}`)

  try {
    const urlObj = new URL(url)
    urlObj.searchParams.set('flag', 'meta')
    urlObj.searchParams.set('types', 'all')
    
    // 改进重试逻辑
    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      let lastError: Error | null = null
      
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`尝试获取订阅 (${i + 1}/${retries})...`)
          
          const response = await fetch(urlObj.toString(), {
            headers: {
              'User-Agent': 'ClashX/1.95.1',
              'Accept': '*/*',
              'Cache-Control': 'no-cache'
            },
            next: { revalidate: 0 }
          })

          // 详细的状态码处理
          if (!response.ok) {
            const statusText = getStatusText(response.status)
            throw new SubscriptionFetchError(
              `订阅获取失败: ${response.status} (${statusText})`,
              response.status
            )
          }

          const text = await response.text()
          if (!text || text.length === 0) {
            throw new Error('订阅内容为空')
          }

          return text
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e))
          console.log(`第 ${i + 1} 次尝试失败: ${lastError.message}`)
          
          if (i < retries - 1) {
            const waitTime = delay * (i + 1)
            console.log(`等待 ${waitTime}ms 后重试...`)
            await new Promise(r => setTimeout(r, waitTime))
          }
        }
      }
      
      throw new SubscriptionFetchError(
        `订阅获取失败 (已重试 ${retries} 次): ${lastError?.message}`,
        lastError instanceof SubscriptionFetchError ? lastError.statusCode : undefined
      )
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
    const duration = Date.now() - startTime
    console.error('\n=== 订阅解析失败 ===')
    console.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`处理耗时: ${duration}ms`)
    console.error('===================\n')
    throw error
  }
}

// 获取HTTP状态码的说明
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    400: '请求无效',
    401: '未授权',
    403: '禁止访问',
    404: '未找到',
    500: '服务器错误',
    502: '网关错误',
    503: '服务不可用',
    504: '网关超时',
    521: 'Web 服务器已关闭',
    522: '连接超时',
    // ... 可以添加更多状态码
  }
  
  return statusMap[status] || '未知错误'
}

// 节点去重函数
function removeDuplicates(proxies: Proxy[]): Proxy[] {
  const seen = new Map<string, Proxy>()
  let infoNodesCount = 0
  let duplicateCount = 0
  
  console.log('\n节点处理详情:')
  console.log('1. 开始过滤信息节点...')
  
  proxies.forEach(proxy => {
    const excludeKeywords = [
      '官网',
      '剩余流量',
      '距离下次重置',
      '套餐到期',
      '订阅'
    ]
    
    if (excludeKeywords.some(keyword => proxy.name.includes(keyword))) {
      console.log(`  [信息] 排除节点: ${proxy.name}`)
      infoNodesCount++
      return
    }

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

    if (seen.has(key)) {
      console.log(`  [重复] 发现重复节点: ${proxy.name}`)
      duplicateCount++
    }
    seen.set(key, proxy)
  })

  console.log('\n节点统计信息:')
  console.log(`  ├─ 原始节点总数: ${proxies.length}`)
  console.log(`  ├─ 信息节点数量: ${infoNodesCount}`)
  console.log(`  ├─ 重复节点数量: ${duplicateCount}`)
  console.log(`  └─ 有效节点数量: ${seen.size}`)
  
  console.log('\n节点类型分布:')
  const typeStats = new Map<string, number>()
  seen.forEach(proxy => {
    typeStats.set(proxy.type, (typeStats.get(proxy.type) || 0) + 1)
  })
  typeStats.forEach((count, type) => {
    console.log(`  ├─ ${type}: ${count}`)
  })
  
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