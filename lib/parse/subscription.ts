import { Proxy, ProxyConfig } from '../core/types'
import yaml from 'js-yaml'
import { logger } from '../core/logger'
import { NetService } from '@/features'

export async function parseSubscription(url: string, clientUserAgent?: string): Promise<Proxy[]> {
  const startTime = Date.now()
  logger.debug(`\n开始解析订阅: ${url}`)

  try {
    // 使用专用的订阅网络请求方法，传递客户端 User-Agent
    const response = await NetService.fetchSubscription(url, clientUserAgent)

    const text = await response.text()
    if (!text || text.length === 0) {
      throw new Error('订阅内容为空，请检查订阅链接是否正确')
    }
    
    if (text.includes('proxies:')) {
      const config = yaml.load(text) as ProxyConfig
      const proxies = config.proxies || []
      
      // 节点去重
      const uniqueProxies = removeDuplicates(proxies)
      
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
        logger.error('节点解析失败:', e)
      }
    }

    return proxies.filter(Boolean) as Proxy[]
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('\n=== 订阅解析失败 ===')
    logger.error(`错误信息: ${error instanceof Error ? error.message : String(error)}`)
    logger.error(`处理耗时: ${duration}ms`)
    logger.error('===================\n')
    throw error
  }
}

// 节点去重函数
function removeDuplicates(proxies: Proxy[]): Proxy[] {
  const seen = new Map<string, Proxy>()
  let infoNodesCount = 0
  let duplicateCount = 0

  logger.log('\n节点处理详情:')
  logger.log('1. 开始过滤信息节点...')

  proxies.forEach(proxy => {
    // 过滤信息节点
    const excludeKeywords = [
      '官网',
      '剩余流量',
      '距离下次重置',
      '套餐到期',
      '订阅',
      '过期时间',
      '流量重置',
      '产品官网'
    ]

    if (excludeKeywords.some(keyword => proxy.name.includes(keyword))) {
      logger.log(`  [信息] 排除节点: ${proxy.name}`)
      infoNodesCount++
      return
    }

    // 生成节点唯一标识符
    const key = generateProxyKey(proxy)

    if (seen.has(key)) {
      const existing = seen.get(key)!
      logger.log(`  [重复] 发现重复节点: ${proxy.name} (已有: ${existing.name})`)
      duplicateCount++
      // 保留名称更短或更规范的节点
      if (proxy.name.length < existing.name.length) {
        seen.set(key, proxy)
      }
    } else {
      seen.set(key, proxy)
    }
  })

  logger.log('\n节点统计信息:')
  logger.log(`  ├─ 原始节点总数: ${proxies.length}`)
  logger.log(`  ├─ 信息节点数量: ${infoNodesCount}`)
  logger.log(`  ├─ 重复节点数量: ${duplicateCount}`)
  logger.log(`  └─ 有效节点数量: ${seen.size}`)

  return Array.from(seen.values())
}

/**
 * 生成节点唯一标识符
 * 根据节点类型和关键配置字段生成唯一 key
 */
function generateProxyKey(proxy: Proxy): string {
  const parts = [proxy.type, proxy.server, proxy.port.toString()]

  // 根据不同协议添加额外的识别字段
  switch (proxy.type) {
    case 'hysteria2':
      parts.push(
        proxy.password || '',
        proxy.sni || '',
        proxy.obfs || '',
        proxy.up || '',
        proxy.down || ''
      )
      break

    case 'vless':
      parts.push(
        proxy.uuid || '',
        proxy.flow || '',
        proxy.network || '',
        proxy.servername || proxy.sni || ''
      )
      if (proxy['reality-opts']) {
        parts.push(
          proxy['reality-opts']['public-key'] || '',
          proxy['reality-opts']['short-id'] || ''
        )
      }
      if (proxy['ws-opts']) {
        parts.push(proxy['ws-opts'].path || '')
      }
      break

    case 'vmess':
      parts.push(
        proxy.uuid || '',
        proxy.network || '',
        proxy.wsPath || '',
        proxy['ws-opts']?.path || ''
      )
      if (proxy.wsHeaders?.Host) {
        parts.push(proxy.wsHeaders.Host)
      }
      if (proxy['ws-opts']?.headers?.Host) {
        parts.push(proxy['ws-opts'].headers.Host)
      }
      break

    case 'ss':
      parts.push(
        proxy.cipher || proxy['encrypt-method'] || '',
        proxy.password || '',
        proxy.plugin || '',
        proxy.obfs || ''
      )
      break

    case 'trojan':
      parts.push(
        proxy.password || '',
        proxy.sni || '',
        proxy.network || ''
      )
      if (proxy['ws-opts']) {
        parts.push(proxy['ws-opts'].path || '')
      }
      if (proxy['grpc-opts']) {
        parts.push(proxy['grpc-opts']['grpc-service-name'] || '')
      }
      break

    default:
      // 未知协议，使用基本字段
      parts.push(proxy.password || proxy.uuid || '')
      break
  }

  // 过滤空字符串并用 : 连接
  return parts.filter(p => p !== '').join(':')
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
    cipher: method || 'aes-256-gcm',
    password: password || ''
  }
}

export function parseVmess(line: string): Proxy {
  const config = JSON.parse(Buffer.from(line.slice(8), 'base64').toString())
  
  const proxy: Proxy = {
    name: config.ps || `${config.add}:${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid),
    cipher: 'auto',
    tls: config.tls === 'tls',
    network: config.net,
    wsPath: config.path
  }

  if (config.host) {
    proxy.wsHeaders = { Host: config.host }
  }

  return proxy
}

export function parseTrojan(line: string): Proxy {
  const url = new URL(line)
  const params = url.searchParams
  
  const proxy: Proxy = {
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : `${url.hostname}:${url.port}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port),
    password: url.username,
    sni: params.get('sni') || url.hostname,
    'skip-cert-verify': params.get('allowInsecure') === '1'
  }

  // 处理传输协议
  const transportType = params.get('type')
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || ''
    }
    if (params.get('mode') === 'gun') {
      proxy['grpc-opts']['grpc-mode'] = 'gun'
    }
  } else if (transportType === 'ws') {
    proxy.network = 'ws'
    proxy['ws-opts'] = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host')! } : {}
    }
  }

  return proxy
} 