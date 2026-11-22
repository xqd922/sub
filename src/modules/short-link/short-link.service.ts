import { createShortLink } from '@/modules/short-link/short-link.repository'
import {
  getBitlyTokens,
  getCuttlyToken,
  getSinkConfig,
  getSiteUrl,
} from '@/server/config/env.config'
import { fetchWithRetry, fetchWithTimeout } from '@/server/http/fetch.client'
import { isKvAvailable } from '@/server/kv/kv.client'
import { logger } from '@/server/logger/logger'
import type { ShortenResult } from '@/shared/types/admin.types'
import { extractNameFromUrl } from '@/shared/utils/url.utils'

interface ShortLinkProvider {
  name: string
  shorten: (url: string, requestOrigin?: string) => Promise<ShortenResult>
}

async function generateSinkSlug(url: string): Promise<string> {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    if (token) return token.slice(0, 6)

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 6)
  } catch {
    return ''
  }
}

async function shortenWithKv(url: string, requestOrigin?: string): Promise<ShortenResult> {
  if (!(await isKvAvailable())) {
    throw new Error('KV 服务不可用')
  }

  const shortLink = await createShortLink(url)
  if (!shortLink) {
    throw new Error('KV 创建短链接失败')
  }

  const baseUrl = process.env.SITE_URL || requestOrigin || getSiteUrl()
  return {
    shortUrl: `${baseUrl}/s/${shortLink.id}`,
    provider: 'KV',
    id: shortLink.id,
    created: true,
  }
}

async function shortenWithTinyUrl(url: string): Promise<ShortenResult> {
  const uniqueUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`
  const response = await fetchWithRetry(
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(uniqueUrl)}`,
    {
      retries: 2,
      timeoutMs: 5000,
      headers: { 'Content-Type': 'application/json' },
    },
  )

  const shortUrl = await response.text()
  if (!shortUrl || shortUrl.startsWith('Error')) {
    throw new Error('TinyURL 短链接生成失败')
  }

  return { shortUrl, provider: 'TinyURL', created: true }
}

async function shortenWithSink(url: string): Promise<ShortenResult> {
  const sink = getSinkConfig()
  if (!sink) {
    throw new Error('Sink 服务配置缺失')
  }

  const parsed = new URL(url)
  const originalUrl = parsed.searchParams.get('url')
  if (!originalUrl) {
    throw new Error('无法获取原始订阅链接')
  }

  const name = extractNameFromUrl(originalUrl, '订阅链接')
  const slug = await generateSinkSlug(originalUrl)
  if (!slug) {
    throw new Error('无法生成短链接标识')
  }

  const response = await fetchWithTimeout(`${sink.url}/api/link/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sink.token}`,
    },
    body: JSON.stringify({
      url,
      title: name || '订阅链接',
      description: '由订阅转换服务生成',
      slug,
    }),
  })

  if (response.ok) {
    const data = (await response.json()) as { link: { slug: string; id: string } }
    return {
      shortUrl: `${sink.url}/${data.link.slug}`,
      provider: 'Sink',
      id: data.link.id,
      created: true,
    }
  }

  if (response.status === 409) {
    return { shortUrl: `${sink.url}/${slug}`, provider: 'Sink', reused: true }
  }

  throw new Error(`Sink API 错误: ${response.status} ${await response.text()}`)
}

async function shortenWithBitly(url: string): Promise<ShortenResult> {
  const tokens = getBitlyTokens()
  if (tokens.length === 0) {
    throw new Error('Bitly 服务配置不完整')
  }

  const token = tokens[Math.floor(Math.random() * tokens.length)]
  const fullUrl = url.replace(/https?:\/\/localhost:\d+/, getSiteUrl())

  try {
    const checkRes = await fetchWithTimeout(
      `https://api-ssl.bitly.com/v4/bitlinks/by_url?long_url=${encodeURIComponent(fullUrl)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
    )
    if (checkRes.ok) {
      const existing = (await checkRes.json()) as { id: string }
      const updateRes = await fetchWithTimeout(
        `https://api-ssl.bitly.com/v4/bitlinks/${existing.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            long_url: fullUrl,
            title: `Updated Subscription Link ${new Date().toISOString()}`,
          }),
        },
      )
      if (updateRes.ok) {
        const updated = (await updateRes.json()) as { link: string }
        return { shortUrl: updated.link, provider: 'Bitly', updated: true }
      }
    }
  } catch {
    // 查询已存在短链失败时降级为直接新建
  }

  const createRes = await fetchWithTimeout('https://api-ssl.bitly.com/v4/shorten', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      long_url: fullUrl,
      domain: 'bit.ly',
      title: `New Subscription Link ${new Date().toISOString()}`,
    }),
  })

  if (!createRes.ok) {
    throw new Error(`Bitly API 错误: ${createRes.status} ${await createRes.text()}`)
  }

  const data = (await createRes.json()) as { link: string }
  return { shortUrl: data.link, provider: 'Bitly', created: true }
}

async function shortenWithCuttly(url: string): Promise<ShortenResult> {
  const token = getCuttlyToken()
  if (!token) {
    throw new Error('Cuttly 服务配置不完整')
  }

  const response = await fetchWithTimeout(
    `https://cutt.ly/api/api.php?key=${token}&short=${encodeURIComponent(url)}`,
  )
  if (!response.ok) {
    throw new Error('Cuttly 短链接服务暂时无法访问')
  }

  const data = (await response.json()) as { url?: { status: number; shortLink: string } }
  if (data.url?.status === 7) {
    return { shortUrl: data.url.shortLink, provider: 'Cuttly', created: true }
  }

  throw new Error(`Cuttly API 错误: ${data.url?.status || 'unknown'}`)
}

function normalizeTargetUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('url') ? url : `/sub?url=${encodeURIComponent(url)}`
  } catch {
    return url
  }
}

const PROVIDERS: readonly ShortLinkProvider[] = [
  { name: 'KV', shorten: shortenWithKv },
  { name: 'TinyURL', shorten: shortenWithTinyUrl },
  { name: 'Sink', shorten: shortenWithSink },
  { name: 'Bitly', shorten: shortenWithBitly },
  { name: 'Cuttly', shorten: shortenWithCuttly },
]

export async function generateShortLink(
  url: string,
  requestOrigin?: string,
): Promise<ShortenResult> {
  if (!url) {
    throw new Error('请提供有效的 URL 地址')
  }

  const targetUrl = normalizeTargetUrl(url)
  logger.debug('短链接生成', { original: url, target: targetUrl })

  let lastError: Error | null = null

  for (const provider of PROVIDERS) {
    try {
      logger.debug(`尝试 ${provider.name} 服务`)
      const result = await provider.shorten(targetUrl, requestOrigin)
      logger.debug(`${provider.name} 服务成功`, { shortUrl: result.shortUrl })
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(`${provider.name} 服务失败: ${lastError.message}`)
    }
  }

  throw new Error(`所有短链接服务暂时不可用，请稍后重试: ${lastError?.message || '未知错误'}`)
}
