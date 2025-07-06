'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  duration?: number
  onClose?: () => void
}

/**
 * Toast通知组件
 * 显示短暂的消息通知，自动消失
 */
export default function Toast({ message, duration = 2000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        onClose?.()
      }, 300) // 动画结束后执行onClose
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div 
      className={`fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg 
                 ${isVisible ? 'animate-fade-up' : 'animate-fade-out'}`}
    >
      {message}
    </div>
  )
}

/**
 * 在DOM中显示一个临时的Toast通知
 * @param message 要显示的消息
 * @param duration 持续时间，默认2000毫秒
 */
export function showToast(message: string, duration = 2000) {
  const toast = document.createElement('div')
  toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-up'
  toast.textContent = message
  document.body.appendChild(toast)
  
  setTimeout(() => {
    toast.classList.add('animate-fade-out')
    setTimeout(() => document.body.removeChild(toast), 300)
  }, duration)
} 