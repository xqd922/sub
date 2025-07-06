import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Bitly API Token
const BITLY_TOKENS = [
  '0b5d4ec2f8b685271b45d2463daff8023e4ba9b1',
  'token2',  // 添加更多 token
  'token3',
  'token4'
]

let currentTokenIndex = 0

function getNextToken() {
  currentTokenIndex = (currentTokenIndex + 1) % BITLY_TOKENS.length
  return BITLY_TOKENS[currentTokenIndex]
}

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
        'Authorization': `Bearer ${getNextToken()}`
      }
    }).catch(error => {
      console.error('检查短链接错误:', error)
      return null
    })

    // 如果找到已存在的短链接，更新它
    if (checkResponse?.ok) {
      const existingData = await checkResponse.json()
      const bitlink = existingData.id // 获取现有短链接的 ID

      // 更新现有短链接
      console.log('更新已存在的短链接...')
      const updateResponse = await fetch(`https://api-ssl.bitly.com/v4/bitlinks/${bitlink}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getNextToken()}`
        },
        body: JSON.stringify({
          long_url: fullUrl,
          title: `Updated Subscription Link ${new Date().toISOString()}`
        })
      })

      if (!updateResponse.ok) {
        console.error('更新短链接失败:', await updateResponse.text())
        return NextResponse.json({ error: '更新短链接失败' }, { status: 500 })
      }

      const updatedData = await updateResponse.json()
      console.log('短链接更新成功:', updatedData.link)
      console.log(`处理耗时: ${Date.now() - startTime}ms`)
      console.log('=== 处理完成 ===\n')
      
      return NextResponse.json({ 
        shortUrl: updatedData.link,
        provider: 'Bitly',
        updated: true
      })
    }

    // 如果没有找到，创建新的短链接
    console.log('创建新的短链接...')
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getNextToken()}`
      },
      body: JSON.stringify({
        long_url: fullUrl,
        domain: "bit.ly",
        title: `New Subscription Link ${new Date().toISOString()}`
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
    console.log('新短链接生成成功:', data.link)
    console.log(`处理耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理完成 ===\n')

    return NextResponse.json({ 
      shortUrl: data.link,
      provider: 'Bitly',
      created: true
    })

  } catch (error) {
    console.error('短链接处理错误:', error)
    console.log(`处理失败，耗时: ${Date.now() - startTime}ms`)
    console.log('=== 处理失败 ===\n')
    return NextResponse.json({ error: '短链接处理失败' }, { status: 500 })
  }
} 