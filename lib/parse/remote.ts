import { parseSubscription } from './subscription';
import { SingleNodeParser } from './node';
import { Proxy } from '../core/types';
import { logger } from '../core/logger';
import { NetService } from '@/features';

// 定义支持的协议前缀
const SINGLE_NODE_PREFIXES = [
  'ss://', 'vmess://', 'trojan://', 
  'vless://', 'hysteria2://', 'hy2://'
];

// 定义支持的订阅链接前缀
const SUBSCRIPTION_PREFIXES = ['http://', 'https://'];

/**
 * 解析单个节点或订阅链接
 * @param line 节点或订阅链接
 * @returns 解析后的节点或节点数组
 */
async function parseNodeOrSubscription(line: string): Promise<Proxy | Proxy[] | null> {
  try {
    // 检查是否包含链式代理标记 (用 | 分隔)
    // 支持: |dialer-proxy: (Clash) 或 |detour: (Sing-box) 或 |chain: (通用)
    const proxyMatch = line.match(/\|(dialer-proxy|detour|chain):\s*(.+?)$/i)
    let dialerProxy = ''
    let cleanLine = line

    if (proxyMatch) {
      dialerProxy = proxyMatch[2].trim()
      // 移除链式代理部分，保留原始节点链接
      cleanLine = line.replace(/\|(dialer-proxy|detour|chain):.+$/i, '')
      logger.info(`节点指定前置代理: ${dialerProxy}`)
    }

    // 判断是单节点还是订阅链接
    let proxy: Proxy | Proxy[] | null = null

    if (SINGLE_NODE_PREFIXES.some(prefix => cleanLine.startsWith(prefix))) {
      proxy = SingleNodeParser.parse(cleanLine)

      // 如果有链式代理，同时添加两种格式的字段
      // Clash 使用 dialer-proxy，Sing-box 使用 detour
      if (dialerProxy && proxy && !Array.isArray(proxy)) {
        proxy['dialer-proxy'] = dialerProxy  // Clash 格式
        proxy['detour'] = dialerProxy         // Sing-box 格式
      }
    } else if (SUBSCRIPTION_PREFIXES.some(prefix => cleanLine.startsWith(prefix))) {
      proxy = await parseSubscription(cleanLine)
    }

    return proxy
  } catch (error) {
    logger.error(`解析节点失败: ${line}`, error)
    return null
  }
}

/**
 * 从远程 URL 获取节点列表
 */
export async function fetchNodesFromRemote(url: string): Promise<{
  proxies: Proxy[]
  hasSubscriptionUrls: boolean
}> {
  try {
    // 使用专用的远程节点网络请求方法
    const response = await NetService.fetchRemoteNodes(url)

    if (!response.ok) {
      throw new Error(`获取节点信息失败: ${response.status}`)
    }

    const content = await response.text()

    // 处理其他域名的节点解析
    const lines = content.split('\n').map(line => line.trim()).filter(line => line)

    // 检测是否包含订阅链接
    const hasSubscriptionUrls = lines.some(line =>
      SUBSCRIPTION_PREFIXES.some(prefix => line.startsWith(prefix))
    )

    const proxies = await Promise.all(lines.map(parseNodeOrSubscription))

    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item])

    // 返回节点和是否包含订阅链接的标识
    return {
      proxies: filteredProxies,
      hasSubscriptionUrls
    }
  } catch (error) {
    logger.error('获取远程节点失败:', error)
    throw error
  }
}