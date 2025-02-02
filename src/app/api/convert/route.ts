import { NextResponse } from 'next/server'
import yaml from 'js-yaml'
import { parseSubscription } from '@/lib/parsers'
import type { ClashConfig } from '@/lib/types'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: '请输入订阅链接' }, { status: 400 })
    }

    const proxies = await parseSubscription(url)
    
    const config: ClashConfig = {
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