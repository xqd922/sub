# API 文档

## 概览

通用订阅转换 API 提供了强大的订阅链接转换功能，支持多种代理协议和客户端格式。

## 基础信息

- **Base URL**: `https://sub.xqd.pp.ua`
- **API Version**: `v1`
- **Content-Type**: `application/json` 或根据客户端返回对应格式

## 核心端点

### 订阅转换

#### `GET /sub`

将订阅链接转换为指定客户端格式。

**请求参数**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `url` | string | ✅ | 订阅链接或节点链接 |

**请求头**

| 头部 | 描述 | 示例 |
|------|------|------|
| `User-Agent` | 客户端标识，用于自动检测返回格式 | `clash.meta/v1.19.13` |

**响应格式**

根据 User-Agent 自动返回对应格式：

- **Clash 客户端**: YAML 格式配置
- **Sing-box 客户端**: JSON 格式配置
- **浏览器**: HTML 预览页面

**示例请求**

```bash
# Clash 客户端
curl -H "User-Agent: clash.meta/v1.19.13" \
  "https://sub.xqd.pp.ua/sub?url=https%3A%2F%2Fexample.com%2Fsubscription"

# Sing-box 客户端
curl -H "User-Agent: sing-box/1.0.0" \
  "https://sub.xqd.pp.ua/sub?url=ss%3A%2F%2FYWVzLTI1Ni1nY206cGFzc3dvcmQ%40server%3A8388"

# 浏览器访问
curl "https://sub.xqd.pp.ua/sub?url=https%3A%2F%2Fgist.githubusercontent.com%2Fuser%2Fid%2Fraw%2Ffile"
```

## 支持的输入格式

### 1. 标准订阅链接

支持 base64 编码和 YAML 格式的订阅链接。

```
https://example.com/subscription
https://raw.githubusercontent.com/user/repo/main/config.yaml
```

### 2. 单节点链接

支持多种代理协议的单节点链接：

#### Shadowsocks
```
ss://method:password@server:port#name
ss://base64encodedstring#name
```

#### VMess
```
vmess://base64encodedconfig
```

#### Trojan
```
trojan://password@server:port#name
```

#### VLESS
```
vless://uuid@server:port?encryption=none&security=tls#name
```

#### Hysteria2
```
hysteria2://password@server:port#name
hy2://password@server:port#name
```

### 3. GitHub Gist

支持从 GitHub Gist 获取节点列表：

```
https://gist.githubusercontent.com/user/gist-id/raw/file-name
```

## 客户端检测

API 通过 `User-Agent` 头部自动检测客户端类型：

### Clash 系列客户端

| User-Agent | 客户端 |
|------------|--------|
| `clash.meta/*` | Clash Meta |
| `ClashX/*` | ClashX |
| `Clash/*` | Clash |
| `clash-verge/*` | Clash Verge |
| `mihomo/*` | Mihomo |

### Sing-box 系列客户端

| User-Agent | 客户端 |
|------------|--------|
| `sing-box/*` | Sing-box |
| `SFI/*` | SFI |

### 浏览器

其他 User-Agent 将被识别为浏览器，返回 HTML 预览页面。

## 响应格式

### Clash YAML 格式

```yaml
proxies:
  - name: "节点名称"
    type: ss
    server: server.example.com
    port: 443
    cipher: aes-256-gcm
    password: password

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "节点名称"

rules:
  - MATCH,🚀 节点选择
```

### Sing-box JSON 格式

```json
{
  "outbounds": [
    {
      "type": "shadowsocks",
      "tag": "节点名称",
      "server": "server.example.com",
      "server_port": 443,
      "method": "aes-256-gcm",
      "password": "password"
    }
  ],
  "route": {
    "rules": [
      {
        "outbound": "节点名称"
      }
    ]
  }
}
```

### HTML 预览格式

返回包含 Clash 和 Sing-box 配置对比的 HTML 页面。

## 错误处理

### 错误响应格式

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "提供的 URL 格式无效",
    "details": "URL must be a valid HTTP/HTTPS link",
    "requestId": "req_123456789"
  }
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `MISSING_URL` | 400 | 缺少 url 参数 |
| `INVALID_URL` | 400 | URL 格式无效 |
| `FETCH_FAILED` | 502 | 无法获取订阅内容 |
| `PARSE_FAILED` | 422 | 订阅内容解析失败 |
| `NO_VALID_NODES` | 422 | 未找到有效节点 |
| `RATE_LIMITED` | 429 | 请求频率过高 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

