import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  url.pathname = '/api/sub'

  return NextResponse.redirect(url.toString(), 308)
}
