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
    api/                      API 路由（全部 Edge Runtime）
      sub/route.ts            订阅转换
      shorten/route.ts        短链接生成
      s/[id]/route.ts         短链跳转
    page.tsx                  首页（/）
    layout.tsx                根布局
    globals.css
    favicon.ico
  node/                       节点：解析、序列化、去重、格式化
    proto/                    协议解析器（每个文件一个协议）
      shadowsocks.ts          SS 协议
      vmess.ts / trojan.ts / vless.ts / hysteria2.ts / socks.ts / anytls.ts / snell.ts
    node.ts                   分发器：parseProxyUri + proxyToUri + proxyToSingboxOutbound
    dedup.ts                  节点去重
    format.ts                 节点名称格式化
    region.ts                 地区检测 & 国旗
    types.ts                  BaseProxy + 协议扩展类型（SSProxy, VmessProxy 等）
    index.ts                  barrel：proxyToUri, proxiesToUris, generateBase64Subscription
  fetch/                      订阅获取与转换
    handler.ts                HTTP 入口，流程编排
    subscription.ts           订阅获取 + 解析 + 格式化
    response.ts               响应组装 + header 生成
    remote.ts                 Gist 远程节点获取
    parse_subscription.ts     远程订阅解析
  config/                     客户端配置生成
    clash.ts                  Clash YAML 配置 + generateClashConfig
    singbox.ts                Sing-box JSON 配置
    preview.ts                预览 HTML 样式
    types.ts                  ClashConfig, SingboxProxyConfig 等配置类型
  link/                       短链接
    service.ts                多 provider 短链接生成
  kv/                         KV 存储
    adapter.ts                KVStoreAdapter 接口 + RemoteKVStore + LocalKVStore
    store.ts                  getKV() 环境选择
    records.ts                转换记录
    short_link.ts             短链接存储
    types.ts                  KV 相关类型
    index.ts                  barrel
  network/                    网络
    client.ts                 fetchWithRetry + UA 轮换 + fetchSubscription
  error/                      错误处理
    errors.ts                 AppError 类
    reporter.ts               错误报告
  lib/                        通用工具
    logger.ts                 日志
    utils.ts                  纯工具函数
    protocol.ts               协议常量 & URL 判断
    client.ts                 客户端检测（detectClientType）
  ui/                         前端组件
    home.tsx / copy_button.tsx / url_input.tsx / short_link.tsx / toast.tsx / error_boundary.tsx
  hooks/                      前端 hooks
    use_convert.ts / use_short_link.ts / use_toast.ts / use_clipboard.ts
tests/                        测试文件
```

## 命名规范

- **目录**: 全小写，业务名词，完整单词（`config/` 不缩写，`kv/` 是标准缩写例外）
- **文件**: 多单词用下划线（`short_link.ts`），不用模糊词
- **函数**: camelCase，动词开头（`handleConvert`, `parseProxy`）
- **类型**: PascalCase（`ClashConfig`, `SSProxy`）
- **路径别名**: `@/` 映射到 `./src/`（如 `import { x } from '@/types'`）

## 开发约定

- **纯函数优先**: 使用函数 + 模块导出，不用 class + static method
- **Edge Runtime**: 所有 `src/app/api/` 下的路由使用 Edge Runtime
- **协议解析器接口**: `src/node/proto/` 下每个协议文件导出:
  - `parse(uri)` — 解析 URI 为节点对象
  - `toUri(node)` — 节点对象转回 URI
  - `toSingboxOutbound(node)` — 转 Sing-box outbound 配置
- **类型跟着领域走**: 不搞全局 types.ts，每个模块导出自己的类型
- **依赖方向**: `fetch/ → node/ → lib/`，无循环依赖
- **错误处理**: 使用 `src/error/errors.ts` 中的 `AppError` 类
- **CSS**: Tailwind CSS 4，用 `@import "tailwindcss"` 引入

## 支持的协议

ss (Shadowsocks)、vmess、trojan、vless、hysteria2、socks、anytls、snell

## 常用命令

```bash
bun run dev          # 开发服务器 (Turbopack)
bun run build        # 生产构建
bun run build:cf     # 构建 Cloudflare Pages 部署产物
bun run test         # 运行测试
bun run lint         # ESLint 检查
```

## 部署

通过 open-next 构建后部署到 Cloudflare Pages。KV 命名空间绑定在 Cloudflare Dashboard 中配置。
