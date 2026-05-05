export interface ConvertRecord {
  id: string;
  originalUrl: string;
  name: string;
  clientType: string;
  createdAt: number;
  updatedAt: number;
  lastAccess: number;
  hits: number;
  nodeCount: number;
  lastIp: string;
}

export interface ShortLink {
  id: string;
  targetUrl: string;
  name: string;
  provider?: string;
  createdAt: number;
  hits: number;
  lastAccess: number;
}

export interface Stats {
  totalRecords: number;
  totalHits: number;
  todayHits: number;
  activeRecords: number;
}

export interface UnifiedItem {
  id: string;
  name: string;
  type: "convert" | "shortlink";
  url: string;
  hits: number;
  lastAccess: number;
  clientType?: string;
  nodeCount?: number;
}
