import { withAdminAuth } from '@/modules/admin-auth/admin.guard'
import { inspectSubscription } from '@/modules/subscription/subscription.service'
import { AppError } from '@/server/app-error'
import { jsonOk, parseJsonBody } from '@/server/route.utils'
import { isAllowedSubscriptionInput, unwrapConversionUrl } from '@/shared/url.utils'

export const runtime = 'edge'

export const POST = withAdminAuth('订阅检测', async (request) => {
  const body = await parseJsonBody<{ url?: string }>(request)
  if (!body?.url || typeof body.url !== 'string') {
    throw AppError.validation('请提供要检测的订阅链接', 'url')
  }

  const { subscriptionUrl } = unwrapConversionUrl(body.url)
  if (!isAllowedSubscriptionInput(subscriptionUrl)) {
    throw AppError.validation('仅支持有效的 HTTP(S) 订阅链接或代理节点 URI', 'url')
  }

  const inspection = await inspectSubscription(subscriptionUrl)
  return jsonOk({ inspection })
})
