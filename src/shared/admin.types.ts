export type TargetClientOverride = 'auto' | 'clash' | 'singbox' | 'v2rayng' | 'browser'

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
  deleted?: boolean
}

export interface ShortLink {
  id: string
  targetUrl: string
  name: string
  createdAt: number
  hits: number
  lastAccess: number
}

export interface StatsData {
  totalRecords: number
  disabledRecords: number
  totalShortLinks: number
  totalHits: number
  todayHits: number
  activeRecords: number
}

export interface DailyStats {
  date: string
  totalHits: number
  uniqueUrls: number
}

export interface LoginAttempt {
  time: number
  ip: string
  ok: boolean
  userAgent?: string
}

export interface SystemConfigFlags {
  adminUsername: boolean
  adminPassword: boolean
  adminSecret: boolean
  sink: boolean
  bitly: boolean
  cuttly: boolean
  siteUrl: boolean
}

export interface SystemStatus {
  config: SystemConfigFlags
  kvAvailable: boolean
  loginLog: LoginAttempt[]
}

export interface KvPingResult {
  ok: boolean
  latencyMs: number
}

export interface RebuildIndexResult {
  recordIndexed: number
  shortIndexed: number
  recordRepaired: number
  shortRepaired: number
}

export interface BatchOperationResult {
  succeeded: string[]
  failed: string[]
}

export interface ShortenResult {
  shortUrl: string
  provider: string
  created?: boolean
  updated?: boolean
  reused?: boolean
  id?: string
}

export interface InspectSubscriptionResult {
  subscription: {
    name: string
    upload: string
    download: string
    total: string
    expire: string
    homepage: string
    updateInterval?: number
  }
  nodeCount: number
  protocolCounts: Record<string, number>
  regionCounts: Array<{ code: string; flag: string; name: string; count: number }>
  sampleNodes: Array<{ name: string; type: string; server: string; port: number }>
  durationMs: number
}

export interface ApiErrorPayload {
  success: false
  error: {
    code: string
    message: string
    severity: string
    statusCode: number
    timestamp: string
    requestId?: string
    metadata?: Record<string, unknown>
  }
}
