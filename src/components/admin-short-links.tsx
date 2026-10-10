'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ShortLink } from '@/infra/kv/types'
import { useAdminShortLinks, useAutoRefresh } from '@/components/use-admin-data'
import { useClipboard } from '@/components/use-clipboard'
import { showToast } from '@/components/use-toast'
import QrCodeModal from './qr-code'

interface AdminShortLinksProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
}

type SortKey = 'createdAt' | 'hits' | 'lastAccess'

function getShortLinkUrl(id: string): string {
  return `${window.location.origin}/s/${id}`
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(timestamp).toISOString().slice(0, 10)
}

export default function AdminShortLinks({ autoRefresh, onUnauthorized }: AdminShortLinksProps) {
  const { shortLinks, loading, refresh, renameLink, deleteLinks, createLink } = useAdminShortLinks(onUnauthorized)
  const { copyToClipboard } = useClipboard()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTargetUrl, setNewTargetUrl] = useState('')
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)

  useAutoRefresh(refresh, autoRefresh)

  const filteredLinks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = keyword
      ? shortLinks.filter(
          link =>
            link.name.toLowerCase().includes(keyword) ||
            link.targetUrl.toLowerCase().includes(keyword) ||
            link.id.includes(keyword)
        )
      : [...shortLinks]

    return filtered.sort((a, b) => b[sortKey] - a[sortKey])
  }, [shortLinks, search, sortKey])

  const allVisibleSelected = filteredLinks.length > 0 && filteredLinks.every(link => selectedIds.has(link.id))

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const link of filteredLinks) next.delete(link.id)
        return next
      }
      return new Set([...prev, ...filteredLinks.map(link => link.id)])
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

  const handleCopyShortLink = async (link: ShortLink) => {
    const copied = await copyToClipboard(getShortLinkUrl(link.id))
    showToast(copied ? '短链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handleOpenTarget = (link: ShortLink) => {
    window.open(`/s/${link.id}`, '_blank')
  }

  const handleRename = async (link: ShortLink) => {
    const name = window.prompt('修改短链接名称', link.name)
    if (name === null || name.trim() === '' || name === link.name) return
    await renameLink(link.id, name.trim())
  }

  const handleDeleteClick = (id: string) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void deleteLinks([id])
      return
    }
    setConfirmingDeleteId(id)
    setTimeout(() => {
      setConfirmingDeleteId(prev => (prev === id ? null : prev))
    }, 3000)
  }

  const handleBatchDelete = async () => {
    if (!window.confirm(`确认删除选中的 ${selectedIds.size} 条短链接？此操作不可恢复。`)) return
    const ids = Array.from(selectedIds)
    await deleteLinks(ids)
    setSelectedIds(new Set())
  }

  const handleCreate = async () => {
    if (!newTargetUrl.trim()) return
    const created = await createLink(newTargetUrl.trim())
    if (created) {
      setNewTargetUrl('')
      setShowCreateForm(false)
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
          placeholder="搜索名称 / 目标链接 / ID"
          className="flex-1 min-w-40 px-3 py-1.5 text-xs bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="px-2 py-1.5 text-xs bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none dark:text-gray-100"
        >
          <option value="createdAt">按创建时间</option>
          <option value="hits">按命中次数</option>
          <option value="lastAccess">按最近访问</option>
        </select>
        <button onClick={() => setShowCreateForm(prev => !prev)} className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 hover:opacity-90">
          {showCreateForm ? '收起' : '创建短链'}
        </button>
      </div>

      {showCreateForm && (
        <div className="flex flex-wrap items-center gap-2 bg-white/50 dark:bg-black/50 border border-gray-200/50 dark:border-gray-700/50 rounded-lg p-3">
          <input
            type="url"
            value={newTargetUrl}
            onChange={(event) => setNewTargetUrl(event.target.value)}
            placeholder="https://example.com/target"
            className="flex-1 min-w-48 px-3 py-1.5 text-xs bg-transparent border border-gray-200/50 dark:border-gray-700/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-gray-100"
          />
          <button
            onClick={handleCreate}
            disabled={!newTargetUrl.trim()}
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 disabled:opacity-40"
          >
            创建
          </button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-xs text-gray-600 dark:text-gray-300">已选 {selectedIds.size} 项</span>
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
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-gray-200/50 dark:border-gray-700/50 text-[10px] text-gray-400 dark:text-gray-500">
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} aria-label="全选" />
                </th>
                <th className="px-2 py-2.5">短链地址</th>
                <th className="px-2 py-2.5">目标链接</th>
                <th className="px-2 py-2.5 text-right">命中</th>
                <th className="px-2 py-2.5">创建时间</th>
                <th className="px-2 pr-4 py-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-gray-400">加载中...</td></tr>
              ) : filteredLinks.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-gray-400">
                  {shortLinks.length === 0 ? '暂无短链接，转换后生成或手动创建' : '没有匹配的短链接'}
                </td></tr>
              ) : (
                filteredLinks.map(link => (
                  <Fragment key={link.id}>
                    <tr className="border-b border-gray-200/30 dark:border-gray-700/30 hover:bg-white/30 dark:hover:bg-white/5 text-xs">
                      <td className="pl-4 pr-2 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(link.id)}
                          onChange={() => toggleSelect(link.id)}
                          aria-label={`选择 ${link.name}`}
                        />
                      </td>
                      <td className="px-2 py-2.5 max-w-48">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200" title={link.name}>{link.name}</p>
                        <p className="truncate text-[10px] font-mono text-blue-500 dark:text-blue-400">{getShortLinkUrl(link.id)}</p>
                      </td>
                      <td className="px-2 py-2.5 max-w-56">
                        <p className="truncate text-[10px] text-gray-500 dark:text-gray-400" title={link.targetUrl}>{link.targetUrl}</p>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{link.hits}</td>
                      <td className="px-2 py-2.5 text-gray-400 dark:text-gray-500">{formatRelativeTime(link.createdAt)}</td>
                      <td className="px-2 pr-4 py-2.5">
                        <div className="flex items-center justify-end gap-2.5 text-[11px]">
                          <button onClick={() => void handleCopyShortLink(link)} className={actionButtonClass}>复制</button>
                          <button onClick={() => handleOpenTarget(link)} className={actionButtonClass}>打开</button>
                          <button onClick={() => setQrLink(link)} className={actionButtonClass}>二维码</button>
                          <button onClick={() => void handleRename(link)} className={actionButtonClass}>改名</button>
                          <button onClick={() => handleDeleteClick(link.id)} className={dangerButtonClass}>
                            {confirmingDeleteId === link.id ? '确认删除？' : '删除'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">共 {shortLinks.length} 条短链接 · 删除后原短链将立即失效</p>

      {qrLink && (
        <QrCodeModal url={getShortLinkUrl(qrLink.id)} title={qrLink.name} onClose={() => setQrLink(null)} />
      )}
    </div>
  )
}
