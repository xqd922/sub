'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  RiAddLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLockLine,
  RiQrCodeLine,
  RiUploadLine,
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
import { ShortLinkDetailRow } from '@/features/admin/components/short-link-detail-row'
import { ShortLinkEditModal } from '@/features/admin/components/short-link-edit-modal'
import { useAdminShortLinks } from '@/features/admin/hooks/use-admin-short-links'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useAutoRefresh } from '@/features/shared/hooks/use-auto-refresh'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { CreateShortLinkInput, ShortLink, TargetClientOverride } from '@/shared/admin.types'
import { formatDateTime, formatRelativeTime } from '@/shared/format.utils'
import { buildShortLinkPublicUrl } from '@/shared/url.utils'
import { cx } from '@/utils/cx'

interface ShortLinksPanelProps {
  autoRefresh: boolean
  refreshSignal?: number
  onUnauthorized?: () => void
  onCountChange?: (count: number) => void
}

type SortKey = 'createdAt' | 'hits' | 'lastAccess'
type StatusFilter = 'all' | 'active' | 'disabled' | 'inactive'
type CreateExpiryPreset = 'never' | '1d' | '7d' | '30d' | '90d'

const CREATE_EXPIRY_MS: Record<Exclude<CreateExpiryPreset, 'never'>, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
}

type LinkHealthState = 'active' | 'disabled' | 'expired' | 'limit_reached'

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

