# 重构计划 — Sub 订阅转换器

> **状态：全部完成 ✅** (2026-06-24)

---

## 第一阶段：清理 & 基础设施 ✅

- [x] 重写 CLAUDE.md — 清除污染的系统提示词，写入项目专属指令
- [x] 清理死代码 — 删除未使用的导出、类、ErrorCode、工厂方法
- [x] 删除 Admin 功能 — 6 个 API 路由 + auth 模块全部移除
- [x] 移除未使用依赖 — `@arco-design/web-react`
- [x] 安全修复 — 硬编码 API token 改用环境变量，弱密码更新

## 第二阶段：后端架构重组 ✅

- [x] Service 类 → 纯函数 — CoreService, SubService, ConfigService, NetService, ShortService, SingleNodeParser
- [x] KV 类 → 纯函数 — KVClient, RecordService, ShortLinkService
- [x] 统一 KV 层 — 提取共享 CloudflareEnv 接口和 getKV()，消除重复，添加泛型类型
- [x] 统一错误处理 — 清理未使用的 ErrorCode（从 16 个减到 5 个）和工厂方法
- [x] 修复 Logger — debug/info/warn/error 使用正确的 console 方法
- [x] 优化双重请求 — 标准订阅从 2 次 HTTP 请求减为 1 次

## 第三阶段：前端重构 ✅

- [x] Toast 系统 — 从 DOM 操作改为 React 状态驱动的单例模式 + ToastContainer 组件
- [x] 组件清理 — 移除未使用的导入，全局集成 ToastContainer
- [x] layout.tsx 更新 — 集成 ToastContainer

## 第四阶段：Admin 功能 ✅ (已删除)

- [x] 完全删除 — 所有 admin API 路由、auth 模块、空目录

## 第五阶段：测试 ✅

- [x] 测试基础设施 — Vitest 配置，@/ 路径别名，test/test:watch 脚本
- [x] 核心测试覆盖 — 5 个测试文件，105 个测试用例，全部通过
  - utils.test.ts (23 tests) — parsePort, formatBytes
  - dedup.test.ts (22 tests) — 去重、info 节点过滤、无效节点过滤
  - region.test.ts (31 tests) — 区域检测、flag emoji、中英文识别
  - shadowsocks.test.ts (11 tests) — SIP002、legacy base64、插件解析
  - vmess.test.ts (18 tests) — TCP/WS/TLS、SNI、默认值

## 验证状态

- TypeScript 编译：零错误
- 测试：105/105 通过
- 构建缓存：已清理 (.next)
