# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

- `bun dev` - 启动开发服务器（端口 3000，Turbopack）
- `bun dev:fast` - 极速开发模式（跳过 lint 和类型检查）
- `bun dev:cf` - 使用 Wrangler 本地模拟 Cloudflare Pages 环境
- `bun run build` - 构建生产版本
- `bun run build:cf` - 构建 Cloudflare Pages 版本（build + pages:build）
- `bun start` - 启动生产服务器
- `bun run lint` - ESLint 检查

项目无测试框架，使用 `bun run build` 做类型检查验证。

## 关键约束

- **必须使用 Bun** 作为包管理器和运行时，不使用 npm
- **所有 API 路由必须声明** `export const runtime = 'edge'`（Cloudflare Pages 兼容）
- **Edge Runtime 限制**：不可使用 Node.js 专有 API（fs、path 等）
- **导入路径**：使用 `@/` 根目录别名
- **UI 框架**：HeroUI (v3 beta) + Tailwind CSS v4
- **React StrictMode 已禁用**（`next.config.ts` 中 `reactStrictMode: false`）

## 项目概述

订阅转换网页应用：将代理订阅链接转换为 Clash / Sing-box / v2rayNG 格式，提供管理后台和短链接服务。

## 架构概览

### 请求处理流程

```
请求 → app/sub/route.ts → CoreService.handleRequest()
  → 检测客户端类型（User-Agent）
  → SubService.processSubscription() 解析订阅源
  → ConfigService 生成对应格式配置
  → 返回响应（YAML / JSON / Base64 / HTML 预览）
```

### 服务层 (features/)

三个核心服务通过 `features/index.ts` 统一导出：

- **CoreService** (`convert/handler.ts`) - 请求协调器，检测客户端、调度订阅处理和配置生成、记录转换日志到 KV
- **SubService** (`convert/processor.ts`) - 订阅处理，解析三种输入（标准订阅 URL / 单节点链接 / Gist URL），节点名格式化（国旗+地区+编号）
- **ConfigService** (`convert/builder.ts`) - 配置生成，客户端检测逻辑在此。支持四种输出：Clash YAML、Sing-box JSON、v2rayNG Base64、浏览器 HTML 预览
- **NetService** (`metrics/network.ts`) - 网络层，封装重试、超时、User-Agent 轮换策略
- **ShortService** (`shorten/shortener.ts`) - 短链接生成，多 provider 降级（KV → TinyURL → Sink → Bitly）

### 客户端检测规则 (ConfigService.detectClientType)

- `sing-box|SFA|SFI|SFM|SFT` → Sing-box（返回 JSON）
- `v2rayn|v2rayng|quantumult|shadowrocket|surge|loon` → v2rayNG（返回 Base64）
- 其他非浏览器 UA → Clash（返回 YAML）
- 浏览器 → HTML 预览页面

### 解析层 (lib/parse/)

- `subscription.ts` - 订阅解析（YAML 和 Base64 两种格式）
- `node.ts` - 单节点链接解析（`SingleNodeParser` 类）
- `remote.ts` - 从 Gist 获取远程节点
- `protocols/` - 协议解析器：shadowsocks、vmess、trojan、vless、hysteria2、socks、anytls

### 配置生成 (config/)

- `clash.ts` - Clash 配置，包含代理组生成逻辑（Manual/Auto/Emby/AI/HK/Min），规则提供者配置
- `singbox.ts` - Sing-box 配置，包含 DNS、入站（tun/socks/mixed）、出站和路由规则

`isAirportSubscription` 标志控制是否生成 Min（低延迟）代理组——仅对机场订阅生效。

### KV 存储层 (lib/kv/)

基于 Cloudflare KV 的持久化层，本地开发使用 mock：

- `client.ts` - KV 客户端，`getKV()` 自动检测环境
- `records.ts` - 转换记录服务（记录每次转换、统计数据）
- `shortlink.ts` - 短链接 CRUD
- `types.ts` - KV 键前缀和数据结构定义

### 管理后台

- 路由：`/admin`（前端）、`/api/admin/*`（API）
- 功能：查看/删除转换记录、管理短链接、查看统计
- 认证：Session token（SHA-256），Bearer token 验证（`lib/auth/index.ts`）
- 组件在 `app/admin/components/`，hooks 在 `app/admin/hooks/`

### 网络策略 (NetService)

- 订阅获取：固定 `ClashX/1.95.1` UA
- 远程节点获取：轮换 `clash.meta/v1.19.13` 和 `mihomo/v1.18.5`
- 超时：订阅 30s、远程节点 15s、短链接 5s
- 重试：3 次，指数退避

### 节点处理特性

- **去重** (`lib/core/dedup.ts`)：按代理配置生成唯一键，过滤信息节点（含"官网""流量""到期"等关键词）和无效服务器（私有 IP、DNS 服务器）
- **名称格式化**：国旗检测 + 地区识别 + 城市检测（多城市国家如美国会显示城市名）+ 倍率提取（`[2x]`、`2×`、`倍率:2`）+ 编号
- **链式代理**：支持 `chain:`、`dialer-proxy:`（Clash）、`detour:`（Sing-box）

## API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/sub` | GET | 订阅转换（主端点） |
| `/api/shorten` | POST/GET | 短链接生成 |
| `/s/[id]` | GET | 短链接重定向 |
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/records` | GET | 转换记录列表 |
| `/api/admin/records/[id]` | GET/DELETE | 单条记录管理 |
| `/api/admin/shortlinks` | GET | 短链接列表 |
| `/api/admin/shortlinks/[id]` | DELETE | 删除短链接 |
| `/api/admin/stats` | GET | 统计数据 |

## 部署

主要部署目标为 **Cloudflare Pages**，使用 `@cloudflare/next-on-pages` 适配器。
构建命令：`bun run build && bun run pages:build`，输出目录：`.vercel/output/static`。
也支持 Vercel 直接部署。
