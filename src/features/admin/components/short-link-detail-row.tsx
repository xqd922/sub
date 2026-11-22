'use client'

import { Chip } from '@/components/base/badges/chip'
import type { ShortLink, TargetClientOverride } from '@/shared/admin.types'
import { formatDateTime } from '@/shared/format.utils'

const TARGET_LABELS: Record<TargetClientOverride, string> = {
  auto: '自动识别',
  clash: 'Clash YAML',
  singbox: 'sing-box JSON',
  v2rayng: 'Base64 节点',
  browser: '浏览器预览',
}

interface ShortLinkDetailRowProps {
  link: ShortLink
}

export function ShortLinkDetailRow({ link }: ShortLinkDetailRowProps) {
  const clientEntries = Object.entries(link.clientHits || {}).sort(([, a], [, b]) => b - a)

  return (
    <tr className="bg-background-secondary-default/70">
      <td colSpan={8} className="px-5 py-3.5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-caption-1-regular sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="inline text-text-tertiary">目标订阅：</dt>
            <dd dir="ltr" className="inline font-mono break-all text-text-primary">
              {link.targetUrl}
            </dd>
          </div>

          {link.comment ? (
            <div className="sm:col-span-2">
              <dt className="inline text-text-tertiary">备注说明：</dt>
              <dd className="inline text-text-secondary">{link.comment}</dd>
            </div>
          ) : null}

          <div>
            <dt className="inline text-text-tertiary">短码 ID：</dt>
            <dd dir="ltr" className="inline font-mono text-text-primary">
              {link.id}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">访问密钥：</dt>
            <dd dir="ltr" className="inline font-mono text-text-primary">
              {link.password ? link.password : '未设置（公开）'}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">过期时间：</dt>
            <dd className="inline tabular-nums text-text-secondary">
              {link.expiresAt ? formatDateTime(link.expiresAt) : '永不过期'}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">访问上限：</dt>
            <dd className="inline font-mono tabular-nums text-text-secondary">
              {link.maxHits ? `${link.hits} / ${link.maxHits}` : '不限制'}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">默认输出格式：</dt>
            <dd className="inline text-text-primary">
              {TARGET_LABELS[link.defaultTarget || 'auto']}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">快捷后缀：</dt>
            <dd dir="ltr" className="inline font-mono text-text-secondary">
              /s/{link.id}.yaml · .json · .txt
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">最近客户端 / IP：</dt>
            <dd dir="ltr" className="inline font-mono text-text-secondary">
              {link.lastClientType || '—'} · {link.lastIp || '—'}
            </dd>
          </div>

          <div>
            <dt className="inline text-text-tertiary">创建时间：</dt>
            <dd className="inline tabular-nums text-text-secondary">
              {formatDateTime(link.createdAt)}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="inline text-text-tertiary">最近 User-Agent：</dt>
            <dd dir="ltr" className="inline select-all font-mono break-all text-text-secondary">
              {link.lastUserAgent || '—'}
            </dd>
          </div>

          {clientEntries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:col-span-2">
              <dt className="text-text-tertiary">客户端分布：</dt>
              {clientEntries.map(([client, count]) => (
                <Chip key={client} variant="caption" color="soft">
                  {client} · {count}
                </Chip>
              ))}
            </div>
          ) : null}
        </dl>
      </td>
    </tr>
  )
}
