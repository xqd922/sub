import { beforeEach, describe, expect, it } from 'vitest'
import { rebuildKvIndexes } from '@/modules/record/index-maintenance.service'
import {
  createRecordManually,
  deleteRecordPermanently,
  getRecentDailyStats,
  getStats,
  isUrlEnabled,
  listAllRecordsForAdmin,
  setRecordEnabled,
  softDeleteRecord,
} from '@/modules/record/record.repository'
import { handleShortLinkRedirect } from '@/modules/short-link/short-link.handler'
import {
  createShortLink,
  deleteShortLink,
  getAllShortLinks,
  resolveShortLink,
  updateShortLink,
} from '@/modules/short-link/short-link.repository'
import { MemoryKvStore, resetFallbackKvStore } from '@/server/kv/kv.adapter'
import { encodeBase64Utf8 } from '@/shared/base64.utils'

const TEST_URL = 'https://example.com/admin-flow-sub'

describe('record and short-link KV flows', () => {
  beforeEach(() => {
    resetFallbackKvStore()
  })

  it('supports manual registration, reuse, enable/disable gate, and permanent delete', async () => {
    const created = await createRecordManually(TEST_URL, '流程测试')
    expect(created).not.toBeNull()
    expect(created!.originalUrl).toBe(TEST_URL)
    expect(created!.hits).toBe(0)

    const reused = await createRecordManually(TEST_URL, '新名字')
    expect(reused!.id).toBe(created!.id)
    expect(reused!.name).toBe('新名字')

    expect(await isUrlEnabled(TEST_URL)).toBe(true)
    await setRecordEnabled(created!.id, false)
    expect(await isUrlEnabled(TEST_URL)).toBe(false)

    const all = await listAllRecordsForAdmin()
    expect(all.find((item) => item.id === created!.id)?.deleted).toBe(true)

    await setRecordEnabled(created!.id, true)
    expect(await isUrlEnabled(TEST_URL)).toBe(true)

    expect(await deleteRecordPermanently(created!.id)).toBe(true)
    expect(await deleteRecordPermanently(created!.id)).toBe(false)
    expect((await listAllRecordsForAdmin()).some((item) => item.id === created!.id)).toBe(false)
  })

  it('creates, deduplicates, edits name/targetUrl, resolves, and deletes short links', async () => {
    const created = await createShortLink('https://example.com/link-target', '初始备注')
    expect(created).not.toBeNull()
    expect(created!.name).toBe('初始备注')

    const duplicated = await createShortLink('https://example.com/link-target')
    expect(duplicated!.id).toBe(created!.id)

    const updated = await updateShortLink(created!.id, {
      name: '改名短链',
      targetUrl: 'https://example.com/new-target',
    })
    expect(updated?.name).toBe('改名短链')
    expect(updated?.targetUrl).toBe('https://example.com/new-target')

    expect(await resolveShortLink(created!.id)).toBe('https://example.com/new-target')

    // 修改目标后，新目标应命中去重并返回同一短链 ID
    const dedupNewTarget = await createShortLink('https://example.com/new-target')
    expect(dedupNewTarget?.id).toBe(created!.id)

    expect((await getAllShortLinks()).some((link) => link.id === created!.id)).toBe(true)

    expect(await deleteShortLink(created!.id)).toBe(true)
    expect(await deleteShortLink(created!.id)).toBe(false)
    expect((await getAllShortLinks()).some((link) => link.id === created!.id)).toBe(false)
  })

  it('unwraps legacy /sub?url=... targets inside /s/[id] without double-wrapping', async () => {
    const ssNode = `ss://${encodeBase64Utf8('aes-256-gcm:secret').replace(/=/g, '')}@1.2.3.4:8388#HK-Test`
    const legacyTarget = `https://old.example.com/sub?url=${encodeURIComponent(ssNode)}&target=clash`
    const created = await createShortLink(legacyTarget, '历史短链')
    expect(created).not.toBeNull()

    const response = await handleShortLinkRedirect(
      new Request(`https://sub.example.com/s/${created!.id}`, {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      created!.id,
    )
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('proxies:')
    expect(body).toContain('1.2.3.4')
  })

  it('reports disabledRecords and totalShortLinks in getStats()', async () => {
    const enabledRec = await createRecordManually('https://example.com/active-sub')
    const disabledRec = await createRecordManually('https://example.com/disabled-sub')
    await setRecordEnabled(disabledRec!.id, false)
    await createShortLink('https://example.com/short-a')

    const stats = await getStats()
    expect(stats.totalRecords).toBe(1)
    expect(stats.disabledRecords).toBe(1)
    expect(stats.totalShortLinks).toBe(1)
    expect(enabledRec).not.toBeNull()
  })

  it('supports TTL expiration and cursor pagination in MemoryKvStore', async () => {
    const kv = new MemoryKvStore()
    await kv.put('k:1', 'a')
    await kv.put('k:2', 'b')
    await kv.put('k:3', 'c')

    const page1 = await kv.list({ prefix: 'k:', limit: 2 })
    expect(page1.keys.map((item) => item.name)).toEqual(['k:1', 'k:2'])
    expect(page1.list_complete).toBe(false)
    expect(page1.cursor).toBeDefined()

    const page2 = await kv.list({ prefix: 'k:', limit: 2, cursor: page1.cursor })
    expect(page2.keys.map((item) => item.name)).toEqual(['k:3'])
    expect(page2.list_complete).toBe(true)

    await kv.put('expiring', 'val', { expirationTtl: 0 })
    expect(await kv.get('expiring')).toBeNull()
  })

  it('recovers records dropped from index via rebuildKvIndexes', async () => {
    const record = await createRecordManually(TEST_URL)
    await softDeleteRecord(record!.id)

    const scanned = await listAllRecordsForAdmin()
    expect(scanned.some((item) => item.id === record!.id)).toBe(true)

    const result = await rebuildKvIndexes()
    expect(result.recordRepaired).toBeGreaterThanOrEqual(1)

    const rebuilt = await rebuildKvIndexes()
    expect(rebuilt.recordIndexed).toBe(result.recordIndexed)
    expect(rebuilt.recordRepaired).toBe(0)
  })

  it('returns ascending recent daily stats', async () => {
    const stats = await getRecentDailyStats(7)
    const dates = stats.map((item) => item.date)
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)))
    expect(stats.length).toBeLessThanOrEqual(7)
  })
})
