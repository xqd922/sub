'use client'

import { Badge } from '@cloudflare/kumo/components/badge'
import { ClipboardText } from '@cloudflare/kumo/components/clipboard-text'
import { Meter } from '@cloudflare/kumo/components/meter'
import {
  RiEditLine,
  RiExternalLinkLine,
  RiLinkM,
  RiPulseLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Spinner } from '@/components/base/spinner/spinner'
import { SideDrawer } from '@/features/shared/components/side-drawer'
import type { ConvertRecord, InspectSubscriptionResult } from '@/shared/admin.types'
import { formatBytes, formatDateTime } from '@/shared/format.utils'
import { buildConversionUrl } from '@/shared/url.utils'

interface RecordDetailDrawerProps {
  record: ConvertRecord | null
  inspection?: InspectSubscriptionResult | null
  inspecting?: boolean
  shortening?: boolean
  onClose: () => void
  onInspect: (record: ConvertRecord) => void
  onCreateShortLink: (record: ConvertRecord) => void
  onOpenQr: (record: ConvertRecord) => void
  onPreview: (record: ConvertRecord) => void
  onRename: (record: ConvertRecord) => void
  onToggleEnabled: (record: ConvertRecord) => void
}

function getTrafficStats(sub: InspectSubscriptionResult['subscription']): {
  percent: number
  summary: string
} | null {
  const upload = Number(sub.upload || 0)
  const download = Number(sub.download || 0)
  const total = Number(sub.total || 0)
  if (!Number.isFinite(total) || total <= 0) return null
  const used = (Number.isFinite(upload) ? upload : 0) + (Number.isFinite(download) ? download : 0)
  const percent = Math.min(100, Math.round((used / total) * 100))
  return {
    percent,
    summary: `${formatBytes(used)} / ${formatBytes(total)}（${percent}%）`,
  }
}

