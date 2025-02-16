# 开发文档

## 项目结构

```
src/
├── app/                    # Next.js 应用主目录
│   ├── sub/               # 订阅转换核心功能
│   ├── api/               # API 路由
│   └── components/        # React 组件
├── config/                 # 配置文件
└── lib/                   # 工具库
```

## 核心功能流程

### 1. 订阅转换流程 (`src/app/sub/route.ts`)

1. **请求处理**
   - 接收订阅 URL
   - 验证 URL 有效性
   - 设置请求头

2. **订阅获取**
   - 发送 HTTP 请求
   - 处理响应头信息
   - 解析订阅信息（流量/到期时间）

3. **节点处理**
   - 解析原始节点 (`parsers.ts`)
   - 节点去重
   - 过滤信息节点
   - 格式化节点名称

4. **配置生成**
   - 加载默认配置 (`clash.ts`)
   - 生成代理组
   - 转换为 YAML

### 2. 节点解析器 (`src/lib/parsers.ts`)

1. **协议支持**
   - SS
   - VMess
   - Trojan
   - Hysteria2
   - VLESS
   - Clash 原生配置

2. **解析流程**
   - Base64 解码
   - 协议识别
   - 参数提取
   - 节点验证

3. **节点去重逻辑**
   - 使用 Map 存储
   - 基于多个字段生成唯一标识
   - 保留最后一个重复节点

### 3. 配置管理 (`src/config/`)

1. **Clash 配置 (`clash.ts`)**
   - 默认配置项
   - DNS 设置
   - 代理组生成
   - 分流规则

2. **地区配置 (`regions.ts`)**
   - 地区映射
   - 国旗表情
   - 命名规范化

### 4. 短链接服务 (`src/app/api/shorten/`)

1. **主要功能**
   - 生成短链接
   - 清理过期链接
   - 多平台支持

2. **支持平台**
   - Bitly
   - TinyURL
   - 自定义实现

## 类型系统 (`src/lib/types.ts`)

1. **代理类型**
```typescript
interface Proxy {
  name: string
  type: string
  server: string
  port: number
  // ... 其他字段
}
```

2. **配置类型**
```typescript
interface ClashConfig {
  'mixed-port': number
  'allow-lan': boolean
  // ... 其他配置项
}
```

## 前端界面

1. **首页组件 (`HomeContent.tsx`)**
   - 订阅输入框
   - 转换按钮
   - 结果展示
   - 错误处理

2. **布局和样式**
   - 响应式设计
   - 主题定制
   - 错误提示

## 错误处理

1. **错误类型**
   - 订阅获取失败
   - 解析错误
   - 配置生成错误

2. **错误响应**
   - 状态码
   - 错误信息
   - 用户友好提示

## 日志系统

1. **日志类型**
   - 订阅信息
   - 节点统计
   - 处理详情
   - 错误记录

2. **输出格式**
   - 结构化输出
   - 美化展示
   - 详细统计

## 性能优化

1. **节点处理**
   - 并发请求
   - 缓存机制
   - 去重优化

2. **配置生成**
   - 按需生成
   - 缓存策略
   - 压缩优化

## 部署说明

1. **环境要求**
   - Node.js 18+
   - npm/yarn
   - 可选: Docker

2. **部署选项**
   - Vercel
   - Docker
   - 传统服务器

## 开发规范

1. **代码风格**
   - TypeScript 严格模式
   - ESLint 配置
   - 注释规范

2. **Git 工作流**
   - 分支管理
   - 提交规范
   - 版本控制

## 详细架构说明

### 1. 核心模块

#### 1.1 订阅转换模块 (`src/app/sub/route.ts`)

**功能职责**：
- 处理订阅转换请求
- 管理节点处理流程
- 生成 Clash 配置

**详细流程**：
1. **URL 处理**
   ```typescript
   const { searchParams } = new URL(request.url)
   const url = searchParams.get('url')
   ```
   - 验证 URL 格式
   - 添加必要的查询参数
   - 处理特殊字符编码

