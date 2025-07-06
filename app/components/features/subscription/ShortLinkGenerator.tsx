'use client'

import React from 'react'
import Button from '../../ui/Button'

interface ShortLinkGeneratorProps {
  shortUrl: string
  isLoading: boolean
  onGenerate: () => void
  onCopy: (url: string) => void
}

/**
 * 短链接生成器组件
 * 提供生成短链接和显示短链接的功能
 */
export default function ShortLinkGenerator({
  shortUrl,
  isLoading,
  onGenerate,
  onCopy
}: ShortLinkGeneratorProps) {
  // 如果没有短链接，显示生成按钮
  if (!shortUrl) {
    return (
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
        <Button
          onClick={onGenerate}
          disabled={isLoading}
          variant="text"
          size="sm"
        >
          {isLoading ? '生成中...' : '生成短链接'}
        </Button>
      </div>
    )
  }
  
  // 如果已有短链接，显示短链接和复制按钮
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">短链接</span>
        <Button
          onClick={() => onCopy(shortUrl)}
          variant="text"
          size="sm"
        >
          复制
        </Button>
      </div>
      <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
        {shortUrl}
      </div>
    </div>
  )
} 