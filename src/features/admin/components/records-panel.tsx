'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinkM,
  RiPulseLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { StatusDot } from '@/components/base/badges/status-dot'
import { Button } from '@/components/base/buttons/button'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { Input } from '@/components/base/input/input'
import { AlertDialog } from '@/components/base/modal/modal'
import { SearchField } from '@/components/base/search-field/search-field'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control'
import { Select, SelectItem } from '@/components/base/select/select'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { RecordDetailRow } from '@/features/admin/components/record-detail-row'
import { RenameEntityModal } from '@/features/admin/components/rename-entity-modal'
import { useAdminRecords } from '@/features/admin/hooks/use-admin-records'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useAutoRefresh } from '@/features/shared/hooks/use-auto-refresh'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { ConvertRecord, InspectSubscriptionResult, ShortLink } from '@/shared/admin.types'
import { escapeCsvCell, formatDateTime, formatRelativeTime } from '@/shared/format.utils'
import { buildConversionUrl } from '@/shared/url.utils'
import { cx } from '@/utils/cx'

interface RecordsPanelProps {
  autoRefresh: boolean
  refreshSignal?: number
  onUnauthorized?: () => void
  onCountChange?: (count: number) => void
  focusSearchSignal?: number
}

type SortKey = 'lastAccess' | 'hits' | 'createdAt' | 'nodeCount'
type StatusFilter = 'all' | 'enabled' | 'disabled'

