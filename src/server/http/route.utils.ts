import { NextResponse } from 'next/server'
import { AppError } from '@/server/errors/app-error'

export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

export async function getExecutionContext(): Promise<ExecutionContext | null> {
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    return getRequestContext().ctx
  } catch {
    return null
  }
}

export function jsonOk<T extends Record<string, unknown>>(
  data: T,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json({ success: true, ...data }, init)
}

export function jsonError(error: AppError, extraHeaders?: HeadersInit): NextResponse {
  return NextResponse.json(error.toResponse(), {
    status: error.statusCode,
    headers: extraHeaders,
  })
}
