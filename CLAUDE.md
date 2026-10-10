# 项目说明

代理订阅转换工具，基于 Next.js 构建，部署到 Cloudflare Pages。用户输入代理订阅链接，解析为统一节点格式，输出 Clash / Sing-box 等客户端配置。

## 技术栈

- Next.js 16 (App Router) + TypeScript 5.9 + React 19
- Tailwind CSS 4
- Bun 1.3 作为包管理器和运行时
- Cloudflare Pages (open-next) 部署，Cloudflare KV 存储

## 目录结构（重构后）

```
src/                          全部源码
├── app/                      Next.js App Router（公开 URL 不变）
│   ├── api/                  API 路由（全部 Edge Runtime）
│   │   ├── sub/route.ts            订阅转换
│   │   ├── shorten/route.ts        短链接生成
│   │   ├── s/[id]/route.ts         短链跳转
│   │   └── admin/                  后台管理 API（login/logout/session/stats/records/short-links/system）
│   ├── sub/route.ts          订阅转换入口（/sub）
│   ├── s/[id]/route.ts       短链跳转入口（/s/[id]）
│   ├── page.tsx              首页（/）
│   ├── admin/page.tsx        后台管理面板（/admin）
│   ├── layout.tsx            根布局
│   ├── globals.css
│   └── favicon.ico
├── protocols/                协议解析器（SS/Vmess/Trojan/VLESS/Hysteria2/SOCKS/AnyTLS/Snell）
│   ├── shadowsocks.ts
│   ├── vmess.ts / trojan.ts / vless.ts / hysteria2.ts / socks.ts / anytls.ts / snell.ts
│   ├── types.ts              BaseProxy + 协议扩展类型
│   └── index.ts              分发器：parseProxyUri / proxyToUri / proxyToSingboxOutbound / generateBase64Subscription
├── templates/                客户端配置生成
│   ├── clash.ts              Clash YAML + generateClashConfig + generateProxyGroups
│   ├── sing-box.ts           Sing-box JSON
│   ├── preview.ts            预览 HTML 样式
│   └── types.ts              ClashConfig / SingboxProxyConfig 等
├── conversion/               订阅 → 配置转换流水线
│   ├── subscription.ts       processSubscription（Gist / 单节点 / 常规订阅）
│   ├── parse-subscription.ts 低层解析（含大小限制）
│   ├── remote-nodes.ts       Gist 远程节点合并 + 命名冲突处理
│   ├── proxy-format.ts       节点名称格式化（地区/国旗）
│   ├── proxy-dedup.ts        节点去重
│   ├── region.ts             地区检测 & 国旗 & 多城市国家映射
│   ├── response.ts           响应组装 + Content-Type / headers / 日志统计
│   └── handler.ts            /sub HTTP 编排：鉴权、日志、KV 记录、错误响应
├── links/
│   └── service.ts            多 provider 短链接生成
├── auth/
│   ├── password.ts           管理员 cookie session（HMAC，Web Crypto）
│   ├── session.ts            会话 token + cookie 序列化
│   ├── guard.ts              requireAdmin 守卫 + 登录限速
│   └── login-log.ts          登录审计（写 KV）
├── infra/                    基础设施（和业务解耦）
│   ├── logger.ts             日志（生产环境脱敏）
│   ├── error.ts              AppError + ErrorFactory
│   ├── error-reporter.ts     handleError / createErrorResponse
│   ├── network.ts            fetchWithRetry + UA 轮换 + 各类 fetch 封装
│   ├── utils.ts              parsePort / extractNameFromUrl / formatBytes
│   ├── client.ts             detectClientType（User-Agent → clash/singbox/v2rayng/browser）
│   ├── url-rules.ts          isProtocolUrl / isGistUrl / shouldFormatNodeNames
│   └── kv/
│       ├── adapter.ts        KVStoreAdapter 接口 + RemoteKVStore + LocalKVStore
│       ├── store.ts          getKV() 环境选择（开发用 LocalKV，CF Pages 用 LINKS_KV）
│       ├── operations.ts     底层读写 + 前缀扫描列举
│       ├── records.ts        转换记录 + 统计
│       ├── short_link.ts     短链接存储
│       ├── maintenance.ts    pingKV + rebuildIndexes
│       ├── types.ts          ConvertRecord / ShortLink / StatsData / DailyStats / KV_PREFIX
│       └── index.ts          barrel
└── components/               前端 UI（client components + hooks）
    ├── home.tsx / copy-button.tsx / url-input.tsx / short-link.tsx / toast.tsx / error-boundary.tsx / qr-code.tsx
    ├── admin-dashboard.tsx / admin-login.tsx / admin-stats.tsx / admin-records.tsx / admin-short-links.tsx / admin-system.tsx / admin-tools.tsx
    └── hooks（use-convert / use-short-link / use-toast / use-clipboard / use-admin-session / use-admin-data）

tests/
├── protocols/                协议解析测试（ss / vmess）
├── conversion/               dedup / region / response / subscription
├── infra/                    utils / kv-admin-flow
└── auth-session.test.ts      session cookie 序列化
```

