import { logger } from '@/logger'
import { fetchShortUrl } from '@/network/client'
import { isAvailable as isKVAvailable, createShortLink } from '@/kv'
import { extractNameFromUrl } from '@/utils'

interface ShortProvider {
  name: string
  handler: (url: string) => Promise<ShortResult>
}

interface ShortResult {
  shortUrl: string
  provider: string
  created?: boolean
  updated?: boolean
  reused?: boolean
  id?: string
}

async function handleKV(url: string): Promise<ShortResult> {

  if (!(await isKVAvailable())) {
    throw new Error('KV 服务不可用')
  }

  const shortLink = await createShortLink(url)
  if (!shortLink) {
    throw new Error('KV 创建短链接失败')
  }

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.SITE_URL || 'https://sub.xqd.pp.ua'

  return {
    shortUrl: `${baseUrl}/s/${shortLink.id}`,
    provider: 'KV',
    id: shortLink.id,
    created: true
  }
}

async function handleTinyUrl(url: string): Promise<ShortResult> {

  const timestamp = Date.now()
  const uniqueUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${timestamp}`

  const response = await fetchShortUrl(
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(uniqueUrl)}`
  )

  if (!response.ok) {
    throw new Error('TinyURL短链接服务暂时无法访问，请稍后重试')
  }

  const shortUrl = await response.text()
  if (!shortUrl || shortUrl.startsWith('Error')) {
    throw new Error('短链接生成失败，请检查网络连接后重试')
  }

  return {
    shortUrl,
    provider: 'TinyURL',
    created: true
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 5000
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function generateSlug(url: string): Promise<string> {
  try {
    const urlObj = new URL(url)
    const token = urlObj.searchParams.get('token')
    if (token) {
      return token.slice(0, 6)
    }

    const msgBuffer = new TextEncoder().encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex.slice(0, 6)
  } catch {
    return ''
  }
}

async function handleSink(url: string): Promise<ShortResult> {
  const SINK_URL = process.env.SINK_URL
  const SINK_TOKEN = process.env.SINK_TOKEN

  if (!SINK_URL || !SINK_TOKEN) {
    throw new Error('Sink 服务配置缺失: 请设置 SINK_URL 和 SINK_TOKEN 环境变量')
  }

  try {
    const convertedUrl = new URL(url)
    const originalUrl = convertedUrl.searchParams.get('url')
    if (!originalUrl) {
      throw new Error('无法获取原始订阅链接')
    }

    const name = extractNameFromUrl(originalUrl, '订阅链接')
    const slug = await generateSlug(originalUrl)
    if (!slug) {
      throw new Error('无法生成短链接标识')
    }

    const response = await fetchWithTimeout(`${SINK_URL}/api/link/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SINK_TOKEN}`
      },
      body: JSON.stringify({
        url,
        title: name || '订阅链接',
        description: '由订阅转换服务生成',
        slug
      })
    })

    if (response.ok) {
      const data = await response.json() as { link: { slug: string; id: string } }
      return {
        shortUrl: `${SINK_URL}/${data.link.slug}`,
        provider: 'Sink',
        id: data.link.id,
        created: true
      }
    } else if (response.status === 409) {
      return {
        shortUrl: `${SINK_URL}/${slug}`,
        provider: 'Sink',
        reused: true
      }
    } else {
      const errorText = await response.text()
      throw new Error(`Sink API 错误: ${response.status} ${errorText}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Sink 服务处理失败')
  }
}

async function handleBitly(url: string): Promise<ShortResult> {
  const rawToken = process.env.BITLY_API_TOKEN
  if (!rawToken) {
    throw new Error('Bitly服务配置不完整: 请设置 BITLY_API_TOKEN 环境变量')
  }

  const BITLY_TOKENS = rawToken.split(',').map(t => t.trim()).filter(Boolean)
  if (BITLY_TOKENS.length === 0) {
    throw new Error('Bitly服务配置不完整: BITLY_API_TOKEN 为空')
  }

  const token = BITLY_TOKENS[Math.floor(Math.random() * BITLY_TOKENS.length)]
  const siteUrl = process.env.SITE_URL || 'https://sub.xqd.us.kg'
  const fullUrl = url.replace(/https?:\/\/localhost:\d+/, siteUrl)

  try {
    const encodedUrl = encodeURIComponent(fullUrl)
    const checkResponse = await fetchWithTimeout(
      `https://api-ssl.bitly.com/v4/bitlinks/by_url?long_url=${encodedUrl}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (checkResponse.ok) {
      const existingData = await checkResponse.json() as { id: string }
      const bitlink = existingData.id

      const updateResponse = await fetchWithTimeout(
        `https://api-ssl.bitly.com/v4/bitlinks/${bitlink}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            long_url: fullUrl,
            title: `Updated Subscription Link ${new Date().toISOString()}`
          })
        }
      )

      if (updateResponse.ok) {
        const updatedData = await updateResponse.json() as { link: string }
        return {
          shortUrl: updatedData.link,
          provider: 'Bitly',
          updated: true
        }
      }
    }
  } catch {

  }

  const response = await fetchWithTimeout('https://api-ssl.bitly.com/v4/shorten', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      long_url: fullUrl,
      domain: "bit.ly",
      title: `New Subscription Link ${new Date().toISOString()}`
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bitly API 错误: ${response.status} ${errorText}`)
  }

  const data = await response.json() as { link: string }
  return {
    shortUrl: data.link,
    provider: 'Bitly',
    created: true
  }
}

async function handleCuttly(url: string): Promise<ShortResult> {
  const token = process.env.CUTTLY_TOKEN
  if (!token) {
    throw new Error('Cuttly服务配置不完整，请检查API密钥设置')
  }

  const response = await fetchWithTimeout(
    `https://cutt.ly/api/api.php?key=${token}&short=${encodeURIComponent(url)}`
  )

  if (!response.ok) {
    throw new Error('Cuttly短链接服务暂时无法访问，请稍后重试')
  }

  const data = await response.json() as { url?: { status: number; shortLink: string } }
  if (data.url?.status === 7) {
    return {
      shortUrl: data.url.shortLink,
      provider: 'Cuttly',
      created: true
    }
  }

  throw new Error(`Cuttly API 错误: ${data.url?.status || 'unknown'}`)
}

function processUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const originalUrl = parsedUrl.searchParams.get('url')

    if (originalUrl) {
      return url
    }

    return `/sub?url=${encodeURIComponent(url)}`
  } catch {
    return url
  }
}

