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

interface RecordsPanelProps {
  onUnauthorized?: () => void
  focusSearchSignal?: number
}

type SortKey = 'lastAccess' | 'hits' | 'createdAt' | 'nodeCount'
type StatusFilter = 'all' | 'enabled' | 'disabled'

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'enabled', label: '正常' },
  { value: 'disabled', label: '已禁用' },
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
        jsonBody('POST', { targetUrl: record.originalUrl, name: record.name }),
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
          <div ref={searchContainerRef} className="w-full sm:min-w-[200px] sm:flex-1">
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

          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              variant="segmented"
              size="sm"
              tabs={STATUS_TABS}
              value={statusFilter}
              onValueChange={(next) => setStatusFilter(next as StatusFilter)}
            />

            <Select
              aria-label="排序方式"
              size="sm"
              selectedKey={sortKey}
              onSelectionChange={(key) => {
                if (key) setSortKey(String(key) as SortKey)
              }}
              className="w-32"
            >
              <SelectItem id="lastAccess">最近访问</SelectItem>
              <SelectItem id="hits">命中次数</SelectItem>
              <SelectItem id="createdAt">创建时间</SelectItem>
              <SelectItem id="nodeCount">节点数量</SelectItem>
            </Select>

            <div className="ms-auto flex items-center gap-1.5 sm:ms-0">
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
                onClick={() => setAddModalOpen(true)}
              >
                登记订阅
              </Button>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator-border bg-accent-500/8 px-4 py-2.5">
            <span className="text-body-2-medium tabular-nums text-text-primary">
              已选中 {selectedIds.size} 条记录
            </span>
            <div className="flex items-center gap-1.5">
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
                取消
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto bg-background-primary-default">
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
                        <Badge variant={record.deleted ? 'warning' : 'success'} appearance="dot">
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
                            <DropdownMenu.Content align="end">
                              <DropdownMenu.Item
                                icon={<RiPulseLine className="size-4" aria-hidden />}
                                disabled={isInspecting}
                                onClick={() => void handleInspectRecord(record)}
                              >
                                {isInspecting ? '检测中…' : '在线检测节点'}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                icon={<RiLinkM className="size-4" aria-hidden />}
                                disabled={isShortening}
                                onClick={() => void handleCreateShortLink(record)}
                              >
                                {isShortening ? '生成短链中…' : '生成短链'}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                icon={<RiQrCodeLine className="size-4" aria-hidden />}
                                onClick={() => setQrRecord(record)}
                              >
                                查看二维码
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                icon={<RiExternalLinkLine className="size-4" aria-hidden />}
                                onClick={() => handlePreview(record)}
                              >
                                预览配置
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                icon={<RiEditLine className="size-4" aria-hidden />}
                                onClick={() => openRenameModal(record)}
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
                                onClick={() => void setEnabled(record.id, Boolean(record.deleted))}
                              >
                                {record.deleted ? '启用订阅' : '禁用订阅'}
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                variant="danger"
                                icon={<RiDeleteBinLine className="size-4" aria-hidden />}
                                onClick={() => setDeletingRecord(record)}
                              >
                                删除记录
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          )}
        </div>
      </LayerCard>

      <p className="text-center text-caption-1-regular tabular-nums text-text-tertiary">
        共 {records.length} 条记录（点击任意行展开侧边详情抽屉 · 禁用后订阅将立即返回 400）
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
