'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@cloudflare/kumo/components/badge'
import { Empty } from '@cloudflare/kumo/components/empty'
import { LayerCard } from '@cloudflare/kumo/components/layer-card'
import { Table } from '@cloudflare/kumo/components/table'
import { Tooltip } from '@cloudflare/kumo/components/tooltip'
import { RiAddLine, RiDeleteBinLine, RiRouteLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { Select, SelectItem } from '@/components/base/select/select'
import {
  bootstrapAdminCache,
  updateCachedClientRules,
  useAdminCache,
} from '@/features/admin/admin.cache'
import { adminFetch, handleAdminFetchError, jsonBody } from '@/features/admin/admin.client'
import { showToast } from '@/features/shared/hooks/use-toast'
import type { CustomClientRule } from '@/shared/admin.types'

interface ClientRulesCardProps {
  onUnauthorized?: () => void
}

const TARGET_LABEL: Record<CustomClientRule['target'], string> = {
  clash: 'Clash YAML',
  singbox: 'sing-box JSON',
  v2rayng: 'Base64 节点',
  browser: '浏览器预览',
}

export function ClientRulesCard({ onUnauthorized }: ClientRulesCardProps) {
  const cache = useAdminCache()
  const rules = cache.clientRules
  const loading = !cache.hydrated
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [target, setTarget] = useState<CustomClientRule['target']>('singbox')
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
      updateCachedClientRules(data.rules || [])
      setKeyword('')
      setNote('')
      setAddModalOpen(false)
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
      updateCachedClientRules(data.rules || [])
      showToast('规则已删除', 'success')
    } catch (error) {
      handleAdminFetchError(error, onUnauthorized)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <LayerCard className="overflow-hidden p-0">
        <LayerCard.Secondary className="my-0 flex items-start justify-between gap-3 border-b border-separator-border px-4 py-3.5 sm:items-center sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-body-semibold text-text-primary sm:text-headline-semibold">
                客户端 UA 适配规则
              </h2>
              <Badge variant="outline" className="tabular-nums">
                {rules.length}
              </Badge>
            </div>
            <p className="mt-1 text-caption-1-regular text-text-secondary sm:mt-0.5 sm:text-body-2-regular">
              按 User-Agent 关键词覆写目标输出格式（不区分大小写，优先级高于内置识别表）
            </p>
          </div>
          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiAddLine}
            className="shrink-0"
            onClick={() => setAddModalOpen(true)}
          >
            添加适配
          </Button>
        </LayerCard.Secondary>

        <div className="bg-background-primary-default">
          {loading ? (
            <div className="py-12 text-center text-body-2-regular text-text-tertiary">
              加载客户端适配规则中…
            </div>
          ) : rules.length === 0 ? (
            <div className="console-empty p-6">
              <Empty
                size="sm"
                icon={<RiRouteLine className="size-7 text-text-tertiary" aria-hidden />}
                title="暂无自定义客户端规则"
                description="遇到未内置识别的新客户端时，可在「订阅 → 详情抽屉」复制其原始 User-Agent 后在此添加。"
              />
            </div>
          ) : (
            <>
              <div className="divide-y divide-separator-border lg:hidden">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-start gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          dir="ltr"
                          className="break-all font-mono text-body-2-semibold text-text-primary"
                        >
                          {rule.keyword}
                        </span>
                        <Badge variant="info" className="shrink-0">
                          {TARGET_LABEL[rule.target]}
                        </Badge>
                      </div>
                      {rule.note ? (
                        <p className="mt-1 line-clamp-2 text-caption-1-regular text-text-tertiary">
                          {rule.note}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="small"
                      iconOnly
                      leadingIcon={RiDeleteBinLine}
                      aria-label={`删除规则 ${rule.keyword}`}
                      disabled={deletingId === rule.id}
                      className="shrink-0 text-text-tertiary hover:text-text-error-primary"
                      onClick={() => void handleDelete(rule.id)}
                    />
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <Table className="console-table min-w-[520px]">
                  <Table.Header variant="compact">
                    <Table.Row>
                      <Table.Head>User-Agent 关键词</Table.Head>
                      <Table.Head>输出格式</Table.Head>
                      <Table.Head>备注</Table.Head>
                      <Table.Head className="text-end">操作</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {rules.map((rule) => (
                      <Table.Row key={rule.id}>
                        <Table.Cell
                          dir="ltr"
                          className="font-mono text-body-2-medium text-text-primary"
                        >
                          {rule.keyword}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant="info">{TARGET_LABEL[rule.target]}</Badge>
                        </Table.Cell>
                        <Table.Cell className="text-body-2-regular text-text-secondary">
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
              </div>
            </>
          )}
        </div>
      </LayerCard>

      <Modal
        isOpen={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open)
          if (!open) {
            setKeyword('')
            setNote('')
          }
        }}
        size="md"
      >
        <ModalHeader
          title="添加客户端 UA 适配规则"
          description="匹配请求头 User-Agent 关键词，免重新部署适配任意新代理客户端"
          closeLabel="关闭"
        />
        <ModalBody>
          <div className="flex flex-col gap-3.5">
            <Input
              label="User-Agent 关键词"
              type="text"
              inputDir="ltr"
              value={keyword}
              onChange={setKeyword}
              placeholder="例如：MyBox 或 Sparkle"
              autoFocus
            />

            <Select
              label="目标输出格式"
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

            <Input
              label="备注（可选）"
              type="text"
              value={note}
              onChange={setNote}
              placeholder="例如：新客户端适配"
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
            disabled={!keyword.trim() || submitting}
            onClick={() => void handleAddConfirm()}
          >
            {submitting ? '保存中…' : '保存规则'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
