import { createShortLink } from '@/modules/short-link/short-link.repository'
import {
  getBitlyTokens,
  getCuttlyToken,
  getSinkConfig,
  getSiteUrl,
} from '@/server/env.config'
import { fetchWithRetry, fetchWithTimeout } from '@/server/fetch.client'
import { isKvAvailable } from '@/server/kv/kv.client'
import { logger } from '@/server/logger'
import type { ShortenResult, TargetClientOverride } from '@/shared/admin.types'
import {
  buildConversionUrl,
  extractNameFromUrl,
  unwrapConversionUrl,
} from '@/shared/url.utils'

interface NormalizedShortenTarget {
  kvTarget: string
  externalConversionUrl: string
  rawSubscriptionUrl: string
  siteOrigin: string
}

interface ShortLinkProvider {
  name: string
  shorten: (target: NormalizedShortenTarget) => Promise<ShortenResult>
}

function buildNormalizedTarget(url: string, requestOrigin?: string): NormalizedShortenTarget {
  const siteOrigin = process.env.SITE_URL || requestOrigin || getSiteUrl()
  const { subscriptionUrl, target } = unwrapConversionUrl(url)
  const targetClient = (target as TargetClientOverride | undefined) || 'auto'

  const externalConversionUrl = buildConversionUrl(siteOrigin, subscriptionUrl, targetClient)
  // KV 侧优先存干净的原始订阅地址；若指定了 target 则保留相对 `/sub?url=...&target=...`
  const kvTarget =
    target && target !== 'auto'
      ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
      : subscriptionUrl

  return {
    kvTarget,
    externalConversionUrl,
    rawSubscriptionUrl: subscriptionUrl,
    siteOrigin,
  }
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

async function shortenWithKv(target: NormalizedShortenTarget): Promise<ShortenResult> {
  if (!(await isKvAvailable())) {
    throw new Error('KV 服务不可用')
  }

  const shortLink = await createShortLink(target.kvTarget)
  if (!shortLink) {
    throw new Error('KV 创建短链接失败')
  }

  return {
    shortUrl: `${target.siteOrigin}/s/${shortLink.id}`,
    provider: 'KV',
    id: shortLink.id,
    created: true,
  }
}

async function shortenWithTinyUrl(target: NormalizedShortenTarget): Promise<ShortenResult> {
  const baseUrl = target.externalConversionUrl
  const uniqueUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
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

async function shortenWithSink(target: NormalizedShortenTarget): Promise<ShortenResult> {
  const sink = getSinkConfig()
  if (!sink) {
    throw new Error('Sink 服务配置缺失')
  }

  const name = extractNameFromUrl(target.rawSubscriptionUrl, '订阅链接')
  const slug = await generateSinkSlug(target.rawSubscriptionUrl)
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
      url: target.externalConversionUrl,
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

async function shortenWithBitly(target: NormalizedShortenTarget): Promise<ShortenResult> {
  const tokens = getBitlyTokens()
  if (tokens.length === 0) {
    throw new Error('Bitly 服务配置不完整')
  }

  const token = tokens[Math.floor(Math.random() * tokens.length)]
  const fullUrl = target.externalConversionUrl.replace(/https?:\/\/localhost:\d+/, getSiteUrl())

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

async function shortenWithCuttly(target: NormalizedShortenTarget): Promise<ShortenResult> {
  const token = getCuttlyToken()
  if (!token) {
    throw new Error('Cuttly 服务配置不完整')
  }

  const response = await fetchWithTimeout(
    `https://cutt.ly/api/api.php?key=${token}&short=${encodeURIComponent(target.externalConversionUrl)}`,
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

  const normalized = buildNormalizedTarget(url, requestOrigin)
  logger.debug('短链接生成', { original: url, target: normalized.kvTarget })

  let lastError: Error | null = null

  for (const provider of PROVIDERS) {
    try {
      logger.debug(`尝试 ${provider.name} 服务`)
      const result = await provider.shorten(normalized)
      logger.debug(`${provider.name} 服务成功`, { shortUrl: result.shortUrl })
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      logger.warn(`${provider.name} 服务失败: ${lastError.message}`)
    }
  }

  throw new Error(`所有短链接服务暂时不可用，请稍后重试: ${lastError?.message || '未知错误'}`)
}
