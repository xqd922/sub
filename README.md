# Xqd Sub - Clash 订阅转换 API

一个基于 Next.js 开发的 Clash 订阅转换 API 服务，支持多种代理协议转换为 Clash 配置。

## 功能特点

- 支持多种代理协议转换
  - Shadowsocks (SS)
  - VMess
  - Trojan
  - Hysteria2
  - VLESS
  - Clash 原生配置

- 节点优化
  - 自动优化节点名称格式
  - 按地区智能分类
  - 自动添加国旗标识
  - 保留倍率信息

- 配置增强
  - 内置优质 DNS 配置
  - 智能分流规则
  - 自动故障转移
  - 节点延迟测试

## 快速开始

1. 克隆项目
```bash
git clone https://github.com/yourusername/clash-sub-api.git
cd clash-sub-api
```

2. 安装依赖
```bash
npm install
```

3. 开发环境运行
```bash
npm dev
```

4. 生产环境部署
```bash
npm build
npm start
```

## API 使用说明

### 转换订阅

```http
GET /sub?url=订阅链接
```

#### 请求参数
- `url`: 原始订阅链接 (必需)

#### 响应格式
- Content-Type: `text/yaml`
- 包含完整的 Clash 配置文件

### 健康检查

```http
GET /api/health
```

返回 API 服务运行状态

## 配置说明

### 环境变量
创建 `.env.local` 文件：
```env
# API 配置
PORT=3001
NODE_ENV=production

# 其他配置项...
```

### 自定义规则
可以在 `src/app/sub/route.ts` 中修改：
- DNS 配置
- 代理组设置
- 节点命名格式

## 开发指南

### 项目结构
```
src/
  ├── app/                # Next.js 应用目录
  │   ├── api/           # API 路由
  │   ├── sub/          # 订阅转换核心逻辑
  │   └── page.tsx      # 首页
  ├── lib/               # 工具函数
  │   ├── parsers.ts    # 协议解析器
  │   └── types.ts      # 类型定义
  └── ...
```

### 添加新功能
1. 在 `src/lib/parsers.ts` 添加新的协议解析器
2. 在 `src/app/sub/route.ts` 中集成新功能
3. 更新相关类型定义和测试

## 部署说明

### 使用 Docker
```bash
# 构建镜像
docker build -t clash-sub-api .

# 运行容器
docker run -d -p 3001:3001 clash-sub-api
```

### 使用 Vercel
直接使用 Vercel 部署：
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/clash-sub-api)

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License

## 联系方式

- 作者：[Your Name]
- 邮箱：[your.email@example.com]
- 项目地址：[https://github.com/yourusername/clash-sub-api](https://github.com/yourusername/clash-sub-api)

## 致谢

感谢以下开源项目：
- [Next.js](https://nextjs.org/)
- [Clash](https://github.com/Dreamacro/clash)
- [js-yaml](https://github.com/nodeca/js-yaml)
