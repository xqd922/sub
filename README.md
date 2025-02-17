# Sub - Clash 订阅转换

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
  - 智能节点去重
  - 保留最后一个重复节点
  - 自动过滤信息节点
  - 按地区智能分类
  - 自动添加国旗标识
  - 保留倍率信息

- 日志系统
  - 订阅基本信息
    - 名称和首页
    - 流量使用情况
    - 到期时间
  - 节点处理详情
    - 信息节点过滤记录
    - 重复节点检测
    - 节点类型分布统计
  - 配置生成过程
    - 步骤追踪
    - 错误定位

- 配置增强
  - 内置优质 DNS 配置
  - 智能分流规则
  - 自动故障转移
  - 节点延迟测试

- 地区支持
  - 东亚地区
    - 香港 (HK/Hong Kong)
    - 台湾 (TW/Taiwan)
    - 日本 (JP/Japan)
    - 韩国 (KR/Korea)
    - 澳门 (MO/Macao)
  - 东南亚地区
    - 新加坡 (SG/Singapore)
    - 马来西亚 (MY/Malaysia)
    - 印尼 (ID/Indonesia)
    - 泰国 (TH/Thailand)
    - 越南 (VN/Vietnam)
    - 菲律宾 (PH/Philippines)
    - 柬埔寨 (KH/Cambodia)
  - 南亚地区
    - 印度 (IN/India)
    - 巴基斯坦 (PK/Pakistan)
  - 欧洲地区
    - 英国 (UK/Great Britain)
    - 德国 (DE/Germany)
    - 法国 (FR/France)
    - 意大利 (IT/Italy)
    - 西班牙 (ES/Spain)
    - 荷兰 (NL/Netherlands)
    - 波兰 (PL/Poland)
    - 乌克兰 (UA/Ukraine)
  - 北欧地区
    - 瑞典 (SE/Sweden)
    - 挪威 (NO/Norway)
    - 芬兰 (FI/Finland)
    - 丹麦 (DK/Denmark)
    - 冰岛 (IS/Iceland)
  - 北美地区
    - 美国 (US/USA)
    - 加拿大 (CA/Canada)
    - 墨西哥 (MX/Mexico)
  - 大洋洲
    - 澳大利亚 (AU/Australia)
    - 新西兰 (NZ/New Zealand)
  - 其他地区
    - 俄罗斯 (RU/Russia)
    - 土耳其 (TR/Turkey)
    - 巴西 (BR/Brazil)
    - 阿根廷 (AR/Argentina)
    - 南非 (ZA/South Africa)
    - 以色列 (IL/Israel)
    - 伊拉克 (IQ/Iraq)
    - 尼日利亚 (NG/Nigeria)

- 节点命名优化
  - 自动添加国旗表情
  - 统一地区命名
  - 序号自动补零
  - 保留倍率信息
  - 例如: 🇭🇰 香港 01 | 0.5x

- 智能分组
  - 自动分类地区节点
  - 自动故障转移
  - 定时延迟测试
  - 智能负载均衡

## 日志输出示例

```
=== 订阅基本信息 ===
名称: Example Sub
首页: https://example.com
流量信息:
  ├─ 上传: 1.5 GB
  ├─ 下载: 15.8 GB
  └─ 总量: 100 GB
到期时间: 2025-02-14 22:09:45

=== 节点处理信息 ===
节点处理详情:
  [信息] 排除节点: 剩余流量：9.77 GB
  [信息] 排除节点: 距离下次重置剩余：3 天
  [重复] 发现重复节点: 🇭🇰 香港 01

节点统计信息:
  ├─ 原始节点总数: 50
  ├─ 信息节点数量: 3
  ├─ 重复节点数量: 5
  └─ 有效节点数量: 42

节点类型分布:
  ├─ vmess: 20
  ├─ trojan: 15
  ├─ ss: 5
  └─ hysteria2: 2

=== 配置生成信息 ===
1. 获取默认配置
2. 格式化节点名称
3. 生成代理组
4. 转换为 YAML
```

## 最新更新

### 2024-02-14 优化

1. 节点去重逻辑优化
   - 改用 Map 存储节点，保留最后一个重复节点
   - 添加重复节点计数
   - 优化节点唯一标识生成规则

2. 日志系统重构
   - 订阅信息展示优化
     ```
     === 订阅基本信息 ===
     名称: Example Sub
     首页: https://example.com
     流量信息:
       ├─ 上传: 1.5 GB
       ├─ 下载: 15.8 GB
       └─ 总量: 100 GB
     ```
   - 节点处理详情增强
     ```
     === 节点处理信息 ===
     节点处理详情:
       [信息] 排除节点: xxx
       [重复] 发现重复节点: xxx
     ```
   - 添加节点类型分布统计
     ```
     节点类型分布:
       ├─ vmess: 20
       ├─ trojan: 15
       └─ ss: 5
     ```

3. 首页配置优化
   - 保留原始订阅的首页地址
   - 支持 profile-web-page-url 配置
   - 优化订阅信息展示

4. 信息节点过滤优化
   - 优化关键词匹配规则
   - 移除冗余过滤条件
   - 添加详细的过滤日志

5. 代码结构优化
   - 重构节点去重函数
   - 优化日志输出格式
   - 改进错误处理逻辑

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

### 清理短链接

访问以下链接可以清理过期的短链接：
```
/api/shorten/clean
```

- 自动清理7天前的短链接
- 显示清理统计信息
- 美观的界面展示

## 配置说明

### 环境变量
创建 `.env.local` 文件
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
docker run -d -p 3000:3000 clash-sub-api
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
