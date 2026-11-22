'use client'

import { useCallback, useEffect, useState } from 'react'
import { RiAddLine, RiDeleteBinLine, RiSplitCellsHorizontal } from '@remixicon/react'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { useFocusRefresh } from '@/features/shared/hooks/use-focus-refresh'
import { showToast } from '@/features/shared/hooks/use-toast'
import type {
  CustomRoutingRule,
  RoutingRuleAction,
  RoutingRuleType,
} from '@/shared/admin.types'

interface RoutingRulesCardProps {
  onUnauthorized?: () => void
}

const ACTION_COLOR: Record<RoutingRuleAction, 'lime' | 'soft' | 'rose' | 'orange'> = {
  DIRECT: 'lime',
  Manual: 'soft',
  Emby: 'soft',
  AI: 'orange',
  REJECT: 'rose',
}

const VALUE_PLACEHOLDER: Record<RoutingRuleType, string> = {
  'DOMAIN-SUFFIX': '例如：115cdn.de',
  DOMAIN: '例如：a.115cdn.de',
  'DOMAIN-KEYWORD': '例如：openai',
  'IP-CIDR': '例如：95.161.76.100/31',
}

export function RoutingRulesCard({ onUnauthorized }: RoutingRulesCardProps) {
  const [rules, setRules] = useState<CustomRoutingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [ruleType, setRuleType] = useState<RoutingRuleType>('DOMAIN-SUFFIX')
  const [value, setValue] = useState('')
  const [action, setAction] = useState<RoutingRuleAction>('DIRECT')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await adminFetch<{ rules: CustomRoutingRule[] }>('/api/admin/rules/routing')
      setRules(data.rules || [])
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const data = await adminFetch<{ rules: CustomRoutingRule[] }>('/api/admin/rules/routing')
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
  }, [onUnauthorized])

  useFocusRefresh(refresh)

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!value.trim() || submitting) return

    setSubmitting(true)
    try {
      const data = await adminFetch<{ rules: CustomRoutingRule[] }>(
        '/api/admin/rules/routing',
        jsonBody('POST', {
          type: ruleType,
          value: value.trim(),
          action,
          note: note.trim() || undefined,
        }),
      )
      setRules(data.rules || [])
      setValue('')
      setNote('')
      showToast('分流规则已保存，Clash 与 sing-box 同步生效', 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const data = await adminFetch<{ rules: CustomRoutingRule[] }>(
        '/api/admin/rules/routing',
        jsonBody('DELETE', { id }),
      )
      setRules(data.rules || [])
      showToast('分流规则已删除', 'success')
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
          <h2 className="text-headline-medium text-text-primary">自定义分流规则</h2>
          <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
            优先级高于内置分流规则，同时作用于 Clash / Mihomo 与 sing-box，添加域名无需改代码重新部署
          </p>
        </div>
        <span className="inline-flex items-center gap-2">
          <Chip variant="caption" color="soft">
            共 {rules.length} 条
          </Chip>
          <RiSplitCellsHorizontal className="size-4 text-foreground-icon-tertiary" aria-hidden />
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 items-end gap-3 border-t border-separator-border bg-background-secondary-default/55 px-5 py-3.5 md:grid-cols-12"
      >
        <div className="md:col-span-3">
          <Select
            label="匹配类型"
            size="sm"
            selectedKey={ruleType}
            onSelectionChange={(key) => {
              if (key) setRuleType(String(key) as RoutingRuleType)
            }}
          >
            <SelectItem id="DOMAIN-SUFFIX">DOMAIN-SUFFIX（域名后缀）</SelectItem>
            <SelectItem id="DOMAIN">DOMAIN（精确域名）</SelectItem>
            <SelectItem id="DOMAIN-KEYWORD">DOMAIN-KEYWORD（关键词）</SelectItem>
            <SelectItem id="IP-CIDR">IP-CIDR（IP 网段）</SelectItem>
          </Select>
        </div>
        <Input
          label="域名 / 网段"
          size="small"
          type="text"
          inputDir="ltr"
          value={value}
          onChange={setValue}
          placeholder={VALUE_PLACEHOLDER[ruleType]}
          className="md:col-span-3"
        />
        <div className="md:col-span-2">
          <Select
            label="目标策略"
            size="sm"
            selectedKey={action}
            onSelectionChange={(key) => {
              if (key) setAction(String(key) as RoutingRuleAction)
            }}
          >
            <SelectItem id="DIRECT">DIRECT（直连）</SelectItem>
            <SelectItem id="Manual">Manual（代理）</SelectItem>
            <SelectItem id="Emby">Emby（媒体组）</SelectItem>
            <SelectItem id="AI">AI（AI 分组）</SelectItem>
            <SelectItem id="REJECT">REJECT（拦截）</SelectItem>
          </Select>
        </div>
        <Input
          label="备注（可选）"
          size="small"
          type="text"
          value={note}
          onChange={setNote}
          placeholder="用途说明"
          className="md:col-span-2"
        />
        <div className="flex justify-end md:col-span-2">
          <Button
            type="submit"
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            disabled={!value.trim() || submitting}
            className="w-full"
          >
            {submitting ? '保存中…' : '添加规则'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="bui-table min-w-[560px]">
          <thead>
            <tr>
              <th className="ps-5">类型</th>
              <th>匹配值</th>
              <th>策略</th>
              <th>备注</th>
              <th className="pe-5 text-end">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-body-2-regular text-text-tertiary">
                  加载中…
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-body-2-regular text-text-tertiary">
                  暂无自定义分流规则，所有转换默认使用内置规则集
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-background-secondary-default/60">
                  <td className="ps-5">
                    <Chip variant="caption" color="gray">
                      {rule.type}
                    </Chip>
                  </td>
                  <td dir="ltr" className="font-mono text-body-2-medium text-text-primary">
                    {rule.value}
                  </td>
                  <td>
                    <Chip variant="caption" color={ACTION_COLOR[rule.action]}>
                      {rule.action}
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
