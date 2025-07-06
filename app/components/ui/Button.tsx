'use client'

import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  fullWidth?: boolean
  children: React.ReactNode
}

/**
 * 通用按钮组件
 * 支持多种变体和尺寸
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  // 基础样式
  const baseStyles = 'relative font-medium rounded-lg transition-all'
  
  // 尺寸样式
  const sizeStyles = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2.5 px-4 text-sm',
    lg: 'py-3 px-5 text-base',
  }
  
  // 变体样式
  const variantStyles = {
    primary: 'bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 text-white dark:text-gray-900 hover:opacity-90 hover:shadow-lg hover:shadow-gray-500/10',
    secondary: 'bg-white/50 dark:bg-black/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50',
    text: 'text-blue-500/80 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 bg-transparent',
  }
  
  // 禁用样式
  const disabledStyles = 'opacity-50 cursor-not-allowed'
  
  // 全宽样式
  const widthStyles = fullWidth ? 'w-full' : ''
  
  return (
    <button
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${disabled || isLoading ? disabledStyles : ''}
        ${widthStyles}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <div className="absolute inset-0 w-full h-full">
          <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-400/20 animate-progress-indeterminate"></div>
        </div>
      )}
      <div className="relative">
        {children}
      </div>
    </button>
  )
} 