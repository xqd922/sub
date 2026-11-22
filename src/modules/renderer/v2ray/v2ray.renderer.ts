import { encodeBase64Subscription } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'

export function renderV2raySubscription(proxies: Proxy[]): string {
  return encodeBase64Subscription(proxies)
}
