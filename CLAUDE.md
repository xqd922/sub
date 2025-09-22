# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

- `bun dev` - 在端口 3000 启动开发服务器（已启用 Turbopack）
- `bun dev:fast` - 极速开发模式（跳过 lint 和类型检查）
- `bun run build` - 构建生产版本
- `bun start` - 在端口 3000 启动生产服务器
- `bun run lint` - 运行 ESLint 进行代码质量检查

## 运行时配置

**重要**：订阅转换 API 路由 (`/sub`) 使用 Node.js 运行时 (`export const runtime = 'nodejs'`) 而不是 Edge 运行时。这对于 Vercel 部署兼容性至关重要，因为 Edge 运行时在网络请求方面有限制，会在获取外部订阅 URL 时导致"内部错误"问题。

## 项目概述

### 核心功能
这是一个完整的订阅转换网页应用，提供用户友好的界面来转换代理订阅链接。应用将订阅链接转换为适用于不同客户端（Clash、Sing-box）的标准化配置，同时提供短链接生成功能。

## 架构设计

### 项目结构
```
project/
├── app/            # Next.js App Router（路由和页面）
├── lib/            # 工具库（核心工具、解析器、格式化器）
├── features/       # 功能模块（业务逻辑）
├── config/         # 配置生成器
├── styles/         # 样式文件
└── public/         # 静态资源
```

### 功能模块架构 (features/)
项目采用功能模块化架构，业务逻辑集中在 `features/` 目录：

- **convert/** - 订阅转换核心
  - `handler.ts` - 请求处理器（CoreService）
  - `processor.ts` - 订阅处理器（SubService）
  - `builder.ts` - 配置构建器（ConfigService）

- **metrics/** - 监控和网络
  - `metrics.ts` - 性能监控（MetricsService）
  - `network.ts` - 网络请求服务（NetService）

- **shorten/** - 短链接服务
  - `shortener.ts` - 短链接生成（ShortService）

### 工具库架构 (lib/)
工具库按功能分层组织：

- **core/** - 核心基础设施
  - `types.ts` - 类型定义
  - `utils.ts` - 通用工具
  - `cache.ts` - 缓存管理
  - `logger.ts` - 日志系统

- **parse/** - 解析器
  - `node.ts` - 节点解析器
  - `subscription.ts` - 订阅解析器
  - `remote.ts` - 远程节点获取器
  - `protocols/` - 协议解析器目录

- **format/** - 格式化器
  - `node.ts` - 节点格式化
  - `region.ts` - 地区映射

- **error/** - 错误处理
  - `errors.ts` - 错误定义
  - `reporter.ts` - 错误报告器

### 请求处理流程

1. **API 入口**: `/sub` 路由接收请求
2. **请求协调**: `CoreService.handleRequest()` 统一处理
3. **订阅处理**: `SubService` 解析不同类型的订阅源
4. **配置生成**: `ConfigService` 根据客户端类型生成配置
5. **响应返回**: 智能检测客户端返回对应格式

### 客户端检测系统

应用通过 User-Agent 自动检测客户端类型：
- **Clash 客户端**: 返回 YAML 配置
- **Sing-box 客户端**: 返回 JSON 配置
- **浏览器访问**: 返回 HTML 预览页面（并排显示两种配置）

### 支持的输入格式

- 标准订阅 URL（base64 编码或 YAML）
- 单节点链接（ss://、vmess://、trojan://、vless://、hysteria2://、hy2://）
- GitHub Gist URL（节点集合）

### 错误处理系统

项目实现了统一的错误处理架构：
- **AppError 类**: 结构化错误信息，包含错误码、严重级别、请求 ID
- **ErrorReporter**: 自动错误收集、上报和监控
- **GlobalErrorBoundary**: React 错误边界组件，防止崩溃

### 性能优化特性

- **Turbopack**: 启用 Next.js 的下一代打包器
- **智能缓存**: 内存缓存系统，支持 TTL 和自动清理
- **User-Agent 轮换**: 使用真实 Clash 客户端 User-Agent 绕过服务器检测
- **代码分割**: 组件级别的懒加载和动态导入

### User-Agent 轮换策略

网络请求使用真实的 Clash 客户端 User-Agent 提高成功率：
- `clash.meta/v1.19.13`
- `ClashX/1.95.1`
- `Clash/1.18.0`
- `clash-verge/v1.3.8`
- `mihomo/v1.18.5`

## 重要注意事项

### 导入路径约定
- 使用 `@/` 作为根目录别名
- 功能模块通过 `@/features` 统一导出
- 工具库通过具体路径导入（如 `@/lib/core/types`）

### 开发环境配置
- TypeScript 严格模式在开发时放宽，生产时严格
- 禁用 React StrictMode 以提高开发体验
- 使用 Bun 作为包管理器，避免使用 npm

### 部署配置
- 专为 Vercel 部署优化
- 必须使用 Node.js 运行时处理订阅转换 API
- 支持静态生成和服务器渲染的混合模式