function exportRecordsCsv(records: ConvertRecord[]): void {
  const header = [
    'ID',
    '名称',
    '订阅链接',
    '状态',
    '客户端',
    '节点数',
    '命中次数',
    '创建时间',
    '最后访问',
    '最后IP',
  ]
  const rows = records.map((record) => [
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

  const csv =
    '\uFEFF' + [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = `convert-records-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(downloadUrl)
}

export function RecordsPanel({
  autoRefresh,
  refreshSignal = 0,
  onUnauthorized,
  onCountChange,
  focusSearchSignal = 0,
}: RecordsPanelProps) {
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
  const deleteTimerRef = useRef<number | null>(null)
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
  const [qrRecord, setQrRecord] = useState<ConvertRecord | null>(null)
  const [shorteningId, setShorteningId] = useState<string | null>(null)
  const [inspectingId, setInspectingId] = useState<string | null>(null)
  const [inspectionsById, setInspectionsById] = useState<
    Record<string, InspectSubscriptionResult>
  >({})
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  useAutoRefresh(refresh, autoRefresh)

  useEffect(() => {
    if (refreshSignal > 0) {
      void refresh()
    }
  }, [refreshSignal, refresh])

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current !== null) {
        window.clearTimeout(deleteTimerRef.current)
      }
    }
  }, [])

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
    filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id))
  const someVisibleSelected =
    !allVisibleSelected && filteredRecords.some((record) => selectedIds.has(record.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const record of filteredRecords) next.delete(record.id)
        return next
      }
      return new Set([...prev, ...filteredRecords.map((record) => record.id)])
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

  const handleCopyConversionLink = async (record: ConvertRecord) => {
    const conversionUrl = buildConversionUrl(window.location.origin, record.originalUrl)
    const copied = await copyToClipboard(conversionUrl)
    showToast(copied ? '转换链接已复制' : '复制失败', copied ? 'success' : 'error')
  }

  const handlePreview = (record: ConvertRecord) => {
    window.open(
      buildConversionUrl(window.location.origin, record.originalUrl, 'browser'),
      '_blank',
      'noopener,noreferrer',
    )
  }

  const handleCreateShortLink = async (record: ConvertRecord) => {
    setShorteningId(record.id)
    try {
      const data = await adminFetch<{ shortLink: ShortLink }>(
        '/api/admin/short-links',
        jsonBody('POST', { targetUrl: record.originalUrl, name: record.name }),
      )
      const shortUrl = `${window.location.origin}/s/${data.shortLink.id}`
      const copied = await copyToClipboard(shortUrl)
      showToast(copied ? '短链已生成并复制' : `短链已生成：${shortUrl}`, 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setShorteningId(null)
    }
  }

  const handleInspectRecord = async (record: ConvertRecord) => {
    setInspectingId(record.id)
    setExpandedId(record.id)
    try {
      const data = await adminFetch<{ inspection: InspectSubscriptionResult }>(
        '/api/admin/inspect',
        jsonBody('POST', { url: record.originalUrl }),
      )
      setInspectionsById((prev) => ({ ...prev, [record.id]: data.inspection }))
      showToast(`检测完成，共解析 ${data.inspection.nodeCount} 个节点`, 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setInspectingId(null)
    }
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
    if (ok) setRenamingRecord(null)
  }

  const handleDeleteClick = (id: string) => {
    if (deleteTimerRef.current !== null) {
      window.clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = null
    }

    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void removeRecords([id])
      return
    }

    setConfirmingDeleteId(id)
    deleteTimerRef.current = window.setTimeout(() => {
      setConfirmingDeleteId((prev) => (prev === id ? null : prev))
      deleteTimerRef.current = null
    }, 3000)
  }

  const handleBatchDeleteConfirm = async () => {
    await removeRecords(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newUrl.trim()) return
    const ok = await addRecord(newUrl.trim(), newName.trim() || undefined)
    if (ok) {
      setNewUrl('')
      setNewName('')
      setShowAddForm(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-separator-border bg-background-primary-default">
        <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:p-4">
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
            onClick={() => exportRecordsCsv(filteredRecords)}
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

        {showAddForm ? (
          <form
            onSubmit={handleAdd}
            className="flex flex-wrap items-end gap-3 border-t border-separator-border bg-background-secondary-default/60 px-4 py-3.5"
          >
            <Input
              label="订阅链接 / 节点 URI"
              size="small"
              type="text"
              inputDir="ltr"
              value={newUrl}
              onChange={setNewUrl}
              placeholder="https://example.com/subscription 或 ss:// / vless://..."
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

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator-border bg-background-secondary-default/80 px-4 py-2.5">
            <span className="text-body-2-medium text-text-primary">
              已选中 {selectedIds.size} 条记录
            </span>
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

        <div className="overflow-x-auto">
          <table className="bui-table min-w-[920px]">
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
                    {records.length === 0
                      ? '暂无记录，转换一次订阅后这里会出现数据'
                      : '没有匹配的记录'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isRowConfirmingDelete = confirmingDeleteId === record.id
                  const isShortening = shorteningId === record.id
                  const isInspecting = inspectingId === record.id
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
                        <td className="max-w-56">
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
                              leadingIcon={RiLinkM}
                              disabled={isShortening}
                              onClick={() => void handleCreateShortLink(record)}
                            >
                              {isShortening ? '生成中…' : '短链'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiQrCodeLine}
                              onClick={() => setQrRecord(record)}
                            >
                              二维码
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiPulseLine}
                              disabled={isInspecting}
                              onClick={() => void handleInspectRecord(record)}
                            >
                              {isInspecting ? '检测中…' : '检测'}
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
                              className={cx(
                                !isRowConfirmingDelete &&
                                  'text-text-tertiary hover:text-text-error-primary',
                              )}
                              onClick={() => handleDeleteClick(record.id)}
                            >
                              {isRowConfirmingDelete ? '确认删除？' : '删除'}
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === record.id ? (
                        <RecordDetailRow
                          record={record}
                          inspection={inspectionsById[record.id]}
                          inspecting={isInspecting}
                        />
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

      {qrRecord ? (
        <QrCodeModal
          url={buildConversionUrl(window.location.origin, qrRecord.originalUrl)}
          title={qrRecord.name}
          onClose={() => setQrRecord(null)}
        />
      ) : null}

      <RenameEntityModal
        isOpen={renamingRecord !== null}
        title="修改订阅名称"
        description="仅用于后台列表展示与检索"
        label="订阅名称"
        placeholder="输入新的备注名"
        value={renameDraft}
        onChange={setRenameDraft}
        onClose={() => setRenamingRecord(null)}
        onConfirm={handleRenameConfirm}
      />

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
