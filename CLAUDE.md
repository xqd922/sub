# 项目说明

代理订阅转换工具，基于 Next.js 构建，部署到 Cloudflare Pages。用户输入代理订阅链接，解析为统一节点格式，输出 Clash / Sing-box 等客户端配置。

## 技术栈

- Next.js 16 (App Router) + TypeScript 5.9 + React 19
- Tailwind CSS 4 + Arco Design UI 组件库
- Bun 1.3 作为包管理器和运行时
- Cloudflare Pages (open-next) 部署，Cloudflare KV 存储短链接和数据

## 目录结构

```
app/                 Next.js App Router
  api/               API 路由 (全部 Edge Runtime)
    admin/           管理后台接口 (login, records, shortlinks, stats)
    shorten/         短链接生成接口
  components/        前端组件
  hooks/             自定义 Hooks
  page.tsx           首页
  layout.tsx         布局
  sub/               订阅管理页面
  s/                 短链接跳转页面

features/            业务逻辑层
  convert/           转换流程 (builder, handler, processor)
  shorten/           短链接服务
  metrics/           网络指标
  index.ts           统一导出

lib/                 核心库
  parse/             解析器
    protocols/       协议解析器 (每个文件一个协议，见下方"支持的协议")
    node.ts          节点数据结构定义
    remote.ts        远程订阅获取
    subscription.ts  订阅解析调度
  config/            配置生成
  kv/                Cloudflare KV 存储封装
  net/               网络请求工具
  auth/              鉴权逻辑
  error/             错误处理 (AppError)
  format/            格式化工具
  service/           服务层
  shorten/           短链接核心逻辑
  core/              通用工具

config/              客户端配置生成器
  clash.ts           Clash 配置输出
  singbox.ts         Sing-box 配置输出

styles/              预览 HTML 样式
backend/             后端辅助代码 (convert, renderers, runtime, utils)
tests/               测试文件
```

## 开发约定

- **纯函数优先**: 使用函数 + 模块导出，不要用 class + static method 模式
- **Edge Runtime**: 所有 `app/api/` 下的路由必须使用 Edge Runtime
- **协议解析器接口**: `lib/parse/protocols/` 下每个协议文件导出统一接口:
  - `parse(uri)` - 解析 URI 为节点对象
  - `toUri(node)` - 节点对象转回 URI
  - `toSingboxOutbound(node)` - 节点对象转 Sing-box outbound 配置
- **错误处理**: 使用 `lib/error/errors.ts` 中的 `AppError` 类抛出业务错误
- **路径别名**: 使用 `@/*` 作为导入别名 (对应项目根目录)
- **UI 组件库**: 使用 Arco Design (`@arco-design/web-react`)
- **CSS**: Tailwind CSS 4，用 `@import "tailwindcss"` 引入 (v4 语法)

## 支持的协议

ss (Shadowsocks)、vmess、trojan、vless、hysteria2、socks、anytls

## 常用命令

```bash
bun run dev          # 开发服务器 (Turbopack)
bun run dev:fast     # 快速开发 (跳过 lint 和类型检查)
bun run build        # 生产构建
bun run build:cf     # 构建并生成 Cloudflare Pages 部署产物 (open-next)
bun run lint         # ESLint 检查
```

## 部署

通过 `@cloudflare/next-on-pages` (open-next) 构建后部署到 Cloudflare Pages。KV 命名空间绑定在 Cloudflare Dashboard 中配置。
