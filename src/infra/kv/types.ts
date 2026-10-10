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

export interface RecordIndex {
  ids: string[]           
  updatedAt: number       
}

export interface StatsData {
  totalRecords: number    
  totalHits: number       
  todayHits: number       
  activeRecords: number   
}

export interface DailyStats {
  date: string            
  totalHits: number       
  uniqueUrls: number      
}

export const KV_PREFIX = {
  RECORD: 'record:',      
  INDEX: 'index:records', 
  STATS: 'stats:global',  
  DAILY: 'stats:daily:',  
  SHORT: 'short:',        
} as const