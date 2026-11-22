'use client'

import { useState } from 'react'
import { RiDatabase2Line, RiPulseLine, RiRefreshLine, RiShieldCheckLine } from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { StatusDot } from '@/components/base/badges/status-dot'
import { Button } from '@/components/base/buttons/button'
import { AlertDialog } from '@/components/base/modal/modal'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import { useAdminSystem } from '@/features/admin/hooks/use-admin-system'
import { useAutoRefresh } from '@/features/shared/hooks/use-auto-refresh'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { SystemConfigFlags } from '@/shared/types/admin.types'
import { formatDateTime } from '@/shared/utils/format.utils'

interface SystemPanelProps {
  autoRefresh: boolean
  onUnauthorized?: () => void
}

const CONFIG_ITEMS: ReadonlyArray<{ key: keyof SystemConfigFlags; label: string }> = [
  { key: 'adminPassword', label: '管理员密码 ADMIN_PASSWORD' },
  { key: 'adminUsername', label: '管理员用户名 ADMIN_USERNAME' },
  { key: 'adminSecret', label: '会话密钥 ADMIN_SECRET（可选）' },
  { key: 'siteUrl', label: '站点地址 SITE_URL' },
  { key: 'sink', label: 'Sink 短链服务' },
  { key: 'bitly', label: 'Bitly 短链服务' },
  { key: 'cuttly', label: 'Cuttly 短链服务' },
]

export function SystemPanel({ autoRefresh, onUnauthorized }: SystemPanelProps) {
  const { system, loading, refresh, pingKv, rebuildIndex } = useAdminSystem(onUnauthorized)
  const [pingResult, setPingResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [rebuildResult, setRebuildResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRebuildOpen, setConfirmRebuildOpen] = useState(false)

  useAutoRefresh(refresh, autoRefresh)

  const handlePingKv = async () => {
    setBusy(true)
    setPingResult(null)
    const result = await pingKv()
    if (result) {
      setPingResult({
        ok: result.ok,
        text: result.ok ? `读写连通正常，延迟 ${result.latencyMs} ms` : '读写校验失败',
      })
      showToast(result.ok ? 'KV 存储连通正常' : 'KV 存储异常', result.ok ? 'success' : 'error')
    }
    setBusy(false)
  }

  const handleRebuildIndex = async () => {
    setBusy(true)
    setRebuildResult(null)
    try {
      const result = await rebuildIndex()
      if (result) {
        setRebuildResult(
          `记录 ${result.recordIndexed} 条（修复 ${result.recordRepaired}）· 短链 ${result.shortIndexed} 条（修复 ${result.shortRepaired}）`,
        )
        showToast(
          `索引重建完成，修复了 ${result.recordRepaired + result.shortRepaired} 条丢失索引`,
          'success',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-headline-medium text-text-primary">环境配置状态</h2>
              <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
                仅显示配置状态，不回显具体值
              </p>
            </div>
            <RiShieldCheckLine className="size-5 text-foreground-icon-tertiary" aria-hidden />
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5 py-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-6 w-full rounded-md" />
              ))}
            </div>
          ) : !system ? (
            <p className="py-8 text-center text-body-2-regular text-text-tertiary">
              无法获取系统状态
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-separator-border">
              <ConfigRow label="KV 存储" ok={system.kvAvailable} okText="可用" failText="不可用" />
              {CONFIG_ITEMS.map((item) => (
                <ConfigRow key={item.key} label={item.label} ok={system.config[item.key]} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-headline-medium text-text-primary">存储维护</h2>
                <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
                  检测 Cloudflare KV 读写耗时或扫描修复并发写入导致的索引遗漏
                </p>
              </div>
              <RiDatabase2Line className="size-5 text-foreground-icon-tertiary" aria-hidden />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiPulseLine}
                disabled={busy}
                onClick={() => void handlePingKv()}
              >
                KV 连通性测试
              </Button>
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiRefreshLine}
                disabled={busy}
                onClick={() => setConfirmRebuildOpen(true)}
              >
                重建索引
              </Button>
            </div>

            {pingResult ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 text-body-2-medium text-text-primary">
                <StatusDot color={pingResult.ok ? 'green' : 'yellow'} />
                <span className="tabular-nums">{pingResult.text}</span>
              </div>
            ) : null}

            {rebuildResult ? (
              <div className="mt-3 rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 text-body-2-regular text-text-secondary">
                {rebuildResult}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-headline-medium text-text-primary">登录审计</h2>
            <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
              最近的后台管理登录尝试记录
            </p>
          </div>
          {system ? (
            <Chip variant="caption" color="neutral">
              共 {system.loginLog.length} 条
            </Chip>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="bui-table min-w-[540px]">
            <thead>
              <tr>
                <th className="ps-5">时间</th>
                <th>IP</th>
                <th>结果</th>
                <th className="pe-5">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {!system || system.loginLog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-body-2-regular text-text-tertiary">
                    暂无登录记录
                  </td>
                </tr>
              ) : (
                system.loginLog.map((entry, index) => (
                  <tr key={`${entry.time}-${index}`} className="hover:bg-background-secondary-default/60">
                    <td className="ps-5 text-body-2-regular whitespace-nowrap tabular-nums text-text-secondary">
                      {formatDateTime(entry.time)}
                    </td>
                    <td dir="ltr" className="font-mono text-caption-1-regular text-text-primary">
                      {entry.ip}
                    </td>
                    <td>
                      <Chip variant="caption" color={entry.ok ? 'lime' : 'rose'}>
                        {entry.ok ? '成功' : '失败'}
                      </Chip>
                    </td>
                    <td
                      dir="ltr"
                      className="max-w-72 truncate pe-5 font-mono text-caption-1-regular text-text-tertiary"
                      title={entry.userAgent}
                    >
                      {entry.userAgent || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog
        isOpen={confirmRebuildOpen}
        onOpenChange={setConfirmRebuildOpen}
        variant="default"
        title="确认重建 KV 索引？"
        description="索引重建将扫描全部 KV 键并重写转换记录与短链索引，用于修复并发写入导致的记录遗漏。"
        confirmLabel="开始重建"
        pendingLabel="重建中…"
        cancelLabel="取消"
        onConfirm={handleRebuildIndex}
      />
    </div>
  )
}

function ConfigRow({
  label,
  ok,
  okText = '已配置',
  failText = '未配置',
}: {
  label: string
  ok: boolean
  okText?: string
  failText?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="truncate text-body-2-regular text-text-secondary" title={label}>
        {label}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <StatusDot color={ok ? 'green' : 'yellow'} />
        <Chip variant="caption" color={ok ? 'lime' : 'neutral'}>
          {ok ? okText : failText}
        </Chip>
      </span>
    </div>
  )
}
