'use client'

import dynamic from 'next/dynamic'

const Converter = dynamic(() => import('./Converter'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-2">
      <div className="h-2 w-2 rounded-full bg-gray-300" />
      <p className="text-sm text-gray-500">加载中...</p>
    </div>
  )
})

export default function ClientWrapper() {
  return <Converter />
} 