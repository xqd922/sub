import { beforeEach, describe, expect, it } from 'vitest'
import { rebuildKvIndexes } from '@/modules/record/index-maintenance.service'
import {
  createRecordManually,
  deleteRecordPermanently,
  getRecentDailyStats,
  isUrlEnabled,
  listAllRecordsForAdmin,
  setRecordEnabled,
  softDeleteRecord,
} from '@/modules/record/record.repository'
import {
  createShortLink,
  deleteShortLink,
  getAllShortLinks,
  resolveShortLink,
  updateShortLink,
} from '@/modules/short-link/short-link.repository'
import { resetFallbackKvStore } from '@/server/kv/kv.adapter'

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

  it('creates, deduplicates, renames, resolves, and deletes short links', async () => {
    const created = await createShortLink('https://example.com/link-target')
    expect(created).not.toBeNull()

    const duplicated = await createShortLink('https://example.com/link-target')
    expect(duplicated!.id).toBe(created!.id)

    const renamed = await updateShortLink(created!.id, { name: '改名短链' })
    expect(renamed?.name).toBe('改名短链')

    expect(await resolveShortLink(created!.id)).toBe('https://example.com/link-target')
    expect((await getAllShortLinks()).some((link) => link.id === created!.id)).toBe(true)

    expect(await deleteShortLink(created!.id)).toBe(true)
    expect(await deleteShortLink(created!.id)).toBe(false)
    expect((await getAllShortLinks()).some((link) => link.id === created!.id)).toBe(false)
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
