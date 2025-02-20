# 功能说明文档

## 核心功能

### 1. 通用订阅转换
- 自动识别客户端类型 (Clash/sing-box)
- 根据 User-Agent 返回对应格式
- 支持多种代理协议转换

### 2. 支持的协议
- Shadowsocks (SS)
- VMess
- Trojan
- Hysteria2
- VLESS

### 3. 节点优化
- 智能节点去重
- 自动过滤信息节点
- 按地区智能分类
- 自动添加国旗标识
- 保留倍率信息

### 4. 配置生成
- Clash 配置
  - 内置优质 DNS 配置
  - 智能分流规则
  - 自动故障转移
  - 节点延迟测试

- sing-box 配置
  - TUN/SOCKS/Mixed 多入站
  - DNS 智能分流
  - 自动故障转移
  - 节点延迟测试

### 5. 短链接服务
- 多平台支持
  - Bitly
  - TinyURL
  - Sink
- 自动重试机制
- 智能服务选择
- 短链接清理

### 6. 地区支持
- 东亚地区 (香港/台湾/日本/韩国等)
- 东南亚地区 (新加坡/马来西亚等)
- 欧美地区 (美国/英国/德国等)
- 其他地区 (俄罗斯/巴西/澳大利亚等)

## 技术特性

### 1. 错误处理
- 完善的错误提示
- 自动重试机制
- 详细的错误日志

### 2. 性能优化
- Edge Runtime 支持
- 智能缓存控制
- 并发请求处理

### 3. 安全特性
- 请求头规范化
- 跨域访问控制
- 响应头安全配置

### 4. 用户界面
- 响应式设计
- 深色模式支持
- 复制/下载功能
- 状态提示动画

## 使用说明

### 1. 基本使用
1. 输入订阅链接
2. 点击转换按钮
3. 复制转换后的链接
4. 在客户端中导入使用

### 2. 短链接生成
1. 转换订阅后
2. 点击生成短链接
3. 等待生成完成
4. 复制短链接使用

### 3. 客户端支持
- Clash 系列
  - Clash
  - ClashX
  - Clash for Windows
  - Clash Meta

- sing-box 系列
  - sing-box
  - SFI
  - SFA
  - Sing-box for Windows

## 开发说明

### 1. 项目结构
```
src/
  ├── app/                # Next.js 应用目录
  │   ├── api/           # API 路由
  │   ├── components/    # React 组件
  │   └── sub/           # 订阅处理
  ├── config/            # 配置文件
  │   ├── clash.ts       # Clash 配置
  │   ├── singbox.ts     # sing-box 配置
  │   └── regions.ts     # 地区配置
  └── lib/               # 工具函数
      ├── parsers.ts     # 协议解析
      ├── nodeUtils.ts   # 节点处理
      └── types.ts       # 类型定义
```

### 2. 主要模块
- 订阅解析 (parsers.ts)
- 节点处理 (nodeUtils.ts)
- 配置生成 (clash.ts/singbox.ts)
- 短链接服务 (shorten/)
- UI 组件 (components/)

### 3. 配置说明
- DNS 配置
- 分流规则
- 代理组设置
- 节点格式化规则 