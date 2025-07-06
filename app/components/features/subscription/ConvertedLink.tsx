'use client'

import React from 'react'
import Button from '../../ui/Button'

interface ConvertedLinkProps {
  url: string
  onCopy: (url: string) => void
}

/**
 * 转换链接显示组件
 * 显示转换后的链接并提供复制功能
 */
export default function ConvertedLink({ url, onCopy }: ConvertedLinkProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] sm:text-xs text-gray-400">订阅链接</span>
        <Button
          onClick={() => onCopy(url)}
          variant="text"
          size="sm"
        >
          复制
        </Button>
      </div>
      <div className="p-2.5 sm:p-4 bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg text-[10px] sm:text-xs font-mono break-all border border-gray-200/50 dark:border-gray-700/50">
        {url}
      </div>
    </div>
  )
} 