'use client'

import { useState } from 'react'
import {
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinkM,
  RiLinksLine,
  RiPulseLine,
  RiQrCodeLine,
} from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/base/segmented-control/segmented-control'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { useShortLinkGenerator } from '@/features/converter/hooks/use-short-link-generator'
import { QrCodeModal } from '@/features/shared/components/qr-code-modal'
import { useClipboard } from '@/features/shared/hooks/use-clipboard'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { InspectSubscriptionResult, TargetClientOverride } from '@/shared/admin.types'
import { formatBytes, formatDateTime } from '@/shared/format.utils'
import {
  buildConversionUrl,
  isAllowedSubscriptionInput,
  unwrapConversionUrl,
} from '@/shared/url.utils'

interface ToolsPanelProps {
  onUnauthorized?: () => void
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

export function ToolsPanel({ onUnauthorized }: ToolsPanelProps) {
  const [inputUrl, setInputUrl] = useState('')
  const [target, setTarget] = useState<TargetClientOverride>('auto')
  const [inspecting, setInspecting] = useState(false)
  const [inspection, setInspection] = useState<InspectSubscriptionResult | null>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [qrTarget, setQrTarget] = useState<{ url: string; title: string } | null>(null)
  const { copyToClipboard } = useClipboard()
  const { shortUrl, loading: generating, generate, reset: resetShortUrl } =
    useShortLinkGenerator()

  const trimmedUrl = inputUrl.trim()
  const unwrapped = trimmedUrl ? unwrapConversionUrl(trimmedUrl) : null
  const normalizedUrl = unwrapped?.subscriptionUrl || ''
  const validInput = normalizedUrl ? isAllowedSubscriptionInput(normalizedUrl) : false

  const conversionUrl =
    validInput && typeof window !== 'undefined'
      ? buildConversionUrl(window.location.origin, normalizedUrl, target)
      : ''

  const handleInputChange = (value: string) => {
    setInputUrl(value)
    resetShortUrl()
    setInspectError(null)
  }

  const handleCopy = async (text: string, successLabel: string) => {
    if (!text) return
    const copied = await copyToClipboard(text)
    showToast(copied ? successLabel : '复制失败', copied ? 'success' : 'error')
  }

  const handlePreview = () => {
    if (!validInput) return
    window.open(
      buildConversionUrl(window.location.origin, normalizedUrl, 'browser'),
      '_blank',
      'noopener,noreferrer',
    )
  }

  const handleInspect = async () => {
    if (!validInput || inspecting) return
    setInspecting(true)
    setInspectError(null)
    try {
      const data = await adminFetch<{ inspection: InspectSubscriptionResult }>(
        '/api/admin/inspect',
        jsonBody('POST', { url: normalizedUrl }),
      )
      setInspection(data.inspection)
      showToast(`检测完成，共解析 ${data.inspection.nodeCount} 个节点`, 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
      setInspectError(error instanceof Error ? error.message : '订阅检测失败')
      setInspection(null)
    } finally {
      setInspecting(false)
    }
  }

  const trafficText = inspection ? formatTrafficSummary(inspection.subscription) : null
  const expireText = inspection ? formatExpireSummary(inspection.subscription.expire) : null

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
        <div className="mb-4">
          <h2 className="text-headline-medium text-text-primary">快捷转换、订阅检测与短链工具</h2>
          <p className="mt-1 text-body-2-regular text-text-secondary">
            粘贴订阅链接或代理节点 URI（支持用 | 合并多个来源），即时检测节点健康与协议分布、组装指定客户端链接或生成短链。
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="原始订阅地址 / 节点 URI"
            type="text"
            inputDir="ltr"
            leadingIcon={RiLinksLine}
            value={inputUrl}
            onChange={handleInputChange}
            placeholder="https://example.com/subscription 或 ss:// / vless://..."
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              aria-label="客户端输出格式"
              selectedKeys={[target]}
              onSelectionChange={(keys) => {
                const next = Array.from(keys)[0] as TargetClientOverride | undefined
                if (next) {
                  setTarget(next)
                  resetShortUrl()
                }
              }}
            >
              <SegmentedControlItem id="auto">自动识别</SegmentedControlItem>
              <SegmentedControlItem id="clash">Clash</SegmentedControlItem>
              <SegmentedControlItem id="singbox">sing-box</SegmentedControlItem>
              <SegmentedControlItem id="v2rayng">v2rayNG</SegmentedControlItem>
            </SegmentedControl>

            {trimmedUrl && !validInput ? (
              <span className="text-caption-1-medium text-text-error-primary">
                请输入有效的 HTTP(S) 链接或支持的代理节点 URI
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="small"
              leadingIcon={RiPulseLine}
              disabled={!validInput || inspecting}
              onClick={() => void handleInspect()}
            >
              {inspecting ? '检测中…' : '检测订阅'}
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={RiFileCopyLine}
              disabled={!conversionUrl}
              onClick={() => void handleCopy(conversionUrl, '转换链接已复制')}
            >
              复制转换链接
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={RiExternalLinkLine}
              disabled={!validInput}
              onClick={handlePreview}
            >
              配置预览
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={RiLinkM}
              disabled={!conversionUrl || generating}
              onClick={() => void generate(conversionUrl)}
            >
              {generating ? '生成中…' : '生成短链接'}
            </Button>
            {conversionUrl ? (
              <Button
                variant="secondary"
                size="small"
                leadingIcon={RiQrCodeLine}
                onClick={() =>
                  setQrTarget({
                    url: shortUrl || conversionUrl,
                    title: shortUrl ? '短链接二维码' : '转换链接二维码',
                  })
                }
              >
                二维码
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {inspectError ? (
        <div className="rounded-2xl border border-border-error-default bg-background-primary-default p-4 text-body-2-regular text-text-error-primary shadow-card">
          {inspectError}
        </div>
      ) : null}

      {inspection ? (
        <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border px-5 py-4">
            <div className="min-w-0">
              <h3 className="truncate text-headline-medium text-text-primary">
                {inspection.subscription.name || '订阅检测结果'}
              </h3>
              {trafficText || expireText ? (
                <p className="mt-1 text-caption-1-regular text-text-secondary">
                  {trafficText ? `流量 ${trafficText}` : null}
                  {trafficText && expireText ? ' · ' : null}
                  {expireText ? `到期 ${expireText}` : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="caption" color={inspection.nodeCount > 0 ? 'lime' : 'orange'}>
                {inspection.nodeCount} 个节点
              </Chip>
              <Chip variant="caption" color="neutral">
                耗时 {inspection.durationMs} ms
              </Chip>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            {Object.keys(inspection.protocolCounts).length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-caption-1-semibold text-text-secondary">协议分布</span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(inspection.protocolCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([protocol, count]) => (
                      <Chip key={protocol} variant="caption" color="blue">
                        {protocol.toUpperCase()} · {count}
                      </Chip>
                    ))}
                </div>
              </div>
            ) : null}

            {inspection.regionCounts.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-caption-1-semibold text-text-secondary">地区分布</span>
                <div className="flex flex-wrap gap-1.5">
                  {inspection.regionCounts.map((region) => (
                    <Chip key={region.code} variant="caption" color="neutral">
                      {region.flag} {region.name} · {region.count}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            {inspection.sampleNodes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-caption-1-semibold text-text-secondary">
                  节点预览（前 {inspection.sampleNodes.length} 个）
                </span>
                <div className="overflow-x-auto rounded-xl border border-separator-border">
                  <table className="bui-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th className="ps-3.5">节点名称</th>
                        <th>协议</th>
                        <th className="pe-3.5">服务器</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspection.sampleNodes.map((node, index) => (
                        <tr
                          key={`${node.name}-${node.server}-${node.port}-${index}`}
                          className="hover:bg-background-secondary-default/60"
                        >
                          <td className="max-w-64 truncate ps-3.5 text-body-2-medium text-text-primary">
                            {node.name}
                          </td>
                          <td>
                            <Chip variant="caption" color="soft">
                              {node.type.toUpperCase()}
                            </Chip>
                          </td>
                          <td
                            dir="ltr"
                            className="pe-3.5 font-mono text-caption-1-regular text-text-secondary"
                          >
                            {node.server}:{node.port}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-body-2-regular text-text-tertiary">未解析到有效代理节点</p>
            )}
          </div>
        </div>
      ) : null}

      {conversionUrl ? (
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-caption-1-semibold text-text-secondary">转换链接</h3>
            <Button
              variant="ghost"
              size="xs"
              leadingIcon={RiFileCopyLine}
              onClick={() => void handleCopy(conversionUrl, '转换链接已复制')}
            >
              复制
            </Button>
          </div>
          <div
            dir="ltr"
            className="rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 font-mono text-caption-1-regular break-all text-text-primary"
          >
            {conversionUrl}
          </div>
        </div>
      ) : null}

      {shortUrl ? (
        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="text-caption-1-semibold text-text-secondary">短链接</h3>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="xs"
                leadingIcon={RiQrCodeLine}
                onClick={() => setQrTarget({ url: shortUrl, title: '短链接二维码' })}
              >
                二维码
              </Button>
              <Button
                variant="ghost"
                size="xs"
                leadingIcon={RiFileCopyLine}
                onClick={() => void handleCopy(shortUrl, '短链接已复制')}
              >
                复制
              </Button>
            </div>
          </div>
          <div
            dir="ltr"
            className="rounded-xl border border-separator-border bg-background-secondary-default px-3.5 py-2.5 font-mono text-body-2-medium break-all text-status-blue-text"
          >
            {shortUrl}
          </div>
        </div>
      ) : null}

      {qrTarget ? (
        <QrCodeModal url={qrTarget.url} title={qrTarget.title} onClose={() => setQrTarget(null)} />
      ) : null}
    </div>
  )
}
