import { handleShortLinkRedirect } from '@/modules/short-link/short-link.handler'

export const runtime = 'edge'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params
  return handleShortLinkRedirect(request, id)
}
