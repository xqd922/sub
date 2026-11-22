import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { jsonOk } from '@/server/http/route.utils'
import { pingKv } from '@/server/kv/kv.client'

export const runtime = 'edge'

export const POST = withAdminAuth('KV 连通性测试', async () => {
  const result = await pingKv()
  return jsonOk({ ...result })
})
