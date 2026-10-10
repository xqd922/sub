import { useCallback, useEffect, useState } from 'react'
import type { ConvertRecord, ShortLink, StatsData, DailyStats } from '@/infra/kv/types'
import { showToast } from '@/components/use-toast'

interface LoginAttemptEntry {
  time: number
  ip: string
  ok: boolean
  userAgent?: string
}

export interface SystemStatus {
  config: {
    adminUsername: boolean
    adminPassword: boolean
    adminSecret: boolean
    sink: boolean
    bitly: boolean
    cuttly: boolean
    siteUrl: boolean
  }
  kvAvailable: boolean
  loginLog: LoginAttemptEntry[]
}

export function useAutoRefresh(callback: () => void, enabled: boolean, intervalMs = 30000) {
  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => {
      if (!document.hidden) callback()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [callback, enabled, intervalMs])
}

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw new Error('网络请求失败，请稍后重试')
  }

  const body = await response.json().catch(() => null) as
    | (T & { success?: boolean; error?: { message?: string } })
    | null

  if (!response.ok) {
    const message = body?.error?.message || `请求失败（${response.status}）`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return body as T
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }
}

export function useAdminStats() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [daily, setDaily] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ stats: StatsData; daily: DailyStats[] }>('/api/admin/stats')
      setStats(data.stats)
      setDaily(data.daily || [])
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 挂载时加载统计数据，setState 均发生在 await 之后
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  return { stats, daily, loading, refresh }
}

export function useAdminRecords(onUnauthorized?: () => void) {
  const [records, setRecords] = useState<ConvertRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ records: ConvertRecord[] }>('/api/admin/records')
      setRecords(data.records || [])
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        showToast('登录已过期，请重新登录', 'error')
        onUnauthorized?.()
        return
      }
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    // 挂载时加载转换记录，setState 均发生在 await 之后
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const renameRecord = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>(`/api/admin/records/${id}`, jsonInit('PATCH', { name }))
      setRecords(prev => prev.map(item => (item.id === id ? data.record : item)))
      showToast('名称已更新', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  const setEnabled = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>(`/api/admin/records/${id}`, jsonInit('PATCH', { enabled }))
      setRecords(prev => prev.map(item => (item.id === id ? data.record : item)))
      showToast(enabled ? '已启用该订阅' : '已禁用该订阅', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  const removeRecords = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      await adminFetch('/api/admin/records', jsonInit('DELETE', { ids }))
      setRecords(prev => prev.filter(item => !ids.includes(item.id)))
      showToast(ids.length > 1 ? `已删除 ${ids.length} 条记录` : '记录已删除', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  const batchSetEnabled = useCallback(async (ids: string[], enabled: boolean): Promise<boolean> => {
    try {
      const data = await adminFetch<{ succeeded: string[]; failed: string[] }>('/api/admin/records', jsonInit('PATCH', {
        ids,
        action: enabled ? 'enable' : 'disable'
      }))
      await refresh()
      const failedCount = data.failed?.length || 0
      showToast(failedCount > 0 ? `完成，${failedCount} 条操作失败` : '批量操作完成', failedCount > 0 ? 'info' : 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [refresh])

  const addRecord = useCallback(async (url: string, name?: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>('/api/admin/records', jsonInit('POST', { url, name }))
      setRecords(prev => [data.record, ...prev.filter(item => item.id !== data.record.id)])
      showToast('订阅已登记', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  return { records, loading, refresh, renameRecord, setEnabled, removeRecords, batchSetEnabled, addRecord }
}

export function useAdminShortLinks(onUnauthorized?: () => void) {
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ shortLinks: ShortLink[] }>('/api/admin/short-links')
      setShortLinks(data.shortLinks || [])
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        showToast('登录已过期，请重新登录', 'error')
        onUnauthorized?.()
        return
      }
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    // 挂载时加载短链接，setState 均发生在 await 之后
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const renameLink = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ shortLink: ShortLink }>(`/api/admin/short-links/${id}`, jsonInit('PATCH', { name }))
      setShortLinks(prev => prev.map(item => (item.id === id ? data.shortLink : item)))
      showToast('名称已更新', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  const deleteLinks = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      await adminFetch('/api/admin/short-links', jsonInit('DELETE', { ids }))
      setShortLinks(prev => prev.filter(item => !ids.includes(item.id)))
      showToast(ids.length > 1 ? `已删除 ${ids.length} 条短链` : '短链已删除', 'success')
      return true
    } catch (error) {
      showToast((error as Error).message, 'error')
      return false
    }
  }, [])

  const createLink = useCallback(async (targetUrl: string): Promise<ShortLink | null> => {
    try {
      const data = await adminFetch<{ shortLink: ShortLink }>('/api/admin/short-links', jsonInit('POST', { targetUrl }))
      setShortLinks(prev => [data.shortLink, ...prev.filter(item => item.id !== data.shortLink.id)])
      showToast('短链接已创建', 'success')
      return data.shortLink
    } catch (error) {
      showToast((error as Error).message, 'error')
      return null
    }
  }, [])

  return { shortLinks, loading, refresh, renameLink, deleteLinks, createLink }
}

export function useAdminSystem(onUnauthorized?: () => void) {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<SystemStatus>('/api/admin/system')
      setSystem(data)
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        showToast('登录已过期，请重新登录', 'error')
        onUnauthorized?.()
        return
      }
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    // 挂载时加载系统状态，setState 均发生在 await 之后
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const pingKV = useCallback(async (): Promise<{ ok: boolean; latencyMs: number } | null> => {
    try {
      return await adminFetch<{ ok: boolean; latencyMs: number }>('/api/admin/system/kv-ping', { method: 'POST' })
    } catch (error) {
      showToast((error as Error).message, 'error')
      return null
    }
  }, [])

  const rebuildIndex = useCallback(async (): Promise<{ recordIndexed: number; shortIndexed: number; recordRepaired: number; shortRepaired: number } | null> => {
    try {
      return await adminFetch('/api/admin/system/rebuild-index', { method: 'POST' })
    } catch (error) {
      showToast((error as Error).message, 'error')
      return null
    }
  }, [])

  return { system, loading, refresh, pingKV, rebuildIndex }
}
