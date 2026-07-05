'use client'

import dynamic from 'next/dynamic'

const HomeContent = dynamic(() => import('./_components/home'), {
  ssr: false 
})

export default function Home() {
  return <HomeContent />
}
