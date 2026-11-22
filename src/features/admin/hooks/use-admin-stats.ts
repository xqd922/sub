import { useCallback, useEffect } from 'react'
import { bootstrapAdminCache, useAdminCache } from '@/features/admin/admin.cache'

export function useAdminStats(onUnauthorized?: () => void) {
  const cache = useAdminCache()

  const refresh = useCallback(async () => {
    const status = await bootstrapAdminCache({ force: true })
    if (status === 'unauthorized') onUnauthorized?.()
  }, [onUnauthorized])

  useEffect(() => {
    if (cache.hydrated) return
    void bootstrapAdminCache().then((status) => {
      if (status === 'unauthorized') onUnauthorized?.()
    })
  }, [cache.hydrated, onUnauthorized])

  return {
    stats: cache.stats,
    daily: cache.daily,
    hourly: cache.hourly,
    records: cache.records,
    loading: !cache.hydrated,
    refresh,
  }
}
