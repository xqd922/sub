import { NextResponse } from 'next/server'
import yaml from 'js-yaml'
import { parseSubscription } from '@/lib/parsers'
import type { ClashConfig } from '@/lib/types'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    // 从 URL 获取参数
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    // 尝试转换
    const proxies = await parseSubscription(url || '')
    
    const clashConfig: ClashConfig = {
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

    // 返回 YAML 格式的配置
    const yamlConfig = yaml.dump(clashConfig)
    
    return new NextResponse(yamlConfig, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch {
    // 返回空的配置而不是错误信息
    const emptyConfig: ClashConfig = {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': true,
      mode: 'rule',
      'log-level': 'info',
      proxies: [],
      'proxy-groups': [],
      rules: []
    }

    return new NextResponse(yaml.dump(emptyConfig), {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
} 