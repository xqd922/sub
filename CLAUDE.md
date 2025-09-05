# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

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

### 关键组件

**前端界面** (`src/app/`):
- `page.tsx` - 主页面，动态导入主组件（禁用SSR）
- `layout.tsx` - 应用布局，设置中文语言和元数据
- `components/HomeContent.tsx` - 主要的React组件，包含完整的UI逻辑

**API 路由** (`src/app/api/`):
- `/sub` - 订阅转换端点，支持多种输入格式，自动检测客户端类型
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

### 用户界面功能

**主要特性**:
- 现代化响应式设计，支持深色模式
- 渐变背景和毛玻璃效果
- 输入验证和错误处理
- 自动复制功能（支持现代和传统剪贴板API）
- 加载状态和进度指示器
- Toast 通知系统

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
- TypeScript
- Tailwind CSS (响应式设计和深色模式)
- 动态导入和 SSR 优化

**后端处理流程**:

1. **输入检测**：识别订阅类型（URL、单节点或 Gist 链接）
2. **重试获取**：使用多个 User-Agent 字符串绕过反机器人措施
3. **解析**：支持 base64 编码内容、YAML 配置和单节点链接
4. **节点处理**：提取区域信息、去除重复、处理协议特定选项
5. **输出生成**：创建客户端特定配置（Clash YAML 或 Sing-box JSON）

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
- 详细的错误日志，包括错误类型和堆栈跟踪
- 针对不同 HTTP 状态码的用户友好错误消息

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