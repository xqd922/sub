import { handleShortenGet, handleShortenPost } from '@/modules/short-link/short-link.handler'

export const runtime = 'edge'

export async function POST(request: Request) {
  return handleShortenPost(request)
}

export async function GET(request: Request) {
  return handleShortenGet(request)
}
