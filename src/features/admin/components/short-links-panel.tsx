'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { DropdownMenu } from '@cloudflare/kumo/components/dropdown'
import { Empty } from '@cloudflare/kumo/components/empty'
import { InlineCopyText } from '@cloudflare/kumo/components/inline-copy-text'
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
  RiInformationLine,
  RiLinkM,
  RiLockLine,
  RiMore2Fill,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiQrCodeLine,
  RiUploadLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { AlertDialog, Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { SearchField } from '@/components/base/search-field/search-field'
import { Select, SelectItem } from '@/components/base/select/select'
import { ShortLinkDetailDrawer } from '@/features/admin/components/short-link-detail-drawer'
import { ShortLinkEditModal } from '@/features/admin/components/short-link-edit-modal'
import { useAdminShortLinks } from '@/features/admin/hooks/use-admin-short-links'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { useFocusRefresh } from '@/features/shared/hooks/use-focus-refresh'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { CreateShortLinkInput, ShortLink, TargetClientOverride } from '@/shared/admin.types'
import { formatDateTime, formatRelativeTime } from '@/shared/format.utils'
import { buildShortLinkPublicUrl } from '@/shared/url.utils'

interface ShortLinksPanelProps {
  onUnauthorized?: () => void
  onCountChange?: (count: number) => void
}

type SortKey = 'createdAt' | 'hits' | 'lastAccess'
type StatusFilter = 'all' | 'active' | 'disabled' | 'inactive'
type CreateExpiryPreset = 'never' | '1d' | '7d' | '30d' | '90d'
type LinkHealthState = 'active' | 'disabled' | 'expired' | 'limit_reached'

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已禁用' },
  { value: 'inactive', label: '已失效' },
]

const CREATE_EXPIRY_MS: Record<Exclude<CreateExpiryPreset, 'never'>, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
}

function getLinkState(link: ShortLink, now: number): LinkHealthState {
  if (link.disabled) return 'disabled'
  if (link.expiresAt && now >= link.expiresAt) return 'expired'
  if (link.maxHits && link.maxHits > 0 && link.hits >= link.maxHits) return 'limit_reached'
  return 'active'
}

function getShortLinkUrl(link: ShortLink): string {
  if (typeof window === 'undefined') return `/s/${link.id}`
  return buildShortLinkPublicUrl(window.location.origin, link.id, link.password)
}

