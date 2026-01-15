import { useState, useEffect, useCallback } from 'react'
import type { ConvertRecord, ShortLink, Stats } from '../types'

interface UseAdminDataReturn {
  records: ConvertRecord[]
  shortLinks: ShortLink[]
  stats: Stats | null
  loading: boolean
  error: string
  refetch: () => Promise<void>
  deleteRecord: (id: string) => Promise<boolean>
  deleteShortLink: (id: string) => Promise<boolean>
}

export function useAdminData(token: string): UseAdminDataReturn {
  const [records, setRecords] = useState<ConvertRecord[]>([])
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError('')

    try {
      const headers = { Authorization: `Bearer ${token}` }

      const [recordsRes, statsRes, shortLinksRes] = await Promise.all([
        fetch('/api/admin/records', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/shortlinks', { headers })
      ])

      if (recordsRes.status === 401 || statsRes.status === 401) {
        setError('Token 无效')
        return
      }

      const recordsData = await recordsRes.json() as { records?: ConvertRecord[] }
      const statsData = await statsRes.json() as Stats
      const shortLinksData = await shortLinksRes.json() as { shortLinks?: ShortLink[] }

      setRecords(recordsData.records || [])
      setStats(statsData)
      setShortLinks(shortLinksData.shortLinks || [])
    } catch (err) {
      setError('获取数据失败')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token, fetchData])

  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/records/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== id))
        return true
      }
      return false
    } catch (err) {
      console.error('删除失败:', err)
      return false
    }
  }, [token])

  const deleteShortLink = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/shortlinks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setShortLinks(prev => prev.filter(l => l.id !== id))
        return true
      }
      return false
    } catch (err) {
      console.error('删除短链接失败:', err)
      return false
    }
  }, [token])

  return {
    records,
    shortLinks,
    stats,
    loading,
    error,
    refetch: fetchData,
    deleteRecord,
    deleteShortLink
  }
}
