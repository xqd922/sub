import { useCallback, useEffect, useState } from 'react'
import { adminFetch, handleAdminFetchError } from '@/features/admin/admin.client'
import type { DailyStats, StatsData } from '@/shared/admin.types'

export function useAdminStats(onUnauthorized?: () => void) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [daily, setDaily] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ stats: StatsData; daily: DailyStats[] }>('/api/admin/stats')
      setStats(data.stats)
      setDaily(data.daily || [])
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
        const data = await adminFetch<{ stats: StatsData; daily: DailyStats[] }>('/api/admin/stats')
        if (!active) return
        setStats(data.stats)
        setDaily(data.daily || [])
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

  return { stats, daily, loading, refresh }
}
