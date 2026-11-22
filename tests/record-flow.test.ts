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
  getRecentHourlyStats,
  getStats,
  isUrlEnabled,
  listAllRecordsForAdmin,
  logConversion,
  setRecordEnabled,
  softDeleteRecord,
} from '@/modules/record/record.repository'
import { handleShortLinkRedirect } from '@/modules/short-link/short-link.handler'
import {
  createShortLink,
  deleteShortLink,
  getAllShortLinks,
  getShortLink,
  importShortLinks,
  resolveShortLink,
  resolveShortLinkDetailed,
  syncShortLinksForSubscription,
  updateShortLink,
} from '@/modules/short-link/short-link.repository'
import { MemoryKvStore, resetFallbackKvStore } from '@/server/kv/kv.adapter'
import { getKvStore, getManyJson } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
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

  it('batch-reads JSON keys via getManyJson and excludes :urls keys in getRecentDailyStats', async () => {
    const recA = await createRecordManually('https://example.com/bulk-a', 'Bulk A')
    const recB = await createRecordManually('https://example.com/bulk-b', 'Bulk B')
    expect(recA).not.toBeNull()
    expect(recB).not.toBeNull()

    const map = await getManyJson<{ id: string; name: string }>([
      `record:${recA!.id}`,
      `record:${recB!.id}`,
      'record:non-existent',
    ])
    expect(map.get(`record:${recA!.id}`)?.name).toBe('Bulk A')
    expect(map.get(`record:${recB!.id}`)?.name).toBe('Bulk B')
    expect(map.get('record:non-existent')).toBeNull()

    const kv = new MemoryKvStore()
    await kv.put('k:a', JSON.stringify({ n: 1 }))
    await kv.put('k:b', JSON.stringify({ n: 2 }))
    const batch = await kv.getMany<{ n: number }>(['k:a', 'k:b', 'k:missing'], 'json')
    expect(batch.get('k:a')).toEqual({ n: 1 })
    expect(batch.get('k:b')).toEqual({ n: 2 })
    expect(batch.get('k:missing')).toBeNull()
  })

  it('tracks hourly and daily conversion stats with deduplicated uniqueUrls', async () => {
    await logConversion({
      originalUrl: 'https://example.com/hourly-sub-1',
      clientType: 'clash',
      nodeCount: 12,
      clientIp: '203.0.113.10',
    })
    await logConversion({
      originalUrl: 'https://example.com/hourly-sub-1',
      clientType: 'clash',
      nodeCount: 12,
      clientIp: '203.0.113.10',
    })
    await logConversion({
      originalUrl: 'https://example.com/hourly-sub-2',
      clientType: 'singbox',
      nodeCount: 8,
      clientIp: '203.0.113.11',
    })

    const [daily, hourly] = await Promise.all([getRecentDailyStats(7), getRecentHourlyStats(24)])
    expect(daily).toHaveLength(1)
    expect(daily[0].totalHits).toBe(3)
    expect(daily[0].uniqueUrls).toBe(2)

    expect(hourly).toHaveLength(1)
    expect(hourly[0].hour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/)
    expect(hourly[0].totalHits).toBe(3)
    expect(hourly[0].uniqueUrls).toBe(2)
  })

  it('inherits subscription names for auto short links, heals legacy wrapper/base64 names, and preserves custom names', async () => {
    const subUrl = 'https://airport.example.com/api/v1/client/subscribe?token=abc'
    const record = await createRecordManually(subUrl, '星云机场')
    expect(record).not.toBeNull()

    // 1. 不传自定义名称创建短链时，自动继承已有订阅记录的名称
    const autoLink = await createShortLink(subUrl)
    expect(autoLink?.name).toBe('星云机场')
    expect(autoLink?.customName).toBe(false)

    // 2. 手动指定名称创建的短链标记为 customName: true，后续订阅改名不会覆盖它
    const customLink = await createShortLink({
      targetUrl: subUrl,
      slug: 'my-custom',
      name: '朋友专用',
    })
    expect(customLink?.name).toBe('朋友专用')
    expect(customLink?.customName).toBe(true)

    // 3. 订阅重命名后，自动命名短链同步跟进，自定义短链保持不变
    await syncShortLinksForSubscription(subUrl, '星云主力')
    expect((await getShortLink(autoLink!.id))?.name).toBe('星云主力')
    expect((await getShortLink('my-custom'))?.name).toBe('朋友专用')

    // 4. 模拟历史 KV 脏数据：短链名称曾落库为转换器域名 sub.xqd.pp.ua 或未解码的 VMess Base64
    const kv = await getKvStore()
    expect(kv).not.toBeNull()

    const vmessPayload = encodeBase64Utf8(
      JSON.stringify({ v: '2', ps: '🇭🇰 HK-优途 | 01', add: '1.2.3.4', port: '443', id: '11111111-1111-1111-1111-111111111111' }),
    )
    const wrappedVmess = `https://sub.xqd.pp.ua/sub?url=${encodeURIComponent(`vmess://${vmessPayload}`)}`
    const legacyWrapperTarget = `https://sub.xqd.pp.ua/sub?url=${encodeURIComponent(subUrl)}`

    await kv!.put(
      `${KV_KEYS.SHORT_PREFIX}leg1`,
      JSON.stringify({
        id: 'leg1',
        targetUrl: legacyWrapperTarget,
        name: 'sub.xqd.pp.ua',
        createdAt: Date.now() - 10_000,
        hits: 3,
        lastAccess: Date.now(),
      }),
    )
    await kv!.put(
      `${KV_KEYS.SHORT_PREFIX}leg2`,
      JSON.stringify({
        id: 'leg2',
        targetUrl: wrappedVmess,
        name: vmessPayload,
        createdAt: Date.now() - 5_000,
        hits: 2,
        lastAccess: Date.now(),
      }),
    )
    const index = (await kv!.get(KV_KEYS.SHORT_INDEX, 'json')) as { ids?: string[] } | null
    await kv!.put(
      KV_KEYS.SHORT_INDEX,
      JSON.stringify({ ids: [...(index?.ids || []), 'leg1', 'leg2'] }),
    )

    // 读取短链列表时自动修复展示名称
    const all = await getAllShortLinks()
    expect(all.find((item) => item.id === 'leg1')?.name).toBe('星云机场')
    expect(all.find((item) => item.id === 'leg2')?.name).toBe('HK-优途 | 01')

    // 通过 /s/leg2 访问时，不仅返回正确订阅标题，还会自动回填 KV 中短链名称
    const res = await handleShortLinkRedirect(
      new Request('https://sub.xqd.pp.ua/s/leg2', {
        headers: { 'User-Agent': 'clash.meta/v1.19' },
      }),
      'leg2',
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain(
      `filename*=UTF-8''${encodeURIComponent('HK-优途 | 01')}`,
    )
    const healed = await getShortLink('leg2')
    expect(healed?.name).toBe('HK-优途 | 01')
    expect(healed?.customName).toBe(false)
  })
})
