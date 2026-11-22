'use client'

import { Badge } from '@cloudflare/kumo/components/badge'
import { ClipboardText } from '@cloudflare/kumo/components/clipboard-text'
import { InlineCopyText } from '@cloudflare/kumo/components/inline-copy-text'
import { Meter } from '@cloudflare/kumo/components/meter'
import { RiEditLine, RiExternalLinkLine, RiQrCodeLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { SideDrawer } from '@/features/shared/components/side-drawer'
import type { ShortLink, TargetClientOverride } from '@/shared/admin.types'
import { formatDateTime } from '@/shared/format.utils'
import { buildShortLinkPublicUrl } from '@/shared/url.utils'

const TARGET_LABELS: Record<TargetClientOverride, string> = {
  auto: '自动识别',
  clash: 'Clash YAML',
  singbox: 'sing-box JSON',
  v2rayng: 'Base64 节点',
  browser: '浏览器预览',
}

interface ShortLinkDetailDrawerProps {
  link: ShortLink | null
  state: 'active' | 'disabled' | 'expired' | 'limit_reached'
  onClose: () => void
  onOpenTarget: (link: ShortLink) => void
  onOpenQr: (link: ShortLink) => void
  onEdit: (link: ShortLink) => void
  onToggleEnabled: (link: ShortLink) => void
}

const STATE_BADGE: Record<
  ShortLinkDetailDrawerProps['state'],
  { label: string; variant: 'success' | 'warning' | 'error' }
> = {
  active: { label: '正常', variant: 'success' },
  disabled: { label: '已禁用', variant: 'warning' },
  expired: { label: '已过期', variant: 'error' },
  limit_reached: { label: '达上限', variant: 'error' },
}

export function ShortLinkDetailDrawer({
  link,
  state,
  onClose,
  onOpenTarget,
  onOpenQr,
  onEdit,
  onToggleEnabled,
}: ShortLinkDetailDrawerProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const publicUrl = link && origin ? buildShortLinkPublicUrl(origin, link.id, link.password) : ''
  const clientEntries = link
    ? Object.entries(link.clientHits || {}).sort(([, a], [, b]) => b - a)
    : []
  const quotaPct =
    link && link.maxHits && link.maxHits > 0
      ? Math.min(100, Math.round((link.hits / link.maxHits) * 100))
      : null

  return (
    <SideDrawer
      isOpen={link !== null}
      onClose={onClose}
      title={link?.name || '短链详情'}
      subtitle={link ? `/s/${link.id}` : undefined}
      headerExtra={
        link ? (
          <Badge variant={STATE_BADGE[state].variant} appearance="dot">
            {STATE_BADGE[state].label}
          </Badge>
        ) : null
      }
      footer={
        link ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiExternalLinkLine}
                onClick={() => onOpenTarget(link)}
              >
                预览配置
              </Button>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiQrCodeLine}
                onClick={() => onOpenQr(link)}
              >
                二维码
              </Button>
              <Button
                variant="secondary"
                size="xs"
                leadingIcon={RiEditLine}
                onClick={() => onEdit(link)}
              >
                编辑配置
              </Button>
            </div>
            <Button
              variant={link.disabled ? 'primary' : 'secondary'}
              size="xs"
              onClick={() => onToggleEnabled(link)}
            >
              {link.disabled ? '启用短链' : '禁用短链'}
            </Button>
          </>
        ) : null
      }
    >
      {link ? (
        <div className="flex flex-col gap-5">
          {/* Copyable Endpoints */}
          <section className="flex flex-col gap-3">
            <div>
              <span className="mb-1.5 block text-body-2-medium text-text-secondary">
                短链地址{link.password ? '（含访问密钥）' : ''}
              </span>
              <div dir="ltr">
                <ClipboardText
                  text={publicUrl || `/s/${link.id}`}
                  size="sm"
                  className="w-full"
                  tooltip={{ text: '复制短链地址', copiedText: '已复制' }}
                  labels={{ copyAction: '复制短链地址' }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-separator-border bg-background-secondary-default/40 px-3 py-2">
              <span className="text-caption-1-medium text-text-secondary">格式直链：</span>
              {(['.yaml', '.json', '.txt'] as const).map((suffix) => {
                const suffixUrl = origin
                  ? buildShortLinkPublicUrl(origin, `${link.id}${suffix}`, link.password)
                  : `/s/${link.id}${suffix}`
                return (
                  <InlineCopyText
                    key={suffix}
                    variant="mono-secondary"
                    value={suffixUrl}
                    labels={{ copyAction: `复制 ${suffix} 地址`, copied: '已复制' }}
                  >
                    {`/s/${link.id}${suffix}`}
                  </InlineCopyText>
                )
              })}
            </div>

            <div>
              <span className="mb-1.5 block text-body-2-medium text-text-secondary">
                目标订阅地址
              </span>
              <div dir="ltr">
                <ClipboardText
                  text={link.targetUrl}
                  size="sm"
                  className="w-full"
                  tooltip={{ text: '复制目标地址', copiedText: '已复制' }}
                  labels={{ copyAction: '复制目标地址' }}
                />
              </div>
            </div>

            {link.password ? (
              <div>
                <span className="mb-1.5 block text-body-2-medium text-text-secondary">
                  访问密钥（默认掩码）
                </span>
                <div dir="ltr">
                  <ClipboardText
                    text={link.password}
                    size="sm"
                    masked
                    className="w-full"
                    tooltip={{ text: '复制密钥', copiedText: '已复制' }}
                    labels={{
                      copyAction: '复制密钥',
                      revealAction: '显示密钥',
                      hideAction: '隐藏密钥',
                    }}
                  />
                </div>
              </div>
            ) : null}
          </section>

          {quotaPct !== null && link.maxHits ? (
            <section className="rounded-xl border border-separator-border bg-background-secondary-default/45 p-4">
              <Meter
                label="访问次数配额"
                value={quotaPct}
                max={100}
                customValue={`${link.hits} / ${link.maxHits}（${quotaPct}%）`}
                className="console-meter"
                indicatorClassName={quotaPct >= 90 ? 'bg-kumo-danger' : 'bg-accent-500'}
              />
            </section>
          ) : null}

          <section className="flex flex-col gap-2.5">
            <h3 className="text-caption-2-medium tracking-wider text-text-tertiary uppercase">
              Metadata
            </h3>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-separator-border bg-background-secondary-default/35 p-3.5 text-body-2-regular">
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">默认输出格式</dt>
                <dd className="mt-0.5 text-text-primary">
                  {TARGET_LABELS[link.defaultTarget || 'auto']}
                </dd>
              </div>
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">累计命中</dt>
                <dd className="mt-0.5 tabular-nums text-text-primary">
                  {link.maxHits ? `${link.hits} / ${link.maxHits}` : `${link.hits} 次`}
                </dd>
              </div>
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">过期时间</dt>
                <dd className="mt-0.5 tabular-nums text-text-secondary">
                  {link.expiresAt ? formatDateTime(link.expiresAt) : '永不过期'}
                </dd>
              </div>
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">创建时间</dt>
                <dd className="mt-0.5 tabular-nums text-text-secondary">
                  {formatDateTime(link.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">最近客户端</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-text-primary">
                  {link.lastClientType || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-caption-1-regular text-text-tertiary">最近 IP</dt>
                <dd dir="ltr" className="mt-0.5 font-mono text-text-primary">
                  {link.lastIp || '—'}
                </dd>
              </div>

              {link.comment ? (
                <div className="col-span-2 border-t border-separator-border pt-2.5">
                  <dt className="text-caption-1-regular text-text-tertiary">备注说明</dt>
                  <dd className="mt-0.5 text-text-secondary">{link.comment}</dd>
                </div>
              ) : null}

              <div className="col-span-2 border-t border-separator-border pt-2.5">
                <dt className="text-caption-1-regular text-text-tertiary">最近 User-Agent</dt>
                <dd
                  dir="ltr"
                  className="mt-1 select-all rounded-md bg-background-primary-default px-2.5 py-1.5 font-mono text-caption-1-regular break-all text-text-secondary ring-1 ring-separator-border"
                >
                  {link.lastUserAgent || '—'}
                </dd>
              </div>

              {clientEntries.length > 0 ? (
                <div className="col-span-2 border-t border-separator-border pt-2.5">
                  <dt className="mb-1.5 text-caption-1-regular text-text-tertiary">客户端分布</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {clientEntries.map(([client, count]) => (
                      <Badge key={client} variant="secondary" className="font-mono">
                        {client} · {count}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>
      ) : null}
    </SideDrawer>
  )
}
