import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { getRecentDailyStats, getStats } from '@/modules/record/record.repository'
import { jsonOk } from '@/server/route.utils'

export const runtime = 'edge'

export const GET = withAdminAuth('获取统计', async () => {
  const [stats, daily] = await Promise.all([getStats(), getRecentDailyStats(30)])
  return jsonOk({ stats, daily })
})
