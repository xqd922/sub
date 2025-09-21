import { parseSubscription } from './parsers';
import { SingleNodeParser } from './singleNode';
import { Proxy } from './types';
import { logger } from './logger';
import { NetService } from '@/services/Net';

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
    // 判断是单节点还是订阅链接
    if (SINGLE_NODE_PREFIXES.some(prefix => line.startsWith(prefix))) {
      return SingleNodeParser.parse(line);
    } else if (SUBSCRIPTION_PREFIXES.some(prefix => line.startsWith(prefix))) {
      return parseSubscription(line);
    }
    return null;
  } catch (error) {
    logger.error(`解析节点失败: ${line}`, error);
    return null;
  }
}

/**
 * 从远程 URL 获取节点列表
 */
export async function fetchNodesFromRemote(url: string): Promise<Proxy[]> {
  try {
    // 使用专用的远程节点网络请求方法
    const response = await NetService.fetchRemoteNodes(url)
    
    if (!response.ok) {
      throw new Error(`获取节点信息失败: ${response.status}`)
    }
    
    const content = await response.text()
    
    // 处理其他域名的节点解析
    const lines = content.split('\n').map(line => line.trim()).filter(line => line)
    const proxies = await Promise.all(lines.map(parseNodeOrSubscription))
    
    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item])
    
    // 直接返回解析后的节点
    return filteredProxies
  } catch (error) {
    logger.error('获取远程节点失败:', error)
    throw error
  }
}