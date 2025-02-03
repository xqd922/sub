'use client'

import { useState, useEffect } from 'react'

export default function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // 使用 API 健康检查端点
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache'
        })
        setStatus(response.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    // 立即检查一次
    checkStatus()

    // 每 5 分钟检查一次
    const interval = setInterval(checkStatus, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const statusConfig = {
    checking: {
      text: '检测中...',
      dotColor: 'bg-yellow-500',
      textColor: 'text-gray-500'
    },
    online: {
      text: 'API 运行正常',
      dotColor: 'bg-green-500',
      textColor: 'text-gray-500'
    },
    offline: {
      text: 'API 服务异常',
      dotColor: 'bg-red-500',
      textColor: 'text-red-500'
    }
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center justify-center gap-2">
      <div className={`h-2 w-2 rounded-full ${config.dotColor} ${status === 'checking' ? 'animate-pulse' : ''}`}></div>
      <p className={`text-sm ${config.textColor}`}>{config.text}</p>
    </div>
  )
} 