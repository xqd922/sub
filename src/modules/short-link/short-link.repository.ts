import { generateRecordId, getRecordById } from '@/modules/record/record.repository'
import { AppError, ErrorCode, ErrorSeverity } from '@/server/app-error'
import { getKvStore, getManyJson } from '@/server/kv/kv.client'
import { KV_KEYS, KV_TTL_SECONDS } from '@/server/kv/kv.types'
import { logger } from '@/server/logger'
import type {
  ConvertRecord,
  CreateShortLinkInput,
  ShortLink,
  ShortLinkImportResult,
  TargetClientOverride,
  UpdateShortLinkInput,
} from '@/shared/admin.types'
import {
  isAutoManagedShortLinkName,
  isValidCustomSlug,
  resolveShortLinkName,
  unwrapConversionUrl,
} from '@/shared/url.utils'

const SHORT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export type ShortLinkResolveResult =
  | { status: 'ok'; link: ShortLink }
  | { status: 'not_found' }
  | { status: 'disabled'; link: ShortLink }
  | { status: 'expired'; link: ShortLink }
  | { status: 'limit_reached'; link: ShortLink }
  | { status: 'unauthorized'; link: ShortLink }

export interface ResolveShortLinkContext {
  key?: string | null
  clientIp?: string
  clientType?: string
  userAgent?: string
}

const VALID_DEFAULT_TARGETS = new Set<TargetClientOverride>([
  'auto',
  'clash',
  'singbox',
  'v2rayng',
  'browser',
])

function normalizeDefaultTarget(value?: TargetClientOverride | null): TargetClientOverride | undefined {
  if (!value || value === 'auto') return undefined
  return VALID_DEFAULT_TARGETS.has(value) ? value : undefined
}

async function sha256Hex(value: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function generateShortId(seed: string): Promise<string> {
  const hashHex = await sha256Hex(seed)
  let id = ''
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(hashHex.slice(i * 2, i * 2 + 2), 16) % SHORT_ID_ALPHABET.length
    id += SHORT_ID_ALPHABET[idx]
  }
  return id
}

async function generateUniqueShortId(targetUrl: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = await generateShortId(attempt === 0 ? targetUrl : `${targetUrl}#${attempt}`)
    const occupied = await getShortLink(candidate)
    if (!occupied || occupied.targetUrl === targetUrl) {
      return candidate
    }
  }
  return generateShortId(`${targetUrl}#${Date.now()}-${Math.random()}`)
}

async function getUrlHash(url: string): Promise<string> {
  return (await sha256Hex(url)).slice(0, 16)
}

function normalizeOptionalString(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeExpiresAt(value?: number | null): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.floor(value)
}

function normalizeMaxHits(value?: number | null): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.floor(value)
}

async function addShortIdToIndex(id: string): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    if (!ids.includes(id)) {
      ids.push(id)
      await kv.put(KV_KEYS.SHORT_INDEX, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLinkRepo] 添加索引失败:', error)
  }
}

async function removeShortIdFromIndex(id: string): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    const idx = ids.indexOf(id)
    if (idx > -1) {
      ids.splice(idx, 1)
      await kv.put(KV_KEYS.SHORT_INDEX, JSON.stringify({ ids }))
    }
  } catch (error) {
    logger.error('[ShortLinkRepo] 移除索引失败:', error)
  }
}

export async function getShortLink(id: string): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    return (await kv.get(`${KV_KEYS.SHORT_PREFIX}${id}`, 'json')) as ShortLink | null
  } catch (error) {
    logger.error('[ShortLinkRepo] 获取失败:', error)
    return null
  }
}

async function findRecordNameForTarget(targetUrl: string): Promise<string | undefined> {
  const { subscriptionUrl } = unwrapConversionUrl(targetUrl)
  if (!subscriptionUrl) return undefined
  const recordId = await generateRecordId(subscriptionUrl)
  const record = await getRecordById(recordId)
  return record?.name?.trim() || undefined
}

export async function syncShortLinkAutoName(
  id: string,
  nextName: string,
): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    const existing = await getShortLink(id)
    if (!existing || !isAutoManagedShortLinkName(existing)) return existing

    const cleaned = nextName.trim()
    if (!cleaned) return existing
    if (existing.name === cleaned && existing.customName === false) {
      return existing
    }

    const updated: ShortLink = {
      ...existing,
      name: cleaned,
      customName: false,
    }
    await kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(updated), {
      expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
    })
    return updated
  } catch (error) {
    logger.error('[ShortLinkRepo] 同步短链名称失败:', error)
    return null
  }
}

