import { Proxy } from './types'
import { REGION_MAP } from '@/lib/regions'

// 共享的计数器
const counters: Record<string, number> = {}

// 格式化节点名称
export function formatNodeName(proxy: Proxy): string {
  // 从原始节点名称中提取地区信息
  const regionMatch = Object.keys(REGION_MAP).find(key => 
    proxy.name.toLowerCase().includes(key.toLowerCase())
  )
  
  if (!regionMatch) {
    return proxy.name
  }
  
  const { flag, name } = REGION_MAP[regionMatch as keyof typeof REGION_MAP]
  
  // 提取倍率信息
  const multiplierMatch = proxy.name.match(/(\d+\.?\d*)[xX倍]/)
  const multiplier = multiplierMatch ? ` | ${multiplierMatch[1]}x` : ''
  
  // 使用计数器生成序号
  counters[name] = (counters[name] || 0) + 1
  const num = String(counters[name]).padStart(2, '0')
  
  return `${flag} ${name} ${num}${multiplier}`.trim()
}

// 重置计数器
export function resetCounters() {
  Object.keys(counters).forEach(key => delete counters[key])
}

// 过滤节点
export function filterNodes(proxies: Proxy[]) {
  resetCounters()
  return proxies.map(proxy => ({
    ...proxy,
    name: formatNodeName(proxy)
  }))
} 