# 通用订阅转换服务

这是一个现代化的订阅转换服务，支持多种代理协议的转换和短链接生成。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/your-repo-name&env=BITLY_TOKEN,SINK_URL,SINK_TOKEN)

## 一键部署

1. 点击上方的 "Deploy with Vercel" 按钮
2. 如果未登录，请先注册或登录 Vercel 账号
3. 点击 "Deploy" 开始部署
4. 等待部署完成后，即可访问你的服务

## 功能特点

- 🔄 订阅转换：支持多种代理协议的转换
- 🔗 短链接生成：支持多个短链接服务（Bitly、TinyURL、Sink）
- 🌍 多客户端支持：生成适用于 Clash 和 Sing-box 的配置
- 🌐 智能分流：基于地区的智能分流规则
- 🎨 现代化界面：响应式设计，支持深色模式
- 📋 便捷复制：一键复制功能，带有视觉反馈
- 🔒 安全可靠：完善的错误处理机制

## 技术栈

- **前端框架**: Next.js 15.1.6
- **UI框架**: React 19
- **样式**: TailwindCSS
- **语言**: TypeScript
- **API**: Next.js API Routes
- **包管理**: Bun

## 项目结构

```
src/
├── app/                    # Next.js应用主目录
│   ├── api/               # API路由
│   │   ├── shorten/      # 短链接服务
│   │   └── sub/          # 订阅转换
│   ├── components/       # React组件
│   └── page.tsx          # 主页面
├── config/               # 配置文件
│   ├── clash.ts         # Clash配置
│   ├── regions.ts       # 地区配置
│   └── singbox.ts       # Sing-box配置
└── lib/                 # 工具库
    ├── nodeUtils.ts     # 节点处理工具
    ├── parsers.ts       # 解析器
    ├── remoteNodes.ts   # 远程节点处理
    ├── singleNode.ts    # 单节点处理
    └── types.ts         # 类型定义
```

## 主要功能说明

### 1. 订阅转换
- 支持输入订阅链接
- 自动识别订阅类型
- 转换为统一格式
- 生成新的订阅地址

### 2. 短链接服务
支持多个短链接提供商：
- Bitly
- TinyURL
- Sink
具有自动故障转移机制，确保服务可用性。

### 3. 配置生成
支持生成两种格式的配置：
- **Clash配置**
  - 自定义代理组
  - 智能分流规则
  - 自动测速功能
  
- **Sing-box配置**
  - DNS配置优化
  - 智能路由规则
  - 多入站支持

### 4. 地区识别
- 支持多个地区的节点识别
- 智能分类系统
- 支持自定义地区标识

## API 接口

### 1. 订阅转换接口
```typescript
GET /sub?url={订阅链接}
```

### 2. 短链接服务
```typescript
POST /api/shorten
Content-Type: application/json

{
  "url": "需要缩短的链接"
}
```

## 开发指南

### 环境要求
- Node.js >= 18
- Bun >= 1.0

### 安装步骤
1. 克隆项目
```bash
git clone [项目地址]
```

2. 安装依赖
```bash
bun install
```

3. 启动开发服务器
```bash
bun dev
```

4. 构建生产版本
```bash
bun run build
```

### 配置说明

项目配置主要包含在以下文件中：
- `next.config.ts`: Next.js配置
- `src/config/`: 功能配置目录

## 部署说明

### 环境变量
需要配置的环境变量：
- `BITLY_TOKEN`: Bitly API Token
- `SINK_URL`: Sink 服务地址
- `SINK_TOKEN`: Sink 服务 Token

### 部署步骤
1. 构建项目
```bash
bun run build
```

2. 启动服务
```bash
bun start
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

[MIT License](LICENSE) 