const PROVIDERS: Record<string, ShortProvider> = {
  kv: {
    name: 'KV',
    handler: handleKV
  },
  tinyurl: {
    name: 'TinyURL',
    handler: handleTinyUrl
  },
  sink: {
    name: 'Sink',
    handler: handleSink
  },
  bitly: {
    name: 'Bitly',
    handler: handleBitly
  },
  cuttly: {
    name: 'Cuttly',
    handler: handleCuttly
  }
}

const SERVICE_ORDER = ['kv', 'tinyurl', 'sink', 'bitly', 'cuttly'] as const

export async function generate(url: string): Promise<ShortResult> {
  if (!url) {
    throw new Error('请提供有效的URL地址')
  }

  const targetUrl = processUrl(url)
  logger.debug('短链接生成', { original: url, target: targetUrl })

  let lastError: Error | null = null

  for (const serviceName of SERVICE_ORDER) {
    const provider = PROVIDERS[serviceName]
    if (!provider) continue

    try {
      logger.debug(`尝试 ${provider.name} 服务`)

      const result = await provider.handler(targetUrl)
      logger.debug(`${provider.name} 服务成功`, { shortUrl: result.shortUrl })

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(`${provider.name} 服务失败: ${lastError.message}`)
      continue
    }
  }

  throw new Error(`所有短链接服务暂时不可用，请稍后重试: ${lastError?.message || '未知错误'}`)
}