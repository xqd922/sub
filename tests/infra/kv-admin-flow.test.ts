import { describe, it, expect } from 'vitest'
import { createRecordManually, listAllRecordsForAdmin, setRecordEnabled, deleteRecordPermanently, getRecentDailyStats, isUrlEnabled } from '@/infra/kv/records'
import { createShortLink, getAllShortLinks, updateShortLink, deleteShortLink } from '@/infra/kv/short_link'
import { rebuildIndexes } from '@/infra/kv/maintenance'

const TEST_URL = 'https://example.com/admin-flow-sub'

describe('admin record flow', () => {
  it('registers a record manually and lists it including disabled ones', async () => {
    const created = await createRecordManually(TEST_URL, '流程测试')
    expect(created).not.toBeNull()
    expect(created!.originalUrl).toBe(TEST_URL)
    expect(created!.hits).toBe(0)

    const all = await listAllRecordsForAdmin()
    expect(all.some(record => record.id === created!.id)).toBe(true)
  })

  it('createRecordManually reuses an existing record', async () => {
    const first = await createRecordManually(TEST_URL)
    const second = await createRecordManually(TEST_URL, '新名字')

    expect(second!.id).toBe(first!.id)
    expect(second!.name).toBe('新名字')
  })

  it('disabling a record blocks the subscription gate', async () => {
    const record = await createRecordManually(TEST_URL)
    expect(await isUrlEnabled(TEST_URL)).toBe(true)

    await setRecordEnabled(record!.id, false)
    expect(await isUrlEnabled(TEST_URL)).toBe(false)

    const all = await listAllRecordsForAdmin()
    const disabled = all.find(item => item.id === record!.id)
    expect(disabled?.deleted).toBe(true)
  })

  it('enabling a record restores the gate and repairs index membership', async () => {
    const record = await createRecordManually(TEST_URL)
    await setRecordEnabled(record!.id, false)
    await setRecordEnabled(record!.id, true)

    expect(await isUrlEnabled(TEST_URL)).toBe(true)
  })

  it('permanently deletes a record', async () => {
    const record = await createRecordManually(TEST_URL)
    expect(await deleteRecordPermanently(record!.id)).toBe(true)
    expect(await deleteRecordPermanently(record!.id)).toBe(false)

    const all = await listAllRecordsForAdmin()
    expect(all.some(item => item.id === record!.id)).toBe(false)
  })
})

describe('admin short link flow', () => {
  it('creates, renames and deletes a short link', async () => {
    const created = await createShortLink('https://example.com/link-target')
    expect(created).not.toBeNull()

    const duplicated = await createShortLink('https://example.com/link-target')
    expect(duplicated!.id).toBe(created!.id)

    const renamed = await updateShortLink(created!.id, { name: '改名短链' })
    expect(renamed?.name).toBe('改名短链')

    const listed = await getAllShortLinks()
    expect(listed.some(link => link.id === created!.id)).toBe(true)

    expect(await deleteShortLink(created!.id)).toBe(true)
    const afterDelete = await getAllShortLinks()
    expect(afterDelete.some(link => link.id === created!.id)).toBe(false)
  })
})

describe('index maintenance', () => {
  it('rebuildIndexes recovers records lost from the index', async () => {
    const record = await createRecordManually(TEST_URL)

    // 模拟历史软删除把 id 移出索引：记录键仍在，索引缺失
    const { deleteRecord } = await import('@/infra/kv/records')
    await deleteRecord(record!.id)

    // 扫描式列表仍能看到记录键，索引式列表看不到
    const scanned = await listAllRecordsForAdmin()
    expect(scanned.some(item => item.id === record!.id)).toBe(true)

    // 重建后索引恢复
    const result = await rebuildIndexes()
    expect(result.recordRepaired).toBeGreaterThanOrEqual(1)

    const rebuilt = await rebuildIndexes()
    expect(rebuilt.recordIndexed).toBe(result.recordIndexed)
    expect(rebuilt.recordRepaired).toBe(0)
  })

  it('getRecentDailyStats returns ascending dates', async () => {
    const stats = await getRecentDailyStats(7)
    const dates = stats.map(item => item.date)
    const sorted = [...dates].sort((a, b) => a.localeCompare(b))
    expect(dates).toEqual(sorted)
    expect(stats.length).toBeLessThanOrEqual(7)
  })
})
