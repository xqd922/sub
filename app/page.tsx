'use client'

import dynamic from 'next/dynamic'

const HomeContent = dynamic(() => import('@/src/ui/public/HomeContent'), {
  ssr: false
})

export default function Home() {
  return <HomeContent />
}
