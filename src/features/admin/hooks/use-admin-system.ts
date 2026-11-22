import { useCallback, useEffect, useState } from 'react'
import { adminFetch, handleAdminFetchError } from '@/features/admin/api/admin.client'
import type { KvPingResult, RebuildIndexResult, SystemStatus } from '@/shared/types/admin.types'

export function useAdminSystem(onUnauthorized?: () => void) {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<SystemStatus>('/api/admin/system')
      setSystem(data)
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
        const data = await adminFetch<SystemStatus>('/api/admin/system')
        if (active) setSystem(data)
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

  const pingKv = useCallback(async (): Promise<KvPingResult | null> => {
    try {
      return await adminFetch<KvPingResult>('/api/admin/system/kv-ping', { method: 'POST' })
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return null
    }
  }, [onUnauthorized])

  const rebuildIndex = useCallback(async (): Promise<RebuildIndexResult | null> => {
    try {
      return await adminFetch<RebuildIndexResult>('/api/admin/system/rebuild-index', {
        method: 'POST',
      })
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      return null
    }
  }, [onUnauthorized])

  return { system, loading, refresh, pingKv, rebuildIndex }
}
