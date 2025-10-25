# Clash 代理组策略详解

本文档详细说明了订阅转换服务生成的 Clash 配置中各个代理组的生成逻辑、使用场景和出现条件。

## 目录

- [代理组概述](#代理组概述)
- [基础代理组](#基础代理组)
- [条件代理组](#条件代理组)
- [代理组依赖关系](#代理组依赖关系)
- [完整决策树](#完整决策树)

---

## 代理组概述

代理组是 Clash 配置的核心组件,用于组织和管理代理节点。本服务根据订阅类型和节点特征,动态生成最适合的代理组配置。

### 代理组分类

代理组分为两大类:

1. **基础代理组**: 始终存在,不受任何条件限制
2. **条件代理组**: 根据订阅类型和节点特征动态生成

---

## 基础代理组

以下代理组在所有情况下都会生成,无论订阅类型或节点特征如何。

### 1. Manual (手动选择)

**类型**: `select` (手动选择)

**功能**: 用户手动选择使用的代理节点或策略组

**包含项**:
- `Auto` - 自动测速组
- `DIRECT` - 直连
- `HK` - 香港组 (仅当有香港节点时)
- `Min` - 低延迟组 (仅当为机场订阅且有 HK 组和 Min 节点时)
- 所有代理节点

**代码位置**: `config/clash.ts:14-20`

**示例**:
```yaml
# 机场订阅 + 有香港节点 + 有低延迟节点
proxies:
  - Auto
  - DIRECT
  - HK
  - Min
  - 香港 01
  - 香港 02
  - 日本 01
  ...

# 单节点订阅 + 有香港节点
proxies:
  - Auto
  - DIRECT
  - HK
  - trojan://example.com
  ...
```

---

### 2. Auto (自动测速)

**类型**: `url-test` (自动测速)

**功能**: 自动选择延迟最低的可用节点

**配置参数**:
- `url`: `http://www.gstatic.com/generate_204` (测试地址)
- `interval`: `300` 秒 (测速间隔)
- `tolerance`: `50` 毫秒 (容差范围)

**包含项**: 所有代理节点

**代码位置**: `config/clash.ts:34-41`

**工作原理**:
- 每 300 秒向测试地址发起请求
- 选择延迟最低的节点
- 当当前节点与最低延迟节点差值超过 50ms 时切换

**示例**:
```yaml
name: Auto
type: url-test
proxies:
  - 香港 01
  - 香港 02
  - 日本 01
  - 美国 01
url: http://www.gstatic.com/generate_204
interval: 300
tolerance: 50
```

---

### 3. Emby (流媒体服务)

**类型**: `select` (手动选择)

**功能**: 专门用于 Emby 流媒体服务的代理选择

**包含项**:
- `Manual` - 手动选择组
- `Min` - 低延迟组 (仅当为机场订阅且有低延迟节点时)
- 所有代理节点

**代码位置**: `config/clash.ts:22-25`, `42-46`

**使用场景**:
- 访问 Emby 流媒体服务器
- 配合规则 `DOMAIN-KEYWORD,emby,Emby` 使用
- 支持大量 Emby 服务器域名 (见配置规则第 168-220 行)

**示例**:
```yaml
# 机场订阅 + 有低延迟节点
proxies:
  - Manual
  - Min
  - 香港 01
  - 日本 01
  ...

# 单节点订阅
proxies:
  - Manual
  - trojan://example.com
```

---

### 4. AI (AI 服务)

**类型**: `select` (手动选择)

**功能**: 专门用于 AI 服务的代理选择

**包含项**:
- `Manual` - 手动选择组
- `Auto` - 自动测速组
- `DIRECT` - 直连
- 所有代理节点

**代码位置**: `config/clash.ts:47-51`

**支持的 AI 服务**:
- OpenAI (ChatGPT)
- Anthropic (Claude)
- Google (Gemini, Bard)
- Microsoft (Copilot)
- Perplexity AI
- Midjourney
- Stability AI
- Hugging Face
- Cohere
- Poe
- Character.AI

**示例**:
```yaml
name: AI
type: select
proxies:
  - Manual
  - Auto
  - DIRECT
  - 香港 01
  - 日本 01
  - 美国 01
```

---

## 条件代理组

以下代理组根据特定条件动态生成。

### 5. HK (香港专线)

**类型**: `url-test` (自动测速)

**生成条件**:
- ✅ 存在符合条件的香港节点
- ❌ 不受订阅类型限制 (机场/单节点/Gist 均可)

**节点筛选规则**:
- ✅ 匹配正则: `/香港|HK|Hong Kong|HKG/`
- ❌ 排除正则: `/家宽|Home/`

**配置参数**:
- `url`: `http://www.gstatic.com/generate_204`
- `interval`: `300` 秒
- `tolerance`: `50` 毫秒

**代码位置**: `config/clash.ts:7-8`, `54-64`

**筛选示例**:

| 节点名称 | 是否包含 | 原因 |
|---------|---------|------|
| `香港 01` | ✅ | 匹配 "香港" |
| `HK-BGP` | ✅ | 匹配 "HK" |
| `Hong Kong IPLC` | ✅ | 匹配 "Hong Kong" |
| `HKG-Premium` | ✅ | 匹配 "HKG" |
| `香港家宽 01` | ❌ | 包含 "家宽" |
| `HK Home 02` | ❌ | 包含 "Home" |
| `日本 01` | ❌ | 不匹配香港特征 |

**完整流程**:

```
是否有节点匹配 /香港|HK|Hong Kong|HKG/ ?
├─ 否 → 不创建 HK 组
└─ 是 → 过滤掉包含 /家宽|Home/ 的节点
         └─ 剩余节点 > 0 ?
            ├─ 是 → 创建 HK 组
            └─ 否 → 不创建 HK 组
```

**示例配置**:
```yaml
name: HK
type: url-test
proxies:
  - 香港 01
  - HK-BGP
  - Hong Kong IPLC
url: http://www.gstatic.com/generate_204
interval: 300
tolerance: 50
```

---

### 6. Min (低延迟)

**类型**: `url-test` (自动测速)

**生成条件** (必须同时满足):
1. ✅ `isAirportSubscription = true` (必须是机场订阅)
2. ✅ 存在符合条件的低延迟节点

**订阅类型判断**:
- **机场订阅** (`true`): 标准订阅 URL (base64 或 YAML 格式)
- **非机场订阅** (`false`): 单节点链接、GitHub Gist 节点集合

**节点筛选规则**:
- ✅ 匹配正则: `/0\.[0-3](?:[0-9]*)?/`
- 匹配延迟范围: 0.0x - 0.3x 秒 (即 0-399ms)

**配置参数**:
- `url`: `http://www.gstatic.com/generate_204`
- `interval`: `300` 秒
- `tolerance`: `50` 毫秒

**代码位置**: `config/clash.ts:10-11`, `66-76`

**筛选示例**:

| 节点名称 | 是否包含 | 原因 |
|---------|---------|------|
| `香港 0.12` | ✅ | 匹配 0.12 (120ms) |
| `日本 0.08` | ✅ | 匹配 0.08 (80ms) |
| `美国 0.3` | ✅ | 匹配 0.3 (300ms) |
| `新加坡 0.35` | ✅ | 匹配 0.35 (350ms) |
| `台湾 0.4` | ❌ | 超出范围 (400ms) |
| `香港 IPLC` | ❌ | 不包含延迟数字 |

**完整流程**:

```
是否为机场订阅?
├─ 否 → 不创建 Min 组
└─ 是 → 是否有节点匹配 /0\.[0-3](?:[0-9]*)?/ ?
         ├─ 否 → 不创建 Min 组
         └─ 是 → 创建 Min 组
```

**应用场景**:

| 场景 | 是否创建 Min 组 |
|------|---------------|
| 机场订阅 + 有低延迟节点 | ✅ |
| 机场订阅 + 无低延迟节点 | ❌ |
| 单节点链接 + 有低延迟节点 | ❌ |
| Gist 节点集合 + 有低延迟节点 | ❌ |

**示例配置**:
```yaml
name: Min
type: url-test
proxies:
  - 香港 0.12
  - 日本 0.08
  - 新加坡 0.35
url: http://www.gstatic.com/generate_204
interval: 300
tolerance: 50
```

---

## 代理组依赖关系

代理组之间存在引用关系,形成层级结构:

```
Manual (顶层)
├── Auto
├── HK (条件)
├── Min (条件)
└── [所有节点]

Auto
└── [所有节点]

Emby
├── Manual
├── Min (条件)
└── [所有节点]

AI
├── Manual
├── Auto
└── [所有节点]

HK (条件)
└── [香港节点]

Min (条件)
└── [低延迟节点]
```

### 依赖说明

1. **Manual 组**:
   - 引用 `Auto`、`HK`(条件)、`Min`(条件)
   - Min 的添加需要满足: `isAirportSubscription && hkProxies.length > 0 && minProxies.length > 0`

2. **Emby 组**:
   - 始终引用 `Manual`
   - 条件引用 `Min` (需要机场订阅且有低延迟节点)

3. **AI 组**:
   - 始终引用 `Manual` 和 `Auto`
   - 不引用其他策略组

---

## 完整决策树

### HK 组决策树

```
开始
 │
 ├─ 提取所有节点名称
 │
 ├─ 筛选: 包含 "香港|HK|Hong Kong|HKG"
 │   └─ 匹配节点数 = 0 → ❌ 不创建 HK 组
 │
 ├─ 过滤: 排除包含 "家宽|Home"
 │   └─ 剩余节点数 = 0 → ❌ 不创建 HK 组
 │
 └─ ✅ 创建 HK 组
     ├─ 包含筛选后的所有香港节点
     ├─ 添加到 Manual 组的选项列表
     └─ 生成 url-test 策略组
```

### Min 组决策树

```
开始
 │
 ├─ 检查订阅类型
 │   └─ isAirportSubscription = false → ❌ 不创建 Min 组
 │
 ├─ 筛选: 匹配 /0\.[0-3](?:[0-9]*)?/
 │   └─ 匹配节点数 = 0 → ❌ 不创建 Min 组
 │
 └─ ✅ 创建 Min 组
     ├─ 包含筛选后的所有低延迟节点
     ├─ 条件添加到 Manual 组 (需要同时有 HK 组)
     ├─ 条件添加到 Emby 组
     └─ 生成 url-test 策略组
```

### Manual 组决策树

```
开始
 │
 ├─ 初始化: ['Auto', 'DIRECT']
 │
 ├─ HK 组存在?
 │   ├─ 是 → 添加 'HK'
 │   │     └─ 机场订阅 && Min 组存在? → 添加 'Min'
 │   └─ 否 → 跳过
 │
 ├─ 添加所有代理节点
 │
 └─ 生成 select 策略组
```

---

## 实际应用示例

### 场景 1: 完整机场订阅

**输入**:
- 订阅类型: 机场订阅 (`isAirportSubscription = true`)
- 节点列表:
  ```
  香港 0.12
  香港 0.25
  HK-BGP
  香港家宽 01
  日本 0.08
  美国 1.2
  ```

**生成的代理组**:

```yaml
proxy-groups:
  - name: Manual
    type: select
    proxies:
      - Auto
      - DIRECT
      - HK        # ✅ 有香港节点
      - Min       # ✅ 机场订阅 + 有 HK + 有低延迟节点
      - 香港 0.12
      - 香港 0.25
      - HK-BGP
      - 香港家宽 01
      - 日本 0.08
      - 美国 1.2

  - name: Auto
    type: url-test
    proxies: [所有节点]
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: Emby
    type: select
    proxies:
      - Manual
      - Min       # ✅ 机场订阅 + 有低延迟节点
      - [所有节点]

  - name: AI
    type: select
    proxies:
      - Manual
      - Auto
      - DIRECT
      - [所有节点]

  - name: HK        # ✅ 创建
    type: url-test
    proxies:
      - 香港 0.12
      - 香港 0.25
      - HK-BGP
      # 注意: "香港家宽 01" 被过滤
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: Min       # ✅ 创建
    type: url-test
    proxies:
      - 香港 0.12
      - 香港 0.25
      - 日本 0.08
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
```

---

### 场景 2: 单节点订阅 (有香港节点)

**输入**:
- 订阅类型: 单节点 (`isAirportSubscription = false`)
- 节点:
  ```
  trojan://example.com#HK-01
  ```

**生成的代理组**:

```yaml
proxy-groups:
  - name: Manual
    type: select
    proxies:
      - Auto
      - DIRECT
      - HK                           # ✅ 有香港节点
      # 注意: 没有 Min (非机场订阅)
      - trojan://example.com#HK-01

  - name: Auto
    type: url-test
    proxies:
      - trojan://example.com#HK-01
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: Emby
    type: select
    proxies:
      - Manual
      # 注意: 没有 Min (非机场订阅)
      - trojan://example.com#HK-01

  - name: AI
    type: select
    proxies:
      - Manual
      - Auto
      - DIRECT
      - trojan://example.com#HK-01

  - name: HK                         # ✅ 创建
    type: url-test
    proxies:
      - trojan://example.com#HK-01
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  # 注意: 没有 Min 组 (非机场订阅)
```

---

### 场景 3: 机场订阅 (无香港节点)

**输入**:
- 订阅类型: 机场订阅 (`isAirportSubscription = true`)
- 节点列表:
  ```
  日本 0.08
  美国 0.15
  新加坡 1.2
  ```

**生成的代理组**:

```yaml
proxy-groups:
  - name: Manual
    type: select
    proxies:
      - Auto
      - DIRECT
      # 注意: 没有 HK (无香港节点)
      # 注意: 没有 Min (虽然有低延迟节点，但没有 HK 组)
      - 日本 0.08
      - 美国 0.15
      - 新加坡 1.2

  - name: Auto
    type: url-test
    proxies: [所有节点]
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: Emby
    type: select
    proxies:
      - Manual
      # 注意: 没有 Min (虽然是机场订阅，但 Manual 中没有 Min)
      - [所有节点]

  - name: AI
    type: select
    proxies:
      - Manual
      - Auto
      - DIRECT
      - [所有节点]

  # 注意: 没有 HK 组 (无香港节点)

  - name: Min                        # ✅ 创建
    type: url-test
    proxies:
      - 日本 0.08
      - 美国 0.15
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
```

**说明**: 虽然创建了 Min 组,但由于没有 HK 组,Min 组不会被添加到 Manual 和 Emby 中。

---

### 场景 4: Gist 节点集合 (有香港 + 有低延迟)

**输入**:
- 订阅类型: Gist (`isAirportSubscription = false`)
- 节点列表:
  ```
  vmess://...#香港-0.12
  vless://...#HK-BGP-0.08
  trojan://...#日本-0.15
  ```

**生成的代理组**:

```yaml
proxy-groups:
  - name: Manual
    type: select
    proxies:
      - Auto
      - DIRECT
      - HK                           # ✅ 有香港节点
      # 注意: 没有 Min (非机场订阅)
      - [所有节点]

  - name: Auto
    type: url-test
    proxies: [所有节点]
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  - name: Emby
    type: select
    proxies:
      - Manual
      # 注意: 没有 Min (非机场订阅)
      - [所有节点]

  - name: AI
    type: select
    proxies:
      - Manual
      - Auto
      - DIRECT
      - [所有节点]

  - name: HK                         # ✅ 创建
    type: url-test
    proxies:
      - 香港-0.12
      - HK-BGP-0.08
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50

  # 注意: 没有 Min 组 (虽然有低延迟节点，但非机场订阅)
```

---

## 特殊情况处理

### 1. 所有节点都是家宽/Home

**场景**:
```
节点列表:
  - 香港家宽 01
  - HK Home 02
  - Hong Kong Home Broadband
```

**结果**:
- ❌ 不创建 HK 组 (所有香港节点被过滤)
- Manual 组不包含 HK 选项
- 其他基础组正常创建

---

### 2. 节点名称不规范

**场景**:
```
节点列表:
  - Node-001
  - Proxy-002
  - Server-003
```

**结果**:
- ❌ 不创建 HK 组 (无节点匹配香港特征)
- ❌ 不创建 Min 组 (无节点包含延迟信息)
- 只生成 4 个基础组: Manual、Auto、Emby、AI

---

### 3. 延迟边界值

**场景**:
```
节点列表:
  - 香港 0.299  # 299ms
  - 香港 0.3    # 300ms
  - 香港 0.399  # 399ms
  - 香港 0.4    # 400ms
```

**Min 组包含**:
- ✅ 香港 0.299 (匹配 `/0\.[0-3](?:[0-9]*)?/`)
- ✅ 香港 0.3   (匹配)
- ✅ 香港 0.399 (匹配 0.3 开头)
- ❌ 香港 0.4   (不匹配,超出范围)

---

### 4. 混合订阅类型

**注意**: `isAirportSubscription` 参数在解析订阅时确定,不会在同一次转换中出现混合情况。

**可能的值**:
- `true`: 标准机场订阅 URL
- `false`: 单节点链接、Gist URL

---

## 配置文件参考

### 代码位置

所有代理组生成逻辑位于: `config/clash.ts`

**关键函数**:
```typescript
export function generateProxyGroups(
  proxies: Proxy[],
  isAirportSubscription: boolean = true
)
```

**关键代码段**:
- 第 7-8 行: HK 节点筛选
- 第 10-11 行: Min 节点筛选
- 第 13-20 行: Manual 组构建
- 第 22-25 行: Emby 组构建
- 第 28-52 行: 基础代理组定义
- 第 54-64 行: HK 组条件生成
- 第 66-76 行: Min 组条件生成

---

## 常见问题 FAQ

### Q1: 为什么我的配置没有 HK 组?

**可能原因**:
1. 节点名称不包含 `香港`、`HK`、`Hong Kong` 或 `HKG`
2. 所有香港节点都包含 `家宽` 或 `Home` 关键字
3. 订阅中根本没有香港节点

**解决方法**: 确保节点命名规范,例如 `香港 01`、`HK-Premium`

---

### Q2: 为什么单节点没有 Min 组?

**答案**: Min 组仅在**机场订阅**时创建。单节点链接和 Gist 节点集合不会生成 Min 组,即使节点名称包含延迟信息。

**设计原因**: Min 组主要用于机场多节点场景下的低延迟优选,单节点场景无此需求。

---

### Q3: Manual 中的 Min 选项什么时候出现?

**必须同时满足**:
1. `isAirportSubscription = true` (机场订阅)
2. `hkProxies.length > 0` (存在 HK 组)
3. `minProxies.length > 0` (存在低延迟节点)

**逻辑**: 只有当 HK 组存在时,才会考虑添加 Min 到 Manual。

---

### Q4: 如何自定义节点筛选规则?

**修改位置**: `config/clash.ts`

**HK 组筛选** (第 8 行):
```typescript
const hkProxies = proxyNames.filter(p =>
  /香港|HK|Hong Kong|HKG/.test(p) && !/家宽|Home/.test(p)
)
```

**Min 组筛选** (第 11 行):
```typescript
const minProxies = proxyNames.filter(p =>
  /0\.[0-3](?:[0-9]*)?/.test(p)
)
```

**示例修改** - 添加台湾节点到地区组:
```typescript
const twProxies = proxyNames.filter(p =>
  /台湾|TW|Taiwan/.test(p) && !/家宽|Home/.test(p)
)
```

---

### Q5: url-test 的测速原理是什么?

**工作流程**:
1. 每隔 `interval` 秒 (默认 300s) 向 `url` 发起 HTTP 请求
2. 记录每个节点的响应延迟
3. 选择延迟最低的节点作为当前使用节点
4. 当最低延迟节点与当前节点延迟差超过 `tolerance` (默认 50ms) 时切换

**测试 URL**: `http://www.gstatic.com/generate_204`
- Google 的空白页面,响应快速
- 返回 HTTP 204 (无内容),节省流量

---

## 总结

### 代理组生成矩阵

| 代理组 | 生成条件 | 类型 | 依赖 |
|-------|---------|------|-----|
| Manual | 始终 | select | - |
| Auto | 始终 | url-test | - |
| Emby | 始终 | select | Manual |
| AI | 始终 | select | Manual, Auto |
| HK | 有香港节点 | url-test | - |
| Min | 机场订阅 + 有低延迟节点 | url-test | - |

### 最佳实践

1. **节点命名规范**:
   - 包含地区标识: `香港`、`HK`、`Hong Kong`
   - 包含延迟信息: `香港 0.12`、`HK-0.08`
   - 避免误触过滤词: 不使用 `家宽`、`Home`

2. **订阅类型选择**:
   - 机场订阅: 完整功能,支持所有策略组
   - 单节点: 适合临时使用,功能简化
   - Gist 集合: 适合自建节点分享

3. **策略组使用建议**:
   - 日常使用: `Manual` → `Auto`
   - 低延迟需求: `Manual` → `Min`
   - 流媒体: `Emby` → `Manual` / `Min`
   - AI 服务: `AI` → `Manual` / `Auto`

---

**文档版本**: v1.0
**最后更新**: 2025-01-25
**维护者**: 订阅转换服务
**代码仓库**: `config/clash.ts`
