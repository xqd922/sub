'use client'

import dynamic from 'next/dynamic'

const ApiStatus = dynamic(() => import('./ApiStatus'), { 
  ssr: false,
  loading: () => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      加载中...
    </span>
  )
})

export default function DynamicApiStatus() {
  return <ApiStatus />
} 