## 其他 API 端点

### 短链接生成

#### `POST /api/shorten`

生成短链接服务。

**请求体**

```json
{
  "url": "https://very-long-subscription-url.com/path?params=values"
}
```

**响应**

```json
{
  "shortUrl": "https://short.ly/abc123",
  "originalUrl": "https://very-long-subscription-url.com/path?params=values",
  "expiresAt": "2025-01-01T00:00:00Z"
}
```

### 性能指标

#### `GET /api/metrics`

获取 API 性能统计信息。

**响应**

```json
{
  "requests": {
    "total": 12345,
    "success": 11234,
    "failed": 1111
  },
  "performance": {
    "avgResponseTime": 350,
    "p95ResponseTime": 800,
    "p99ResponseTime": 1200
  },
  "uptime": "99.9%"
}
```

### 网络统计

#### `GET /api/network/stats`

获取网络请求统计信息。

**响应**

```json
{
  "requests": {
    "total": 5432,
    "successful": 5123,
    "failed": 309
  },
  "domains": {
    "example.com": 1234,
    "github.com": 987
  },
  "responseTime": {
    "avg": 450,
    "min": 120,
    "max": 2300
  }
}
```

## 限制说明

### 请求频率

- **普通用户**: 每分钟 60 次请求
- **注册用户**: 每分钟 300 次请求 (未来功能)

### 订阅大小

- **最大文件大小**: 10MB
- **最大节点数量**: 1000 个
- **超时时间**: 30 秒

### 支持的协议版本

- **Shadowsocks**: SIP003 插件支持
- **VMess**: V2Ray 4.0+ 格式
- **Trojan**: Trojan-go 兼容
- **VLESS**: XTLS 支持
- **Hysteria2**: 最新版本协议

## SDK 和示例

### JavaScript/TypeScript

```typescript
interface ConvertOptions {
  url: string;
  userAgent?: string;
}

async function convertSubscription(options: ConvertOptions) {
  const response = await fetch('/sub?' + new URLSearchParams({
    url: options.url
  }), {
    headers: {
      'User-Agent': options.userAgent || 'clash.meta/v1.19.13'
    }
  });

  if (!response.ok) {
    throw new Error(`Conversion failed: ${response.status}`);
  }

  return response.text();
}
```

### Python

```python
import requests

def convert_subscription(url, user_agent='clash.meta/v1.19.13'):
    response = requests.get(
        'https://api.example.com/sub',
        params={'url': url},
        headers={'User-Agent': user_agent}
    )
    response.raise_for_status()
    return response.text
```

### Go

```go
package main

import (
    "fmt"
    "io"
    "net/http"
    "net/url"
)

func convertSubscription(subscriptionURL, userAgent string) (string, error) {
    client := &http.Client{}

    req, err := http.NewRequest("GET",
        "https://api.example.com/sub?url="+url.QueryEscape(subscriptionURL),
        nil)
    if err != nil {
        return "", err
    }

    req.Header.Set("User-Agent", userAgent)

    resp, err := client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    return string(body), err
}
```

## 最佳实践

### 1. 缓存策略

客户端应实现适当的缓存策略：

- **订阅更新频率**: 建议每 6-12 小时更新一次
- **缓存有效期**: 根据订阅服务商的更新频率设置
- **失败重试**: 实现指数退避重试机制

### 2. 错误处理

```typescript
async function robustConvert(url: string, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await convertSubscription({ url });
    } catch (error) {
      lastError = error;
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }

  throw lastError;
}
```

### 3. 用户代理轮换

为提高成功率，建议轮换使用不同的 User-Agent：

```typescript
const userAgents = [
  'clash.meta/v1.19.13',
  'ClashX/1.95.1',
  'Clash/1.18.0',
  'clash-verge/v1.3.8',
  'mihomo/v1.18.5'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
```

## 更新日志

### v1.0.0 (2025-01-01)
- 🎉 首次发布
- ✨ 支持 Clash 和 Sing-box 格式转换
- 🤖 智能客户端检测
- 🔗 短链接生成
- 📊 性能监控

---

如有疑问或建议，请访问 [GitHub Issues](https://github.com/xqd922/sub/issues)。