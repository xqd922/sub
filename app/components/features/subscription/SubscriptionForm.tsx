'use client'

import React from 'react'
import Input from '../../ui/Input'
import Button from '../../ui/Button'

interface SubscriptionFormProps {
  inputUrl: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConvert: () => void
  loading: boolean
  error: string
}

/**
 * 订阅表单组件
 * 包含输入框和转换按钮
 */
export default function SubscriptionForm({
  inputUrl,
  onInputChange,
  onConvert,
  loading,
  error
}: SubscriptionFormProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Input
        value={inputUrl}
        onChange={onInputChange}
        placeholder="在此输入你的订阅链接"
        error={error}
      />

      <Button
        onClick={onConvert}
        isLoading={loading}
        fullWidth
      >
        {loading ? '转换中...' : '转换'}
      </Button>
    </div>
  )
} 