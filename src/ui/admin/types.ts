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

export interface UnifiedItem {
  id: string
  name: string
  type: 'convert' | 'shortlink'
  url: string
  hits: number
  lastAccess: number
  clientType?: string
  nodeCount?: number
}

export interface DeleteTarget {
  isOpen: boolean
  item: UnifiedItem | null
}


export type AdminSection = 'overview' | 'subscriptions' | 'shortlinks' | 'diagnostics' | 'settings'

export type TypeFilter = 'all' | UnifiedItem['type']

export type SortDirection = 'ascending' | 'descending'

export type SortColumn = 'name' | 'hits' | 'lastAccess'

export interface SortDescriptor {
  column: SortColumn
  direction: SortDirection
}

