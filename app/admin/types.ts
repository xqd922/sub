// 管理面板类型定义

export interface ConvertRecord {
  id: string
  originalUrl: string
  name: string
  clientType: string
  createdAt: number
  updatedAt: number
  lastAccess: number
  hits: number
  nodeCount: number
  lastIp: string
}

export interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
}

export interface Stats {
  totalRecords: number
  totalHits: number
  todayHits: number
  activeRecords: number
  todayNewRecords?: number
}

export interface Toast {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  id?: string
}

export type TabType = 'records' | 'shortlinks' | 'analytics'

export type SortDirection = 'ascending' | 'descending'

export interface SortDescriptor {
  column: string
  direction: SortDirection
}