function formatExpireSummary(expire: string): string | null {
  const seconds = Number(expire || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return formatDateTime(seconds * 1000)
}

export function RecordDetailDrawer({
  record,
  inspection = null,
  inspecting = false,
  shortening = false,
  onClose,
  onInspect,
  onCreateShortLink,
  onOpenQr,
  onPreview,
  onRename,
  onToggleEnabled,
}: RecordDetailDrawerProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const conversionUrl = record && origin ? buildConversionUrl(origin, record.originalUrl) : ''
  const traffic = inspection ? getTrafficStats(inspection.subscription) : null
  const expireText = inspection ? formatExpireSummary(inspection.subscription.expire) : null

  return (
    <SideDrawer
      isOpen={record !== null}
      onClose={onClose}
      title={record?.name || '订阅详情'}
      subtitle={record ? `ID: ${record.id}` : undefined}
      headerExtra={
        record ? (
          <Badge variant={record.deleted ? 'warning' : 'success'} appearance="dot">
            {record.deleted ? '已禁用' : '正常'}
          </Badge>
        ) : null
      }
      footer={
        record ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiLinkM}
                disabled={shortening}
                onClick={() => onCreateShortLink(record)}
              >
                {shortening ? '生成中…' : '生成短链'}
              </Button>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiQrCodeLine}
                onClick={() => onOpenQr(record)}
              >
                二维码
              </Button>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiExternalLinkLine}
                onClick={() => onPreview(record)}
              >
                预览
              </Button>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiEditLine}
                onClick={() => onRename(record)}
              >
                改名
              </Button>
            </div>
            <Button
              variant={record.deleted ? 'primary' : 'secondary'}
              size="xs"
              onClick={() => onToggleEnabled(record)}
            >
              {record.deleted ? '启用订阅' : '禁用订阅'}
            </Button>
          </>
        ) : null
      }
    >
      {record ? (
        <div className="flex flex-col gap-5">
          {/* Quick URL Copy Blocks */}
          <section className="flex flex-col gap-3">
            <div>
              <span className="mb-1.5 block text-caption-1-medium text-text-secondary">
                转换订阅地址
              </span>
              <div dir="ltr">
                <ClipboardText
                  text={conversionUrl || record.originalUrl}
                  size="sm"
                  className="w-full"
                  tooltip={{ text: '复制转换链接', copiedText: '已复制' }}
                  labels={{ copyAction: '复制转换链接' }}
                />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-caption-1-medium text-text-secondary">
                原始上游地址
              </span>
              <div dir="ltr">
                <ClipboardText
                  text={record.originalUrl}
                  size="sm"
                  className="w-full"
                  tooltip={{ text: '复制原始链接', copiedText: '已复制' }}
                  labels={{ copyAction: '复制原始链接' }}
                />
              </div>
            </div>
          </section>

          {/* Online Health Inspection */}
          <section className="rounded-xl border border-separator-border bg-background-secondary-default/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-body-2-semibold text-text-primary">上游节点检测</h3>
                <p className="text-caption-2-regular text-text-tertiary">
                  实时拉取上游订阅并解析节点协议、地区与流量配额
                </p>
              </div>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiPulseLine}
                disabled={inspecting}
                onClick={() => onInspect(record)}
              >
                {inspecting ? '检测中…' : inspection ? '重新检测' : '立即检测'}
              </Button>
            </div>

            {inspecting ? (
              <div className="mt-4 flex items-center gap-2 border-t border-separator-border pt-3 text-caption-1-regular text-text-secondary">
                <Spinner size="sm" aria-label="正在检测" />
                <span>正在拉取上游订阅并解析节点…</span>
              </div>
            ) : inspection ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-separator-border pt-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={inspection.nodeCount > 0 ? 'success' : 'warning'} appearance="dot">
                    {inspection.nodeCount} 节点
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {inspection.durationMs} ms
                  </Badge>
                  {expireText ? (
                    <Badge variant="secondary" className="font-mono">
                      到期 {expireText}
                    </Badge>
                  ) : null}
                </div>

                {traffic ? (
                  <Meter
                    label="上游订阅流量"
                    value={traffic.percent}
                    max={100}
                    customValue={traffic.summary}
                    indicatorClassName={
                      traffic.percent >= 85 ? 'bg-kumo-danger' : 'bg-accent-500'
                    }
                  />
                ) : null}

                {Object.keys(inspection.protocolCounts).length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-caption-2-medium text-text-tertiary">协议分布</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(inspection.protocolCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([protocol, count]) => (
                          <Badge key={protocol} variant="secondary" className="font-mono">
                            {protocol.toUpperCase()} · {count}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ) : null}

                {inspection.regionCounts.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-caption-2-medium text-text-tertiary">地区分布</span>
                    <div className="flex flex-wrap gap-1.5">
                      {inspection.regionCounts.slice(0, 12).map((region) => (
                        <Badge key={region.code} variant="outline" className="font-mono">
                          {region.flag} {region.name} · {region.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Structured Telemetry Metadata */}
          <section className="flex flex-col gap-2.5">
            <h3 className="font-mono text-caption-2-semibold tracking-wider text-text-tertiary uppercase">
              Metadata
            </h3>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-separator-border bg-background-secondary-default/35 p-3.5 text-caption-1-regular">
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">最近客户端</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-text-primary">
                  {record.clientType || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">节点数 / 命中次数</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-text-primary">
                  {record.nodeCount} 节点 · {record.hits} 次
                </dd>
              </div>
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">最后访问 IP</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-text-primary">
                  {record.lastIp || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">最后访问时间</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-text-secondary">
                  {formatDateTime(record.lastAccess)}
                </dd>
              </div>
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">首次登记</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-text-secondary">
                  {formatDateTime(record.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-caption-2-regular text-text-tertiary">最近更新</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-text-secondary">
                  {formatDateTime(record.updatedAt)}
                </dd>
              </div>
              <div className="col-span-2 border-t border-separator-border pt-2.5">
                <dt className="text-caption-2-regular text-text-tertiary">最近 User-Agent</dt>
                <dd
                  dir="ltr"
                  className="mt-1 select-all rounded-md bg-background-primary-default px-2.5 py-1.5 font-mono text-caption-2-regular break-all text-text-secondary ring-1 ring-separator-border"
                >
                  {record.lastUserAgent || '—'}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </SideDrawer>
  )
}
