import { useCallback, useEffect, useState } from 'react'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { BatchOperationResult, ConvertRecord } from '@/shared/admin.types'

export function useAdminRecords(onUnauthorized?: () => void) {
  const [records, setRecords] = useState<ConvertRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ records: ConvertRecord[] }>('/api/admin/records')
      setRecords(data.records || [])
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const data = await adminFetch<{ records: ConvertRecord[] }>('/api/admin/records')
        if (active) setRecords(data.records || [])
      } catch (error) {
        if (active) handleAdminFetchError(error, onUnauthorized)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [onUnauthorized])

  const renameRecord = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>(
        `/api/admin/records/${id}`,
        jsonBody('PATCH', { name }),
      )
      setRecords((prev) => prev.map((item) => (item.id === id ? data.record : item)))
      showToast('名称已更新', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  const setEnabled = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>(
        `/api/admin/records/${id}`,
        jsonBody('PATCH', { enabled }),
      )
      setRecords((prev) => prev.map((item) => (item.id === id ? data.record : item)))
      showToast(enabled ? '已启用该订阅' : '已禁用该订阅', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  const removeRecords = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      await adminFetch('/api/admin/records', jsonBody('DELETE', { ids }))
      setRecords((prev) => prev.filter((item) => !ids.includes(item.id)))
      showToast(ids.length > 1 ? `已删除 ${ids.length} 条记录` : '记录已删除', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  const batchSetEnabled = useCallback(
    async (ids: string[], enabled: boolean): Promise<boolean> => {
      try {
        const data = await adminFetch<BatchOperationResult>(
          '/api/admin/records',
          jsonBody('PATCH', { ids, action: enabled ? 'enable' : 'disable' }),
        )
        await refresh()
        const failedCount = data.failed?.length || 0
        showToast(
          failedCount > 0 ? `完成，${failedCount} 条操作失败` : '批量操作完成',
          failedCount > 0 ? 'info' : 'success',
        )
        return true
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return false
      }
    },
    [refresh, onUnauthorized],
  )

  const addRecord = useCallback(async (url: string, name?: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ record: ConvertRecord }>(
        '/api/admin/records',
        jsonBody('POST', { url, name }),
      )
      setRecords((prev) => [data.record, ...prev.filter((item) => item.id !== data.record.id)])
      showToast('订阅已登记', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  return {
    records,
    loading,
    refresh,
    renameRecord,
    setEnabled,
    removeRecords,
    batchSetEnabled,
    addRecord,
  }
}
