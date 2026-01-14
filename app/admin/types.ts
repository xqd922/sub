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
  tags?: string[] // 新增：标签
  isFavorite?: boolean // 新增：是否收藏
  note?: string // 新增：备注
}

export interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
  tags?: string[] // 新增：标签
  note?: string // 新增：备注
}

export interface Stats {
  totalRecords: number
  totalHits: number
  todayHits: number
  activeRecords: number
  todayNewRecords?: number // 新增：今日新增
  weeklyHits?: number[] // 新增：最近7天访问数据
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

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
}

export interface FilterConfig {
  clientType?: string[]
  dateRange?: {
    start: number
    end: number
  }
  tags?: string[]
}

export interface ExportOptions {
  format: 'csv' | 'json'
  columns: string[]
  includeHeaders: boolean
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string[]
    borderColor?: string
  }[]
}
