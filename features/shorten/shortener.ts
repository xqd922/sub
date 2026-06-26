import { logger } from '@/lib/core/logger'
import { fetchShortUrl } from '../metrics/network'
import { isAvailable as isKVAvailable, createShortLink } from '@/lib/kv'

/**
 * 短链接提供商配置
 */
interface ShortProvider {
  name: string
  timeout: number
  retries: number
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

/**
 * KV 处理器 - 使用 Cloudflare KV 存储
 */
async function handleKV(url: string): Promise<ShortResult> {
  // 检查 KV 是否可用
  if (!(await isKVAvailable())) {
    throw new Error('KV 服务不可用')
  }

  const shortLink = await createShortLink(url)
  if (!shortLink) {
    throw new Error('KV 创建短链接失败')
  }

  // 构建短链接 URL
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

/**
 * TinyURL 处理器
 */
async function handleTinyUrl(url: string): Promise<ShortResult> {
  // 添加时间戳确保唯一性
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

/**
 * 带超时的 fetch 封装
 */
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

/**
 * 生成短链接标识
 */
async function generateSlug(url: string): Promise<string> {
  try {
    const urlObj = new URL(url)
    const token = urlObj.searchParams.get('token')
    if (token) {
      return token.slice(0, 6)
    }

    // 使用 URL 的 SHA-256 前6位
    const msgBuffer = new TextEncoder().encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex.slice(0, 6)
  } catch {
    return ''
  }
}

/**
 * 从URL提取名称
 */
function getNameFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url)
    const name = urlObj.searchParams.get('name')
    if (name) return decodeURIComponent(name)

    const remarks = urlObj.searchParams.get('remarks')
    if (remarks) return decodeURIComponent(remarks)

    return undefined
  } catch {
    return undefined
  }
}

/**
 * Sink 处理器
 * Requires env vars: SINK_URL, SINK_TOKEN
 */
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

    const name = getNameFromUrl(originalUrl)
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

/**
 * Bitly 处理器
 * Requires env var: BITLY_API_TOKEN (comma-separated for multiple tokens)
 */
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
  const fullUrl = url.replace('http://localhost:3001', 'https://sub.xqd.us.kg')

  // 检查是否已存在
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

      // 更新现有短链接
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
    // 忽略检查错误，继续创建新链接
  }

  // 创建新短链接
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

/**
 * Cuttly 处理器
 */
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

/**
 * 处理URL格式
 */
function processUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const originalUrl = parsedUrl.searchParams.get('url')

    // 如果已经是转换过的链接，直接使用
    if (originalUrl) {
      return url
    }

    // 如果不是转换过的链接，需要先转换
    return `/sub?url=${encodeURIComponent(url)}`
  } catch {
    return url
  }
}

// KV 优先
const PROVIDERS: Record<string, ShortProvider> = {
  kv: {
    name: 'KV',
    timeout: 3000,
    retries: 1,
    handler: handleKV
  },
  tinyurl: {
    name: 'TinyURL',
    timeout: 3000,
    retries: 1,
    handler: handleTinyUrl
  },
  sink: {
    name: 'Sink',
    timeout: 3000,
    retries: 1,
    handler: handleSink
  },
  bitly: {
    name: 'Bitly',
    timeout: 5000,
    retries: 2,
    handler: handleBitly
  },
  cuttly: {
    name: 'Cuttly',
    timeout: 3000,
    retries: 1,
    handler: handleCuttly
  }
}

const SERVICE_ORDER = ['kv', 'tinyurl', 'sink', 'bitly', 'cuttly'] as const

/**
 * 短链接服务 - 统一管理多个短链接提供商
 * 生成短链接 - 按优先级尝试多个服务
 */
export async function generate(url: string): Promise<ShortResult> {
  if (!url) {
    throw new Error('请提供有效的URL地址')
  }

  // 处理链接格式
  const targetUrl = processUrl(url)
  logger.debug('短链接生成', { original: url, target: targetUrl })

  // 按优先级尝试服务
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
