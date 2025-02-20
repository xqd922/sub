# Sing-box 订阅转换说明

## 使用方法

### 订阅链接格式
```
http(s)://your-domain/api/sing?url=原始订阅链接
```

### 在 sing-box 中导入
1. 打开 sing-box
2. 点击"从 URL 导入"
3. 粘贴上述格式的订阅链接
4. sing-box 会自动更新和应用配置

## 支持的协议
- Shadowsocks (SS)
- VMess
- Trojan

## 配置特点
- 自动生成完整配置
- 保持原有节点名称和分组
- 优化的 DNS 设置
  - 国外域名: Cloudflare (1.1.1.1)
  - 国内域名: 阿里 DNS (223.5.5.5)
- 智能分流规则
  - 国内域名直连
  - 广告域名拦截
  - 国外域名代理

## 入站设置
- TUN: 系统代理
- SOCKS: 127.0.0.1:2333
- Mixed: 127.0.0.1:2334

## 节点分组
- Manual: 手动选择
- Auto: 自动测速
- 延迟测试间隔: 300秒
- 测试网址: www.gstatic.com/generate_204

## 注意事项
- 建议使用 HTTPS 链接
- 确保订阅链接可以正常访问
- 如遇导入失败，检查原始订阅是否有效 