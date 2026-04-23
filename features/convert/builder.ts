import yaml from 'js-yaml'
import { Proxy } from '@/lib/core/types'
import { defaultConfig, generateProxyGroups } from '@/config/clash'
import { generateSingboxConfig as buildSingboxConfig } from '@/config/singbox'
import { generateBase64Subscription } from '@/lib/parse/protocols'
import { previewStyles } from '@/styles/preview'
import { SubscriptionInfo } from './processor'
import { logger } from '@/lib/core/logger'
import { formatBytes } from '@/lib/core/utils'

/**
 * 配置生成服务 - 生成各种格式的配置文件
 */
export class ConfigService {
  
  /**
   * 生成 Clash YAML 配置
   */
  static generateClashConfig(proxies: Proxy[], isAirportSubscription: boolean = true): string {
    // 清理 Clash 不需要的字段（移除 detour 字段）
    const clashProxies = proxies.map(proxy => {
      const { detour, ...clashProxy } = proxy
      return clashProxy
    })

    const clashConfig = {
      ...defaultConfig,
      proxies: clashProxies,
      'proxy-groups': generateProxyGroups(clashProxies, isAirportSubscription)
    }

    let output = yaml.dump(clashConfig, {
      flowLevel: 2,
      lineWidth: -1,
      indent: 2,
      noRefs: true,
      forceQuotes: false,
      quotingType: '"',
      styles: {
        '!!null': 'lowercase'
      }
    })

    // 给包含特殊字符的 path 值加引号
    output = output.replace(/path: ([^,}"'\n]+)/g, (match, value) => {
      if (/[?:&]/.test(value) && !value.startsWith('"')) {
        return `path: "${value}"`
      }
      return match
    })

    return output
  }

  /**
   * 生成 Sing-box JSON 配置
   */
  static generateSingboxConfig(proxies: Proxy[]): string {
    const config = buildSingboxConfig(proxies)
    return JSON.stringify(config, null, 2)
  }

  /**
   * 生成 v2rayNG/通用 base64 订阅
   */
  static generateV2rayNGConfig(proxies: Proxy[]): string {
    return generateBase64Subscription(proxies)
  }

  /**
   * HTML 转义，防止 XSS
   */
  private static escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  /**
   * 生成浏览器预览页面
   */
  static generatePreviewHtml(yamlConfig: string, jsonConfig: string): string {
    const escapedYaml = this.escapeHtml(yamlConfig)
    const escapedJson = this.escapeHtml(jsonConfig)

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>SubOps 配置预览</title>
        <style>${previewStyles}</style>
      </head>
      <body>
        <div class="page-shell">
          <header class="preview-topbar">
            <div class="brand">
              <div class="brand-mark">S</div>
              <div>
                <div class="brand-title">SubOps</div>
                <div class="brand-subtitle">配置预览</div>
              </div>
            </div>
            <div class="status-group">
              <span class="status-pill">Browser Preview</span>
              <span class="status-pill green">Clash Ready</span>
              <span class="status-pill cyan">sing-box Ready</span>
            </div>
          </header>

          <section class="hero-card">
            <span class="eyebrow">ARCO CONFIG PREVIEW</span>
            <h1>订阅配置预览</h1>
            <p>浏览器访问会同时展示 Clash YAML 与 sing-box JSON。客户端订阅时仍会根据 User-Agent 自动返回对应格式。</p>
          </section>

          <main class="config-grid">
            <section class="config-panel">
              <div class="panel-header">
                <div class="panel-title">
                  <h2>Clash 配置</h2>
                  <span class="panel-meta">YAML · ${yamlConfig.length.toLocaleString()} chars</span>
                </div>
                <button class="copy-button" type="button" data-target="clash-config">复制 Clash</button>
              </div>
              <div class="code-wrap">
                <pre id="clash-config">${escapedYaml}</pre>
              </div>
            </section>

            <section class="config-panel">
              <div class="panel-header">
                <div class="panel-title">
                  <h2>sing-box 配置</h2>
                  <span class="panel-meta">JSON · ${jsonConfig.length.toLocaleString()} chars</span>
                </div>
                <button class="copy-button" type="button" data-target="singbox-config">复制 sing-box</button>
              </div>
              <div class="code-wrap">
                <pre id="singbox-config">${escapedJson}</pre>
              </div>
            </section>
          </main>

          <div class="tip-card">
            提示：如果你在 Clash、Mihomo、sing-box 等客户端中订阅，请直接使用原始转换链接，系统会自动返回客户端需要的配置格式。
          </div>
        </div>
        <script>
          document.querySelectorAll('.copy-button').forEach((button) => {
            button.addEventListener('click', async () => {
              const target = document.getElementById(button.dataset.target);
              if (!target) return;
              try {
                await navigator.clipboard.writeText(target.textContent || '');
                const original = button.textContent;
                button.textContent = '已复制';
                setTimeout(() => { button.textContent = original; }, 1400);
              } catch {
                button.textContent = '复制失败';
              }
            });
          });
        </script>
      </body>
      </html>
    `
  }

  /**
   * 生成响应头
   */
  static generateResponseHeaders(
    subscription: SubscriptionInfo,
    isSingBox: boolean,
    isBrowser: boolean
  ): Record<string, string> {
    const baseHeaders = {
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    }

    if (isBrowser) {
      return {
        ...baseHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    }

    const configHeaders: Record<string, string> = {
      ...baseHeaders,
      'Content-Type': isSingBox ? 'application/json; charset=utf-8' : 'text/yaml; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(subscription.name)}`,
      'profile-update-interval': String(subscription.updateInterval || 24),
      'profile-title': Buffer.from(subscription.name).toString('base64'),
      'expires': subscription.expire,
      'profile-web-page-url': this.encodeHeaderValue(subscription.homepage),
      'profile-expire': subscription.expire,
      'profile-status': 'active'
    }

