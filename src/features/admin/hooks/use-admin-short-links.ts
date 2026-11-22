import { useCallback, useEffect, useState } from 'react'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/api/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { ShortLink } from '@/shared/types/admin.types'

export function useAdminShortLinks(onUnauthorized?: () => void) {
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ shortLinks: ShortLink[] }>('/api/admin/short-links')
      setShortLinks(data.shortLinks || [])
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
        const data = await adminFetch<{ shortLinks: ShortLink[] }>('/api/admin/short-links')
        if (active) setShortLinks(data.shortLinks || [])
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

  const renameLink = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const data = await adminFetch<{ shortLink: ShortLink }>(
        `/api/admin/short-links/${id}`,
        jsonBody('PATCH', { name }),
      )
      setShortLinks((prev) => prev.map((item) => (item.id === id ? data.shortLink : item)))
      showToast('名称已更新', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  const deleteLinks = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      await adminFetch('/api/admin/short-links', jsonBody('DELETE', { ids }))
      setShortLinks((prev) => prev.filter((item) => !ids.includes(item.id)))
      showToast(ids.length > 1 ? `已删除 ${ids.length} 条短链` : '短链已删除', 'success')
      return true
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return false
    }
  }, [onUnauthorized])

  const createLink = useCallback(async (targetUrl: string): Promise<ShortLink | null> => {
    try {
      const data = await adminFetch<{ shortLink: ShortLink }>(
        '/api/admin/short-links',
        jsonBody('POST', { targetUrl }),
      )
      setShortLinks((prev) => [
        data.shortLink,
        ...prev.filter((item) => item.id !== data.shortLink.id),
      ])
      showToast('短链接已创建', 'success')
      return data.shortLink
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return null
    }
  }, [onUnauthorized])

  return { shortLinks, loading, refresh, renameLink, deleteLinks, createLink }
}