2. **订阅信息获取**
   ```typescript
   const response = await fetch(url, {
     headers: {
       'User-Agent': 'ClashX/1.95.1'
     }
   })
   ```
   - 自定义 User-Agent
   - 错误重试机制
   - 超时处理

3. **订阅信息解析**
   ```typescript
   const subscription = {
     name: subName,
     upload: userInfo.match(/upload=(\d+)/)?.[1],
     download: userInfo.match(/download=(\d+)/)?.[1],
     total: userInfo.match(/total=(\d+)/)?.[1],
     expire: userInfo.match(/expire=(\d+)/)?.[1]
   }
   ```
   - 解析订阅名称
   - 提取流量信息
   - 获取到期时间

4. **节点处理流程**
   ```typescript
   const proxies = await parseSubscription(url)
   const formattedProxies = proxies.map(formatProxyName)
   ```
   - 调用解析器
   - 格式化节点名称
   - 节点去重处理

5. **配置生成**
   ```typescript
   const clashConfig = {
     ...defaultConfig,
     proxies: formattedProxies,
     'proxy-groups': generateProxyGroups(formattedProxies)
   }
   ```
   - 合并默认配置
   - 生成代理组
   - 添加规则

#### 1.2 节点解析器 (`src/lib/parsers.ts`)

**功能职责**：
- 解析不同协议的节点
- 处理节点去重
- 提供统计信息

**协议支持详情**：

1. **SS 协议**
   ```typescript
   function parseSS(line: string): Proxy {
     const url = new URL(line)
     const [method, password] = atob(url.username).split(':')
     return {
       type: 'ss',
       name: decodeURIComponent(url.hash.slice(1)),
       server: url.hostname,
       port: parseInt(url.port),
       cipher: method,
       password: password
     }
   }
   ```

2. **VMess 协议**
   ```typescript
   function parseVmess(line: string): Proxy {
     const config = JSON.parse(atob(line.slice(8)))
     return {
       type: 'vmess',
       name: config.ps,
       server: config.add,
       port: parseInt(config.port),
       uuid: config.id,
       alterId: parseInt(config.aid),
       cipher: config.scy || 'auto',
       network: config.net,
       // ... 其他配置
     }
   }
   ```

3. **Trojan 协议**
   ```typescript
   function parseTrojan(line: string): Proxy {
     const url = new URL(line)
     return {
       type: 'trojan',
       name: decodeURIComponent(url.hash.slice(1)),
       server: url.hostname,
       port: parseInt(url.port),
       password: url.username,
       // ... 其他配置
     }
   }
   ```

**节点去重逻辑**：
```typescript
function removeDuplicates(proxies: Proxy[]): Proxy[] {
  const seen = new Map<string, Proxy>()
  
  proxies.forEach(proxy => {
    const key = generateKey(proxy)
    seen.set(key, proxy)
  })
  
  return Array.from(seen.values())
}

function generateKey(proxy: Proxy): string {
  const base = `${proxy.type}:${proxy.server}:${proxy.port}`
  
  switch (proxy.type) {
    case 'vmess':
      return `${base}:${proxy.uuid}:${proxy.network}`
    case 'ss':
      return `${base}:${proxy.cipher}:${proxy.password}`
    // ... 其他协议
  }
}
```

#### 1.3 配置管理 (`src/config/`)

##### 1.3.1 Clash 配置 (`clash.ts`)

**默认配置**：
```typescript
export const defaultConfig: ClashConfig = {
  'mixed-port': 7890,
  'allow-lan': true,
  mode: 'rule',
  'log-level': 'info',
  dns: {
    enable: true,
    nameserver: [
      'https://doh.pub/dns-query',
      'https://dns.alidns.com/dns-query'
    ],
    fallback: [
      'https://doh.dns.sb/dns-query',
      'https://dns.cloudflare.com/dns-query'
    ]
  }
}
```

