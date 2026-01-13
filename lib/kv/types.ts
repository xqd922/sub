/**
 * KV 存储类型定义
 */

/**
 * 转换记录
 */
export interface ConvertRecord {
  id: string              // 记录 ID (基于 URL 的 hash)
  originalUrl: string     // 原始订阅 URL
  name: string            // 订阅名称
  clientType: string      // 最后访问的客户端类型
  createdAt: number       // 首次转换时间
  updatedAt: number       // 最后更新时间
  lastAccess: number      // 最后访问时间
  hits: number            // 访问次数
  nodeCount: number       // 节点数量
  lastIp: string          // 最后访问 IP
  deleted?: boolean       // 是否已删除（软删除）
}

/**
 * 短链接记录
 */
export interface ShortLink {
  id: string              // 短链接 ID (6位字符)
  targetUrl: string       // 目标 URL
  name: string            // 链接名称
  createdAt: number       // 创建时间
  hits: number            // 访问次数
  lastAccess: number      // 最后访问时间
}

/**
 * 记录索引
 */
export interface RecordIndex {
  ids: string[]           // 所有记录 ID
  updatedAt: number       // 索引更新时间
}

/**
 * 统计数据
 */
export interface StatsData {
  totalRecords: number    // 总记录数
  totalHits: number       // 总访问次数
  todayHits: number       // 今日访问
  activeRecords: number   // 活跃记录数（7天内有访问）
}

/**
 * 每日统计数据
 */
export interface DailyStats {
  date: string            // YYYY-MM-DD
  totalHits: number       // 当日总访问次数
  uniqueUrls: number      // 当日独立 URL 数
}

/**
 * KV 键前缀
 */
export const KV_PREFIX = {
  RECORD: 'record:',      // 单条记录
  INDEX: 'index:records', // 记录索引
  STATS: 'stats:global',  // 全局统计
  DAILY: 'stats:daily:',  // 每日统计前缀
  SHORT: 'short:',        // 短链接
} as const
