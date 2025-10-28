# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

- `bun dev` - 在端口 3000 启动开发服务器（已启用 Turbopack）
- `bun dev:fast` - 极速开发模式（跳过 lint 和类型检查）
- `bun run build` - 构建生产版本
- `bun start` - 在端口 3000 启动生产服务器
- `bun run lint` - 运行 ESLint 进行代码质量检查

## 运行时配置

**重要**：所有 API 路由使用 Edge 运行时 (`export const runtime = 'edge'`)，这是为了兼容 Cloudflare Pages 部署。Edge 运行时支持全球边缘部署，提供更快的响应速度和更好的可扩展性。

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
- **智能 User-Agent 策略**: 根据客户端类型发送对应的真实 User-Agent，未知客户端时启用容灾轮换
- **代码分割**: 组件级别的懒加载和动态导入

### 智能 User-Agent 策略

网络请求采用智能的 User-Agent 策略，提高订阅获取的成功率：

**基本原则**:
- **真实性优先**: 根据实际客户端发送对应的 User-Agent（如 Clash 客户端请求就用 Clash 的 User-Agent）
- **容灾轮换**: 对于未知客户端或远程节点获取，使用预设的真实客户端标识进行轮换

**容灾 User-Agent 池**:
- `clash.meta/v1.19.13` - Clash Meta 客户端
- `mihomo/v1.18.5` - Mihomo 客户端

**应用场景**:
- **订阅转换**: 使用客户端真实 User-Agent，提高兼容性和成功率
- **远程节点获取**: 启用容灾轮换，避免被服务器屏蔽
- **重试机制**: 失败时轮换不同的客户端标识，增强容错能力

这样当你的订阅转换服务请求外部订阅链接时，会优先使用真实的客户端标识，让目标服务器认为请求来自合法的代理客户端，而不是网页应用。

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
- 支持 Cloudflare Pages 和 Vercel 部署
- 使用 Edge Runtime 实现全球边缘部署
- 支持静态生成和服务器渲染的混合模式

## Cloudflare Pages 部署

### 前置准备
项目使用 `@cloudflare/next-on-pages` 适配器将 Next.js 应用转换为 Cloudflare Pages 兼容格式。

### 部署步骤
1. 连接 GitHub 仓库到 Cloudflare Pages
2. 配置构建设置：
   - 框架预设：`Next.js`
   - 构建命令：`bun run build && bun run pages:build`
   - 构建输出目录：`.vercel/output/static`
   - 环境变量（必须）：
     - `NODE_VERSION=18`
     - `BUN_VERSION=latest`
3. 部署完成后自动生成预览和生产环境 URL

### 本地测试 Cloudflare 构建
```bash
# 安装依赖
bun install

# 构建 Next.js
bun run build

# 构建 Cloudflare Pages 版本
bun run pages:build
```

### 环境变量（可选）
- 在 Cloudflare Pages 设置中添加所需的环境变量
- 支持生产和预览环境的独立配置

### 注意事项
- 所有 API 路由必须使用 `export const runtime = 'edge'`
- Edge Runtime 不支持 Node.js 特定的 API（如 fs、path 等）
- 静态资源会自动部署到 Cloudflare CDN
- 必须使用 Bun 作为包管理器和运行时