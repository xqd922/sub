'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown'
import { Empty } from '@cloudflare/kumo/components/empty'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Table } from '@cloudflare/kumo/components/table'
import { Tabs } from '@cloudflare/kumo/components/tabs'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import {
  RiAddLine,
  RiCheckboxMultipleLine,
  RiDatabase2Line,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFileList3Line,
  RiInformationLine,
  RiLinkM,
  RiMore2Fill,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiPulseLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { Input } from '@/components/base/input/input'
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { SearchField } from '@/components/base/search-field/search-field'
import { Select, SelectItem } from '@/components/base/select/select'
import { updateCachedShortLinks } from '@/features/admin/admin.cache'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { RecordDetailDrawer } from '@/features/admin/components/record-detail-drawer'
import { RenameEntityModal } from '@/features/admin/components/rename-entity-modal'
import { useAdminRecords } from '@/features/admin/hooks/use-admin-records'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { ConvertRecord, InspectSubscriptionResult, ShortLink } from '@/shared/admin.types'
import { escapeCsvCell, formatDateTime, formatRelativeTime } from '@/shared/format.utils'
import { buildConversionUrl } from '@/shared/url.utils'
import { cx } from '@/utils/cx'

interface RecordsPanelProps {
  onUnauthorized?: () => void
  focusSearchSignal?: number
}

type SortKey = 'lastAccess' | 'hits' | 'createdAt' | 'nodeCount'
type StatusFilter = 'all' | 'enabled' | 'disabled'

const STATUS_TABS: Array<{ value: StatusFilter; label: string; className: string }> = [
  { value: 'all', label: '全部', className: 'flex-1 justify-center sm:flex-none' },
  { value: 'enabled', label: '正常', className: 'flex-1 justify-center sm:flex-none' },
  { value: 'disabled', label: '已禁用', className: 'flex-1 justify-center sm:flex-none' },
]

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

interface RecordActionsMenuProps {
  record: ConvertRecord
  isInspecting: boolean
  isShortening: boolean
  onCopy: (record: ConvertRecord) => void
  onInspect: (record: ConvertRecord) => void
  onCreateShortLink: (record: ConvertRecord) => void
  onOpenQr: (record: ConvertRecord) => void
  onPreview: (record: ConvertRecord) => void
  onRename: (record: ConvertRecord) => void
  onToggleEnabled: (record: ConvertRecord) => void
  onDelete: (record: ConvertRecord) => void
}

function RecordActionsMenu({
  record,
  isInspecting,
  isShortening,
  onCopy,
  onInspect,
  onCreateShortLink,
  onOpenQr,
  onPreview,
  onRename,
  onToggleEnabled,
  onDelete,
}: RecordActionsMenuProps) {
  return (
    <DropdownMenu.Content align="end">
      <DropdownMenu.Item
        icon={<RiFileCopyLine className="size-4" aria-hidden />}
        onClick={() => onCopy(record)}
      >
        复制转换链接
      </DropdownMenu.Item>
      <DropdownMenu.Item
        icon={<RiPulseLine className="size-4" aria-hidden />}
        disabled={isInspecting}
        onClick={() => onInspect(record)}
      >
        {isInspecting ? '检测中…' : '在线检测节点'}
      </DropdownMenu.Item>
      <DropdownMenu.Item
        icon={<RiLinkM className="size-4" aria-hidden />}
        disabled={isShortening}
        onClick={() => onCreateShortLink(record)}
      >
        {isShortening ? '生成短链中…' : '生成短链'}
      </DropdownMenu.Item>
      <DropdownMenu.Item
        icon={<RiQrCodeLine className="size-4" aria-hidden />}
        onClick={() => onOpenQr(record)}
      >
        查看二维码
      </DropdownMenu.Item>
      <DropdownMenu.Item
        icon={<RiExternalLinkLine className="size-4" aria-hidden />}
        onClick={() => onPreview(record)}
      >
        预览配置
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        icon={<RiEditLine className="size-4" aria-hidden />}
        onClick={() => onRename(record)}
      >
        重命名
      </DropdownMenu.Item>
      <DropdownMenu.Item
        icon={
          record.deleted ? (
            <RiPlayCircleLine className="size-4" aria-hidden />
          ) : (
            <RiPauseCircleLine className="size-4" aria-hidden />
          )
        }
        onClick={() => onToggleEnabled(record)}
      >
        {record.deleted ? '启用订阅' : '禁用订阅'}
      </DropdownMenu.Item>
      <DropdownMenu.Separator />
      <DropdownMenu.Item
        variant="danger"
        icon={<RiDeleteBinLine className="size-4" aria-hidden />}
        onClick={() => onDelete(record)}
      >
        删除记录
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  )
}

export function RecordsPanel({
  onUnauthorized,
  focusSearchSignal = 0,
}: RecordsPanelProps) {
  const {
    records,
    loading,
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
  const [drawerRecordId, setDrawerRecordId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mobileSelectMode, setMobileSelectMode] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [renamingRecord, setRenamingRecord] = useState<ConvertRecord | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [qrRecord, setQrRecord] = useState<ConvertRecord | null>(null)
  const [shorteningId, setShorteningId] = useState<string | null>(null)
  const [inspectingId, setInspectingId] = useState<string | null>(null)
  const [inspectionsById, setInspectionsById] = useState<
    Record<string, InspectSubscriptionResult>
  >({})
  const [deletingRecord, setDeletingRecord] = useState<ConvertRecord | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

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

  const drawerRecord = useMemo(
    () => (drawerRecordId ? records.find((item) => item.id === drawerRecordId) ?? null : null),
    [records, drawerRecordId],
  )

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
        jsonBody('POST', { targetUrl: record.originalUrl }),
      )
      updateCachedShortLinks((prev) => [
        data.shortLink,
        ...prev.filter((item) => item.id !== data.shortLink.id),
      ])
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
    setDrawerRecordId(record.id)
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

  const handleSingleDeleteConfirm = async () => {
    if (!deletingRecord) return
    const id = deletingRecord.id
    await removeRecords([id])
    if (drawerRecordId === id) setDrawerRecordId(null)
    setDeletingRecord(null)
  }

  const handleBatchDeleteConfirm = async () => {
    const ids = Array.from(selectedIds)
    await removeRecords(ids)
    if (drawerRecordId && selectedIds.has(drawerRecordId)) setDrawerRecordId(null)
    setSelectedIds(new Set())
    setMobileSelectMode(false)
  }

  const toggleMobileSelectMode = () => {
    setMobileSelectMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }

  const handleAddConfirm = async () => {
    if (!newUrl.trim() || adding) return
    setAdding(true)
    const ok = await addRecord(newUrl.trim(), newName.trim() || undefined)
    setAdding(false)
    if (ok) {
      setNewUrl('')
      setNewName('')
      setAddModalOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <LayerCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-2.5 border-b border-separator-border bg-background-secondary-default/45 p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
          <div className="flex w-full items-center gap-2 sm:min-w-[200px] sm:flex-1">
            <div ref={searchContainerRef} className="min-w-0 flex-1">
              <SearchField
                size="small"
                shape="rounded"
                fieldClassName="h-9 sm:h-8"
                value={search}
                onChange={setSearch}
                placeholder="搜索订阅名称、链接、客户端或 ID"
                clearLabel="清除搜索"
              />
            </div>
            <Button
              variant="primary"
              size="small"
              leadingIcon={RiAddLine}
              className="h-9 shrink-0 sm:hidden"
              onClick={() => setAddModalOpen(true)}
            >
              登记
            </Button>
          </div>

          <Tabs
            variant="segmented"
            size="sm"
            className="w-full sm:w-auto"
            listClassName="w-full sm:w-auto"
            tabs={STATUS_TABS}
            value={statusFilter}
            onValueChange={(next) => setStatusFilter(next as StatusFilter)}
          />

          <div className="flex items-center justify-between gap-2 sm:contents">
            <div className="flex items-center gap-2">
              <Select
                aria-label="排序方式"
                size="sm"
                selectedKey={sortKey}
                onSelectionChange={(key) => {
                  if (key) setSortKey(String(key) as SortKey)
                }}
                className="w-[108px] sm:w-32"
              >
                <SelectItem id="lastAccess">最近访问</SelectItem>
                <SelectItem id="hits">命中次数</SelectItem>
                <SelectItem id="createdAt">创建时间</SelectItem>
                <SelectItem id="nodeCount">节点数量</SelectItem>
              </Select>

              <span className="hidden text-caption-1-regular whitespace-nowrap tabular-nums text-text-tertiary min-[380px]:inline sm:hidden">
                {filteredRecords.length} 条
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:ms-auto">
              <Button
                variant={mobileSelectMode ? 'primary' : 'secondary'}
                size="small"
                leadingIcon={RiCheckboxMultipleLine}
                aria-label={mobileSelectMode ? '退出多选' : '批量多选'}
                className="lg:hidden"
                disabled={!mobileSelectMode && filteredRecords.length === 0}
                onClick={toggleMobileSelectMode}
              >
                {mobileSelectMode ? '完成' : '多选'}
              </Button>

              <Tooltip
                content="导出当前列表为 CSV"
                side="bottom"
                render={
                  <Button
                    variant="secondary"
                    size="small"
                    iconOnly
                    leadingIcon={RiDownloadLine}
                    aria-label="导出 CSV"
                    disabled={filteredRecords.length === 0}
                    onClick={() => exportRecordsCsv(filteredRecords)}
                  />
                }
              />

              <Button
                variant="primary"
                size="small"
                leadingIcon={RiAddLine}
                className="hidden sm:inline-flex"
                onClick={() => setAddModalOpen(true)}
              >
                登记订阅
              </Button>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 || mobileSelectMode ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator-border bg-accent-500/8 px-3.5 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <span className="text-body-2-medium tabular-nums text-text-primary">
                {selectedIds.size > 0 ? `已选 ${selectedIds.size} 条` : '勾选订阅进行批量操作'}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="lg:hidden"
                disabled={filteredRecords.length === 0}
                onClick={toggleSelectAll}
              >
                {allVisibleSelected ? '取消全选' : '全选'}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                className="h-7 sm:h-6"
                disabled={selectedIds.size === 0}
                onClick={() => void batchSetEnabled(Array.from(selectedIds), true)}
              >
                启用
              </Button>
              <Button
                variant="secondary"
                size="xs"
                className="h-7 sm:h-6"
                disabled={selectedIds.size === 0}
                onClick={() => void batchSetEnabled(Array.from(selectedIds), false)}
              >
                禁用
              </Button>
              <Button
                variant="danger"
                size="xs"
                leadingIcon={RiDeleteBinLine}
                className="h-7 sm:h-6"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteOpen(true)}
              >
                删除
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="h-7 sm:h-6"
                onClick={() => {
                  setSelectedIds(new Set())
                  setMobileSelectMode(false)
                }}
              >
                取消
              </Button>
            </div>
          </div>
        ) : null}

        <div className="bg-background-primary-default">
          {loading ? (
            <div className="py-16 text-center text-body-2-regular text-text-tertiary">
              加载订阅记录中…
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="console-empty p-6">
              <Empty
                size="sm"
                icon={<RiFileList3Line className="size-8 text-text-tertiary" aria-hidden />}
                title={records.length === 0 ? '暂无订阅记录' : '没有匹配的订阅'}
                description={
                  records.length === 0
                    ? '在首页转换一次订阅，或点击下方按钮手动登记上游订阅链接。'
                    : '尝试调整搜索关键字或切换状态筛选条件。'
                }
                contents={
                  records.length === 0 ? (
                    <Button
                      variant="primary"
                      size="small"
                      leadingIcon={RiAddLine}
                      onClick={() => setAddModalOpen(true)}
                    >
                      登记第一条订阅
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-separator-border lg:hidden">
                {filteredRecords.map((record) => {
                  const isSelected = selectedIds.has(record.id)
                  const isShortening = shorteningId === record.id
                  const isInspecting = inspectingId === record.id
                  const showCheckboxes = mobileSelectMode || selectedIds.size > 0
                  return (
                    <div
                      key={record.id}
                      className={cx(
                        'flex items-start gap-2.5 px-4 py-3.5 transition-colors',
                        isSelected && 'bg-accent-500/6',
                      )}
                    >
                      {showCheckboxes ? (
                        <Checkbox
                          size="sm"
                          isSelected={isSelected}
                          onChange={() => toggleSelect(record.id)}
                          aria-label={`选择 ${record.name}`}
                          className="mt-1 shrink-0"
                        />
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          showCheckboxes
                            ? toggleSelect(record.id)
                            : setDrawerRecordId(record.id)
                        }
                        className="min-w-0 flex-1 cursor-pointer rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="min-w-0 flex-1 truncate text-body-semibold text-text-primary"
                            title={record.name}
                          >
                            {record.name}
                          </span>
                          <Badge
                            variant={record.deleted ? 'warning' : 'success'}
                            appearance="dot"
                            className="shrink-0"
                          >
                            {record.deleted ? '已禁用' : '正常'}
                          </Badge>
                        </span>
                        <span
                          dir="ltr"
                          className="mt-1 block truncate font-mono text-caption-1-regular text-text-tertiary"
                          title={record.originalUrl}
                        >
                          {record.originalUrl}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-1-regular text-text-secondary">
                          {record.clientType ? (
                            <span className="rounded bg-background-secondary-default px-1.5 py-0.5 font-mono text-caption-2-medium text-text-secondary">
                              {record.clientType}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <RiDatabase2Line className="size-3 text-foreground-icon-tertiary" aria-hidden />
                            {record.nodeCount} 节点
                          </span>
                          <span className="tabular-nums">{record.hits} 命中</span>
                          <span className="ms-auto whitespace-nowrap text-text-tertiary">
                            {formatRelativeTime(record.lastAccess)}
                          </span>
                        </span>
                      </button>

                      {!showCheckboxes ? (
                        <div className="flex shrink-0 items-center gap-0.5 -me-1">
                          <Button
                            variant="ghost"
                            size="small"
                            iconOnly
                            leadingIcon={RiFileCopyLine}
                            aria-label={`复制转换链接：${record.name}`}
                            onClick={() => void handleCopyConversionLink(record)}
                          />
                          <DropdownMenu>
                            <DropdownMenu.Trigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="small"
                                  iconOnly
                                  leadingIcon={RiMore2Fill}
                                  aria-label={`更多操作：${record.name}`}
                                />
                              }
                            />
                            <RecordActionsMenu
                              record={record}
                              isInspecting={isInspecting}
                              isShortening={isShortening}
                              onCopy={(item) => void handleCopyConversionLink(item)}
                              onInspect={(item) => void handleInspectRecord(item)}
                              onCreateShortLink={(item) => void handleCreateShortLink(item)}
                              onOpenQr={setQrRecord}
                              onPreview={handlePreview}
                              onRename={openRenameModal}
                              onToggleEnabled={(item) =>
                                void setEnabled(item.id, Boolean(item.deleted))
                              }
                              onDelete={setDeletingRecord}
                            />
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="console-table min-w-[680px]">
                  <Table.Header variant="compact">
                    <Table.Row>
                      <Table.CheckHead
                        checked={allVisibleSelected}
                        indeterminate={someVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="全选"
                      />
                      <Table.Head>订阅</Table.Head>
                      <Table.Head>状态</Table.Head>
                      <Table.Head>客户端</Table.Head>
                      <Table.Head className="text-end">节点 / 命中</Table.Head>
                      <Table.Head>最近访问</Table.Head>
                      <Table.Head className="text-end">操作</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredRecords.map((record) => {
                      const isSelected = selectedIds.has(record.id)
                      const isShortening = shorteningId === record.id
                      const isInspecting = inspectingId === record.id
                      return (
                        <Table.Row
                          key={record.id}
                          variant={isSelected ? 'selected' : 'default'}
                          onClick={() => setDrawerRecordId(record.id)}
                          className="cursor-pointer transition-colors hover:bg-background-secondary-default/65"
                        >
                          <Table.CheckCell
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(record.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`选择 ${record.name}`}
                          />

                          <Table.Cell className="max-w-72">
                            <p
                              className="truncate text-body-2-medium text-text-primary"
                              title={record.name}
                            >
                              {record.name}
                            </p>
                            <p
                              dir="ltr"
                              className="mt-0.5 truncate font-mono text-caption-1-regular text-text-tertiary"
                              title={record.originalUrl}
                            >
                              {record.originalUrl}
                            </p>
                          </Table.Cell>

                          <Table.Cell>
                            <Badge
                              variant={record.deleted ? 'warning' : 'success'}
                              appearance="dot"
                            >
                              {record.deleted ? '已禁用' : '正常'}
                            </Badge>
                          </Table.Cell>

                          <Table.Cell>
                            <span className="font-mono text-caption-1-regular text-text-secondary">
                              {record.clientType || '—'}
                            </span>
                          </Table.Cell>

                          <Table.Cell className="text-end text-body-2-regular tabular-nums">
                            <span className="text-text-primary">{record.nodeCount}</span>
                            <span className="mx-1 text-text-tertiary">/</span>
                            <span className="text-text-secondary">{record.hits}</span>
                          </Table.Cell>

                          <Table.Cell
                            className="text-body-2-regular whitespace-nowrap text-text-secondary"
                            title={formatDateTime(record.lastAccess)}
                          >
                            {formatRelativeTime(record.lastAccess)}
                          </Table.Cell>

                          <Table.Cell onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip
                                content="复制转换链接"
                                render={
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    iconOnly
                                    leadingIcon={RiFileCopyLine}
                                    aria-label="复制转换链接"
                                    onClick={() => void handleCopyConversionLink(record)}
                                  />
                                }
                              />

                              <Tooltip
                                content="查看详情抽屉"
                                render={
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    iconOnly
                                    leadingIcon={RiInformationLine}
                                    aria-label="查看详情"
                                    onClick={() => setDrawerRecordId(record.id)}
                                  />
                                }
                              />

                              <DropdownMenu>
                                <DropdownMenu.Trigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      iconOnly
                                      leadingIcon={RiMore2Fill}
                                      aria-label="更多操作"
                                    />
                                  }
                                />
                                <RecordActionsMenu
                                  record={record}
                                  isInspecting={isInspecting}
                                  isShortening={isShortening}
                                  onCopy={(item) => void handleCopyConversionLink(item)}
                                  onInspect={(item) => void handleInspectRecord(item)}
                                  onCreateShortLink={(item) => void handleCreateShortLink(item)}
                                  onOpenQr={setQrRecord}
                                  onPreview={handlePreview}
                                  onRename={openRenameModal}
                                  onToggleEnabled={(item) =>
                                    void setEnabled(item.id, Boolean(item.deleted))
                                  }
                                  onDelete={setDeletingRecord}
                                />
                              </DropdownMenu>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table>
              </div>
            </>
          )}
        </div>
      </LayerCard>

      <p className="text-center text-caption-1-regular tabular-nums text-text-tertiary">
        <span className="sm:hidden">共 {records.length} 条 · 点击查看详情 · 禁用后立即返回 400</span>
        <span className="hidden sm:inline">
          共 {records.length} 条记录（点击任意行展开侧边详情抽屉 · 禁用后订阅将立即返回 400）
        </span>
      </p>

      <RecordDetailDrawer
        record={drawerRecord}
        inspection={drawerRecord ? inspectionsById[drawerRecord.id] : null}
        inspecting={drawerRecord ? inspectingId === drawerRecord.id : false}
        shortening={drawerRecord ? shorteningId === drawerRecord.id : false}
        onClose={() => setDrawerRecordId(null)}
        onInspect={(record) => void handleInspectRecord(record)}
        onCreateShortLink={(record) => void handleCreateShortLink(record)}
        onOpenQr={(record) => setQrRecord(record)}
        onPreview={handlePreview}
        onRename={openRenameModal}
        onToggleEnabled={(record) => void setEnabled(record.id, Boolean(record.deleted))}
      />

      <Modal
        isOpen={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open)
          if (!open) {
            setNewUrl('')
            setNewName('')
          }
        }}
        size="md"
      >
        <ModalHeader
          title="登记订阅"
          description="将上游订阅链接或节点 URI 登记到控制台，支持在线检测与启停控制"
          closeLabel="关闭"
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
            <Input
              label="订阅链接 / 节点 URI"
              type="text"
              inputDir="ltr"
              value={newUrl}
              onChange={setNewUrl}
              placeholder="https://example.com/subscription 或 ss:// / vless://..."
              autoFocus
            />
            <Input
              label="备注名称（可选）"
              type="text"
              value={newName}
              onChange={setNewName}
              placeholder="例如：主用机场"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAddConfirm()
                }
              }}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!newUrl.trim() || adding}
            onClick={() => void handleAddConfirm()}
          >
            {adding ? '登记中…' : '确认登记'}
          </Button>
        </ModalFooter>
      </Modal>

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
        isOpen={deletingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRecord(null)
        }}
        title={`删除订阅「${deletingRecord?.name || ''}」？`}
        description="永久删除后不可恢复，原订阅仍可通过再次转换重新登记。"
        confirmLabel="永久删除"
        pendingLabel="删除中…"
        cancelLabel="取消"
        onConfirm={handleSingleDeleteConfirm}
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
