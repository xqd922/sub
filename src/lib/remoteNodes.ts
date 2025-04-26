// 在 src/lib/remoteNodes.ts 文件中

import { parseSubscription } from './parsers';
import { SingleNodeParser } from './singleNode';
import { Proxy } from './types';

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
    
    // 分割节点信息，每行一个节点
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    // 解析所有节点
    const proxies = await Promise.all(
      lines.map(async (line) => {
        try {
          // 判断是单节点还是订阅链接
          if (line.startsWith('ss://') || 
              line.startsWith('vmess://') || 
              line.startsWith('trojan://') || 
              line.startsWith('vless://') || 
              line.startsWith('hysteria2://') || 
              line.startsWith('hy2://')) {
            // 单节点，使用 SingleNodeParser 解析
            return SingleNodeParser.parse(line);
          } else if (line.startsWith('http://') || line.startsWith('https://')) {
            // 订阅链接，使用 parseSubscription 解析
            return parseSubscription(line);
          }
          return null;
        } catch (error) {
          console.error(`解析节点失败: ${line}`, error);
          return null;
        }
      })
    );
    
    // 展平数组并过滤掉 null 值
    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item]);
      
    // 如果是从Gist或原始文本获取的节点，使用地区优先级排序
    if (url.includes('githubusercontent.com') || url.includes('pastebin.com')) {
      console.log('对远程获取的节点按地区进行排序');
      return SingleNodeParser.sortProxiesByRegion(filteredProxies);
    }
      
    return filteredProxies;
  } catch (error) {
    console.error('获取远程节点失败:', error);
    throw error;
  }
}