export function ShortLinksPanel({
  autoRefresh,
  refreshSignal = 0,
  onUnauthorized,
  onCountChange,
}: ShortLinksPanelProps) {
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

  const deleteTimerRef = useRef<number | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
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
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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

  const handleDeleteClick = (id: string) => {
    if (deleteTimerRef.current !== null) {
      window.clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = null
    }

    if (confirmingDeleteId === id) {
      setConfirmingDeleteId(null)
      void deleteLinks([id])
      return
    }

    setConfirmingDeleteId(id)
    deleteTimerRef.current = window.setTimeout(() => {
      setConfirmingDeleteId((prev) => (prev === id ? null : prev))
      deleteTimerRef.current = null
    }, 3000)
  }

  const handleBatchDeleteConfirm = async () => {
    await deleteLinks(Array.from(selectedIds))
    setSelectedIds(new Set())
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
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
      setNewTargetUrl('')
      setNewName('')
      setNewSlug('')
      setNewComment('')
      setNewExpiry('never')
      setNewMaxHits('')
      setNewPassword('')
      setNewDefaultTarget('auto')
      setShowCreateForm(false)
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
      <div className="overflow-hidden rounded-xl border border-separator-border bg-background-primary-default">
        <div className="flex flex-wrap items-center gap-2.5 p-3.5 sm:p-4">
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

          <SegmentedControl
            aria-label="按状态筛选"
            selectedKeys={[statusFilter]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as StatusFilter | undefined
              if (next) setStatusFilter(next)
            }}
          >
            <SegmentedControlItem id="all">全部</SegmentedControlItem>
            <SegmentedControlItem id="active">正常</SegmentedControlItem>
            <SegmentedControlItem id="disabled">已禁用</SegmentedControlItem>
            <SegmentedControlItem id="inactive">已失效</SegmentedControlItem>
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
            <SelectItem id="createdAt">按创建时间</SelectItem>
            <SelectItem id="hits">按命中次数</SelectItem>
            <SelectItem id="lastAccess">按最近访问</SelectItem>
          </Select>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void handleImportFile(event)}
            className="hidden"
          />

          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiUploadLine}
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
          >
            {importing ? '导入中…' : '导入'}
          </Button>

          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiDownloadLine}
            disabled={filteredLinks.length === 0}
            onClick={() => exportShortLinksJson(filteredLinks)}
          >
            导出 JSON
          </Button>

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
            className="flex flex-col gap-3 border-t border-separator-border bg-background-secondary-default/60 px-4 py-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <Input
                label="目标订阅地址 / 节点 URI"
                size="small"
                type="text"
                inputDir="ltr"
                value={newTargetUrl}
                onChange={setNewTargetUrl}
                placeholder="https://example.com/subscription 或 ss:// / vless://..."
                className="md:col-span-6"
              />
              <Input
                label="自定义短码（可选）"
                size="small"
                type="text"
                inputDir="ltr"
                value={newSlug}
                onChange={setNewSlug}
                placeholder="如 hk-main（留空自动生成）"
                className="md:col-span-3"
              />
              <Input
                label="名称（可选）"
                size="small"
                type="text"
                value={newName}
                onChange={setNewName}
                placeholder="例如：主用机场"
                className="md:col-span-3"
              />
            </div>

            <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
              <div className="md:col-span-2">
                <Select
                  label="默认输出格式"
                  size="sm"
                  selectedKey={newDefaultTarget}
                  onSelectionChange={(key) => {
                    if (key) setNewDefaultTarget(String(key) as TargetClientOverride)
                  }}
                >
                  <SelectItem id="auto">自动识别</SelectItem>
                  <SelectItem id="clash">Clash</SelectItem>
                  <SelectItem id="singbox">sing-box</SelectItem>
                  <SelectItem id="v2rayng">Base64</SelectItem>
                </Select>
              </div>
              <div className="md:col-span-2">
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
              <Input
                label="访问上限"
                size="small"
                type="text"
                inputDir="ltr"
                value={newMaxHits}
                onChange={(val) => setNewMaxHits(val.replace(/[^\d]/g, ''))}
                placeholder="不限"
                className="md:col-span-2"
              />
              <Input
                label="访问密钥（可选）"
                size="small"
                type="text"
                inputDir="ltr"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="留空公开"
                className="md:col-span-2"
              />
              <Input
                label="备注说明（可选）"
                size="small"
                type="text"
                value={newComment}
                onChange={setNewComment}
                placeholder="用途或提醒"
                className="md:col-span-3"
              />
              <div className="flex justify-end md:col-span-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="small"
                  disabled={!newTargetUrl.trim() || creating}
                  className="w-full"
                >
                  {creating ? '…' : '创建'}
                </Button>
              </div>
            </div>
          </form>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator-border bg-background-secondary-default/80 px-4 py-2.5">
            <span className="text-body-2-medium text-text-primary">
              已选中 {selectedIds.size} 条短链接
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
                <th>短链地址</th>
                <th>状态</th>
                <th>目标链接</th>
                <th className="text-end">命中</th>
                <th>有效期</th>
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
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-body-2-regular text-text-tertiary">
                    {shortLinks.length === 0 ? '暂无短链接，转换后生成或手动创建' : '没有匹配的短链接'}
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link) => {
                  const state = getLinkState(link, now)
                  const isRowConfirmingDelete = confirmingDeleteId === link.id
                  return (
                    <Fragment key={link.id}>
                      <tr className="hover:bg-background-secondary-default/65">
                        <td className="ps-4">
                          <Checkbox
                            size="sm"
                            isSelected={selectedIds.has(link.id)}
                            onChange={() => toggleSelect(link.id)}
                            aria-label={`选择 ${link.name}`}
                          />
                        </td>
                        <td className="max-w-52">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-body-2-medium text-text-primary" title={link.name}>
                              {link.name}
                            </p>
                            {link.password ? (
                              <RiLockLine
                                className="size-3.5 shrink-0 text-foreground-icon-tertiary"
                                aria-label="已开启密钥保护"
                              />
                            ) : null}
                            {link.defaultTarget && link.defaultTarget !== 'auto' ? (
                              <Chip variant="caption" color="soft">
                                {link.defaultTarget}
                              </Chip>
                            ) : null}
                          </div>
                          <p
                            dir="ltr"
                            className="truncate font-mono text-caption-1-regular text-text-secondary"
                          >
                            /s/{link.id}
                          </p>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot color={state === 'active' ? 'green' : 'yellow'} />
                            <Chip
                              variant="caption"
                              color={
                                state === 'active'
                                  ? 'lime'
                                  : state === 'disabled'
                                    ? 'orange'
                                    : 'rose'
                              }
                            >
                              {state === 'active'
                                ? '正常'
                                : state === 'disabled'
                                  ? '已禁用'
                                  : state === 'expired'
                                    ? '已过期'
                                    : '达上限'}
                            </Chip>
                          </span>
                        </td>
                        <td className="max-w-56">
                          <p
                            dir="ltr"
                            className="truncate font-mono text-caption-1-regular text-text-secondary"
                            title={link.targetUrl}
                          >
                            {link.targetUrl}
                          </p>
                          {link.comment ? (
                            <p
                              className="truncate text-caption-2-regular text-text-tertiary"
                              title={link.comment}
                            >
                              {link.comment}
                            </p>
                          ) : null}
                        </td>
                        <td className="text-end font-mono text-body-2-regular tabular-nums text-text-primary">
                          {link.maxHits ? `${link.hits}/${link.maxHits}` : link.hits}
                        </td>
                        <td
                          className="text-caption-1-regular whitespace-nowrap text-text-secondary"
                          title={link.expiresAt ? formatDateTime(link.expiresAt) : '永不过期'}
                        >
                          {link.expiresAt
                            ? new Date(link.expiresAt).toISOString().slice(0, 10)
                            : '永久'}
                        </td>
                        <td
                          className="text-caption-1-regular whitespace-nowrap text-text-secondary"
                          title={formatDateTime(link.lastAccess)}
                        >
                          {formatRelativeTime(link.lastAccess)}
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
                              onClick={() => void setEnabled(link.id, Boolean(link.disabled))}
                            >
                              {link.disabled ? '启用' : '禁用'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              leadingIcon={RiEditLine}
                              onClick={() => setEditingLink(link)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setExpandedId((prev) => (prev === link.id ? null : link.id))
                              }
                            >
                              {expandedId === link.id ? '收起' : '详情'}
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

                      {expandedId === link.id ? <ShortLinkDetailRow link={link} /> : null}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-caption-1-regular text-text-tertiary">
        共 {shortLinks.length} 条短链接 · 支持自定义短码、过期时间、访问上限、密钥保护与 JSON 备份导入（兼容 Sink 导出格式）
      </p>

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
