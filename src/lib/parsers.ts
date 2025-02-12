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
      return config.proxies || []
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