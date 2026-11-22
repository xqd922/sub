'use client'

import { useState } from 'react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import { Select, SelectItem } from '@/components/base/select/select'
import { Switch } from '@/components/base/switch/switch'
import type { ShortLink, UpdateShortLinkInput } from '@/shared/admin.types'
import { formatDateTime } from '@/shared/format.utils'

type ExpiryChoice = 'keep' | 'never' | '1d' | '7d' | '30d' | '90d'

const EXPIRY_OFFSETS_MS: Record<Exclude<ExpiryChoice, 'keep' | 'never'>, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
}

interface ShortLinkEditModalProps {
  link: ShortLink
  onClose: () => void
  onSave: (id: string, updates: UpdateShortLinkInput) => Promise<boolean>
}

export function ShortLinkEditModal({ link, onClose, onSave }: ShortLinkEditModalProps) {
  const [name, setName] = useState(link.name)
  const [targetUrl, setTargetUrl] = useState(link.targetUrl)
  const [comment, setComment] = useState(link.comment || '')
  const [password, setPassword] = useState(link.password || '')
  const [maxHits, setMaxHits] = useState(link.maxHits ? String(link.maxHits) : '')
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>('keep')
  const [enabled, setEnabled] = useState(!link.disabled)
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    const trimmedName = name.trim()
    const trimmedTarget = targetUrl.trim()
    if (!trimmedName || !trimmedTarget || saving) return

    const updates: UpdateShortLinkInput = {}
    if (trimmedName !== link.name) updates.name = trimmedName
    if (trimmedTarget !== link.targetUrl) updates.targetUrl = trimmedTarget

    const trimmedComment = comment.trim()
    if (trimmedComment !== (link.comment || '')) {
      updates.comment = trimmedComment || null
    }

    const trimmedPassword = password.trim()
    if (trimmedPassword !== (link.password || '')) {
      updates.password = trimmedPassword || null
    }

    const trimmedMaxHits = maxHits.trim()
    const parsedMaxHits = trimmedMaxHits ? Number.parseInt(trimmedMaxHits, 10) : null
    const existingMaxHits = link.maxHits ?? null
    if (parsedMaxHits !== existingMaxHits) {
      if (parsedMaxHits !== null && (!Number.isFinite(parsedMaxHits) || parsedMaxHits < 1)) {
        return
      }
      updates.maxHits = parsedMaxHits
    }

    if (expiryChoice === 'never') {
      updates.expiresAt = null
    } else if (expiryChoice !== 'keep') {
      updates.expiresAt = Date.now() + EXPIRY_OFFSETS_MS[expiryChoice]
    }

    if (enabled !== !link.disabled) {
      updates.disabled = !enabled
    }

    if (Object.keys(updates).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    const ok = await onSave(link.id, updates)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="md"
    >
      <ModalHeader
        title={`编辑短链 /s/${link.id}`}
        description="修改目标订阅、备注、有效期、访问上限或密钥，原短链地址保持不变"
        closeLabel="关闭"
      />
      <ModalBody>
        <div className="flex flex-col gap-3.5">
          <Input
            label="短链接名称"
            value={name}
            onChange={setName}
            placeholder="输入名称"
            autoFocus
          />

          <Input
            label="目标订阅地址"
            type="text"
            inputDir="ltr"
            value={targetUrl}
            onChange={setTargetUrl}
            placeholder="https://example.com/subscription"
          />

          <Input
            label="备注说明（可选）"
            type="text"
            value={comment}
            onChange={setComment}
            placeholder="例如：给手机客户端专用"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="有效期策略"
              size="sm"
              selectedKey={expiryChoice}
              onSelectionChange={(key) => {
                if (key) setExpiryChoice(String(key) as ExpiryChoice)
              }}
            >
              <SelectItem id="keep">
                {link.expiresAt ? `保持当前（${formatDateTime(link.expiresAt)}）` : '保持当前（永不过期）'}
              </SelectItem>
              <SelectItem id="never">设为永不过期</SelectItem>
              <SelectItem id="1d">从现在起 1 天有效</SelectItem>
              <SelectItem id="7d">从现在起 7 天有效</SelectItem>
              <SelectItem id="30d">从现在起 30 天有效</SelectItem>
              <SelectItem id="90d">从现在起 90 天有效</SelectItem>
            </Select>

            <Input
              label="最大访问次数（留空不限）"
              type="text"
              inputDir="ltr"
              value={maxHits}
              onChange={(val) => setMaxHits(val.replace(/[^\d]/g, ''))}
              placeholder={`已访问 ${link.hits} 次`}
            />
          </div>

          <Input
            label="访问密钥（留空公开访问）"
            type="text"
            inputDir="ltr"
            value={password}
            onChange={setPassword}
            placeholder="设置后访问需携带 ?key=密钥"
          />

          <div className="flex items-center justify-between rounded-lg border border-separator-border bg-background-secondary-default/55 px-3 py-2.5">
            <span className="text-body-2-medium text-text-primary">允许通过短链访问</span>
            <Switch size="sm" isSelected={enabled} onChange={setEnabled} aria-label="允许通过短链访问" />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          variant="primary"
          disabled={saving || !name.trim() || !targetUrl.trim()}
          onClick={() => void handleConfirm()}
        >
          {saving ? '保存中…' : '保存修改'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
