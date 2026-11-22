import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import {
  computeStatsFromData,
  getRecentDailyStats,
  listAllRecordsForAdmin,
} from '@/modules/record/record.repository'
import { listKeysByPrefix } from '@/server/kv/kv.client'
import { KV_KEYS } from '@/server/kv/kv.types'
import { jsonOk } from '@/server/route.utils'

export const runtime = 'edge'

export const GET = withAdminAuth('获取统计', async () => {
  const [records, daily, shortKeys] = await Promise.all([
    listAllRecordsForAdmin(),
    getRecentDailyStats(30),
    listKeysByPrefix(KV_KEYS.SHORT_PREFIX),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const todayHits = daily.find((item) => item.date === today)?.totalHits || 0
  const totalShortLinks = shortKeys.filter(
    (name) => name.startsWith(KV_KEYS.SHORT_PREFIX) && !name.startsWith(KV_KEYS.SHORT_URL_PREFIX),
  ).length
  const stats = computeStatsFromData(records, todayHits, totalShortLinks)

  return jsonOk({ stats, daily, records })
})
