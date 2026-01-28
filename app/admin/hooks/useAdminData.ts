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

      // 检查所有响应的认证状态
      if (recordsRes.status === 401 || statsRes.status === 401 || shortLinksRes.status === 401) {
        setError('登录已过期，请重新登录')
        return
      }

      // 检查其他错误状态
      if (!recordsRes.ok || !statsRes.ok || !shortLinksRes.ok) {
        const errors: string[] = []
        if (!recordsRes.ok) errors.push(`记录: ${recordsRes.status}`)
        if (!statsRes.ok) errors.push(`统计: ${statsRes.status}`)
        if (!shortLinksRes.ok) errors.push(`短链接: ${shortLinksRes.status}`)
        setError(`获取数据失败 (${errors.join(', ')})`)
        return
      }

      const recordsData = await recordsRes.json() as { records?: ConvertRecord[] }
      const statsData = await statsRes.json() as Stats
      const shortLinksData = await shortLinksRes.json() as { shortLinks?: ShortLink[] }

      setRecords(recordsData.records || [])
      setStats(statsData)
      setShortLinks(shortLinksData.shortLinks || [])
    } catch (err) {
      setError('网络请求失败，请检查网络连接')
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
        const deletedRecord = records.find(r => r.id === id)
        setRecords(prev => prev.filter(r => r.id !== id))
        // 同步更新统计数据
        if (stats && deletedRecord) {
          setStats(prev => prev ? {
            ...prev,
            totalRecords: Math.max(0, prev.totalRecords - 1),
            totalHits: Math.max(0, prev.totalHits - deletedRecord.hits),
            activeRecords: deletedRecord.lastAccess > Date.now() - 7 * 24 * 60 * 60 * 1000
              ? Math.max(0, prev.activeRecords - 1)
              : prev.activeRecords
          } : null)
        }
        return true
      }
      return false
    } catch (err) {
      console.error('删除失败:', err)
      return false
    }
  }, [token, records, stats])

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