function exportShortLinksJson(links: ShortLink[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    links: links.map((link) => ({
      slug: link.id,
      name: link.name,
      targetUrl: link.targetUrl,
      ...(link.comment ? { comment: link.comment } : {}),
      ...(link.disabled ? { disabled: true } : {}),
      ...(link.expiresAt ? { expiresAt: link.expiresAt } : {}),
      ...(link.maxHits ? { maxHits: link.maxHits } : {}),
      ...(link.password ? { password: link.password } : {}),
      ...(link.defaultTarget && link.defaultTarget !== 'auto'
        ? { defaultTarget: link.defaultTarget }
        : {}),
    })),
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `short-links-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const STATE_BADGE: Record<
  LinkHealthState,
  { label: string; variant: 'success' | 'warning' | 'error' }
> = {
  active: { label: '正常', variant: 'success' },
  disabled: { label: '已禁用', variant: 'warning' },
  expired: { label: '已过期', variant: 'error' },
  limit_reached: { label: '达上限', variant: 'error' },
}

export function ShortLinksPanel({ onUnauthorized, onCountChange }: ShortLinksPanelProps) {
  const {
    shortLinks,
    loading,
    refresh,
    updateLink,
    setEnabled,
    batchSetEnabled,
    deleteLinks,
    createLink,
    importLinks,
  } = useAdminShortLinks(onUnauthorized)
  const { copyToClipboard } = useClipboard()

  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [drawerLinkId, setDrawerLinkId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newTargetUrl, setNewTargetUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newExpiry, setNewExpiry] = useState<CreateExpiryPreset>('never')
  const [newMaxHits, setNewMaxHits] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDefaultTarget, setNewDefaultTarget] = useState<TargetClientOverride>('auto')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [qrLink, setQrLink] = useState<ShortLink | null>(null)
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null)
  const [deletingLink, setDeletingLink] = useState<ShortLink | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useFocusRefresh(refresh)

  useEffect(() => {
    onCountChange?.(shortLinks.length)
  }, [shortLinks.length, onCountChange])

  const filteredLinks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const filtered = shortLinks.filter((link) => {
      const state = getLinkState(link, now)
      if (statusFilter === 'active' && state !== 'active') return false
      if (statusFilter === 'disabled' && state !== 'disabled') return false
      if (statusFilter === 'inactive' && state !== 'expired' && state !== 'limit_reached') {
        return false
      }
      if (!keyword) return true
      return (
        link.name.toLowerCase().includes(keyword) ||
        link.targetUrl.toLowerCase().includes(keyword) ||
        link.id.toLowerCase().includes(keyword) ||
        (link.comment || '').toLowerCase().includes(keyword)
      )
    })

    return filtered.sort((a, b) => b[sortKey] - a[sortKey])
  }, [shortLinks, search, statusFilter, sortKey, now])

  const drawerLink = useMemo(
    () => (drawerLinkId ? shortLinks.find((item) => item.id === drawerLinkId) ?? null : null),
    [shortLinks, drawerLinkId],
  )

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
    const copied = await copyToClipboard(getShortLinkUrl(link))
    showToast(
      copied ? (link.password ? '已复制带密钥的短链接' : '短链接已复制') : '复制失败',
      copied ? 'success' : 'error',
    )
  }

  const handleOpenTarget = (link: ShortLink) => {
    const url = new URL(`/s/${encodeURIComponent(link.id)}`, window.location.origin)
    url.searchParams.set('target', 'browser')
    if (link.password) url.searchParams.set('key', link.password)
    window.open(url.toString(), '_blank', 'noopener,noreferrer')
  }

  const handleSingleDeleteConfirm = async () => {
    if (!deletingLink) return
    const id = deletingLink.id
    await deleteLinks([id])
    if (drawerLinkId === id) setDrawerLinkId(null)
    setDeletingLink(null)
  }

  const handleBatchDeleteConfirm = async () => {
    await deleteLinks(Array.from(selectedIds))
    if (drawerLinkId && selectedIds.has(drawerLinkId)) setDrawerLinkId(null)
    setSelectedIds(new Set())
  }

  const resetCreateForm = () => {
    setNewTargetUrl('')
    setNewName('')
    setNewSlug('')
    setNewComment('')
    setNewExpiry('never')
    setNewMaxHits('')
    setNewPassword('')
    setNewDefaultTarget('auto')
  }

  const handleCreateConfirm = async () => {
    if (!newTargetUrl.trim() || creating) return

    const parsedMaxHits = newMaxHits.trim() ? Number.parseInt(newMaxHits.trim(), 10) : undefined
    const expiresAt = newExpiry === 'never' ? undefined : Date.now() + CREATE_EXPIRY_MS[newExpiry]

    setCreating(true)
    const created = await createLink({
      targetUrl: newTargetUrl.trim(),
      name: newName.trim() || undefined,
      slug: newSlug.trim() || undefined,
      comment: newComment.trim() || undefined,
      expiresAt,
      maxHits: parsedMaxHits && parsedMaxHits >= 1 ? parsedMaxHits : undefined,
      password: newPassword.trim() || undefined,
      defaultTarget: newDefaultTarget !== 'auto' ? newDefaultTarget : undefined,
    })
    setCreating(false)

    if (created) {
      resetCreateForm()
      setCreateModalOpen(false)
    }
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { links?: unknown }).links)
          ? (parsed as { links: unknown[] }).links
          : null

      if (!list || list.length === 0) {
        showToast('JSON 格式无效，需要短链数组或包含 links 字段的对象', 'error')
        return
      }

      await importLinks(list as CreateShortLinkInput[])
    } catch {
      showToast('无法解析 JSON 文件', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <LayerCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-separator-border bg-background-secondary-default/45 p-3.5 sm:px-4">
          <div className="min-w-[200px] flex-1">
            <SearchField
              size="small"
              shape="rounded"
              value={search}
              onChange={setSearch}
              placeholder="搜索短链名称、短码、备注或目标链接"
              clearLabel="清除搜索"
            />
          </div>

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
            <SelectItem id="createdAt">创建时间</SelectItem>
            <SelectItem id="hits">命中次数</SelectItem>
            <SelectItem id="lastAccess">最近访问</SelectItem>
          </Select>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportFile(event)}
            className="hidden"
          />

          <Tooltip
            content={importing ? '导入中…' : '导入 JSON 备份（兼容 Sink）'}
            render={
              <Button
                variant="secondary"
                size="small"
                iconOnly
                leadingIcon={RiUploadLine}
                aria-label="导入 JSON"
                disabled={importing}
                onClick={() => importInputRef.current?.click()}
              />
            }
          />

          <Tooltip
            content="导出 JSON 备份"
            render={
              <Button
                variant="secondary"
                size="small"
                iconOnly
                leadingIcon={RiDownloadLine}
                aria-label="导出 JSON"
                disabled={filteredLinks.length === 0}
                onClick={() => exportShortLinksJson(filteredLinks)}
              />
            }
          />

          <Button
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            onClick={() => setCreateModalOpen(true)}
          >
            创建短链
          </Button>
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator-border bg-accent-500/8 px-4 py-2.5">
            <span className="font-mono text-caption-1-medium text-text-primary">
              已选中 {selectedIds.size} 条短链接
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
            <div className="py-16 text-center font-mono text-caption-1-regular text-text-tertiary">
              加载短链列表中…
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="p-6">
              <Empty
                size="sm"
                icon={<RiLinkM className="size-8 text-text-tertiary" aria-hidden />}
                title={shortLinks.length === 0 ? '暂无短链接' : '没有匹配的短链接'}
                description={
                  shortLinks.length === 0
                    ? '支持自定义短码、过期时间、访问上限、密钥保护与 JSON 备份导入。'
                    : '尝试调整搜索条件或切换状态筛选。'
                }
                contents={
                  shortLinks.length === 0 ? (
                    <Button
                      variant="primary"
                      size="small"
                      leadingIcon={RiAddLine}
                      onClick={() => setCreateModalOpen(true)}
                    >
                      创建第一条短链
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Table className="min-w-[720px]">
              <Table.Header variant="compact">
                <Table.Row>
                  <Table.CheckHead
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="全选"
                  />
                  <Table.Head>短链 / 短码</Table.Head>
                  <Table.Head>状态</Table.Head>
                  <Table.Head>目标链接</Table.Head>
                  <Table.Head className="text-end">命中</Table.Head>
                  <Table.Head>有效期</Table.Head>
                  <Table.Head>最近访问</Table.Head>
                  <Table.Head className="text-end">操作</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredLinks.map((link) => {
                  const state = getLinkState(link, now)
                  const isSelected = selectedIds.has(link.id)
                  return (
                    <Table.Row
                      key={link.id}
                      variant={isSelected ? 'selected' : 'default'}
                      onClick={() => setDrawerLinkId(link.id)}
                      className="cursor-pointer transition-colors hover:bg-background-secondary-default/65"
                    >
                      <Table.CheckCell
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(link.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`选择 ${link.name}`}
                      />

                      <Table.Cell className="max-w-56">
                        <div className="flex items-center gap-1.5">
                          <p
                            className="truncate text-body-2-medium text-text-primary"
                            title={link.name}
                          >
                            {link.name}
                          </p>
                          {link.password ? (
                            <RiLockLine
                              className="size-3.5 shrink-0 text-foreground-icon-tertiary"
                              aria-label="已开启密钥保护"
                            />
                          ) : null}
                          {link.defaultTarget && link.defaultTarget !== 'auto' ? (
                            <Badge variant="outline" className="font-mono">
                              {link.defaultTarget}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5" onClick={(event) => event.stopPropagation()}>
                          <InlineCopyText
                            variant="mono-secondary"
                            value={getShortLinkUrl(link)}
                            labels={{ copyAction: '复制短链地址', copied: '已复制' }}
                          >
                            {`/s/${link.id}`}
                          </InlineCopyText>
                        </div>
                      </Table.Cell>

                      <Table.Cell>
                        <Badge variant={STATE_BADGE[state].variant} appearance="dot">
                          {STATE_BADGE[state].label}
                        </Badge>
                      </Table.Cell>

                      <Table.Cell className="max-w-56">
                        <p
                          dir="ltr"
                          className="truncate font-mono text-caption-2-regular text-text-secondary"
                          title={link.targetUrl}
                        >
                          {link.targetUrl}
                        </p>
                        {link.comment ? (
                          <p
                            className="mt-0.5 truncate text-caption-2-regular text-text-tertiary"
                            title={link.comment}
                          >
                            {link.comment}
                          </p>
                        ) : null}
                      </Table.Cell>

                      <Table.Cell className="text-end font-mono text-caption-1-regular tabular-nums text-text-primary">
                        {link.maxHits ? `${link.hits}/${link.maxHits}` : link.hits}
                      </Table.Cell>

                      <Table.Cell
                        className="font-mono text-caption-1-regular whitespace-nowrap text-text-secondary"
                        title={link.expiresAt ? formatDateTime(link.expiresAt) : '永不过期'}
                      >
                        {link.expiresAt
                          ? new Date(link.expiresAt).toISOString().slice(0, 10)
                          : '永久'}
                      </Table.Cell>

                      <Table.Cell
                        className="text-caption-1-regular whitespace-nowrap text-text-secondary"
                        title={formatDateTime(link.lastAccess)}
                      >
                        {formatRelativeTime(link.lastAccess)}
                      </Table.Cell>

                      <Table.Cell onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip
                            content="复制短链地址"
                            render={
                              <Button
                                variant="ghost"
                                size="xs"
                                iconOnly
                                leadingIcon={RiFileCopyLine}
                                aria-label="复制短链"
                                onClick={() => void handleCopyShortLink(link)}
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
                                onClick={() => setDrawerLinkId(link.id)}
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
                                icon={<RiExternalLinkLine className="size-4" aria-hidden />}
                                onClick={() => handleOpenTarget(link)}
                              >
                                打开预览
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                icon={<RiQrCodeLine className="size-4" aria-hidden />}
                                onClick={() => setQrLink(link)}
                              >
                                查看二维码
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                icon={<RiEditLine className="size-4" aria-hidden />}
                                onClick={() => setEditingLink(link)}
                              >
                                编辑配置
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                icon={
                                  link.disabled ? (
                                    <RiPlayCircleLine className="size-4" aria-hidden />
                                  ) : (
                                    <RiPauseCircleLine className="size-4" aria-hidden />
                                  )
                                }
                                onClick={() => void setEnabled(link.id, Boolean(link.disabled))}
                              >
                                {link.disabled ? '启用短链' : '禁用短链'}
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator />
                              <DropdownMenu.Item
                                variant="danger"
                                icon={<RiDeleteBinLine className="size-4" aria-hidden />}
                                onClick={() => setDeletingLink(link)}
                              >
                                删除短链
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

      <p className="text-center font-mono text-caption-2-regular text-text-tertiary">
        共 {shortLinks.length} 条短链 · 点击行查看配额与格式直链 · 导入导出兼容 Sink JSON
      </p>

      <ShortLinkDetailDrawer
        link={drawerLink}
        state={drawerLink ? getLinkState(drawerLink, now) : 'active'}
        onClose={() => setDrawerLinkId(null)}
        onOpenTarget={handleOpenTarget}
        onOpenQr={(link) => setQrLink(link)}
        onEdit={(link) => setEditingLink(link)}
        onToggleEnabled={(link) => void setEnabled(link.id, Boolean(link.disabled))}
      />

      <Modal
        isOpen={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open)
          if (!open) resetCreateForm()
        }}
        size="lg"
      >
        <ModalHeader
          title="创建短链"
          description="为订阅链接生成易记短码，可选配默认输出格式、有效期、访问上限与密钥保护"
          closeLabel="关闭"
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
            <Input
              label="目标订阅地址 / 节点 URI"
              type="text"
              inputDir="ltr"
              value={newTargetUrl}
              onChange={setNewTargetUrl}
              placeholder="https://example.com/subscription 或 ss:// / vless://..."
              autoFocus
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="名称（可选）"
                type="text"
                value={newName}
                onChange={setNewName}
                placeholder="例如：主用机场"
              />
              <Input
                label="自定义短码（可选）"
                type="text"
                inputDir="ltr"
                value={newSlug}
                onChange={setNewSlug}
                placeholder="如 hk-main（留空自动生成）"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="默认输出格式"
                size="sm"
                selectedKey={newDefaultTarget}
                onSelectionChange={(key) => {
                  if (key) setNewDefaultTarget(String(key) as TargetClientOverride)
                }}
              >
                <SelectItem id="auto">自动识别（按客户端 UA）</SelectItem>
                <SelectItem id="clash">强制 Clash YAML</SelectItem>
                <SelectItem id="singbox">强制 sing-box JSON</SelectItem>
                <SelectItem id="v2rayng">强制 Base64 节点列表</SelectItem>
              </Select>

              <Select
                label="有效期"
                size="sm"
                selectedKey={newExpiry}
                onSelectionChange={(key) => {
                  if (key) setNewExpiry(String(key) as CreateExpiryPreset)
                }}
              >
                <SelectItem id="never">永不过期</SelectItem>
                <SelectItem id="1d">1 天</SelectItem>
                <SelectItem id="7d">7 天</SelectItem>
                <SelectItem id="30d">30 天</SelectItem>
                <SelectItem id="90d">90 天</SelectItem>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="最大访问次数（留空不限）"
                type="text"
                inputDir="ltr"
                value={newMaxHits}
                onChange={(val) => setNewMaxHits(val.replace(/[^\d]/g, ''))}
                placeholder="不限"
              />
              <Input
                label="访问密钥（留空公开）"
                type="text"
                inputDir="ltr"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="设置后访问需携带 ?key="
              />
            </div>

            <Input
              label="备注说明（可选）"
              type="text"
              value={newComment}
              onChange={setNewComment}
              placeholder="用途或设备提醒"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!newTargetUrl.trim() || creating}
            onClick={() => void handleCreateConfirm()}
          >
            {creating ? '创建中…' : '创建短链'}
          </Button>
        </ModalFooter>
      </Modal>

      {qrLink ? (
        <QrCodeModal
          url={getShortLinkUrl(qrLink)}
          title={qrLink.name}
          onClose={() => setQrLink(null)}
        />
      ) : null}

      {editingLink ? (
        <ShortLinkEditModal
          key={editingLink.id}
          link={editingLink}
          onClose={() => setEditingLink(null)}
          onSave={updateLink}
        />
      ) : null}

      <AlertDialog
        isOpen={deletingLink !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingLink(null)
        }}
        title={`删除短链 /s/${deletingLink?.id || ''}？`}
        description="删除后对应短链将立即失效且无法恢复。"
        confirmLabel="确认删除"
        pendingLabel="删除中…"
        cancelLabel="取消"
        onConfirm={handleSingleDeleteConfirm}
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
