'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Empty } from '@cloudflare/kumo/components/empty'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Table } from '@cloudflare/kumo/components/table'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import { RiAddLine, RiDeleteBinLine, RiSplitCellsHorizontal } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { Select, SelectItem } from '@/components/base/select/select'
import {
  bootstrapAdminCache,
  updateCachedRoutingRules,
  useAdminCache,
} from '@/features/admin/admin.cache'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type {
  CustomRoutingRule,
  RoutingRuleAction,
  RoutingRuleType,
} from '@/shared/admin.types'

interface RoutingRulesCardProps {
  onUnauthorized?: () => void
}

const ACTION_BADGE: Record<
  RoutingRuleAction,
  'success' | 'info' | 'purple' | 'warning' | 'error'
> = {
  DIRECT: 'success',
  Manual: 'info',
  Emby: 'purple',
  AI: 'warning',
  REJECT: 'error',
}

const VALUE_PLACEHOLDER: Record<RoutingRuleType, string> = {
  'DOMAIN-SUFFIX': '例如：115cdn.de',
  DOMAIN: '例如：a.115cdn.de',
  'DOMAIN-KEYWORD': '例如：openai',
  'IP-CIDR': '例如：95.161.76.100/31',
}

export function RoutingRulesCard({ onUnauthorized }: RoutingRulesCardProps) {
  const cache = useAdminCache()
  const rules = cache.routingRules
  const loading = !cache.hydrated
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [ruleType, setRuleType] = useState<RoutingRuleType>('DOMAIN-SUFFIX')
  const [value, setValue] = useState('')
  const [action, setAction] = useState<RoutingRuleAction>('DIRECT')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (cache.hydrated) return
    void bootstrapAdminCache().then((status) => {
      if (status === 'unauthorized') onUnauthorized?.()
    })
  }, [cache.hydrated, onUnauthorized])

  const handleAddConfirm = async () => {
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
      updateCachedRoutingRules(data.rules || [])
      setValue('')
      setNote('')
      setAddModalOpen(false)
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
      updateCachedRoutingRules(data.rules || [])
      showToast('分流规则已删除', 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <LayerCard className="overflow-hidden p-0">
        <LayerCard.Secondary className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-body-semibold text-text-primary">自定义分流规则</h2>
              <Badge variant="outline" className="font-mono">
                {rules.length}
              </Badge>
            </div>
            <p className="mt-0.5 text-caption-1-regular text-text-tertiary">
              优先级高于内置规则集，同时注入 Clash / Mihomo 与 sing-box，实时生效无需重新部署
            </p>
          </div>
          <Button
            variant="primary"
            size="small"
            leadingIcon={RiAddLine}
            onClick={() => setAddModalOpen(true)}
          >
            添加规则
          </Button>
        </LayerCard.Secondary>

        <div className="overflow-x-auto bg-background-primary-default">
          {loading ? (
            <div className="py-12 text-center font-mono text-caption-1-regular text-text-tertiary">
              加载分流规则中…
            </div>
          ) : rules.length === 0 ? (
            <div className="p-6">
              <Empty
                size="sm"
                icon={<RiSplitCellsHorizontal className="size-7 text-text-tertiary" aria-hidden />}
                title="暂无自定义分流规则"
                description="所有转换当前使用内置规则集；可随时添加域名或 IP 网段覆盖默认分流策略。"
              />
            </div>
          ) : (
            <Table className="min-w-[560px]">
              <Table.Header variant="compact">
                <Table.Row>
                  <Table.Head>匹配类型</Table.Head>
                  <Table.Head>域名 / 网段</Table.Head>
                  <Table.Head>目标策略</Table.Head>
                  <Table.Head>备注</Table.Head>
                  <Table.Head className="text-end">操作</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rules.map((rule) => (
                  <Table.Row key={rule.id}>
                    <Table.Cell>
                      <Badge variant="secondary" className="font-mono">
                        {rule.type}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell dir="ltr" className="font-mono text-body-2-medium text-text-primary">
                      {rule.value}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={ACTION_BADGE[rule.action]} className="font-mono">
                        {rule.action}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-caption-1-regular text-text-secondary">
                      {rule.note || '—'}
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      <Tooltip
                        content="删除规则"
                        render={
                          <Button
                            variant="ghost"
                            size="xs"
                            iconOnly
                            leadingIcon={RiDeleteBinLine}
                            aria-label="删除规则"
                            disabled={deletingId === rule.id}
                            className="text-text-tertiary hover:text-text-error-primary"
                            onClick={() => void handleDelete(rule.id)}
                          />
                        }
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      </LayerCard>

      <Modal
        isOpen={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open)
          if (!open) {
            setValue('')
            setNote('')
          }
        }}
        size="md"
      >
        <ModalHeader
          title="添加自定义分流规则"
          description="保存后同时注入 Clash YAML 与 sing-box JSON 路由规则顶部"
          closeLabel="关闭"
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
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

            <Input
              label="域名 / 网段"
              type="text"
              inputDir="ltr"
              value={value}
              onChange={setValue}
              placeholder={VALUE_PLACEHOLDER[ruleType]}
              autoFocus
            />

            <Select
              label="目标策略"
              size="sm"
              selectedKey={action}
              onSelectionChange={(key) => {
                if (key) setAction(String(key) as RoutingRuleAction)
              }}
            >
              <SelectItem id="DIRECT">DIRECT（直连）</SelectItem>
              <SelectItem id="Manual">Manual（手动代理组）</SelectItem>
              <SelectItem id="Emby">Emby（媒体分流组）</SelectItem>
              <SelectItem id="AI">AI（AI 服务分组）</SelectItem>
              <SelectItem id="REJECT">REJECT（拦截）</SelectItem>
            </Select>

            <Input
              label="备注（可选）"
              type="text"
              value={note}
              onChange={setNote}
              placeholder="用途说明"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAddConfirm()
                }
              }}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!value.trim() || submitting}
            onClick={() => void handleAddConfirm()}
          >
            {submitting ? '保存中…' : '保存规则'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
