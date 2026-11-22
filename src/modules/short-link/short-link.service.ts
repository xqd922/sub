import { createShortLink } from '@/modules/short-link/short-link.repository'
import { getSiteUrl } from '@/server/env.config'
import { isKvAvailable } from '@/server/kv/kv.client'
import { logger } from '@/server/logger'
import type { ShortenResult } from '@/shared/admin.types'
import { unwrapConversionUrl } from '@/shared/url.utils'

function buildNormalizedTarget(
  url: string,
  requestOrigin?: string,
): { kvTarget: string; siteOrigin: string } {
  const siteOrigin = process.env.SITE_URL || requestOrigin || getSiteUrl()
  const { subscriptionUrl, target } = unwrapConversionUrl(url)

  // KV 侧优先存干净的原始订阅地址；若指定了 target 则保留相对 `/sub?url=...&target=...`
  const kvTarget =
    target && target !== 'auto'
      ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
      : subscriptionUrl

  return { kvTarget, siteOrigin }
}

export async function generateShortLink(
  url: string,
  requestOrigin?: string,
): Promise<ShortenResult> {
  if (!url) {
    throw new Error('请提供有效的 URL 地址')
  }

  const { kvTarget, siteOrigin } = buildNormalizedTarget(url, requestOrigin)
  logger.debug('短链接生成', { original: url, target: kvTarget })

  if (!(await isKvAvailable())) {
    throw new Error('KV 存储不可用，无法创建短链接')
  }

  const shortLink = await createShortLink(kvTarget)
  if (!shortLink) {
    throw new Error('KV 创建短链接失败')
  }

  return {
    shortUrl: `${siteOrigin}/s/${shortLink.id}`,
    provider: 'KV',
    id: shortLink.id,
    created: true,
  }
}
