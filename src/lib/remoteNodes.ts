// 在 src/lib/remoteNodes.ts 文件中

import { parseSubscription } from './parsers';
import { SingleNodeParser } from './singleNode';
import { Proxy } from './types';

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
    console.error(`解析节点失败: ${line}`, error);
    return null;
  }
}

/**
 * 从远程 URL 获取节点列表
 */
export async function fetchNodesFromRemote(url: string): Promise<Proxy[]> {
  try {
    // 获取远程文本内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClashX/1.95.1',
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 0 },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`获取节点信息失败: ${response.status}`);
    }
    
    const content = await response.text();
    
    // 处理其他域名的节点解析
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const proxies = await Promise.all(lines.map(parseNodeOrSubscription));
    
    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item]);
    
    // 对于特定域名，按地区排序
    if (url.includes('githubusercontent.com') || url.includes('pastebin.com') || url.includes('raw')) {
      console.log('对远程获取的节点按地区排序（保留原始名称）');
      return SingleNodeParser.sortProxiesByRegion(filteredProxies);
    }
    
    // 默认返回解析后的节点
    return filteredProxies;
  } catch (error) {
    console.error('获取远程节点失败:', error);
    throw error;
  }
}