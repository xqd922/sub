'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
} from '@remixicon/react'
import type { ConvertRecord } from '@/infra/kv/types'
import { Chip } from '@/components/base/badges/chip'
import { StatusDot } from '@/components/base/badges/status-dot'
import { Button } from '@/components/base/buttons/button'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { Input } from '@/components/base/input/input'
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { SearchField } from '@/components/base/search-field/search-field'
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control'
import { Select, SelectItem } from '@/components/base/select/select'
import { useAdminRecords, useAutoRefresh } from '@/components/use-admin-data'
import { useClipboard } from '@/components/use-clipboard'
import { showToast } from '@/components/use-toast'
import { cx } from '@/utils/cx'

interface AdminRecordsProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
  onCountChange?: (count: number) => void
  focusSearchSignal?: number
}

type SortKey = 'lastAccess' | 'hits' | 'createdAt' | 'nodeCount'
type StatusFilter = 'all' | 'enabled' | 'disabled'

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

export default function AdminRecords({
  autoRefresh,
  onUnauthorized,
  onCountChange,
  focusSearchSignal = 0,
}: AdminRecordsProps) {
  const {
    records,
    loading,
    refresh,
    renameRecord,
    setEnabled,
    removeRecords,
    batchSetEnabled,
    addRecord,
  } = useAdminRecords(onUnauthorized)
  const { copyToClipboard } = useClipboard()

  const searchContainerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('lastAccess')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [renamingRecord, setRenamingRecord] = useState<ConvertRecord | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  useAutoRefresh(refresh, autoRefresh)

  useEffect(() => {
    onCountChange?.(records.length)
  }, [records.length, onCountChange])

  useEffect(() => {
    if (focusSearchSignal > 0) {
      searchContainerRef.current?.querySelector('input')?.focus()
    }
  }, [focusSearchSignal])

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = records.filter((record) => {
      if (statusFilter === 'enabled' && record.deleted) return false
      if (statusFilter === 'disabled' && !record.deleted) return false
      if (!keyword) return true
      return (
        record.name.toLowerCase().includes(keyword) ||
        record.originalUrl.toLowerCase().includes(keyword) ||
        record.id.toLowerCase().includes(keyword) ||
        (record.clientType || '').toLowerCase().includes(keyword)
      )
    })

    return filtered.sort((a, b) => b[sortKey] - a[sortKey])
  }, [records, search, statusFilter, sortKey])

  const allVisibleSelected =
    filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id))
  const someVisibleSelected =
    !allVisibleSelected && filteredRecords.some((r) => selectedIds.has(r.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const record of filteredRecords) next.delete(record.id)
        return next
      }
      return new Set([...prev, ...filteredRecords.map((r) => r.id)])
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
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
    window.open(`/sub?url=${encodeURIComponent(record.originalUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const openRenameModal = (record: ConvertRecord) => {
    setRenamingRecord(record)
    setRenameDraft(record.name)
  }

  const handleRenameConfirm = async () => {
    if (!renamingRecord) return
    const trimmed = renameDraft.trim()
    if (!trimmed || trimmed === renamingRecord.name) {
      setRenamingRecord(null)
      return
    }
    const ok = await renameRecord(renamingRecord.id, trimmed)
    if (ok) {
      setRenamingRecord(null)
    }
  }

  const handleDeleteClick = (id: string) => {
    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void removeRecords([id])
      return
    }
    setConfirmingDeleteId(id)
    window.setTimeout(() => {
      setConfirmingDeleteId((prev) => (prev === id ? null : prev))
    }, 3000)
  }

  const handleBatchDeleteConfirm = async () => {
    const ids = Array.from(selectedIds)
    await removeRecords(ids)
    setSelectedIds(new Set())
  }

  const handleExportCsv = () => {
    const header = ['ID', '名称', '订阅链接', '状态', '客户端', '节点数', '命中次数', '创建时间', '最后访问', '最后IP']
    const rows = filteredRecords.map((record) => [
      record.id,
      record.name,
      record.originalUrl,
      record.deleted ? '已禁用' : '正常',
      record.clientType,
      String(record.nodeCount),
      String(record.hits),
      formatDateTime(record.createdAt),
      formatDateTime(record.lastAccess),
      record.lastIp,
    ])
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `convert-records-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(downloadUrl)
  }

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newUrl.trim()) return
    const success = await addRecord(newUrl.trim(), newName.trim() || undefined)
    if (success) {
      setNewUrl('')
      setNewName('')
      setShowAddForm(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div ref={searchContainerRef} className="min-w-[200px] flex-1">
            <SearchField
              size="small"
              shape="rounded"
              value={search}
              onChange={setSearch}
              placeholder="搜索订阅名称、链接、客户端或 ID"
              clearLabel="清除搜索"
            />
          </div>

          <SegmentedControl
            aria-label="按状态筛选"
            selectedKeys={[statusFilter]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as StatusFilter | undefined
              if (next) setStatusFilter(next)
            }}
          >
            <SegmentedControlItem id="all">全部</SegmentedControlItem>
            <SegmentedControlItem id="enabled">正常</SegmentedControlItem>
            <SegmentedControlItem id="disabled">已禁用</SegmentedControlItem>
          </SegmentedControl>

          <Select
            aria-label="排序方式"
            size="sm"
            selectedKey={sortKey}
            onSelectionChange={(key) => {
              if (key) setSortKey(String(key) as SortKey)
            }}
            className="w-36"
          >
            <SelectItem id="lastAccess">按最近访问</SelectItem>
            <SelectItem id="hits">按命中次数</SelectItem>
            <SelectItem id="createdAt">按创建时间</SelectItem>
            <SelectItem id="nodeCount">按节点数量</SelectItem>
          </Select>

          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiDownloadLine}
            disabled={filteredRecords.length === 0}
            onClick={handleExportCsv}
          >
            导出 CSV
          </Button>

          <Button
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            {showAddForm ? '收起表单' : '登记订阅'}
          </Button>
        </div>

        {/* Inline Add Form */}
        {showAddForm ? (
          <form
            onSubmit={handleAdd}
            className="flex flex-wrap items-end gap-3 border-t border-separator-border bg-background-secondary-default px-4 py-3.5"
          >
            <Input
              label="订阅链接"
              size="small"
              type="url"
              inputDir="ltr"
              value={newUrl}
              onChange={setNewUrl}
              placeholder="https://example.com/subscription"
              className="min-w-[240px] flex-1"
            />
            <Input
              label="备注名（可选）"
              size="small"
              type="text"
              value={newName}
              onChange={setNewName}
              placeholder="例如：主用机场"
              className="w-44"
            />
            <Button type="submit" variant="primary" size="small" disabled={!newUrl.trim()}>
              添加记录
            </Button>
          </form>
        ) : null}

        {/* Batch Action Bar */}
        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator-border bg-status-blue-background/50 px-4 py-2.5">
            <span className="text-body-2-medium text-text-primary">已选中 {selectedIds.size} 条记录</span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => void batchSetEnabled(Array.from(selectedIds), true)}
              >
                批量启用
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => void batchSetEnabled(Array.from(selectedIds), false)}
              >
                批量禁用
              </Button>
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

        {/* BoardUI Table */}
        <div className="overflow-x-auto">
          <table className="bui-table min-w-[820px]">
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
                <th>订阅</th>
                <th>状态</th>
                <th>客户端</th>
                <th className="text-end">节点</th>
                <th className="text-end">命中</th>
                <th>最近访问</th>
                <th className="pe-4 text-end">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-body-2-regular text-text-tertiary">
                    加载中…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-body-2-regular text-text-tertiary">
                    {records.length === 0 ? '暂无记录，转换一次订阅后这里会出现数据' : '没有匹配的记录'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isRowConfirmingDelete = confirmingDeleteId === record.id
                  return (
                    <Fragment key={record.id}>
                      <tr className="hover:bg-background-secondary-default/65">
                        <td className="ps-4">
                          <Checkbox
                            size="sm"
                            isSelected={selectedIds.has(record.id)}
                            onChange={() => toggleSelect(record.id)}
                            aria-label={`选择 ${record.name}`}
                          />
                        </td>
                        <td className="max-w-60">
                          <p className="truncate text-body-2-medium text-text-primary" title={record.name}>
                            {record.name}
                          </p>
                          <p
                            dir="ltr"
                            className="truncate font-mono text-caption-1-regular text-text-tertiary"
                            title={record.originalUrl}
                          >
                            {record.originalUrl}
                          </p>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot color={record.deleted ? 'yellow' : 'green'} />
                            <Chip variant="caption" color={record.deleted ? 'orange' : 'lime'}>
                              {record.deleted ? '已禁用' : '正常'}
                            </Chip>
                          </span>
                        </td>
                        <td className="font-mono text-caption-1-regular text-text-secondary">
                          {record.clientType || '—'}
                        </td>
                        <td className="text-end font-mono text-body-2-regular tabular-nums text-text-primary">
                          {record.nodeCount}
                        </td>
                        <td className="text-end font-mono text-body-2-regular tabular-nums text-text-primary">
                          {record.hits}
                        </td>
                        <td
                          className="text-caption-1-regular whitespace-nowrap text-text-secondary"
                          title={formatDateTime(record.lastAccess)}
                        >
                          {formatRelativeTime(record.lastAccess)}
                        </td>
                        <td className="pe-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiFileCopyLine}
                              onClick={() => void handleCopyConversionLink(record)}
                            >
                              复制
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiExternalLinkLine}
                              onClick={() => handlePreview(record)}
                            >
                              预览
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => void setEnabled(record.id, Boolean(record.deleted))}
                            >
                              {record.deleted ? '启用' : '禁用'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiEditLine}
                              onClick={() => openRenameModal(record)}
                            >
                              改名
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setExpandedId((prev) => (prev === record.id ? null : record.id))
                              }
                            >
                              {expandedId === record.id ? '收起' : '详情'}
                            </Button>
                            <Button
                              variant={isRowConfirmingDelete ? 'danger' : 'ghost'}
                              size="xs"
                              className={cx(!isRowConfirmingDelete && 'text-text-tertiary hover:text-text-error-primary')}
                              onClick={() => handleDeleteClick(record.id)}
                            >
                              {isRowConfirmingDelete ? '确认删除？' : '删除'}
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === record.id ? (
                        <tr className="bg-background-secondary-default/70">
                          <td colSpan={8} className="px-5 py-3.5">
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-caption-1-regular sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <dt className="inline text-text-tertiary">订阅链接：</dt>
                                <dd dir="ltr" className="inline font-mono break-all text-text-primary">
                                  {record.originalUrl}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-text-tertiary">ID：</dt>
                                <dd dir="ltr" className="inline font-mono text-text-primary">
                                  {record.id}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-text-tertiary">最后 IP：</dt>
                                <dd dir="ltr" className="inline font-mono text-text-primary">
                                  {record.lastIp || '—'}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-text-tertiary">创建时间：</dt>
                                <dd className="inline tabular-nums text-text-secondary">
                                  {formatDateTime(record.createdAt)}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-text-tertiary">更新时间：</dt>
                                <dd className="inline tabular-nums text-text-secondary">
                                  {formatDateTime(record.updatedAt)}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline text-text-tertiary">最后访问：</dt>
                                <dd className="inline tabular-nums text-text-secondary">
                                  {formatDateTime(record.lastAccess)}
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-caption-1-regular text-text-tertiary">
        共 {records.length} 条记录（含已禁用） · 禁用后该订阅链接将立即返回 400
      </p>

      {/* Rename Modal */}
      <Modal
        isOpen={renamingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingRecord(null)
        }}
        size="sm"
      >
        <ModalHeader title="修改订阅名称" description="仅用于后台列表展示与检索" closeLabel="关闭" />
        <ModalBody>
          <Input
            label="订阅名称"
            value={renameDraft}
            onChange={setRenameDraft}
            placeholder="输入新的备注名"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleRenameConfirm()
              }
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRenamingRecord(null)}>
            取消
          </Button>
          <Button variant="primary" disabled={!renameDraft.trim()} onClick={() => void handleRenameConfirm()}>
            保存修改
          </Button>
        </ModalFooter>
      </Modal>

      {/* Batch Delete AlertDialog */}
      <AlertDialog
        isOpen={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title={`删除选中的 ${selectedIds.size} 条记录？`}
        description="永久删除后不可恢复，原订阅仍可通过再次转换重新登记。"
        confirmLabel="永久删除"
        pendingLabel="删除中…"
        cancelLabel="取消"
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  )
}