## 依赖方向（严格单向，无循环）

```
infra/  ──logger/error/network/utils/client/url-rules──┐
                                                        │
protocols/  ──depends on infra.logger only─────────────┤
                                                        │
templates/  ──depends on protocols + infra─────────────┤
                                                        ▼
conversion/ ──组合 protocols + templates + infra───►  /sub handler
                                                        │
links/      ──infra.kv + infra.network─────────────────┤
                                                        │
auth/       ──infra.kv + infra.error + infra.logger────┤
                                                        │
components/ ──React UI，无后端依赖──────────────────────┘
                                                        │
app/        ──只调用 conversion / links / auth + Next.js route plumbing
```

## 命名规范（重构后统一）

- **文件名与目录**：全部 `kebab-case`（例如 `short-link.ts`、`admin-dashboard.tsx`、`use-admin-session.ts`），不再混进 `snake_case`/`PascalCase`。
- **目录**：全小写、单词完整或通用缩写；`kv/` 仍是公认缩写。
- **React 组件文件**：用 kebab-case，内部导出的函数名仍可用 PascalCase 以匹配 `<AdminDashboard />`。
- **函数**：camelCase 动词开头；**类型**：PascalCase。
- **路径别名**：`@/*` → `./src/*`。

## 开发约定

- **纯函数优先**：函数 + 模块导出，不用 class + static method。
- **Edge Runtime**：`src/app/api/**` 全部用 Edge Runtime。
- **协议解析器接口**（`src/protocols/*.ts`）：每个协议导出统一的三个函数
  - `parse(uri)` — 解析 URI 为 `Proxy`
  - `toUri(node)` — `Proxy` 转回 URI
  - `toSingboxOutbound(node)` — `Proxy` → Sing-box outbound 对象
- **类型跟着领域走**：每个模块导出自己的类型，只有 Proxy 体系和 ClientConfig 体系保留公共 `types.ts`。
- **错误路径**：所有领域错误用 `src/infra/error.ts` 的 `AppError`，HTTP 出口交给 `src/infra/error-reporter.ts`。
- **CSS**：Tailwind CSS 4，通过 `@import "tailwindcss"` 引入。

## 支持的协议

ss (Shadowsocks)、vmess、trojan、vless、hysteria2 (hy2)、socks、anytls、snell

## 常用命令

```bash
bun run dev          # 开发服务器 (Turbopack)
bun run build        # 生产构建
bun run build:cf     # 构建 Cloudflare Pages 部署产物
bun run test         # 运行测试
bun run lint         # ESLint 检查
```

## 部署

通过 open-next 构建后部署到 Cloudflare Pages。KV 命名空间（`LINKS_KV`）在 Cloudflare Dashboard 中配置。
