import { Proxy } from '@/lib/core/types'
import { logger } from '@/lib/core/logger'

/**
 * 链式代理规则
 */
interface ChainRule {
  target: string  // 目标节点匹配规则
  proxy: string   // 前置代理匹配规则
}

/**
 * 链式代理处理器
 */
export class ChainProxyHandler {

  /**
   * 解析链式代理规则字符串
   *
   * @example
   * "HK BGP->HK CM IPv6" => { target: "HK BGP", proxy: "HK CM IPv6" }
   * "*IPv6->*BGP;*IPLC->*直连" => [{ target: "*IPv6", proxy: "*BGP" }, { target: "*IPLC", proxy: "*直连" }]
   */
  static parseChainRules(rulesStr: string): ChainRule[] {
    if (!rulesStr || !rulesStr.trim()) {
      return []
    }

    const rules: ChainRule[] = []

    // 用分号分割多条规则
    const ruleStrings = rulesStr.split(';').map(r => r.trim()).filter(r => r)

    for (const ruleStr of ruleStrings) {
      // 用 -> 分割目标和前置代理
      const parts = ruleStr.split('->').map(p => p.trim())

      if (parts.length < 2) {
        logger.warn(`无效的链式规则: ${ruleStr}`)
        continue
      }

      // 支持多跳链式: A->B->C (A使用B，B使用C)
      for (let i = 0; i < parts.length - 1; i++) {
        rules.push({
          target: parts[i],      // 前一个节点是目标
          proxy: parts[i + 1]    // 后一个节点是前置代理
        })
      }
    }

    logger.info(`解析到 ${rules.length} 条链式规则:`)
    rules.forEach((rule, i) => {
      logger.info(`  ${i + 1}. ${rule.target} 使用 ${rule.proxy} 作为前置代理`)
    })

    return rules
  }

  /**
   * 应用链式代理规则到节点列表
   */
  static applyChainRules(proxies: Proxy[], rulesStr: string): Proxy[] {
    if (!rulesStr || !rulesStr.trim()) {
      return proxies
    }

    const rules = this.parseChainRules(rulesStr)
    if (rules.length === 0) {
      return proxies
    }

    logger.info('\n=== 开始应用链式代理规则 ===')

    const processedProxies = [...proxies]
    let appliedCount = 0

    // 为每条规则找到匹配的节点
    for (const rule of rules) {
      const targetProxies = this.findMatchingProxies(processedProxies, rule.target)
      const proxyNode = this.findProxyNode(processedProxies, rule.proxy)

      if (!proxyNode) {
        logger.warn(`未找到前置代理节点: ${rule.proxy}`)
        continue
      }

      // 为目标节点添加 dialer-proxy
      for (const target of targetProxies) {
        // 跳过已经有 dialer-proxy 的节点
        if (target['dialer-proxy']) {
          logger.info(`  [跳过] ${target.name} 已有前置代理: ${target['dialer-proxy']}`)
          continue
        }

        // 防止自己指向自己
        if (target.name === proxyNode.name) {
          logger.warn(`  [跳过] ${target.name} 不能使用自己作为前置代理`)
          continue
        }

        // 防止循环引用
        if (this.hasCircularReference(processedProxies, target.name, proxyNode.name)) {
          logger.warn(`  [跳过] ${target.name} -> ${proxyNode.name} 会造成循环引用`)
          continue
        }

        target['dialer-proxy'] = proxyNode.name
        appliedCount++
        logger.info(`  [应用] ${target.name} -> ${proxyNode.name}`)
      }
    }

    logger.info(`\n链式代理应用完成: 共 ${appliedCount} 个节点添加了前置代理`)
    logger.info('======================\n')

    return processedProxies
  }

  /**
   * 查找匹配的目标节点
   */
  private static findMatchingProxies(proxies: Proxy[], pattern: string): Proxy[] {
    // 通配符匹配
    if (pattern.startsWith('*')) {
      const keyword = pattern.substring(1).toLowerCase()
      return proxies.filter(p => p.name.toLowerCase().includes(keyword))
    }

    // 精确匹配或包含匹配
    return proxies.filter(p =>
      p.name === pattern ||
      p.name.includes(pattern) ||
      p.name.toLowerCase().includes(pattern.toLowerCase())
    )
  }

  /**
   * 查找前置代理节点（返回第一个匹配的）
   */
  private static findProxyNode(proxies: Proxy[], pattern: string): Proxy | null {
    // 通配符匹配
    if (pattern.startsWith('*')) {
      const keyword = pattern.substring(1).toLowerCase()
      return proxies.find(p => p.name.toLowerCase().includes(keyword)) || null
    }

    // 精确匹配优先
    return proxies.find(p => p.name === pattern) ||
           proxies.find(p => p.name.includes(pattern)) ||
           proxies.find(p => p.name.toLowerCase().includes(pattern.toLowerCase())) ||
           null
  }

  /**
   * 检测循环引用
   *
   * @example
   * A -> B, B -> C, C -> A (循环)
   * A -> B, B -> C, C -> D (正常)
   */
  private static hasCircularReference(
    proxies: Proxy[],
    targetName: string,
    proxyName: string,
    visited: Set<string> = new Set()
  ): boolean {
    // 如果前置代理已经在访问路径中，说明有循环
    if (visited.has(proxyName)) {
      return true
    }

    // 查找前置代理的 dialer-proxy
    const proxyNode = proxies.find(p => p.name === proxyName)
    if (!proxyNode || !proxyNode['dialer-proxy']) {
      return false
    }

    // 如果前置代理的 dialer-proxy 指向目标节点，说明有循环
    if (proxyNode['dialer-proxy'] === targetName) {
      return true
    }

    // 递归检查
    visited.add(proxyName)
    return this.hasCircularReference(
      proxies,
      targetName,
      proxyNode['dialer-proxy'],
      visited
    )
  }

  /**
   * 统计链式代理信息
   */
  static getChainStats(proxies: Proxy[]): {
    totalChained: number
    chainDepth: Map<number, number>
  } {
    const chainedProxies = proxies.filter(p => p['dialer-proxy'])
    const depthMap = new Map<number, number>()

    for (const proxy of chainedProxies) {
      const depth = this.getChainDepth(proxies, proxy.name)
      depthMap.set(depth, (depthMap.get(depth) || 0) + 1)
    }

    return {
      totalChained: chainedProxies.length,
      chainDepth: depthMap
    }
  }

  /**
   * 计算节点的链式深度
   */
  private static getChainDepth(
    proxies: Proxy[],
    nodeName: string,
    visited: Set<string> = new Set()
  ): number {
    if (visited.has(nodeName)) {
      return 0
    }

    const node = proxies.find(p => p.name === nodeName)
    if (!node || !node['dialer-proxy']) {
      return 1
    }

    visited.add(nodeName)
    return 1 + this.getChainDepth(proxies, node['dialer-proxy'], visited)
  }
}