export async function enrichShortLinksWithRecords(
  links: ShortLink[],
  recordsByUrl?: Map<string, ConvertRecord>,
): Promise<{ links: ShortLink[]; repaired: Array<{ id: string; name: string }> }> {
  if (links.length === 0) return { links: [], repaired: [] }

  const lookupMap = recordsByUrl ?? new Map<string, ConvertRecord>()

  if (!recordsByUrl) {
    const autoUrls = new Set<string>()
    for (const link of links) {
      if (!isAutoManagedShortLinkName(link)) continue
      const { subscriptionUrl } = unwrapConversionUrl(link.targetUrl)
      if (subscriptionUrl) autoUrls.add(subscriptionUrl)
    }

    if (autoUrls.size > 0) {
      const urlList = Array.from(autoUrls)
      const recordIds = await Promise.all(urlList.map((url) => generateRecordId(url)))
      const recordKeys = recordIds.map((id) => `${KV_KEYS.RECORD_PREFIX}${id}`)
      const values = await getManyJson<ConvertRecord>(recordKeys)
      urlList.forEach((url, index) => {
        const record = values.get(recordKeys[index])
        if (record) lookupMap.set(url, record)
      })
    }
  }

  const repaired: Array<{ id: string; name: string }> = []
  const enriched = links.map((link) => {
    const { subscriptionUrl } = unwrapConversionUrl(link.targetUrl)
    const matchedRecord = lookupMap.get(subscriptionUrl)
    const resolvedName = resolveShortLinkName(link, matchedRecord?.name)

    if (resolvedName !== link.name) {
      repaired.push({ id: link.id, name: resolvedName })
      return {
        ...link,
        name: resolvedName,
        customName: false,
      }
    }

    return link
  })

  return { links: enriched, repaired }
}

export async function persistRepairedShortLinkNames(
  repairs: Array<{ id: string; name: string }>,
): Promise<void> {
  if (repairs.length === 0) return
  await Promise.allSettled(
    repairs.map((item) => syncShortLinkAutoName(item.id, item.name)),
  )
}

export async function syncShortLinksForSubscription(
  subscriptionUrl: string,
  nextName: string,
): Promise<void> {
  const kv = await getKvStore()
  if (!kv) return

  const trimmedName = nextName.trim()
  if (!trimmedName) return

  try {
    const normalizedSubUrl = unwrapConversionUrl(subscriptionUrl).subscriptionUrl
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    if (ids.length === 0) return

    const keys = ids.map((id) => `${KV_KEYS.SHORT_PREFIX}${id}`)
    const values = await getManyJson<ShortLink>(keys)
    const updates: Array<Promise<void>> = []

    for (const link of values.values()) {
      if (!link || !isAutoManagedShortLinkName(link)) continue
      if (unwrapConversionUrl(link.targetUrl).subscriptionUrl !== normalizedSubUrl) continue

      const resolvedName = resolveShortLinkName(link, trimmedName)
      if (resolvedName === link.name && link.customName === false) continue

      const updated: ShortLink = {
        ...link,
        name: resolvedName,
        customName: false,
      }
      updates.push(
        kv.put(`${KV_KEYS.SHORT_PREFIX}${link.id}`, JSON.stringify(updated), {
          expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
        }),
      )
    }

    if (updates.length > 0) {
      await Promise.allSettled(updates)
    }
  } catch (error) {
    logger.error('[ShortLinkRepo] 按订阅同步短链名称失败:', error)
  }
}

