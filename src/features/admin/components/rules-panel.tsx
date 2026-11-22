'use client'

import { ClientRulesCard } from '@/features/admin/components/client-rules-card'
import { RoutingRulesCard } from '@/features/admin/components/routing-rules-card'

interface RulesPanelProps {
  onUnauthorized?: () => void
}

export function RulesPanel({ onUnauthorized }: RulesPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <RoutingRulesCard onUnauthorized={onUnauthorized} />
      <ClientRulesCard onUnauthorized={onUnauthorized} />
    </div>
  )
}
