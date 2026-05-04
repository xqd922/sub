# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

- `bun dev` - 启动开发服务器（端口 3000，Turbopack）
- `bun dev:fast` - 极速开发模式（跳过 lint 和类型检查）
- `bun dev:cf` - 使用 OpenNext + Wrangler 本地模拟 Cloudflare Workers 环境
- `bun run build` - 构建生产版本
- `bun run cf:build` - 构建 Cloudflare Workers 版本（OpenNext）
- `bun run deploy:cf` - 构建并部署到 Cloudflare Workers
- `bun run build:cf` - `cf:build` 的兼容别名
- `bun start` - 启动生产服务器
- `bun run lint` - ESLint 检查

项目无测试框架，使用 `bun run build` 做类型检查验证。

## 关键约束

- **必须使用 Bun** 作为包管理器和运行时，不使用 npm
- **Cloudflare 目标运行时**：使用 OpenNext 部署到 Cloudflare Workers，路由默认使用 Next.js Node runtime
- **Workers Runtime 限制**：避免依赖不可用的 Node.js 系统能力（本项目不使用 fs/path 读写运行时文件）
- **导入路径**：使用 `@/` 根目录别名
- **UI 框架**：Arco Design React + Tailwind CSS v4
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

### 代码分层 (src/)

`app/` 只保留 Next.js 路由入口，实际实现按产品和运行职责放在 `src/`：

- **应用用例** (`src/application/`) - `CoreService`、`SubService`、`ConfigService` 和 `ShortService`，负责请求编排和业务流程。
- **领域规则** (`src/domain/`) - 代理类型、协议解析、订阅解析、节点去重、地区识别和节点命名规则。
- **基础设施** (`src/infrastructure/`) - Cloudflare KV、鉴权、网络请求、日志和错误上报。
- **展示输出** (`src/presentation/`) - Clash/Sing-box 配置生成和 HTML 预览样式。
- **界面层** (`src/ui/`) - 公共转换工作台、管理后台和共享品牌/错误边界组件。

### 客户端检测规则 (ConfigService.detectClientType)

- `sing-box|SFA|SFI|SFM|SFT` → Sing-box（返回 JSON）
- `v2rayn|v2rayng|quantumult|shadowrocket|surge|loon` → v2rayNG（返回 Base64）
- 其他非浏览器 UA → Clash（返回 YAML）
- 浏览器 → HTML 预览页面

### 解析层 (`src/domain/subscription/`)

- `subscription-parser.ts` - 订阅解析（YAML 和 Base64 两种格式）
- `node-parser.ts` - 单节点链接解析（`SingleNodeParser` 类）
- `remote-source.ts` - 从 Gist 获取远程节点
- `protocols/` - 协议解析器：shadowsocks、vmess、trojan、vless、hysteria2、socks、anytls

### 配置生成 (`src/presentation/config/`)

- `clash.ts` - Clash 配置，包含代理组生成逻辑（Manual/Auto/Emby/AI/HK/Min），规则提供者配置
- `singbox.ts` - Sing-box 配置，包含 DNS、入站（tun/socks/mixed）、出站和路由规则

`isAirportSubscription` 标志控制是否生成 Min（低延迟）代理组——仅对机场订阅生效。

### KV 存储层 (`src/infrastructure/storage/kv/`)

基于 Cloudflare KV 的持久化层，本地开发使用 mock：

- `client.ts` - KV 客户端，`getKV()` 自动检测环境
- `records.ts` - 转换记录服务（记录每次转换、统计数据）
- `shortlink.ts` - 短链接 CRUD
- `types.ts` - KV 键前缀和数据结构定义

### 管理后台

- 路由：`/admin`（前端）、`/api/admin/*`（API）
- 功能：查看/删除转换记录、管理短链接、查看统计
- 认证：Session token（SHA-256），Bearer token 验证（`src/infrastructure/auth/index.ts`）
- 页面入口在 `app/admin/page.tsx`，组件和 hooks 在 `src/ui/admin/`

### 网络策略 (NetService)

- 订阅获取：固定 `ClashX/1.95.1` UA
- 远程节点获取：轮换 `clash.meta/v1.19.13` 和 `mihomo/v1.18.5`
- 超时：订阅 30s、远程节点 15s、短链接 5s
- 重试：3 次，指数退避

### 节点处理特性

- **去重** (`src/domain/proxy/dedup.ts`)：按代理配置生成唯一键，过滤信息节点（含"官网""流量""到期"等关键词）和无效服务器（私有 IP、DNS 服务器）
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

主要部署目标为 **Cloudflare Workers**，使用 `@opennextjs/cloudflare` 适配器。
构建命令：`bun run cf:build`，输出目录：`.open-next/`。
部署命令：`bun run deploy:cf`。生产环境需要配置 `ADMIN_PASSWORD`，并绑定名为 `LINKS_KV` 的 Cloudflare KV 命名空间。
也支持 Vercel 直接部署。