**代理组生成**：
```typescript
export function generateProxyGroups(proxies: Proxy[]) {
  return [
    {
      name: 'Auto',
      type: 'url-test',
      proxies: proxies.map(p => p.name),
      url: 'http://www.gstatic.com/generate_204',
      interval: 300
    },
    {
      name: 'Manual',
      type: 'select',
      proxies: ['Auto', 'DIRECT', ...proxies.map(p => p.name)]
    },
    // ... 其他代理组
  ]
}
```

##### 1.3.2 地区配置 (`regions.ts`)

**地区映射**：
```typescript
export const REGION_MAP = {
  // 东亚地区
  '香港': { flag: '🇭🇰', name: '香港' },
  'HK': { flag: '🇭🇰', name: '香港' },
  // ... 其他地区
}
```

**命名格式化**：
```typescript
function formatProxyName(proxy: Proxy): string {
  const region = detectRegion(proxy.name)
  const multiplier = extractMultiplier(proxy.name)
  return `${region.flag} ${region.name} ${getNumber()} ${multiplier}`
}
```

### 2. 辅助功能

#### 2.1 短链接服务

**主要功能**：
```typescript
async function generateShortLink(url: string): Promise<string> {
  // 选择合适的短链接服务
  const service = selectService()
  
  // 生成短链接
  const shortUrl = await service.shorten(url)
  
  // 保存记录
  await saveRecord(url, shortUrl)
  
  return shortUrl
}
```

**清理机制**：
```typescript
async function cleanExpiredLinks(): Promise<void> {
  const expiredDate = new Date()
  expiredDate.setDate(expiredDate.getDate() - 7)
  
  await db.links.deleteMany({
    createdAt: { $lt: expiredDate }
  })
}
```

### 3. 性能优化

#### 3.1 缓存策略

```typescript
const cache = new Map<string, {
  data: any,
  timestamp: number
}>()

function getCached(key: string, ttl: number): any {
  const cached = cache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > ttl) {
    cache.delete(key)
    return null
  }
  
  return cached.data
}
```

#### 3.2 并发处理

```typescript
async function processBatch(urls: string[]) {
  const batchSize = 5
  const results = []
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const promises = batch.map(url => fetch(url))
    results.push(...await Promise.all(promises))
  }
  
  return results
}
```

### 4. 错误处理

#### 4.1 错误类型

```typescript
class SubscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'SubscriptionError'
  }
}
```

#### 4.2 错误响应

```typescript
function handleError(error: unknown) {
  if (error instanceof SubscriptionError) {
    return {
      error: true,
      code: error.code,
      message: error.message,
      status: error.status
    }
  }
  
  return {
    error: true,
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred'
  }
}
```

### 5. 日志系统

#### 5.1 日志格式

```typescript
interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  category: string
  message: string
  details?: Record<string, any>
}

function log(entry: LogEntry) {
  const formatted = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.category}] ${entry.message}`
  console.log(formatted)
  
  if (entry.details) {
    console.log(JSON.stringify(entry.details, null, 2))
  }
}
```

### 6. 测试策略

#### 6.1 单元测试

```typescript
describe('Proxy Parser', () => {
  test('should parse SS links correctly', () => {
    const link = 'ss://...'
    const result = parseSS(link)
    expect(result).toMatchObject({
      type: 'ss',
      server: expect.any(String),
      port: expect.any(Number)
    })
  })
})
```

#### 6.2 集成测试

```typescript
describe('Subscription Conversion', () => {
  test('should convert subscription to clash config', async () => {
    const url = 'https://example.com/sub'
    const result = await convertSubscription(url)
    expect(result).toHaveProperty('proxies')
    expect(result).toHaveProperty('proxy-groups')
  })
})
```

### 7. 部署配置

#### 7.1 Docker 配置

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 7.2 环境变量

```env
# 基础配置
PORT=3000
NODE_ENV=production

# API 密钥
BITLY_API_KEY=your_key_here
TINYURL_API_KEY=your_key_here

# 缓存配置
CACHE_TTL=3600
MAX_CACHE_SIZE=1000

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json 