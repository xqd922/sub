'use client'

import type { ReactNode } from 'react'
import { TooltipProvider } from '@cloudflare/kumo/components/tooltip'
import { DirectionProvider } from '@/components/foundations/direction/direction'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <DirectionProvider locale="zh-CN">
      <TooltipProvider delay={260}>{children}</TooltipProvider>
    </DirectionProvider>
  )
}
