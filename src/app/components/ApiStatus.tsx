'use client'

import { useState, useEffect } from 'react'

export default function ApiStatus() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading')

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/health')
        if (response.ok) {
          setApiStatus('online')
        } else {
          setApiStatus('offline')
        }
      } catch {
        setApiStatus('offline')
      }
    }

    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const statusDisplay = {
    loading: {
      text: 'API 状态检测中',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    },
    online: {
      text: 'API 运行正常',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    },
    offline: {
      text: 'API 服务异常',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
  }

  return (
    <span 
      suppressHydrationWarning 
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay[apiStatus].className}`}
    >
      <span 
        suppressHydrationWarning
        className={`h-1.5 w-1.5 rounded-full ${apiStatus === 'online' ? 'animate-pulse' : ''} ${apiStatus === 'loading' ? 'animate-ping' : ''} bg-current`}
      />
      <span suppressHydrationWarning>{statusDisplay[apiStatus].text}</span>
    </span>
  )
} 