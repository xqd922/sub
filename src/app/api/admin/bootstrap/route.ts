import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { parseCustomClientRules } from '@/modules/record/client-rule.repository'
import { computeStatsFromData } from '@/modules/record/record.repository'
import { parseCustomRoutingRules } from '@/modules/record/routing-rule.repository'
import {
  enrichShortLinksWithRecords,
  persistRepairedShortLinkNames,
} from '@/modules/short-link/short-link.repository'
import { getKvStore, getManyJson, listKeysByPrefix } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { getExecutionContext, jsonOk } from '@/server/route.utils'
import type { ConvertRecord, DailyStats, HourlyStats, ShortLink } from '@/shared/admin.types'
import { unwrapConversionUrl } from '@/shared/url.utils'

export const runtime = 'edge'

function buildRecentDateKeys(days: number): Set<string> {
  const now = new Date()
  const keys = new Set<string>()
  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    keys.add(`${KV_KEYS.DAILY_PREFIX}${date.toISOString().slice(0, 10)}`)
  }
  return keys
}

function buildRecentHourKeys(hours: number): Set<string> {
  const now = new Date()
  now.setUTCMinutes(0, 0, 0)
  const keys = new Set<string>()
  for (let i = 0; i < hours; i++) {
    const bucket = new Date(now.getTime() - i * 3_600_000)
    keys.add(`${KV_KEYS.HOURLY_PREFIX}${bucket.toISOString().slice(0, 13)}`)
  }
  return keys
}

/**
 * Single-round-trip bootstrap endpoint for the admin console.
 * Wave 1 (parallel): list record keys, daily keys, hourly keys, and read short-link index.
 * Wave 2 (1 bulk KV read): fetch all records, daily/hourly stats, short links, and rule configs together.
 */
export const GET = withAdminAuth('初始化控制台', async () => {
  const kv = await getKvStore()
  if (!kv) {
    return jsonOk({
      stats: computeStatsFromData([], 0, 0),
      daily: [],
      hourly: [],
      records: [],
      shortLinks: [],
      routingRules: [],
      clientRules: [],
      fetchedAt: Date.now(),
    })
  }

  const targetDailyKeys = buildRecentDateKeys(30)
  const targetHourlyKeys = buildRecentHourKeys(24)

  // Wave 1: 4 lightweight index/list calls in parallel
  const [rawRecordKeys, rawDailyKeys, rawHourlyKeys, shortIndex] = await Promise.all([
    listKeysByPrefix(KV_KEYS.RECORD_PREFIX),
    listKeysByPrefix(KV_KEYS.DAILY_PREFIX),
    listKeysByPrefix(KV_KEYS.HOURLY_PREFIX),
    kv.get(KV_KEYS.SHORT_INDEX, 'json') as Promise<{ ids?: string[] } | null>,
  ])

  const recordKeys = rawRecordKeys.filter((name) => name.startsWith(KV_KEYS.RECORD_PREFIX))
  const dailyKeys = rawDailyKeys.filter((name) => targetDailyKeys.has(name))
  const hourlyKeys = rawHourlyKeys.filter((name) => targetHourlyKeys.has(name))
  const shortKeys = (shortIndex?.ids || []).map((id) => `${KV_KEYS.SHORT_PREFIX}${id}`)

  // Wave 2: 1 unified KV bulk-get for ALL payloads across all 4 admin tabs
  const allKeys = [
    ...recordKeys,
    ...dailyKeys,
    ...hourlyKeys,
    ...shortKeys,
    KV_KEYS.ROUTING_RULES,
    KV_KEYS.CLIENT_RULES,
  ]
  const bulkValues = await getManyJson<unknown>(allKeys)

  const records: ConvertRecord[] = []
  for (const key of recordKeys) {
    const value = bulkValues.get(key) as ConvertRecord | null | undefined
    if (value) records.push(value)
  }
  records.sort((a, b) => b.lastAccess - a.lastAccess)

  const daily: DailyStats[] = []
  for (const key of dailyKeys) {
    const value = bulkValues.get(key) as DailyStats | null | undefined
    if (value && typeof value.date === 'string') daily.push(value)
  }
  daily.sort((a, b) => a.date.localeCompare(b.date))

  const hourly: HourlyStats[] = []
  for (const key of hourlyKeys) {
    const value = bulkValues.get(key) as HourlyStats | null | undefined
    if (value && typeof value.hour === 'string') hourly.push(value)
  }
  hourly.sort((a, b) => a.hour.localeCompare(b.hour))

  const rawShortLinks: ShortLink[] = []
  for (const key of shortKeys) {
    const value = bulkValues.get(key) as ShortLink | null | undefined
    if (value) rawShortLinks.push(value)
  }
  rawShortLinks.sort((a, b) => b.createdAt - a.createdAt)

  const recordsByUrl = new Map<string, ConvertRecord>()
  for (const record of records) {
    const normalized = unwrapConversionUrl(record.originalUrl).subscriptionUrl
    if (normalized && !recordsByUrl.has(normalized)) {
      recordsByUrl.set(normalized, record)
    }
    if (!recordsByUrl.has(record.originalUrl)) {
      recordsByUrl.set(record.originalUrl, record)
    }
  }

  const { links: shortLinks, repaired } = await enrichShortLinksWithRecords(
    rawShortLinks,
    recordsByUrl,
  )

  if (repaired.length > 0) {
    const ctx = await getExecutionContext()
    const repairPromise = persistRepairedShortLinkNames(repaired)
    if (ctx?.waitUntil) {
      ctx.waitUntil(repairPromise)
    } else {
      await repairPromise
    }
  }

  const routingRules = parseCustomRoutingRules(bulkValues.get(KV_KEYS.ROUTING_RULES))
  const clientRules = parseCustomClientRules(bulkValues.get(KV_KEYS.CLIENT_RULES))

  const today = new Date().toISOString().slice(0, 10)
  const todayHits = daily.find((item) => item.date === today)?.totalHits || 0
  const stats = computeStatsFromData(records, todayHits, shortLinks.length)

  return jsonOk({
    stats,
    daily,
    hourly,
    records,
    shortLinks,
    routingRules,
    clientRules,
    fetchedAt: Date.now(),
  })
})
