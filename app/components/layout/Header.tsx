'use client'

import React from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
}

/**
 * 页面标题组件
 */
export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="text-center space-y-1 mb-8 sm:mb-12">
      <h1 className="text-2xl sm:text-3xl font-light tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      )}
    </div>
  )
} 