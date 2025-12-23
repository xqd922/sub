/**
 * 节点名称格式化模块
 * 根据地区信息重命名节点
 */

import { Proxy } from '../core/types'
import { REGION_MAP } from './region'

/** 地区计数器 */
const counters: Record<string, number> = {}

/**
 * 格式化单个节点名称
 * @param proxy 节点对象
 * @returns 格式化后的名称
 */
export function formatNodeName(proxy: Proxy): string {
  const regionMatch = Object.keys(REGION_MAP).find(key =>
    proxy.name.toLowerCase().includes(key.toLowerCase())
  )

  if (!regionMatch) {
    return proxy.name
  }

  const { flag, name } = REGION_MAP[regionMatch as keyof typeof REGION_MAP]

  // 提取倍率信息
  const multiplierMatch = proxy.name.match(/(\d+\.?\d*)[xX倍]/)
  const multiplier = multiplierMatch ? ` [${multiplierMatch[1]}x]` : ''

  // 生成序号
  counters[name] = (counters[name] || 0) + 1
  const num = String(counters[name]).padStart(2, '0')

  return `${flag} ${name} ${num}${multiplier}`.trim()
}

/** 重置计数器 */
export function resetCounters(): void {
  Object.keys(counters).forEach(key => delete counters[key])
}

/**
 * 批量格式化节点名称
 * @param proxies 节点列表
 * @returns 格式化后的节点列表
 */
export function filterNodes(proxies: Proxy[]): Proxy[] {
  resetCounters()
  return proxies.map(proxy => ({
    ...proxy,
    name: formatNodeName(proxy)
  }))
}