export async function createShortLink(
  inputOrUrl: string | CreateShortLinkInput,
  customName?: string,
): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  const input: CreateShortLinkInput =
    typeof inputOrUrl === 'string'
      ? { targetUrl: inputOrUrl, name: customName }
      : inputOrUrl

  const targetUrl = input.targetUrl.trim()
  const customSlug = normalizeOptionalString(input.slug)
  const name = normalizeOptionalString(input.name)
  const comment = normalizeOptionalString(input.comment)
  const password = normalizeOptionalString(input.password)
  const expiresAt = normalizeExpiresAt(input.expiresAt)
  const maxHits = normalizeMaxHits(input.maxHits)
  const defaultTarget = normalizeDefaultTarget(input.defaultTarget)
  const disabled = Boolean(input.disabled)

  if (customSlug) {
    if (!isValidCustomSlug(customSlug)) {
      throw AppError.validation('自定义短码仅支持 2-32 位字母、数字、连字符或下划线', 'slug')
    }
    const existingBySlug = await getShortLink(customSlug)
    if (existingBySlug) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `短码 "${customSlug}" 已被占用，请更换其他短码`,
        409,
        ErrorSeverity.LOW,
        { slug: customSlug },
      )
    }
  }

  try {
    const urlHash = await getUrlHash(targetUrl)
    const matchedRecordName = !name ? await findRecordNameForTarget(targetUrl) : undefined

    // 仅在未指定自定义短码且未配置独立限流/加密/输出格式策略时复用同一目标地址的短链
    const hasCustomPolicy = Boolean(
      customSlug || comment || password || expiresAt || maxHits || defaultTarget || disabled,
    )
    if (!hasCustomPolicy) {
      const existingId = (await kv.get(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`)) as string | null
      if (existingId) {
        const existing = await getShortLink(existingId)
        if (existing) {
          if (name && name !== existing.name) {
            return (await updateShortLink(existing.id, { name })) || existing
          }
          if (!name && isAutoManagedShortLinkName(existing)) {
            const resolvedName = resolveShortLinkName(existing, matchedRecordName)
            if (resolvedName !== existing.name) {
              return (
                (await syncShortLinkAutoName(existing.id, resolvedName)) || {
                  ...existing,
                  name: resolvedName,
                  customName: false,
                }
              )
            }
          }
          return existing
        }
      }
    }

    const id = customSlug || (await generateUniqueShortId(targetUrl))
    const now = Date.now()
    const resolvedName =
      name || resolveShortLinkName({ name: '', targetUrl, customName: false }, matchedRecordName)
    const shortLink: ShortLink = {
      id,
      targetUrl,
      name: resolvedName,
      customName: Boolean(name),
      createdAt: now,
      hits: 0,
      lastAccess: now,
      ...(comment ? { comment } : {}),
      ...(disabled ? { disabled: true } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(maxHits ? { maxHits } : {}),
      ...(password ? { password } : {}),
      ...(defaultTarget ? { defaultTarget } : {}),
    }

    const putTasks: Array<Promise<void>> = [
      kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(shortLink), {
        expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
      }),
    ]

    if (!customSlug) {
      putTasks.push(
        kv.put(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`, id, {
          expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
        }),
      )
    }

    await Promise.all(putTasks)
    await addShortIdToIndex(id)

    return shortLink
  } catch (error) {
    if (error instanceof AppError) throw error
    logger.error('[ShortLinkRepo] 创建失败:', error)
    return null
  }
}

export async function getAllShortLinks(): Promise<ShortLink[]> {
  const kv = await getKvStore()
  if (!kv) return []

  try {
    const indexData = (await kv.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    const ids = indexData?.ids || []
    if (ids.length === 0) return []

    const keys = ids.map((id) => `${KV_KEYS.SHORT_PREFIX}${id}`)
    const values = await getManyJson<ShortLink>(keys)
    const links: ShortLink[] = []
    for (const link of values.values()) {
      if (link) links.push(link)
    }
    links.sort((a, b) => b.createdAt - a.createdAt)

    const { links: enriched } = await enrichShortLinksWithRecords(links)
    return enriched
  } catch (error) {
    logger.error('[ShortLinkRepo] 获取全部失败:', error)
    return []
  }
}

export async function updateShortLink(
  id: string,
  updates: UpdateShortLinkInput,
): Promise<ShortLink | null> {
  const kv = await getKvStore()
  if (!kv) return null

  try {
    const existing = await getShortLink(id)
    if (!existing) return null

    const nextTargetUrl = updates.targetUrl?.trim() || existing.targetUrl
    const targetChanged = nextTargetUrl !== existing.targetUrl
    const trimmedUpdateName = updates.name?.trim()

    let nextName = existing.name
    let nextCustomName = existing.customName

    if (updates.name !== undefined && trimmedUpdateName) {
      nextName = trimmedUpdateName
      nextCustomName = true
    } else if (targetChanged && isAutoManagedShortLinkName(existing)) {
      const matchedRecordName = await findRecordNameForTarget(nextTargetUrl)
      nextName = resolveShortLinkName(
        { name: '', targetUrl: nextTargetUrl, customName: false },
        matchedRecordName,
      )
      nextCustomName = false
    }

    const updated: ShortLink = {
      ...existing,
      name: nextName,
      ...(nextCustomName !== undefined ? { customName: nextCustomName } : {}),
      targetUrl: nextTargetUrl,
      ...(updates.disabled !== undefined ? { disabled: updates.disabled } : {}),
    }

    if (updates.comment !== undefined) {
      const cleaned = normalizeOptionalString(updates.comment)
      if (cleaned) updated.comment = cleaned
      else delete updated.comment
    }

    if (updates.password !== undefined) {
      const cleaned = normalizeOptionalString(updates.password)
      if (cleaned) updated.password = cleaned
      else delete updated.password
    }

    if (updates.expiresAt !== undefined) {
      const cleaned = normalizeExpiresAt(updates.expiresAt)
      if (cleaned) updated.expiresAt = cleaned
      else delete updated.expiresAt
    }

    if (updates.maxHits !== undefined) {
      const cleaned = normalizeMaxHits(updates.maxHits)
      if (cleaned) updated.maxHits = cleaned
      else delete updated.maxHits
    }

    if (updates.defaultTarget !== undefined) {
      const cleaned = normalizeDefaultTarget(updates.defaultTarget)
      if (cleaned) updated.defaultTarget = cleaned
      else delete updated.defaultTarget
    }

    const tasks: Array<Promise<void>> = [
      kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(updated), {
        expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
      }),
    ]

    if (targetChanged) {
      const [oldHash, newHash] = await Promise.all([
        getUrlHash(existing.targetUrl),
        getUrlHash(nextTargetUrl),
      ])
      const oldMapping = (await kv.get(`${KV_KEYS.SHORT_URL_PREFIX}${oldHash}`)) as string | null
      if (oldMapping === id) {
        tasks.push(kv.delete(`${KV_KEYS.SHORT_URL_PREFIX}${oldHash}`))
      }
      tasks.push(
        kv.put(`${KV_KEYS.SHORT_URL_PREFIX}${newHash}`, id, {
          expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
        }),
      )
    }

    await Promise.all(tasks)
    return updated
  } catch (error) {
    logger.error('[ShortLinkRepo] 更新失败:', error)
    return null
  }
}

