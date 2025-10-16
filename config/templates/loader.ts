import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { ClashConfig, Proxy } from '@/lib/core/types'
import { logger } from '@/lib/core/logger'

/**
 * 模板加载和管理服务
 */
export class TemplateLoader {
  private static templateCache = new Map<string, ClashConfig>()
  private static readonly TEMPLATES_DIR = path.join(process.cwd(), 'templates')

  /**
   * 加载 Clash 模板文件
   * @param templateName 模板名称（不带扩展名）或完整路径
   */
  static loadClashTemplate(templateName: string = 'default'): ClashConfig | null {
    try {
      // 检查缓存
      if (this.templateCache.has(templateName)) {
        logger.info(`使用缓存的模板: ${templateName}`)
        return this.templateCache.get(templateName)!
      }

      // 确定模板文件路径
      let templatePath: string

      if (path.isAbsolute(templateName)) {
        // 如果是绝对路径，直接使用
        templatePath = templateName
      } else if (templateName.includes('\\') || templateName.includes('/')) {
        // 如果包含路径分隔符，视为相对于项目根目录的路径
        templatePath = path.join(process.cwd(), templateName)
      } else {
        // 否则在 templates 目录中查找
        templatePath = path.join(this.TEMPLATES_DIR, `${templateName}.yml`)

        // 如果 templates 目录中不存在，尝试项目根目录
        if (!fs.existsSync(templatePath)) {
          templatePath = path.join(process.cwd(), `${templateName}.yml`)
        }
      }

      logger.info(`加载模板文件: ${templatePath}`)

      // 检查文件是否存在
      if (!fs.existsSync(templatePath)) {
        logger.error(`模板文件不存在: ${templatePath}`)
        return null
      }

      // 读取并解析 YAML 文件
      const fileContent = fs.readFileSync(templatePath, 'utf-8')
      const template = yaml.load(fileContent) as ClashConfig

      // 验证模板格式
      if (!this.validateTemplate(template)) {
        logger.error(`模板格式无效: ${templatePath}`)
        return null
      }

      // 缓存模板
      this.templateCache.set(templateName, template)

      logger.info(`模板加载成功: ${templateName}`)
      return template

    } catch (error) {
      logger.error(`加载模板失败: ${templateName}`, error)
      return null
    }
  }

  /**
   * 验证模板格式
   */
  private static validateTemplate(template: any): template is ClashConfig {
    return (
      template &&
      typeof template === 'object' &&
      Array.isArray(template['proxy-groups']) &&
      'rules' in template
    )
  }

  /**
   * 应用模板到节点列表
   * @param template 模板配置
   * @param proxies 节点列表
   */
  static applyTemplate(template: ClashConfig, proxies: Proxy[]): ClashConfig {
    logger.info(`应用模板，节点数量: ${proxies.length}`)

    // 深拷贝模板
    const config = JSON.parse(JSON.stringify(template)) as ClashConfig

    // 1. 替换节点列表
    config.proxies = proxies

    // 2. 获取所有节点名称
    const proxyNames = proxies.map(p => p.name)

    // 3. 更新代理组中的节点引用
    config['proxy-groups'] = config['proxy-groups'].map(group => {
      // 保留原有的特殊关键字（如 DIRECT, REJECT 等）
      // 注意：不保留流量信息节点，它们不是真实的代理节点
      const specialProxies = group.proxies.filter(p =>
        ['DIRECT', 'REJECT', 'PASS'].includes(p)
      )

      // 保留引用其他代理组的选项
      const groupReferences = group.proxies.filter(p =>
        config['proxy-groups'].some(g => g.name === p)
      )

      // 根据代理组类型处理
      if (group.type === 'select') {
        // select 类型：保留特殊选项和组引用，然后添加所有节点
        group.proxies = [
          ...specialProxies,
          ...groupReferences,
          ...proxyNames
        ]
      } else if (group.type === 'url-test' || group.type === 'fallback' || group.type === 'load-balance') {
        // 自动测试类型：只使用真实节点
        group.proxies = proxyNames
      } else {
        // 其他类型：保持原样或使用所有节点
        group.proxies = [...specialProxies, ...groupReferences, ...proxyNames]
      }

      return group
    })

    logger.info(`模板应用完成，代理组数量: ${config['proxy-groups'].length}`)
    return config
  }

  /**
   * 清除模板缓存
   */
  static clearCache(templateName?: string) {
    if (templateName) {
      this.templateCache.delete(templateName)
      logger.info(`清除模板缓存: ${templateName}`)
    } else {
      this.templateCache.clear()
      logger.info('清除所有模板缓存')
    }
  }

  /**
   * 列出可用的模板
   */
  static listTemplates(): string[] {
    try {
      if (!fs.existsSync(this.TEMPLATES_DIR)) {
        return []
      }

      const files = fs.readdirSync(this.TEMPLATES_DIR)
      return files
        .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map(f => path.basename(f, path.extname(f)))
    } catch (error) {
      logger.error('列出模板失败', error)
      return []
    }
  }
}
