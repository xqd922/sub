import { handleRequest } from '@/conversion/handler'

export const runtime = 'edge'

export async function GET(request: Request) {
  return handleRequest(request)
}
