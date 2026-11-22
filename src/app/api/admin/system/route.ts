import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { getLoginAuditLog } from '@/modules/admin-auth/login-audit.repository'
import { getPublicConfigFlags } from '@/server/env.config'
import { jsonOk } from '@/server/route.utils'
import { isKvAvailable } from '@/server/kv/kv.client'

export const runtime = 'edge'

export const GET = withAdminAuth('获取系统状态', async () => {
  const [kvAvailable, loginLog] = await Promise.all([isKvAvailable(), getLoginAuditLog()])
  return jsonOk({
    config: getPublicConfigFlags(),
    kvAvailable,
    loginLog,
  })
})
