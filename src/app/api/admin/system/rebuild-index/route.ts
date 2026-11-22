import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { rebuildKvIndexes } from '@/modules/record/index-maintenance.service'
import { jsonOk } from '@/server/route.utils'

export const runtime = 'edge'

export const POST = withAdminAuth('索引重建', async () => {
  const result = await rebuildKvIndexes()
  return jsonOk({ ...result })
})
