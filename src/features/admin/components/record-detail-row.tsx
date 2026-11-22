'use client'

import { Chip } from '@/components/base/badges/chip'
import type { ConvertRecord, InspectSubscriptionResult } from '@/shared/admin.types'
import { formatBytes, formatDateTime } from '@/shared/format.utils'

interface RecordDetailRowProps {
  record: ConvertRecord
  inspection?: InspectSubscriptionResult | null
  inspecting?: boolean
}

function formatTrafficSummary(sub: InspectSubscriptionResult['subscription']): string | null {
  const upload = Number(sub.upload || 0)
  const download = Number(sub.download || 0)
  const total = Number(sub.total || 0)
  if (!Number.isFinite(total) || total <= 0) return null
  const used = (Number.isFinite(upload) ? upload : 0) + (Number.isFinite(download) ? download : 0)
  const percent = Math.min(100, Math.round((used / total) * 100))
  return `${formatBytes(used)} / ${formatBytes(total)}（${percent}%）`
}

function formatExpireSummary(expire: string): string | null {
  const seconds = Number(expire || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return formatDateTime(seconds * 1000)
}

export function RecordDetailRow({
  record,
  inspection = null,
  inspecting = false,
}: RecordDetailRowProps) {
  const trafficText = inspection ? formatTrafficSummary(inspection.subscription) : null
  const expireText = inspection ? formatExpireSummary(inspection.subscription.expire) : null

  return (
    <tr className="bg-background-secondary-default/70">
      <td colSpan={8} className="px-5 py-3.5">
        <div className="flex flex-col gap-3">
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
            <div className="sm:col-span-2">
              <dt className="inline text-text-tertiary">最近 User-Agent：</dt>
              <dd dir="ltr" className="inline select-all font-mono break-all text-text-secondary">
                {record.lastUserAgent || '—'}
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

          {inspecting ? (
            <div className="border-t border-separator-border pt-3 text-caption-1-regular text-text-tertiary">
              正在拉取上游订阅并解析节点…
            </div>
          ) : inspection ? (
            <div className="flex flex-col gap-2.5 border-t border-separator-border pt-3">
              <div className="flex flex-wrap items-center gap-2 text-caption-1-regular text-text-secondary">
                <span className="text-caption-1-semibold text-text-primary">在线检测</span>
                <Chip variant="caption" color={inspection.nodeCount > 0 ? 'lime' : 'orange'}>
                  {inspection.nodeCount} 节点
                </Chip>
                <Chip variant="caption" color="soft">
                  {inspection.durationMs} ms
                </Chip>
                {trafficText ? <span>流量 {trafficText}</span> : null}
                {expireText ? <span>· 到期 {expireText}</span> : null}
              </div>

              {Object.keys(inspection.protocolCounts).length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption-2-medium text-text-tertiary">协议：</span>
                  {Object.entries(inspection.protocolCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([protocol, count]) => (
                      <Chip key={protocol} variant="caption" color="gray">
                        {protocol.toUpperCase()} · {count}
                      </Chip>
                    ))}
                </div>
              ) : null}

              {inspection.regionCounts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-caption-2-medium text-text-tertiary">地区：</span>
                  {inspection.regionCounts.slice(0, 12).map((region) => (
                    <Chip key={region.code} variant="caption" color="soft">
                      {region.flag} {region.name} · {region.count}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
