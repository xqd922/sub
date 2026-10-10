'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ConvertRecord } from '@/infra/kv/types'
import { useAdminRecords, useAutoRefresh } from '@/components/use-admin-data'
import { useClipboard } from '@/components/use-clipboard'
import { showToast } from '@/components/use-toast'

interface AdminRecordsProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
}

type SortKey = 'lastAccess' | 'hits' | 'createdAt' | 'nodeCount'

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(timestamp).toISOString().slice(0, 10)
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export default function AdminRecords({ autoRefresh, onUnauthorized }: AdminRecordsProps) {
  const { records, loading, refresh, renameRecord, setEnabled, removeRecords, batchSetEnabled, addRecord } =
    useAdminRecords(onUnauthorized)
  const { copyToClipboard } = useClipboard()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('lastAccess')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')

  useAutoRefresh(refresh, autoRefresh)

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = keyword
      ? records.filter(
          record =>
            record.name.toLowerCase().includes(keyword) ||
            record.originalUrl.toLowerCase().includes(keyword) ||
            record.id.includes(keyword)
        )
      : [...records]

    return filtered.sort((a, b) => b[sortKey] - a[sortKey])
  }, [records, search, sortKey])

  const allVisibleSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r.id))

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const record of filteredRecords) next.delete(record.id)
        return next
      }
      return new Set([...prev, ...filteredRecords.map(r => r.id)])
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleCopyConversionLink = async (record: ConvertRecord) => {
    const conversionUrl = `${window.location.origin}/sub?url=${encodeURIComponent(record.originalUrl)}`
    const copied = await copyToClipboard(conversionUrl)
    showToast(copied ? '转换链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handlePreview = (record: ConvertRecord) => {
    window.open(`/sub?url=${encodeURIComponent(record.originalUrl)}`, '_blank')
  }

  const handleRename = async (record: ConvertRecord) => {
    const name = window.prompt('修改订阅名称', record.name)
    if (name === null || name.trim() === '' || name === record.name) return
    await renameRecord(record.id, name.trim())
  }

  const handleDeleteClick = (id: string) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void removeRecords([id])
      return
    }
    setConfirmingDeleteId(id)
    setTimeout(() => {
      setConfirmingDeleteId(prev => (prev === id ? null : prev))
    }, 3000)
  }

  const handleBatchDelete = async () => {
    if (!window.confirm(`确认永久删除选中的 ${selectedIds.size} 条记录？此操作不可恢复。`)) return
    const ids = Array.from(selectedIds)
    await removeRecords(ids)
    setSelectedIds(new Set())
  }

  const handleExportCsv = () => {
    const header = ['ID', '名称', '订阅链接', '状态', '客户端', '节点数', '命中次数', '创建时间', '最后访问', '最后IP']
    const rows = filteredRecords.map(record => [
      record.id,
      record.name,
      record.originalUrl,
      record.deleted ? '已禁用' : '正常',
      record.clientType,
      String(record.nodeCount),
      String(record.hits),
      formatDateTime(record.createdAt),
      formatDateTime(record.lastAccess),
      record.lastIp
    ])
    const csv = '﻿' + [header, ...rows].map(row => row.map(cell => csvEscape(cell)).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `convert-records-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(downloadUrl)
  }

  const handleAdd = async () => {
    if (!newUrl.trim()) return
    const success = await addRecord(newUrl.trim(), newName.trim() || undefined)
    if (success) {
      setNewUrl('')
      setNewName('')
      setShowAddForm(false)
    }
  }

  const actionButtonClass = 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap'
  const dangerButtonClass = confirmingDeleteId
    ? 'text-red-600 dark:text-red-400 font-medium whitespace-nowrap'
    : 'text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索名称 / 链接 / ID"
          className="flex-1 min-w-40 px-3 py-1.5 text-xs bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="px-2 py-1.5 text-xs bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none dark:text-gray-100"
        >
          <option value="lastAccess">按最近访问</option>
          <option value="hits">按命中次数</option>
          <option value="createdAt">按创建时间</option>
          <option value="nodeCount">按节点数量</option>
        </select>
        <button onClick={() => setShowAddForm(prev => !prev)} className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 hover:opacity-90">
          {showAddForm ? '收起' : '登记订阅'}
        </button>
        <button
          onClick={handleExportCsv}
          disabled={filteredRecords.length === 0}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-black/50 disabled:opacity-40"
        >
          导出 CSV
        </button>
      </div>

      {showAddForm && (
        <div className="flex flex-wrap items-center gap-2 bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg p-3">
          <input
            type="url"
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            placeholder="https://example.com/subscription"
            className="flex-1 min-w-48 px-3 py-1.5 text-xs bg-transparent border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
          />
          <input
            type="text"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="备注名（可选）"
            className="w-36 px-3 py-1.5 text-xs bg-transparent border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
          />
          <button
            onClick={handleAdd}
            disabled={!newUrl.trim()}
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 disabled:opacity-40"
          >
            添加
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs text-gray-600 dark:text-gray-300">已选 {selectedIds.size} 项</span>
          <button onClick={() => void batchSetEnabled(Array.from(selectedIds), true)} className="text-xs text-green-600 dark:text-green-400 hover:underline">
            批量启用
          </button>
          <button onClick={() => void batchSetEnabled(Array.from(selectedIds), false)} className="text-xs text-orange-600 dark:text-orange-400 hover:underline">
            批量禁用
          </button>
          <button onClick={handleBatchDelete} className="text-xs text-red-600 dark:text-red-400 hover:underline">
            批量删除
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:underline">
            取消选择
          </button>
        </div>
      )}

      <div className="bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-gray-200/50 dark:border-gray-700/50 text-[10px] text-gray-400 dark:text-gray-500">
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="全选" />
                </th>
                <th className="px-2 py-2.5">订阅</th>
                <th className="px-2 py-2.5">状态</th>
                <th className="px-2 py-2.5">客户端</th>
                <th className="px-2 py-2.5 text-right">节点</th>
                <th className="px-2 py-2.5 text-right">命中</th>
                <th className="px-2 py-2.5">最近访问</th>
                <th className="px-2 pr-4 py-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-400">加载中...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-400">
                  {records.length === 0 ? '暂无记录，转换一次订阅后这里会出现数据' : '没有匹配的记录'}
                </td></tr>
              ) : (
                filteredRecords.map(record => (
                  <Fragment key={record.id}>
                    <tr className="border-b border-gray-200/30 dark:border-gray-700/30 hover:bg-white/30 dark:hover:bg-white/5 text-xs">
                      <td className="pl-4 pr-2 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          aria-label={`选择 ${record.name}`}
                        />
                      </td>
                      <td className="px-2 py-2.5 max-w-56">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200" title={record.name}>{record.name}</p>
                        <p className="truncate text-[10px] text-gray-400 dark:text-gray-500" title={record.originalUrl}>{record.originalUrl}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        {record.deleted ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px]">
                            ● 已禁用
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]">
                            ● 正常
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-gray-500 dark:text-gray-400">{record.clientType}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{record.nodeCount}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{record.hits}</td>
                      <td className="px-2 py-2.5 text-gray-400 dark:text-gray-500" title={formatDateTime(record.lastAccess)}>
                        {formatRelativeTime(record.lastAccess)}
                      </td>
                      <td className="px-2 pr-4 py-2.5">
                        <div className="flex items-center justify-end gap-2.5 text-[11px]">
                          <button onClick={() => void handleCopyConversionLink(record)} className={actionButtonClass}>复制</button>
                          <button onClick={() => handlePreview(record)} className={actionButtonClass}>预览</button>
                          <button
                            onClick={() => void setEnabled(record.id, !!record.deleted)}
                            className={record.deleted ? 'text-green-600 dark:text-green-400 hover:underline whitespace-nowrap' : 'text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap'}
                          >
                            {record.deleted ? '启用' : '禁用'}
                          </button>
                          <button onClick={() => void handleRename(record)} className={actionButtonClass}>改名</button>
                          <button
                            onClick={() => setExpandedId(prev => (prev === record.id ? null : record.id))}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {expandedId === record.id ? '收起' : '详情'}
                          </button>
                          <button onClick={() => handleDeleteClick(record.id)} className={dangerButtonClass}>
                            {confirmingDeleteId === record.id ? '确认删除？' : '删除'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === record.id && (
                      <tr className="border-b border-gray-200/30 dark:border-gray-700/30 bg-gray-50/50 dark:bg-white/5">
                        <td colSpan={8} className="px-4 py-3">
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                            <div className="sm:col-span-2">
                              <dt className="inline text-gray-400 dark:text-gray-500">订阅链接：</dt>
                              <dd className="inline break-all text-gray-600 dark:text-gray-300">{record.originalUrl}</dd>
                            </div>
                            <div><dt className="inline text-gray-400 dark:text-gray-500">ID：</dt><dd className="inline font-mono text-gray-600 dark:text-gray-300">{record.id}</dd></div>
                            <div><dt className="inline text-gray-400 dark:text-gray-500">最后 IP：</dt><dd className="inline text-gray-600 dark:text-gray-300">{record.lastIp || '—'}</dd></div>
                            <div><dt className="inline text-gray-400 dark:text-gray-500">创建时间：</dt><dd className="inline text-gray-600 dark:text-gray-300">{formatDateTime(record.createdAt)}</dd></div>
                            <div><dt className="inline text-gray-400 dark:text-gray-500">更新时间：</dt><dd className="inline text-gray-600 dark:text-gray-300">{formatDateTime(record.updatedAt)}</dd></div>
                            <div><dt className="inline text-gray-400 dark:text-gray-500">最后访问：</dt><dd className="inline text-gray-600 dark:text-gray-300">{formatDateTime(record.lastAccess)}</dd></div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
        共 {records.length} 条记录（含已禁用） · 禁用后该订阅链接将立即返回 400
      </p>
    </div>
  )
}
