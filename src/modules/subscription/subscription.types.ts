import type { Proxy } from '@/modules/proxy/proxy.types'
import type { ClientType } from '@/modules/renderer/renderer.types'

export interface SubscriptionInfo {
  name: string
  upload: string
  download: string
  total: string
  expire: string
  homepage: string
  updateInterval?: number
}

export interface SubscriptionResult {
  proxies: Proxy[]
  subscription: SubscriptionInfo
}

export interface RenderConversionInput {
  proxies: Proxy[]
  formattedProxies: Proxy[]
  subscription: SubscriptionInfo
  userAgent: string
  targetOverride?: string | null
}

export interface RenderedConversionResponse {
  body: string
  headers: Record<string, string>
  clientType: ClientType
  configSize: number
}
