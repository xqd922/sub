'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { Input } from '@/components/base/input/input'
import { AlertDialog } from '@/components/base/modal/modal'
import { SearchField } from '@/components/base/search-field/search-field'
import { Select, SelectItem } from '@/components/base/select/select'
import { RenameEntityModal } from '@/features/admin/components/rename-entity-modal'
import { useAdminShortLinks } from '@/features/admin/hooks/use-admin-short-links'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useAutoRefresh } from '@/features/shared/hooks/use-auto-refresh'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { ShortLink } from '@/shared/admin.types'
import { formatRelativeTime } from '@/shared/format.utils'
import { cx } from '@/utils/cx'

interface ShortLinksPanelProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
  onCountChange?: (count: number) => void
}

type SortKey = 'createdAt' | 'hits' | 'lastAccess'

function getShortLinkUrl(id: string): string {
  if (typeof window === 'undefined') return `/s/${id}`
  return `${window.location.origin}/s/${id}`
}

export function ShortLinksPanel({
  autoRefresh,
  onUnauthorized,
  onCountChange,
}: ShortLinksPanelProps) {
  const { shortLinks, loading, refresh, renameLink, deleteLinks, createLink } =
    useAdminShortLinks(onUnauthorized)
  const { copyToClipboard } = useClipboard()

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTargetUrl, setNewTargetUrl] = useState('')
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)
  const [renamingLink, setRenamingLink] = useState<ShortLink | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  useAutoRefresh(refresh, autoRefresh)

  useEffect(() => {
    onCountChange?.(shortLinks.length)
  }, [shortLinks.length, onCountChange])

  const filteredLinks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = keyword
      ? shortLinks.filter(
          (link) =>
            link.name.toLowerCase().includes(keyword) ||
            link.targetUrl.toLowerCase().includes(keyword) ||
            link.id.toLowerCase().includes(keyword),
        )
      : [...shortLinks]

    return filtered.sort((a, b) => b[sortKey] - a[sortKey])
  }, [shortLinks, search, sortKey])

  const allVisibleSelected =
    filteredLinks.length > 0 && filteredLinks.every((link) => selectedIds.has(link.id))
  const someVisibleSelected =
    !allVisibleSelected && filteredLinks.some((link) => selectedIds.has(link.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const link of filteredLinks) next.delete(link.id)
        return next
      }
      return new Set([...prev, ...filteredLinks.map((link) => link.id)])
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopyShortLink = async (link: ShortLink) => {
    const copied = await copyToClipboard(getShortLinkUrl(link.id))
    showToast(copied ? '短链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handleOpenTarget = (link: ShortLink) => {
    window.open(`/s/${link.id}`, '_blank', 'noopener,noreferrer')
  }

  const openRenameModal = (link: ShortLink) => {
    setRenamingLink(link)
    setRenameDraft(link.name)
  }

  const handleRenameConfirm = async () => {
    if (!renamingLink) return
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === renamingLink.name) {
      setRenamingLink(null)
      return
    }
    const ok = await renameLink(renamingLink.id, trimmed)
    if (ok) setRenamingLink(null)
  }

  const handleDeleteClick = (id: string) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void deleteLinks([id])
      return
    }
    setConfirmingDeleteId(id)
    window.setTimeout(() => {
      setConfirmingDeleteId((prev) => (prev === id ? null : prev))
    }, 3000)
  }

  const handleBatchDeleteConfirm = async () => {
    await deleteLinks(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTargetUrl.trim()) return
    const created = await createLink(newTargetUrl.trim())
    if (created) {
      setNewTargetUrl('')
      setShowCreateForm(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="min-w-[200px] flex-1">
            <SearchField
              size="small"
              shape="rounded"
              value={search}
              onChange={setSearch}
              placeholder="搜索短链名称、目标链接或 ID"
              clearLabel="清除搜索"
            />
          </div>

          <Select
            aria-label="排序方式"
            size="sm"
            selectedKey={sortKey}
            onSelectionChange={(key) => {
              if (key) setSortKey(String(key) as SortKey)
            }}
            className="w-36"
          >
            <SelectItem id="createdAt">按创建时间</SelectItem>
            <SelectItem id="hits">按命中次数</SelectItem>
            <SelectItem id="lastAccess">按最近访问</SelectItem>
          </Select>

          <Button
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? '收起表单' : '创建短链'}
          </Button>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleCreate}
            className="flex flex-wrap items-end gap-3 border-t border-separator-border bg-background-secondary-default px-4 py-3.5"
          >
            <Input
              label="目标地址"
              size="small"
              type="url"
              inputDir="ltr"
              value={newTargetUrl}
              onChange={setNewTargetUrl}
              placeholder="https://example.com/target"
              className="min-w-[240px] flex-1"
            />
            <Button type="submit" variant="primary" size="small" disabled={!newTargetUrl.trim()}>
              立即创建
            </Button>
          </form>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator-border bg-status-blue-background/50 px-4 py-2.5">
            <span className="text-body-2-medium text-text-primary">
              已选中 {selectedIds.size} 条短链接
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="xs"
                leadingIcon={RiDeleteBinLine}
                onClick={() => setBatchDeleteOpen(true)}
              >
                批量删除
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setSelectedIds(new Set())}>
                取消选择
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="bui-table min-w-[760px]">
            <thead>
              <tr>
                <th className="w-10 ps-4">
                  <Checkbox
                    size="sm"
                    isSelected={allVisibleSelected}
                    isIndeterminate={someVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="全选"
                  />
                </th>
                <th>短链地址</th>
                <th>目标链接</th>
                <th className="text-end">命中</th>
                <th>创建时间</th>
                <th className="pe-4 text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-body-2-regular text-text-tertiary">
                    加载中…
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-body-2-regular text-text-tertiary">
                    {shortLinks.length === 0 ? '暂无短链接，转换后生成或手动创建' : '没有匹配的短链接'}
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => {
                  const isRowConfirmingDelete = confirmingDeleteId === link.id
                  return (
                    <tr key={link.id} className="hover:bg-background-secondary-default/65">
                      <td className="ps-4">
                        <Checkbox
                          size="sm"
                          isSelected={selectedIds.has(link.id)}
                          onChange={() => toggleSelect(link.id)}
                          aria-label={`选择 ${link.name}`}
                        />
                      </td>
                      <td className="max-w-52">
                        <p className="truncate text-body-2-medium text-text-primary" title={link.name}>
                          {link.name}
                        </p>
                        <p
                          dir="ltr"
                          className="truncate font-mono text-caption-1-regular text-status-blue-text"
                        >
                          {getShortLinkUrl(link.id)}
                        </p>
                      </td>
                      <td className="max-w-60">
                        <p
                          dir="ltr"
                          className="truncate font-mono text-caption-1-regular text-text-secondary"
                          title={link.targetUrl}
                        >
                          {link.targetUrl}
                        </p>
                      </td>
                      <td className="text-end font-mono text-body-2-regular tabular-nums text-text-primary">
                        {link.hits}
                      </td>
                      <td className="text-caption-1-regular whitespace-nowrap text-text-secondary">
                        {formatRelativeTime(link.createdAt)}
                      </td>
                      <td className="pe-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            leadingIcon={RiFileCopyLine}
                            onClick={() => void handleCopyShortLink(link)}
                          >
                            复制
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            leadingIcon={RiExternalLinkLine}
                            onClick={() => handleOpenTarget(link)}
                          >
                            打开
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            leadingIcon={RiQrCodeLine}
                            onClick={() => setQrLink(link)}
                          >
                            二维码
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            leadingIcon={RiEditLine}
                            onClick={() => openRenameModal(link)}
                          >
                            改名
                          </Button>
                          <Button
                            variant={isRowConfirmingDelete ? 'danger' : 'ghost'}
                            size="xs"
                            className={cx(
                              !isRowConfirmingDelete &&
                                'text-text-tertiary hover:text-text-error-primary',
                            )}
                            onClick={() => handleDeleteClick(link.id)}
                          >
                            {isRowConfirmingDelete ? '确认删除？' : '删除'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-caption-1-regular text-text-tertiary">
        共 {shortLinks.length} 条短链接 · 删除后原短链将立即失效
      </p>

      {qrLink ? (
        <QrCodeModal
          url={getShortLinkUrl(qrLink.id)}
          title={qrLink.name}
          onClose={() => setQrLink(null)}
        />
      ) : null}

      <RenameEntityModal
        isOpen={renamingLink !== null}
        title="修改短链接名称"
        description="仅用于后台备注与快速查找"
        label="短链接名称"
        placeholder="输入新的名称"
        value={renameDraft}
        onChange={setRenameDraft}
        onClose={() => setRenamingLink(null)}
        onConfirm={handleRenameConfirm}
      />

      <AlertDialog
        isOpen={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title={`删除选中的 ${selectedIds.size} 条短链接？`}
        description="删除后对应短链将立即失效且无法恢复。"
        confirmLabel="确认删除"
        pendingLabel="删除中…"
        cancelLabel="取消"
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  )
}
