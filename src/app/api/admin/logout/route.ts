import { NextResponse } from 'next/server'
import { serializeClearedSessionCookie } from '@/modules/admin-auth/session.service'

export const runtime = 'edge'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.headers.set('Set-Cookie', serializeClearedSessionCookie())
  return response
}
