import { useCallback, useEffect } from 'react'
import {
  bootstrapAdminCache,
  updateCachedShortLinks,
  useAdminCache,
} from '@/features/admin/admin.cache'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type {
  BatchOperationResult,
  CreateShortLinkInput,
  ShortLink,
  ShortLinkImportResult,
  UpdateShortLinkInput,
} from '@/shared/admin.types'

export function useAdminShortLinks(onUnauthorized?: () => void) {
  const cache = useAdminCache()

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ shortLinks: ShortLink[] }>('/api/admin/short-links')
      updateCachedShortLinks(() => data.shortLinks || [])
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    }
  }, [onUnauthorized])

  useEffect(() => {
    if (cache.hydrated) return
    void bootstrapAdminCache().then((status) => {
      if (status === 'unauthorized') onUnauthorized?.()
    })
  }, [cache.hydrated, onUnauthorized])

  const updateLink = useCallback(
    async (id: string, updates: UpdateShortLinkInput): Promise<boolean> => {
      try {
        const data = await adminFetch<{ shortLink: ShortLink }>(
          `/api/admin/short-links/${encodeURIComponent(id)}`,
          jsonBody('PATCH', updates),
        )
        updateCachedShortLinks((prev) =>
          prev.map((item) => (item.id === id ? data.shortLink : item)),
        )
        showToast('短链接已更新', 'success')
        return true
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return false
      }
    },
    [onUnauthorized],
  )

  const setEnabled = useCallback(
    async (id: string, enabled: boolean): Promise<boolean> => {
      try {
        const data = await adminFetch<{ shortLink: ShortLink }>(
          `/api/admin/short-links/${encodeURIComponent(id)}`,
          jsonBody('PATCH', { disabled: !enabled }),
        )
        updateCachedShortLinks((prev) =>
          prev.map((item) => (item.id === id ? data.shortLink : item)),
        )
        showToast(enabled ? '已启用该短链' : '已禁用该短链', 'success')
        return true
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return false
      }
    },
    [onUnauthorized],
  )

  const batchSetEnabled = useCallback(
    async (ids: string[], enabled: boolean): Promise<boolean> => {
      try {
        const data = await adminFetch<BatchOperationResult>(
          '/api/admin/short-links',
          jsonBody('PATCH', { ids, action: enabled ? 'enable' : 'disable' }),
        )
        const succeeded = new Set(data.succeeded || [])
        if (succeeded.size > 0) {
          updateCachedShortLinks((prev) =>
            prev.map((item) => (succeeded.has(item.id) ? { ...item, disabled: !enabled } : item)),
          )
        }
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
    [onUnauthorized],
  )

  const deleteLinks = useCallback(
    async (ids: string[]): Promise<boolean> => {
      try {
        await adminFetch('/api/admin/short-links', jsonBody('DELETE', { ids }))
        updateCachedShortLinks((prev) => prev.filter((item) => !ids.includes(item.id)))
        showToast(ids.length > 1 ? `已删除 ${ids.length} 条短链` : '短链已删除', 'success')
        return true
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return false
      }
    },
    [onUnauthorized],
  )

  const createLink = useCallback(
    async (input: CreateShortLinkInput): Promise<ShortLink | null> => {
      try {
        const data = await adminFetch<{ shortLink: ShortLink }>(
          '/api/admin/short-links',
          jsonBody('POST', input),
        )
        updateCachedShortLinks((prev) => [
          data.shortLink,
          ...prev.filter((item) => item.id !== data.shortLink.id),
        ])
        showToast('短链接已创建', 'success')
        return data.shortLink
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return null
      }
    },
    [onUnauthorized],
  )

  const importLinks = useCallback(
    async (links: CreateShortLinkInput[]): Promise<ShortLinkImportResult | null> => {
      try {
        const data = await adminFetch<{ result: ShortLinkImportResult }>(
          '/api/admin/short-links/import',
          jsonBody('POST', { links }),
        )
        await refresh()
        const { imported, skipped, failed } = data.result
        showToast(
          `导入完成：成功 ${imported}，跳过 ${skipped}${failed > 0 ? `，失败 ${failed}` : ''}`,
          failed > 0 ? 'info' : 'success',
        )
        return data.result
      } catch (error) {
        handleAdminFetchError(error, onUnauthorized)
        return null
      }
    },
    [refresh, onUnauthorized],
  )

  return {
    shortLinks: cache.shortLinks,
    loading: !cache.hydrated,
    refresh,
    updateLink,
    setEnabled,
    batchSetEnabled,
    deleteLinks,
    createLink,
    importLinks,
  }
}
