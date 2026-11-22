import { showToast } from '@/features/shared/hooks/use-toast'

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

export function jsonBody(method: 'POST' | 'PATCH' | 'DELETE', payload: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new AdminApiError('网络请求失败，请稍后重试', 0)
  }

  const body = (await response.json().catch(() => null)) as
    | (T & { success?: boolean; error?: { message?: string } })
    | null

  if (!response.ok) {
    const message = body?.error?.message || `请求失败（${response.status}）`
    throw new AdminApiError(message, response.status)
  }

  return body as T
}

export function handleAdminFetchError(error: unknown, onUnauthorized?: () => void): void {
  if (error instanceof AdminApiError && error.status === 401) {
    showToast('登录已过期，请重新登录', 'error')
    onUnauthorized?.()
    return
  }

  const message = error instanceof Error ? error.message : '操作失败，请稍后重试'
  showToast(message, 'error')
}
