'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { LoginForm } from './components/LoginForm'
import { StatsCards } from './components/StatsCards'
import { SearchBar } from './components/SearchBar'
import { Pagination } from './components/Pagination'
import { BatchActions } from './components/BatchActions'
import { RecordsTable } from './components/RecordsTable'
import { ConfirmModal } from './components/ConfirmModal'
import { ToastProvider, useToast } from './components/Toast'

interface ConvertRecord {
  id: string
  originalUrl: string
  name: string
  clientType: string
  createdAt: number
  updatedAt: number
  lastAccess: number
  hits: number
  nodeCount: number
  lastIp: string
}

interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
}

interface Stats {
  totalRecords: number
  totalHits: number
  todayHits: number
  activeRecords: number
}

const PAGE_SIZE = 20

function AdminContent() {
  const { toast } = useToast()

  // 认证状态
  const [token, setToken] = useState('')
  const [isAuthed, setIsAuthed] = useState(false)

  // 数据状态
  const [records, setRecords] = useState<ConvertRecord[]>([])
  const [shortLinks, setShortLinks] = useState<ShortLink[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  // UI 状态
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [sortBy, setSortBy] = useState('lastAccess')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 弹窗状态
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  // 初始化 token
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setToken(savedToken)
      setIsAuthed(true)
    }
  }, [])

  // 获取数据
  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)

    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [recordsRes, statsRes, shortLinksRes] = await Promise.all([
        fetch('/api/admin/records', { headers }),
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/shortlinks', { headers })
      ])

      if (recordsRes.status === 401 || statsRes.status === 401) {
        toast('Token 已失效，请重新登录', 'error')
        handleLogout()
        return
      }

      const recordsData = await recordsRes.json() as { records?: ConvertRecord[] }
      const statsData = await statsRes.json() as Stats
      const shortLinksData = await shortLinksRes.json() as { shortLinks?: ShortLink[] }

      setRecords(recordsData.records || [])
      setStats(statsData)
      setShortLinks(shortLinksData.shortLinks || [])
    } catch {
      toast('获取数据失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  useEffect(() => {
    if (token && isAuthed) fetchData()
  }, [token, isAuthed, fetchData])

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setToken('')
    setIsAuthed(false)
    setRecords([])
    setShortLinks([])
    setStats(null)
  }

  // 过滤和排序记录
  const filteredRecords = useMemo(() => {
    let result = [...records]

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(lower) ||
        r.originalUrl.toLowerCase().includes(lower)
      )
    }

    if (clientFilter) {
      result = result.filter(r => r.clientType === clientFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'hits': return b.hits - a.hits
        case 'nodeCount': return b.nodeCount - a.nodeCount
        case 'createdAt': return b.createdAt - a.createdAt
        default: return b.lastAccess - a.lastAccess
      }
    })

    return result
  }, [records, search, clientFilter, sortBy])

  // 分页
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE)
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredRecords.slice(start, start + PAGE_SIZE)
  }, [filteredRecords, currentPage])

  useEffect(() => setCurrentPage(1), [search, clientFilter, sortBy])

  // 选择操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (paginatedRecords.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedRecords.map(r => r.id)))
    }
  }

  // 删除记录
  const deleteRecord = async (id: string) => {
    setConfirmModal({
      open: true,
      title: '删除记录',
      message: '确定要删除这条记录吗？删除后该订阅链接将无法使用。',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/records/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            toast('删除成功', 'success')
            fetchData()
          }
        } catch {
          toast('删除失败', 'error')
        }
        setConfirmModal(prev => ({ ...prev, open: false }))
      }
    })
  }

  // 批量删除
  const batchDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmModal({
      open: true,
      title: '批量删除',
      message: `确定要删除选中的 ${selectedIds.size} 条记录吗？`,
      onConfirm: async () => {
        try {
          await Promise.all(
            Array.from(selectedIds).map(id =>
              fetch(`/api/admin/records/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              })
            )
          )
          toast(`成功删除 ${selectedIds.size} 条记录`, 'success')
          setSelectedIds(new Set())
          fetchData()
        } catch {
          toast('批量删除失败', 'error')
        }
        setConfirmModal(prev => ({ ...prev, open: false }))
      }
    })
  }

  // 导出 CSV
  const exportCSV = () => {
    // CSV 字段转义函数
    const escapeCsvField = (field: string | number): string => {
      const str = String(field)
      // 如果包含逗号、换行符或双引号，需要用双引号包裹并转义内部的双引号
      if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const selected = records.filter(r => selectedIds.has(r.id))
    const headers = ['名称', '原始URL', '客户端', '节点数', '访问次数', '最后访问']
    const rows = selected.map(r => [
      escapeCsvField(r.name),
      escapeCsvField(r.originalUrl),
      escapeCsvField(r.clientType),
      escapeCsvField(r.nodeCount),
      escapeCsvField(r.hits),
      escapeCsvField(new Date(r.lastAccess).toLocaleString('zh-CN'))
    ])

    const csv = [headers.map(escapeCsvField), ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `records_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('导出成功', 'success')
  }

  // 复制订阅链接
  const copySubUrl = async (_id: string, originalUrl: string) => {
    const subUrl = `${window.location.origin}/sub?url=${encodeURIComponent(originalUrl)}`
    try {
      await navigator.clipboard.writeText(subUrl)
      toast('订阅链接已复制', 'success')
    } catch {
      toast('复制失败', 'error')
    }
  }

  // 创建短链接
  const createShortLink = async (record: ConvertRecord) => {
    const subUrl = `${window.location.origin}/sub?url=${encodeURIComponent(record.originalUrl)}`
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: subUrl })
      })
      if (res.ok) {
        toast('短链接创建成功', 'success')
        fetchData()
      }
    } catch {
      toast('创建短链接失败', 'error')
    }
  }

  // 复制短链接
  const copyShortLink = async (id: string) => {
    const url = `${window.location.origin}/s/${id}`
    try {
      await navigator.clipboard.writeText(url)
      toast('短链接已复制', 'success')
    } catch {
      toast('复制失败', 'error')
    }
  }

  // 删除短链接
  const deleteShortLink = async (id: string) => {
    setConfirmModal({
      open: true,
      title: '删除短链接',
      message: '确定要删除这个短链接吗？',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/shortlinks/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            toast('短链接已删除', 'success')
            fetchData()
          }
        } catch {
          toast('删除失败', 'error')
        }
        setConfirmModal(prev => ({ ...prev, open: false }))
      }
    })
  }

  if (!isAuthed) {
    return <LoginForm onLogin={(t) => { setToken(t); setIsAuthed(true) }} />
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600
                            flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                订阅管理
              </h1>
              <p className="text-xs text-gray-500">Sub Converter Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#18181b] border border-[#27272a]
                         text-gray-300 rounded-lg hover:bg-[#27272a] hover:border-[#3f3f46]
                         transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>刷新中</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>刷新</span>
                </>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10
                         rounded-lg transition-colors"
              title="退出登录"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <StatsCards stats={stats} shortLinksCount={shortLinks.length} />

        {/* 搜索过滤 */}
        <SearchBar
          search={search}
          onSearchChange={setSearch}
          clientFilter={clientFilter}
          onClientFilterChange={setClientFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* 批量操作 */}
        <BatchActions
          selectedCount={selectedIds.size}
          onDelete={batchDelete}
          onExport={exportCSV}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        {/* 记录表格 */}
        <RecordsTable
          records={paginatedRecords}
          shortLinks={shortLinks}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onDelete={deleteRecord}
          onCopySubUrl={copySubUrl}
          onCreateShortLink={createShortLink}
          onCopyShortLink={copyShortLink}
          onDeleteShortLink={deleteShortLink}
        />

        {/* 分页 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 确认弹窗 */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        danger
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
      />
    </div>
  )
}

export default function AdminPage() {
  return (
    <ToastProvider>
      <AdminContent />
    </ToastProvider>
  )
}
