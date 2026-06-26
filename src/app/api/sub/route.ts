import { handleRequest } from '@/convert/handler'

export const runtime = 'edge'

export async function GET(request: Request) {
  return handleRequest(request)
}
