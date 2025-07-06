'use client'

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  fullWidth?: boolean
}

/**
 * 通用输入框组件
 */
export default function Input({
  label,
  error,
  fullWidth = true,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {label}
        </label>
      )}
      
      <input
        className={`
          w-full px-3 sm:px-4 py-2.5 sm:py-3 
          bg-white/50 dark:bg-black/50 backdrop-blur-sm 
          border-0 rounded-lg sm:rounded-xl 
          text-xs sm:text-sm 
          focus:ring-2 focus:ring-blue-500/20 transition-all 
          placeholder:text-gray-400 dark:placeholder:text-gray-600
          ${error ? 'ring-2 ring-red-500/50' : ''}
          ${className}
        `}
        {...props}
      />
      
      {error && (
        <p className="mt-1 text-[10px] sm:text-xs text-red-500/90">
          {error}
        </p>
      )}
    </div>
  )
} 