import { handleConversionRequest } from '@/modules/subscription/conversion.handler'

export const runtime = 'edge'

export async function GET(request: Request) {
  return handleConversionRequest(request)
}
