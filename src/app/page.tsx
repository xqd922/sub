'use client'

import dynamic from 'next/dynamic'

// 动态导入主组件
const HomeContent = dynamic(() => import('./components/HomeContent'), {
  ssr: false // 禁用服务端渲染
})

export default function Home() {
  return <HomeContent />
}
