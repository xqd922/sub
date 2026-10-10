# 订阅转换（sub-next）

输入代理订阅链接 → 输出 Clash / Sing-box / v2rayNG 配置 + 短链 + 预览页。

## 目录速览

```
src/
├── app/         Next.js App Router（公开路由保持原状）
├── protocols/   代理协议解析器，一个文件一个协议
├── templates/   Clash / Sing-box / 预览 HTML 的生成器
├── conversion/  订阅 → proxies → 输出配置的完整流水线
├── links/       短链接业务
├── auth/        管理员 session / 守卫 / 登录审计
├── infra/       logger · error · network · utils · client · url-rules · kv/
└── components/  React UI + 相关 hooks
tests/           测试用例（按 mirror src/ 分目录）
```

## 快速开始

```bash
bun install
bun run dev     # Turbopack 开发
bun run build   # 生产构建
bun run test    # 单元测试
bun run lint    # ESLint
```

## 开发规约

- 文件和目录统一 kebab-case
- 所有 API 路由使用 Edge Runtime（`export const runtime = 'edge'`）
- 依赖方向只允许 `infra → protocols → templates → conversion/links/auth/components → app`
- 公开 URL：`/sub`、`/api/shorten`、`/s/[id]`、`/api/admin/*`、`/admin`
- 测试文件：`tests/<layer>/<name>.test.ts`，目录结构与 `src/` 镜像

更详细说明请见 [CLAUDE.md](./CLAUDE.md) 与领域术语 [CONTEXT.md](./CONTEXT.md)。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