export async function deleteShortLink(id: string): Promise<boolean> {
  const kv = await getKvStore()
  if (!kv) return false

  try {
    const existing = await getShortLink(id)
    if (!existing) return false

    const urlHash = await getUrlHash(existing.targetUrl)
    const reverseId = (await kv.get(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`)) as string | null

    const deleteTasks: Array<Promise<void>> = [kv.delete(`${KV_KEYS.SHORT_PREFIX}${id}`)]
    if (reverseId === id) {
      deleteTasks.push(kv.delete(`${KV_KEYS.SHORT_URL_PREFIX}${urlHash}`))
    }

    await Promise.all(deleteTasks)
    await removeShortIdFromIndex(id)
    return true
  } catch (error) {
    logger.error('[ShortLinkRepo] 删除失败:', error)
    return false
  }
}

export async function resolveShortLinkDetailed(
  id: string,
  context: ResolveShortLinkContext = {},
): Promise<ShortLinkResolveResult> {
  const kv = await getKvStore()
  if (!kv) return { status: 'not_found' }

  try {
    const shortLink = await getShortLink(id)
    if (!shortLink) return { status: 'not_found' }

    if (shortLink.disabled) {
      return { status: 'disabled', link: shortLink }
    }

    if (shortLink.expiresAt && Date.now() >= shortLink.expiresAt) {
      return { status: 'expired', link: shortLink }
    }

    if (shortLink.maxHits && shortLink.maxHits > 0 && shortLink.hits >= shortLink.maxHits) {
      return { status: 'limit_reached', link: shortLink }
    }

    if (shortLink.password) {
      const provided = context.key?.trim() || ''
      if (provided !== shortLink.password) {
        return { status: 'unauthorized', link: shortLink }
      }
    }

    const clientHits = { ...(shortLink.clientHits || {}) }
    if (context.clientType) {
      clientHits[context.clientType] = (clientHits[context.clientType] || 0) + 1
    }

    const cleanUa = context.userAgent?.trim().slice(0, 300) || undefined
    const updated: ShortLink = {
      ...shortLink,
      hits: shortLink.hits + 1,
      lastAccess: Date.now(),
      ...(context.clientIp ? { lastIp: context.clientIp } : {}),
      ...(context.clientType ? { lastClientType: context.clientType } : {}),
      ...(cleanUa ? { lastUserAgent: cleanUa } : {}),
      ...(Object.keys(clientHits).length > 0 ? { clientHits } : {}),
    }

    await kv.put(`${KV_KEYS.SHORT_PREFIX}${id}`, JSON.stringify(updated), {
      expirationTtl: KV_TTL_SECONDS.ONE_YEAR,
    })

    return { status: 'ok', link: updated }
  } catch (error) {
    logger.error('[ShortLinkRepo] 解析失败:', error)
    return { status: 'not_found' }
  }
}

export async function resolveShortLink(id: string): Promise<string | null> {
  const result = await resolveShortLinkDetailed(id)
  return result.status === 'ok' ? result.link.targetUrl : null
}

export async function importShortLinks(
  items: CreateShortLinkInput[],
): Promise<ShortLinkImportResult> {
  let imported = 0
  let skipped = 0
  let failed = 0

  for (const item of items) {
    try {
      const slug = normalizeOptionalString(item.slug)
      if (slug) {
        const exists = await getShortLink(slug)
        if (exists) {
          skipped++
          continue
        }
      }

      const created = await createShortLink(item)
      if (created) imported++
      else failed++
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        skipped++
      } else {
        failed++
      }
    }
  }

  return { imported, skipped, failed }
}
