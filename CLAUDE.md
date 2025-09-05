# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

- `bun dev` - 在端口 3000 启动开发服务器
- `bun run build` - 构建生产版本
- `bun start` - 在端口 3000 启动生产服务器
- `bun run lint` - 运行 ESLint 进行代码质量检查

## 运行时配置

**重要**：订阅转换 API 路由 (`/sub`) 使用 Node.js 运行时 (`export const runtime = 'nodejs'`) 而不是 Edge 运行时。这对于 Vercel 部署兼容性至关重要，因为 Edge 运行时在网络请求方面有限制，会在获取外部订阅 URL 时导致"内部错误"问题。

## 项目概述

### 核心功能
这是一个完整的订阅转换网页应用，提供用户友好的界面来转换代理订阅链接。应用将订阅链接转换为适用于不同客户端（Clash、Sing-box）的标准化配置，同时提供短链接生成功能。

## 架构设计

### 服务层架构 (src/services/)
项目采用分层服务架构，将业务逻辑从路由层分离：

- **RequestHandlerService** - 主请求协调器
  - 整合所有子服务
  - 处理请求生命周期（验证 → 缓存检查 → 处理 → 响应）
  - 统一错误处理和日志记录

- **SubscriptionService** - 订阅处理核心
  - 支持三种输入类型：标准订阅URL、单节点链接、GitHub Gist
  - 客户端类型自动检测（Clash/Sing-box/Browser）
  - 集成重试机制和User-Agent轮换

- **ConfigGeneratorService** - 配置文件生成
  - 支持Clash YAML、Sing-box JSON、浏览器预览HTML
  - 响应头管理和内容格式化
  - 节点名称格式化逻辑

- **CacheService** - 缓存管理
  - 分层缓存策略（浏览器2分钟，客户端5分钟）
  - 基于URL和客户端类型的缓存键生成
  - 自动清理和统计功能

### 错误处理系统 (src/lib/errors.ts, error-reporter.ts)
统一的错误处理架构：

- **AppError类** - 结构化错误信息，包含错误码、严重级别、请求ID
- **ErrorFactory** - 便捷的错误创建方法
- **ErrorReporter** - 自动错误收集、上报和监控
- **GlobalErrorBoundary** - React错误边界组件

### 关键组件

**前端界面** (`src/app/components/`):
- `HomeContent.tsx` - 主UI组件，使用自定义hooks
- `ui/` - 可复用UI组件（按钮、输入框、错误显示等）
- `ErrorBoundary.tsx` - 全局错误捕获和用户友好错误界面

**API 路由** (`src/app/api/`):
- `/sub` - 订阅转换端点，现已重构为使用服务层架构
- `/api/shorten/` - 短链接服务（多个提供商：Bitly、TinyURL、Sink等）

**配置生成器** (`src/config/`):
- `clash.ts` - 生成带有代理组和规则的 Clash YAML 配置
- `singbox.ts` - 生成 Sing-box JSON 配置  
- `regions.ts` - 包含旗帜和国家代码的全面区域映射

**解析器和处理器** (`src/lib/`):
- `parsers.ts` - 主要的订阅解析器，具有备用 User-Agent 轮换
- `singleNode.ts` - 单节点链接解析器（ss://、vmess://、trojan:// 等）
- `remoteNodes.ts` - GitHub Gist 节点获取器
- `types.ts` - 所有代理协议的完整 TypeScript 定义
- `cache.ts` - 内存缓存实现
- `logger.ts` - 智能日志系统（生产环境只输出警告和错误）

### 用户界面功能

**组件化架构**:
- 使用自定义React hooks分离业务逻辑
- UI组件按功能模块化（`useUrlConverter`, `useShortUrl`, `useToast`, `useClipboard`）
- 支持现代剪贴板API和传统回退
- 统一的错误显示和加载状态管理

**用户流程**:
1. 用户输入订阅链接
2. 点击"转换"按钮生成新的订阅链接
3. 自动复制转换后的链接到剪贴板
4. 可选择生成短链接以便分享
5. 支持一键复制任意链接

### 技术架构

**前端技术栈**:
- Next.js 15 (App Router)
- React 19 (客户端组件)
- TypeScript (严格类型检查)
- Tailwind CSS (响应式设计和深色模式)
- 动态导入和 SSR 优化

**后端处理流程**:
1. **请求验证**：URL格式验证和客户端类型检测
2. **缓存检查**：基于URL和客户端类型的智能缓存
3. **订阅处理**：多策略解析（标准订阅/单节点/Gist）
4. **配置生成**：根据客户端类型生成相应格式
5. **响应缓存**：分层缓存策略优化性能

### 性能优化特性

- **智能缓存**: 内存缓存系统，支持TTL和自动清理
- **组件化**: 前端组件拆分，提高代码复用性
- **服务层**: 业务逻辑分层，便于测试和维护
- **错误边界**: 防止单点故障影响整体用户体验

### 区域处理系统

服务使用复杂的区域检测系统自动重命名代理节点：
- 识别多语言国家名称（中文、英文、国家代码）
- 分配适当的旗帜表情符号和标准化名称
- 维护顺序编号计数器（香港 01、香港 02 等）
- 保留倍率信息（1x、2x 速度指示器）

### 错误处理策略

**网络弹性**：
- 实现指数退避重试和多 User-Agent 轮换
- 每次尝试 30 秒超时，并进行适当清理
- 结构化错误日志，包含请求ID追踪
- 针对不同 HTTP 状态码的用户友好错误消息

**统一错误处理**：
- AppError类支持错误码、严重级别、元数据
- ErrorReporter自动收集和上报错误
- 全局React错误边界捕获前端异常
- 开发环境显示详细调试信息，生产环境显示友好提示

**User-Agent 轮换**：
使用真实的 Clash 客户端 User-Agent 绕过服务器检测：
- `clash.meta/v1.19.13`
- `ClashX/1.95.1`
- `Clash/1.18.0`
- `clash-verge/v1.3.8`
- `mihomo/v1.18.5`

### 支持的协议

**输入格式**：
- 订阅 URL（base64 编码或 YAML）
- 单节点链接（ss://、vmess://、trojan://、vless://、hysteria2://、hy2://）
- GitHub Gist URL（节点集合）

**输出格式**：
- Clash YAML 配置，包含代理组和路由规则
- Sing-box JSON 配置
- 浏览器预览，并排比较

### 环境变量

- `BITLY_TOKEN` - Bitly API 令牌，用于短链接生成
- `SINK_URL` - Sink 服务端点
- `SINK_TOKEN` - Sink 服务认证令牌
- `NODE_ENV` - 环境配置，影响日志级别和错误处理

## 部署说明

**部署配置**：代码库专为 Vercel 部署优化。Node.js 运行时的选择至关重要，因为 Edge 运行时在外部 API 调用订阅服务时会失败。

**智能客户端检测**：通过 User-Agent 头检测访问的客户端类型：
- Clash 客户端：返回 YAML 配置  
- Sing-box 客户端：返回 JSON 配置
- 浏览器：返回 HTML 预览页面（并排显示两种配置）

**前端用户体验优化**：
- 禁用 SSR 确保客户端功能正常
- 安全的剪贴板操作（现代 API + 传统回退）
- 响应式设计适配移动端和桌面端
- 优雅的加载状态和错误处理

## 代码质量

- **TypeScript严格模式**: 避免any类型，完整的类型定义
- **错误边界**: React组件级别的错误捕获
- **分层架构**: 服务层分离，便于测试和维护
- **统一日志**: 智能日志系统，生产环境优化
- **缓存策略**: 多层缓存，自动清理和统计