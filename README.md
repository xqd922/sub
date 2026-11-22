# 订阅转换（sub-next）

基于 Next.js 16 + Cloudflare Pages Edge Runtime 构建的代理订阅转换与短链管理平台。支持将订阅链接或单节点 URI 自动转换为 Clash / sing-box / v2rayNG 客户端配置，并提供浏览器预览与后台管理控制台。

## 架构与目录

```text
src/
├── app/                   # Next.js App Router（极薄页面壳 + Edge API 路由）
├── components/            # BoardUI 设计系统原语（base / application / foundations）
├── features/              # 按页面切片的客户端 UI 模块（严禁依赖 server / modules）
│   ├── shared/            # 跨页面共享 UI（toaster / error-boundary / qr-code-modal / hooks）
│   ├── converter/         # 首页订阅转换器
│   └── admin/             # 后台管理控制台（stats / records / short-links / tools / system）
├── modules/               # 高内聚服务端业务领域模块
│   ├── proxy/             # 代理协议模型 + 8 协议 Codec + 统一注册表
│   ├── renderer/          # Clash / sing-box / v2rayNG / Preview 配置渲染器与规则数据
│   ├── subscription/      # 订阅拉取、解析、去重、地区识别、节点命名与转换编排
│   ├── record/            # 转换记录、每日统计与 KV 索引维护
│   ├── short-link/        # 多 Provider 短链服务、KV 仓储与跳转处理
│   └── admin-auth/        # HMAC 会话、恒定时间密码校验、限速、登录审计与路由守卫
├── server/                # 平台基础设施（env 配置、错误、日志、HTTP、路由工具、KV 适配）
├── shared/                # 前后端共享纯类型（DTO）与无副作用工具（base64 / url / format）
├── styles/                # BoardUI 全局样式、主题色 Token 与排版系统
└── utils/                 # BoardUI 样式工具（cx 等）

tests/                     # Vitest 单元测试（严格镜像 src/ 结构）
```

## 快速开始

```bash
bun install
bun run dev       # 本地开发（Turbopack）
bun run test      # 单元测试（Vitest）
bun run lint      # ESLint 检查
bun run build     # Next.js 生产构建
bun run build:cf  # Cloudflare Pages 部署构建
```

## 开发规范

- **命名统一**：目录与文件一律使用 `kebab-case`，服务端与共享模块附带语义角色后缀（`*.codec.ts`、`*.renderer.ts`、`*.service.ts`、`*.repository.ts`、`*.handler.ts`、`*.guard.ts`、`*.types.ts`、`*.utils.ts`）。
- **单向依赖**：`shared → server → modules (proxy → renderer → subscription / record / short-link / admin-auth) → app`；客户端 `features` 仅允许依赖 `shared`、`components`、`utils`。
- **Edge 兼容**：所有 API 路由运行于 Edge Runtime，全链路使用 Web Standard API（`crypto.subtle`、`TextEncoder`、`btoa`/`atob`），避免依赖 Node 专属 API。
- **公开路由**：`/`、`/admin`、`/sub`、`/s/[id]`、`/api/s/[id]`、`/api/shorten`、`/api/admin/*`。

更多架构细节与领域约定见 [CLAUDE.md](./CLAUDE.md) 与 [CONTEXT.md](./CONTEXT.md)。