    // 只在有流量信息时添加 subscription-userinfo 头
    if (Number(subscription.upload) > 0 || Number(subscription.download) > 0 || Number(subscription.total) > 0) {
      configHeaders['subscription-userinfo'] = 
        `upload=${subscription.upload}; download=${subscription.download}; total=${subscription.total}; expire=${subscription.expire}`
    }

    return configHeaders
  }

  /**
   * 安全编码 HTTP 头部值
   */
  private static encodeHeaderValue(value: string): string {
    try {
      // 检查是否包含非 ASCII 字符
      if (!/^[\x00-\x7F]*$/.test(value)) {
        // 如果是 URL，尝试使用 Punycode 编码域名部分
        if (value.startsWith('http://') || value.startsWith('https://')) {
          try {
            const url = new URL(value)
            return url.toString()
          } catch {
            return encodeURIComponent(value)
          }
        }
        return encodeURIComponent(value)
      }
      return value
    } catch {
      return 'https://sub.xqd.pp.ua'
    }
  }

  /**
   * 检测客户端类型
   */
  static detectClientType(userAgent: string): {
    isSingBox: boolean
    isV2rayNG: boolean
    isBrowser: boolean
    clientType: 'clash' | 'singbox' | 'v2rayng' | 'browser'
  } {
    // 检测 sing-box 客户端标识（支持所有平台）
    // SFA: Sing-box For Android, SFI: Sing-box For iOS, SFM: Sing-box For MAC, SFT: Sing-box For tvOS
    const isSingBox = /sing-box|SFA|SFI|SFM|SFT/i.test(userAgent)

    // 检测 v2rayNG/v2rayN 等通用客户端
    const isV2rayNG = /v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

    const isBrowser = /mozilla|chrome|safari|firefox|edge/i.test(userAgent) &&
      !/sing-box|SFA|SFI|SFM|SFT|clash|v2rayn|v2rayng|quantumult|shadowrocket|surge|loon/i.test(userAgent)

    let clientType: 'clash' | 'singbox' | 'v2rayng' | 'browser'
    if (isSingBox) {
      clientType = 'singbox'
    } else if (isV2rayNG) {
      clientType = 'v2rayng'
    } else if (isBrowser) {
      clientType = 'browser'
    } else {
      clientType = 'clash' // 默认为 Clash（包括 clash.meta、mihomo 等）
    }

    return { isSingBox, isV2rayNG, isBrowser, clientType }
  }

  /**
   * 记录配置生成统计信息
   */
  static logConfigStats(
    proxies: Proxy[],
    formattedProxies: Proxy[],
    yamlConfig: string,
    clientType: string,
    duration: number
  ): void {
    logger.info('\n=== 订阅处理完成 ===')
    logger.info('处理结果:')
    logger.info(`  ├─ 客户端类型: ${clientType}`)
    logger.info(`  ├─ 节点总数: ${proxies.length}`)
    logger.info(`  ├─ 有效节点: ${formattedProxies.length}`)
    logger.info(`  ├─ 处理耗时: ${duration}ms`)
    logger.info(`  └─ 配置大小: ${formatBytes(yamlConfig.length)}`)
    logger.info('结束时间:', new Date().toLocaleString(), '\n')
  }
}
