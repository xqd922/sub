'use client'

import { ClientRulesCard } from '@/features/admin/components/client-rules-card'
import { RoutingRulesCard } from '@/features/admin/components/routing-rules-card'

interface RulesPanelProps {
  refreshSignal?: number
  onUnauthorized?: () => void
}

export function RulesPanel({ refreshSignal = 0, onUnauthorized }: RulesPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <RoutingRulesCard refreshSignal={refreshSignal} onUnauthorized={onUnauthorized} />
      <ClientRulesCard refreshSignal={refreshSignal} onUnauthorized={onUnauthorized} />
    </div>
  )
}
