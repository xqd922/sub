import { NextResponse } from 'next/server'
import yaml from 'js-yaml'

// 定义配置类型
type ConfigType = 'basic' | 'custom' | 'microsoft' | 'google' | 'full'

const CONFIG_OPTIONS: Record<ConfigType, string> = {
  basic: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini',
  custom: 'https://raw.githubusercontent.com/xqd922/Xqd-Sub/refs/heads/main/my/my.ini',
  microsoft: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_Microsoft.ini',
  google: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_Google.ini',
  full: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Full.ini'
}

// 添加类型检查函数
function isConfigType(value: string): value is ConfigType {
  return value in CONFIG_OPTIONS
}

// 支持的订阅类型
type SubType = 'ss' | 'ssr' | 'vmess' | 'trojan' | 'mixed'

// 解析订阅内容
async function parseSubscription(url: string): Promise<any[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClashX/1.95.1'
      }
    })

    if (!response.ok) {
      throw new Error('订阅获取失败')
    }

    const text = await response.text()
    
    // 如果已经是 Clash 配置，直接返回
    if (text.includes('proxies:')) {
      const config = yaml.load(text) as any
      return config.proxies || []
    }
    
    // 解码 base64 内容
    const decodedText = Buffer.from(text, 'base64').toString()
    
    // 解析各种格式的节点
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

    return proxies.filter(Boolean)
  } catch (error) {
    console.error('解析订阅失败:', error)
    throw error
  }
}

// 解析 SS 链接
function parseSS(line: string) {
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

// 解析 Vmess 链接
function parseVmess(line: string) {
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

// 解析 Trojan 链接
function parseTrojan(line: string) {
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

// 转换为 Clash 配置
function convertToClash(proxies: any[], config: any = {}): string {
  const clashConfig = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'rule',
    'log-level': 'info',
    proxies,
    'proxy-groups': [
      {
        name: '🚀 节点选择',
        type: 'select',
        proxies: ['DIRECT', ...proxies.map(p => p.name)]
      },
      {
        name: '🌍 国外媒体',
        type: 'select',
        proxies: ['🚀 节点选择', ...proxies.map(p => p.name)]
      },
      {
        name: '📲 电报信息',
        type: 'select',
        proxies: ['🚀 节点选择', ...proxies.map(p => p.name)]
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,google.com,🚀 节点选择',
      'DOMAIN-SUFFIX,telegram.org,📲 电报信息',
      'DOMAIN-SUFFIX,netflix.com,🌍 国外媒体',
      'GEOIP,CN,DIRECT',
      'MATCH,🚀 节点选择'
    ]
  }

  return yaml.dump(clashConfig)
}

// 在 isConfigType 函数后添加
interface Proxy {
  name: string
  type: string
  server: string
  port: number
  cipher?: string
  password?: string
  uuid?: string
  alterId?: number
  network?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  tls?: boolean
  skipCertVerify?: boolean
}

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: '请输入订阅链接' }, { status: 400 })
    }

    // 解析订阅
    const proxies = await parseSubscription(url)
    
    // 生成 Clash 配置
    const config = {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': true,
      mode: 'rule',
      'log-level': 'info',
      proxies,
      'proxy-groups': [
        {
          name: '🚀 节点选择',
          type: 'select',
          proxies: ['DIRECT', ...proxies.map(p => p.name)]
        }
      ],
      rules: [
        'GEOIP,CN,DIRECT',
        'MATCH,🚀 节点选择'
      ]
    }

    return new NextResponse(yaml.dump(config), {
      headers: {
        'Content-Type': 'text/yaml',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('转换错误:', error)
    return NextResponse.json(
      { error: '转换失败，请检查订阅链接是否正确' },
      { status: 500 }
    )
  }
} 