'use client'

import { useEffect, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiRouteLine } from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { CustomClientRule } from '@/shared/admin.types'

interface ClientRulesCardProps {
  refreshSignal?: number
  onUnauthorized?: () => void
}

const TARGET_LABEL: Record<CustomClientRule['target'], string> = {
  clash: 'Clash YAML',
  singbox: 'sing-box JSON',
  v2rayng: 'Base64 节点',
  browser: '浏览器预览',
}

export function ClientRulesCard({ refreshSignal = 0, onUnauthorized }: ClientRulesCardProps) {
  const [rules, setRules] = useState<CustomClientRule[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [target, setTarget] = useState<CustomClientRule['target']>('singbox')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const data = await adminFetch<{ rules: CustomClientRule[] }>(
          '/api/admin/system/client-rules',
        )
        if (active) setRules(data.rules || [])
      } catch (error) {
        if (active) handleAdminFetchError(error, onUnauthorized)
      } finally {
        if (active) setLoading(false)
      }
    }
    void run()
    return () => {
      active = false
    }
  }, [onUnauthorized, refreshSignal])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!keyword.trim() || submitting) return

    setSubmitting(true)
    try {
      const data = await adminFetch<{ rules: CustomClientRule[] }>(
        '/api/admin/system/client-rules',
        jsonBody('POST', {
          keyword: keyword.trim(),
          target,
          note: note.trim() || undefined,
        }),
      )
      setRules(data.rules || [])
      setKeyword('')
      setNote('')
      showToast('自定义 UA 规则已保存，立即生效', 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const data = await adminFetch<{ rules: CustomClientRule[] }>(
        '/api/admin/system/client-rules',
        jsonBody('DELETE', { id }),
      )
      setRules(data.rules || [])
      showToast('规则已删除', 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-separator-border bg-background-primary-default">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h2 className="text-headline-medium text-text-primary">自定义客户端 UA 路由规则</h2>
          <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
            按关键词匹配请求 User-Agent（不区分大小写，优先级高于内置规则），实时生效免发版适配新客户端
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <Chip variant="caption" color="soft">
            共 {rules.length} 条
          </Chip>
          <RiRouteLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 items-end gap-3 border-t border-separator-border bg-background-secondary-default/55 px-5 py-3.5 md:grid-cols-12"
      >
        <Input
          label="User-Agent 关键词"
          size="small"
          type="text"
          inputDir="ltr"
          value={keyword}
          onChange={setKeyword}
          placeholder="例如：MyBox 或 Sparkle"
          className="md:col-span-4"
        />
        <div className="md:col-span-3">
          <Select
            label="输出格式"
            size="sm"
            selectedKey={target}
            onSelectionChange={(key) => {
              if (key) setTarget(String(key) as CustomClientRule['target'])
            }}
          >
            <SelectItem id="clash">Clash YAML</SelectItem>
            <SelectItem id="singbox">sing-box JSON</SelectItem>
            <SelectItem id="v2rayng">Base64 节点列表</SelectItem>
            <SelectItem id="browser">浏览器预览</SelectItem>
          </Select>
        </div>
        <Input
          label="备注（可选）"
          size="small"
          type="text"
          value={note}
          onChange={setNote}
          placeholder="例如：新客户端适配"
          className="md:col-span-3"
        />
        <div className="flex justify-end md:col-span-2">
          <Button
            type="submit"
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            disabled={!keyword.trim() || submitting}
            className="w-full"
          >
            {submitting ? '保存中…' : '添加规则'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="bui-table min-w-[520px]">
          <thead>
            <tr>
              <th className="ps-5">匹配关键词</th>
              <th>输出格式</th>
              <th>备注</th>
              <th className="pe-5 text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-body-2-regular text-text-tertiary">
                  加载中…
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-body-2-regular text-text-tertiary">
                  暂无自定义规则（遇到无法识别的新客户端时，可先在「订阅 → 详情」查看其原始 User-Agent 再在此添加）
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-background-secondary-default/60">
                  <td dir="ltr" className="ps-5 font-mono text-body-2-medium text-text-primary">
                    {rule.keyword}
                  </td>
                  <td>
                    <Chip variant="caption" color="soft">
                      {TARGET_LABEL[rule.target]}
                    </Chip>
                  </td>
                  <td className="text-caption-1-regular text-text-secondary">
                    {rule.note || '—'}
                  </td>
                  <td className="pe-5 text-end">
                    <Button
                      variant="ghost"
                      size="xs"
                      leadingIcon={RiDeleteBinLine}
                      disabled={deletingId === rule.id}
                      className="text-text-tertiary hover:text-text-error-primary"
                      onClick={() => void handleDelete(rule.id)}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
