import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { importShortLinks } from '@/modules/short-link/short-link.repository'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import type { CreateShortLinkInput, TargetClientOverride } from '@/shared/admin.types'
import {
  isAllowedSubscriptionInput,
  isValidCustomSlug,
  unwrapConversionUrl,
} from '@/shared/url.utils'

export const runtime = 'edge'

const MAX_IMPORT_ITEMS = 200
const VALID_TARGETS = new Set<TargetClientOverride>(['auto', 'clash', 'singbox', 'v2rayng', 'browser'])

export const POST = withAdminAuth('导入短链接', async (request) => {
  const body = await parseJsonBody<{ links?: unknown[] }>(request)
  if (!Array.isArray(body?.links) || body.links.length === 0) {
    throw AppError.validation('请提供要导入的短链接数组（links）', 'links')
  }

  if (body.links.length > MAX_IMPORT_ITEMS) {
    throw AppError.validation(`单次最多导入 ${MAX_IMPORT_ITEMS} 条短链接`, 'links')
  }

  const validItems: CreateShortLinkInput[] = []
  let invalidCount = 0

  for (const raw of body.links) {
    if (!raw || typeof raw !== 'object') {
      invalidCount++
      continue
    }

    const item = raw as Record<string, unknown>
    const rawTarget =
      typeof item.targetUrl === 'string'
        ? item.targetUrl
        : typeof item.url === 'string'
          ? item.url
          : ''

    const { subscriptionUrl, target } = unwrapConversionUrl(rawTarget)
    if (!isAllowedSubscriptionInput(subscriptionUrl)) {
      invalidCount++
      continue
    }

    const normalizedTarget =
      target && target !== 'auto'
        ? `/sub?url=${encodeURIComponent(subscriptionUrl)}&target=${encodeURIComponent(target)}`
        : subscriptionUrl

    const rawSlug =
      typeof item.slug === 'string'
        ? item.slug.trim()
        : typeof item.id === 'string'
          ? item.id.trim()
          : undefined
    const slug = rawSlug && isValidCustomSlug(rawSlug) ? rawSlug : undefined

    const rawExpires =
      typeof item.expiresAt === 'number'
        ? item.expiresAt
        : typeof item.expiration === 'number'
          ? item.expiration < 1e12
            ? item.expiration * 1000
            : item.expiration
          : undefined

    validItems.push({
      targetUrl: normalizedTarget,
      name: typeof item.name === 'string' ? item.name.trim() || undefined : undefined,
      slug,
      comment: typeof item.comment === 'string' ? item.comment.trim() || undefined : undefined,
      disabled: typeof item.disabled === 'boolean' ? item.disabled : undefined,
      expiresAt: rawExpires && Number.isFinite(rawExpires) && rawExpires > 0 ? rawExpires : undefined,
      maxHits:
        typeof item.maxHits === 'number' && Number.isFinite(item.maxHits) && item.maxHits >= 1
          ? Math.floor(item.maxHits)
          : undefined,
      password: typeof item.password === 'string' ? item.password.trim() || undefined : undefined,
      defaultTarget:
        typeof item.defaultTarget === 'string' &&
        VALID_TARGETS.has(item.defaultTarget as TargetClientOverride)
          ? (item.defaultTarget as TargetClientOverride)
          : undefined,
    })
  }

  const result = await importShortLinks(validItems)
  return jsonOk({
    result: {
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed + invalidCount,
    },
  })
})
