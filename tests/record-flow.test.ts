import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCustomClientRule,
  deleteCustomClientRule,
  getCustomClientRules,
} from '@/modules/record/client-rule.repository'
import {
  addCustomRoutingRule,
  deleteCustomRoutingRule,
  getCustomRoutingRules,
} from '@/modules/record/routing-rule.repository'
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
  importShortLinks,
  resolveShortLink,
  resolveShortLinkDetailed,
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
    const ssNode = `ss://${encodeBase64Utf8('aes-256-gcm:secret').replace(/=/g, '')}@1.2.3.4:8388#${encodeURIComponent('🇭🇰 HK Test')}`
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
    // 订阅卡片标题自动去除国旗 Emoji，节点自身仍保留国旗
    expect(response.headers.get('Content-Disposition')).toContain(
      `filename*=UTF-8''${encodeURIComponent('HK Test')}`,
    )
    const body = await response.text()
    expect(body).toContain('proxies:')
    expect(body).toContain('🇭🇰 HK Test')
    expect(body).toContain('1.2.3.4')

    // 支持显式 ?name= 覆盖 Clash 客户端显示的订阅卡片名称
    const renamedResponse = await handleShortLinkRedirect(
      new Request(`https://sub.example.com/s/${created!.id}?name=${encodeURIComponent('自建专线')}`, {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      created!.id,
    )
    expect(renamedResponse.status).toBe(200)
    expect(renamedResponse.headers.get('Content-Disposition')).toContain(
      `filename*=UTF-8''${encodeURIComponent('自建专线')}`,
    )
  })

  it('supports Sink-style custom slug, expiration, maxHits, disabled state, password key, telemetry, and import', async () => {
    const ssNode = `ss://${encodeBase64Utf8('aes-256-gcm:secret').replace(/=/g, '')}@1.2.3.4:8388#HK-Test`

    const custom = await createShortLink({
      targetUrl: ssNode,
      slug: 'hk-vip',
      name: '香港专线',
      comment: '给手机端使用',
      maxHits: 1,
      password: 'mykey',
    })
    expect(custom?.id).toBe('hk-vip')
    expect(custom?.comment).toBe('给手机端使用')

    // 冲突短码拒绝覆盖
    await expect(
      createShortLink({ targetUrl: ssNode, slug: 'hk-vip' }),
    ).rejects.toThrow('已被占用')

    // 无密钥时客户端返回 401 JSON，浏览器返回 401 密码验证 HTML
    const clientNoKey = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/hk-vip', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'hk-vip',
    )
    expect(clientNoKey.status).toBe(401)

    const browserNoKey = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/hk-vip', {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36' },
      }),
      'hk-vip',
    )
    expect(browserNoKey.status).toBe(401)
    expect(await browserNoKey.text()).toContain('密钥验证')

    // 携带正确密钥第 1 次成功并记录客户端统计
    const okRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/hk-vip?key=mykey', {
        headers: { 'User-Agent': 'clash.meta/v1.19', 'x-forwarded-for': '203.0.113.5' },
      }),
      'hk-vip',
    )
    expect(okRes.status).toBe(200)

    // 达到 maxHits=1 上限后第 2 次返回 410
    const limitedRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/hk-vip?key=mykey', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'hk-vip',
    )
    expect(limitedRes.status).toBe(410)

    // 禁用态与过期态检查
    await updateShortLink('hk-vip', { maxHits: null, disabled: true })
    expect((await resolveShortLinkDetailed('hk-vip', { key: 'mykey' })).status).toBe('disabled')

    await updateShortLink('hk-vip', { disabled: false, expiresAt: Date.now() - 1000 })
    const expiredRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/hk-vip?key=mykey', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'hk-vip',
    )
    expect(expiredRes.status).toBe(410)

    // JSON 批量导入：新短码导入成功，已存在短码跳过
    const importResult = await importShortLinks([
      { targetUrl: ssNode, slug: 'hk-vip', name: '重复跳过' },
      { targetUrl: ssNode, slug: 'jp-backup', name: '日本备用', defaultTarget: 'singbox' },
    ])
    expect(importResult).toEqual({ imported: 1, skipped: 1, failed: 0 })

    // 短链路径后缀 `.json` / `.yaml` / `.txt` 与默认输出格式 defaultTarget 验证
    const defaultSingboxRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/jp-backup', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'jp-backup',
    )
    expect(defaultSingboxRes.status).toBe(200)
    expect(defaultSingboxRes.headers.get('Content-Type')).toContain('application/json')

    const suffixYamlRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/jp-backup.yaml', {
        headers: { 'User-Agent': 'sing-box/1.14' },
      }),
      'jp-backup.yaml',
    )
    expect(suffixYamlRes.status).toBe(200)
    expect(suffixYamlRes.headers.get('Content-Type')).toContain('text/yaml')

    const suffixTxtRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/jp-backup.txt', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'jp-backup.txt',
    )
    expect(suffixTxtRes.status).toBe(200)
    expect(suffixTxtRes.headers.get('Content-Type')).toContain('text/plain')

    // 记录原始 User-Agent 与自定义 KV UA 规则生效验证
    const { rule } = await addCustomClientRule({
      keyword: 'NewBrandBox',
      target: 'singbox',
      note: '测试新客户端',
    })
    expect((await getCustomClientRules()).some((r) => r.id === rule.id)).toBe(true)

    await updateShortLink('jp-backup', { defaultTarget: null })
    const customRuleRes = await handleShortLinkRedirect(
      new Request('https://sub.example.com/s/jp-backup', {
        headers: { 'User-Agent': 'NewBrandBox/0.9' },
      }),
      'jp-backup',
    )
    expect(customRuleRes.status).toBe(200)
    expect(customRuleRes.headers.get('Content-Type')).toContain('application/json')

    const allLinks = await getAllShortLinks()
    expect(allLinks.find((item) => item.id === 'jp-backup')?.lastUserAgent).toBe('NewBrandBox/0.9')

    const remainingRules = await deleteCustomClientRule(rule.id)
    expect(remainingRules).toEqual([])
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

  it('manages custom KV routing rules with normalization, deduplication, and deletion', async () => {
    const { rule: domainRule } = await addCustomRoutingRule({
      type: 'DOMAIN-SUFFIX',
      value: '.MyDomain.COM ',
      action: 'DIRECT',
      note: '测试直连',
    })
    expect(domainRule.value).toBe('mydomain.com')

    const { rule: ipRule } = await addCustomRoutingRule({
      type: 'IP-CIDR',
      value: '203.0.113.10',
      action: 'REJECT',
    })
    expect(ipRule.value).toBe('203.0.113.10/32')

    await expect(
      addCustomRoutingRule({ type: 'DOMAIN-SUFFIX', value: 'mydomain.com', action: 'Manual' }),
    ).rejects.toThrow('已存在')

    expect(await getCustomRoutingRules()).toHaveLength(2)
    const remaining = await deleteCustomRoutingRule(domainRule.id)
    expect(remaining?.map((item) => item.id)).toEqual([ipRule.id])
  })
})
