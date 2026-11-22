# 项目架构与开发指南

代理订阅转换与短链管理服务，基于 Next.js 16 (App Router) + TypeScript 5 + React 19 + Tailwind CSS 4 + BoardUI，通过 Cloudflare Pages Edge Runtime 与 Cloudflare KV 运行。

## 目录结构

```text
src/
├── app/                          Next.js App Router（公开 URL 保持稳定，零业务逻辑）
│   ├── page.tsx                  首页（/）
│   ├── admin/page.tsx            后台控制台（/admin）
│   ├── sub/route.ts              订阅转换入口（/sub）
│   ├── s/[id]/route.ts           短链跳转入口（/s/[id]）
│   └── api/
│       ├── shorten/route.ts      短链生成（POST / GET）
│       ├── s/[id]/route.ts       短链跳转 API 兼容入口
│       └── admin/                后台管理 API（login / logout / session / stats / records / short-links / system）
├── components/                   BoardUI 设计系统组件（base / application / foundations）
├── features/                     客户端功能模块（严禁导入 server/ 或 modules/）
│   ├── shared/                   components/ + hooks/（toaster / error-boundary / qr-code-modal）
│   ├── converter/                components/ + hooks/（首页转换器）
│   └── admin/                    admin.client.ts + components/ + hooks/（后台控制台）
├── modules/                      服务端领域模块（高内聚、严格单向依赖）
│   ├── proxy/
│   │   ├── proxy.types.ts        8 协议 Proxy 联合类型 + ProtocolCodec 接口 + SingboxOutbound
│   │   ├── proxy.registry.ts     协议统一注册表（解析 / 校验 / URI 序列化 / Sing-box 出站转换）
│   │   └── codecs/               shadowsocks / vmess / trojan / vless / hysteria2 / socks / anytls / snell + codec.utils.ts
│   ├── renderer/                 renderer.types.ts / client-detector.ts / clash.* / sing-box.* / v2ray.renderer.ts / preview.*
│   ├── subscription/             subscription.types.ts / region.catalog.ts / proxy-dedup.ts / proxy-namer.ts / subscription.parser.ts / remote-nodes.fetcher.ts / subscription.service.ts / response.builder.ts / conversion.handler.ts
│   ├── record/                   record.repository.ts / index-maintenance.service.ts
│   ├── short-link/               short-link.repository.ts / short-link.service.ts / short-link.handler.ts
│   └── admin-auth/               session.service.ts / rate-limit.service.ts / login-audit.repository.ts / admin.guard.ts
├── server/                       服务端基础设施（无业务逻辑）
│   ├── env.config.ts             全项目环境变量与默认配置唯一入口
│   ├── app-error.ts / error-handler.ts
│   ├── logger.ts                 生产环境自动脱敏日志
│   ├── fetch.client.ts / route.utils.ts
│   └── kv/                       kv.types.ts / kv.adapter.ts / kv.client.ts
├── shared/                       前后端共享纯模块（无服务端依赖）
│   ├── admin.types.ts            后台与 API 共享 DTO 类型
│   └── base64.utils.ts / url.utils.ts / format.utils.ts
├── styles/                       BoardUI CSS（globals.css / theme.css / typography.css）
└── utils/                        BoardUI 工具（cx.ts 等）

tests/                            Vitest 单元测试（按模块平铺，多文件域单独建子目录）
```

## 依赖方向约束（严禁倒挂或循环）

```text
shared/  ─────────────────────────────────────────────┐
   ▲                                                  │
server/  (env / error / logger / http / kv)           │
   ▲                                                  │
modules/                                              │
   ├── proxy/         (只依赖 shared + server/logger) │
   ├── renderer/      (只依赖 modules/proxy + shared) │
   ├── record/        (依赖 server/kv + shared)       │
   ├── short-link/    (依赖 server + shared)          │
   ├── admin-auth/    (依赖 server + shared)          │
   └── subscription/  (编排 proxy + renderer + record)│
   ▲                                                  │
app/  (只装配 modules/ 与 features/)                   │
                                                      │
components/ (BoardUI) ◄── features/ ◄─────────────────┘
(客户端目录禁止导入任何 server/ 或 modules/ 代码)
```

## 命名与编码约定

- **目录与文件**：一律 `kebab-case`，带明确角色后缀，避免多余的单文件嵌套目录：
  - `*.types.ts`、`*.codec.ts`、`*.registry.ts`、`*.renderer.ts`、`*.rules.ts`
  - `*.service.ts`、`*.repository.ts`、`*.handler.ts`、`*.guard.ts`、`*.adapter.ts`、`*.client.ts`
  - `*.config.ts`、`*.utils.ts`、`use-*.ts`、`*-panel.tsx`、`*-modal.tsx`、`*-card.tsx`
- **新增代理协议**：在 `src/modules/proxy/codecs/` 新增 `<name>.codec.ts`，并在 `src/modules/proxy/proxy.registry.ts` 的 `REGISTERED_CODECS` 注册即可自动同步前缀识别、解析、校验、序列化与 Sing-box 转换。
- **Edge 兼容**：禁止在业务代码中新增 Node `Buffer` 等非 Web 标准 API，统一使用 `@/shared/base64.utils`。
- **UI 规范**：严格遵守 `AGENTS.md` 中的 BoardUI 规则（仅使用语义色 Token、复合排版工具类、逻辑间距属性、`cx()` 与 `@remixicon/react`）。

## 常用命令

```bash
bun run dev          # 开发服务器
bun run test         # Vitest 单元测试
bun run lint         # ESLint 检查
bun run build        # 生产构建
bun run build:cf     # Cloudflare Pages 构建
```
