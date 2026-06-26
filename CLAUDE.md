# 项目说明

代理订阅转换工具，基于 Next.js 构建，部署到 Cloudflare Pages。用户输入代理订阅链接，解析为统一节点格式，输出 Clash / Sing-box 等客户端配置。

## 技术栈

- Next.js 16 (App Router) + TypeScript 5.9 + React 19
- Tailwind CSS 4
- Bun 1.3 作为包管理器和运行时
- Cloudflare Pages (open-next) 部署，Cloudflare KV 存储

## 目录结构

```
src/                          全部源码
  app/                        Next.js App Router
    (user)/                   用户页面路由组
      page.tsx                首页（/）
      home.tsx                首页主组件
      use_convert.ts          转换 hook（页面专属）
      use_short_link.ts       短链接 hook（页面专属）
    api/                      API 路由（全部 Edge Runtime）
      convert/route.ts        订阅转换
      shorten/route.ts        短链接生成
      s/[id]/route.ts         短链跳转
    layout.tsx                根布局
    globals.css
    favicon.ico
  parse/                      协议解析（每个文件一个协议，纯函数导出）
    index.ts                  barrel：proxy_to_uri, proxies_to_uris
    node.ts                   单节点解析入口
    remote.ts                 远程订阅获取
    subscription.ts           订阅内容解析
    shadowsocks.ts            SS 协议
    vmess.ts / trojan.ts / vless.ts / hysteria2.ts / socks.ts / anytls.ts
  config/                     客户端配置生成
    clash.ts                  Clash YAML 配置
    singbox.ts                Sing-box JSON 配置
  convert/                    订阅转换核心流程
    handler.ts                请求入口
    subscription.ts           订阅处理
    response.ts               响应生成
  shorten/service.ts          短链接服务
  kv/                         KV 存储
    store.ts                  底层 KV 操作
    records.ts                转换记录
    short_link.ts             短链接存储
  network/client.ts           HTTP 客户端（重试、UA 轮换）
  format/                     节点名称格式化
    proxy.ts                  代理节点名称标准化
    region.ts                 地区检测 & 国旗
  error/                      错误处理
    errors.ts                 AppError 类
    reporter.ts               错误报告
  components/                 共享 UI 组件
    error_boundary.tsx
    ui/                       基础 UI 组件
  hooks/                      共享 hooks
    use_clipboard.ts
    use_toast.ts
  types.ts                    全局共享类型
  logger.ts                   日志
  dedup.ts                    节点去重
  protocol.ts                 协议常量 & URL 判断
  preview.ts                  浏览器预览 HTML 样式
  utils.ts                    纯工具函数
tests/                        测试文件
```

## 命名规范

- **目录**: 全小写，业务名词，不用泛词（不用 `lib`, `core`, `features`）
- **文件**: 多单词用下划线（`short_link.ts`），不用模糊词（不用 `builder`, `processor`）
- **函数**: camelCase，动词开头（`handleConvert`, `parseProxy`）
- **类型**: PascalCase（`ClashConfig`, `ProxyGroup`）
- **路径别名**: `@/` 映射到 `./src/`（如 `import { x } from '@/types'`）

## 开发约定

- **纯函数优先**: 使用函数 + 模块导出，不用 class + static method
- **Edge Runtime**: 所有 `src/app/api/` 下的路由使用 Edge Runtime
- **协议解析器接口**: `src/parse/` 下每个协议文件导出:
  - `parse(uri)` — 解析 URI 为节点对象
  - `toUri(node)` — 节点对象转回 URI
  - `toSingboxOutbound(node)` — 转 Sing-box outbound 配置
- **错误处理**: 使用 `src/error/errors.ts` 中的 `AppError` 类
- **共享代码**: 组件、hooks 放 `src/` 下，页面专属代码放路由组内
- **CSS**: Tailwind CSS 4，用 `@import "tailwindcss"` 引入

## 支持的协议

ss (Shadowsocks)、vmess、trojan、vless、hysteria2、socks、anytls

## 常用命令

```bash
bun run dev          # 开发服务器 (Turbopack)
bun run dev:fast     # 快速开发 (跳过 lint 和类型检查)
bun run build        # 生产构建
bun run build:cf     # 构建 Cloudflare Pages 部署产物
bun run test         # 运行测试
bun run lint         # ESLint 检查
```

## 部署

通过 open-next 构建后部署到 Cloudflare Pages。KV 命名空间绑定在 Cloudflare Dashboard 中配置。
