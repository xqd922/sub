import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Bitly API Token
const BITLY_TOKEN = '0b5d4ec2f8b685271b45d2463daff8023e4ba9b1'

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log('\n=== 开始处理 Bitly 短链接请求 ===')
  
  try {
    const { url } = await request.json()
    console.log('原始URL:', url)

    // 替换 localhost 为实际域名
    const fullUrl = url.replace('http://localhost:3001', 'https://sub.xqd.us.kg')
    console.log('处理后的URL:', fullUrl)

    // 先检查该长链接是否已经有对应的短链接
    const encodedUrl = encodeURIComponent(fullUrl)
    const checkResponse = await fetch(`https://api-ssl.bitly.com/v4/bitlinks/by_url?long_url=${encodedUrl}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BITLY_TOKEN}`
      }
    }).catch(error => {
      console.error('检查短链接错误:', error)
      return null
    })

    // 如果找到已存在的短链接，直接返回
    if (checkResponse?.ok) {
      const existingData = await checkResponse.json()
      const shortUrl = existingData.link
      console.log('找到已存在的短链接:', shortUrl)
      console.log(`处理耗时: ${Date.now() - startTime}ms`)
      console.log('=== 处理完成 ===\n')
      return NextResponse.json({ 
        shortUrl,
        provider: 'Bitly'
      })
    }

    // 如果没有找到，创建新的短链接
    console.log('创建新的短链接...')
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BITLY_TOKEN}`
      },
      body: JSON.stringify({
        long_url: fullUrl,
        domain: "bit.ly"
      })
    }).catch(error => {
      console.error('Fetch 错误:', error)
      return null
    })

    if (!response?.ok) {
      console.error('API 错误:', await response?.text())
      return NextResponse.json({ error: '服务不可用' }, { status: 503 })
    }

    const data = await response.json()
    const shortUrl = data.link
    console.log('短链接生成成功:', shortUrl)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理完成 ===\n')

    return NextResponse.json({ 
      shortUrl,
      provider: 'Bitly'
    })

  } catch (error) {
    console.error('短链接生成错误:', error)
    console.log(`处理失败，耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理失败 ===\n')
    return NextResponse.json({ error: '短链接生成失败' }, { status: 500 })
  }
} 