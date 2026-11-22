import { getSessionFromRequest } from '@/modules/admin-auth/session.service'
import { jsonOk } from '@/server/route.utils'

export const runtime = 'edge'

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  return jsonOk({ authenticated: session !== null })
}
