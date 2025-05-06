// 在 src/lib/remoteNodes.ts 文件中

import { parseSubscription } from './parsers';
import { SingleNodeParser } from './singleNode';
import { Proxy } from './types';
import yaml from 'js-yaml';

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
 * 处理特殊节点标记
 * @param proxy 代理节点
 * @param isYamlSource 是否来自 YAML 源
 * @returns 处理后的代理节点
 */
function processSpecialNode(proxy: Proxy, isYamlSource: boolean = false): Proxy {
  // 如果是 YAML 源，不增加链式代理标记
  if (isYamlSource) {
    return proxy;
  }

  if (proxy.name.toLowerCase().includes('bage')) {
    return {
      ...proxy,
      name: `${proxy.name} ⇄`,
      'dialer-proxy': 'SG-Claw-SS'
    };
  }
  return proxy;
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
    
    // 仅处理 githubusercontent.com 域名
    if (url.includes('githubusercontent.com')) {
      console.log('检测到 githubusercontent.com 域名');
      
      // 尝试 YAML 解析
      try {
        const yamlData = yaml.load(content);
        
        if (yamlData && typeof yamlData === 'object') {
          let nodes: Proxy[] = [];
          
          // 处理不同的 YAML 格式
          if (Array.isArray(yamlData)) {
            nodes = yamlData;
          } else if ('proxies' in yamlData && Array.isArray(yamlData.proxies)) {
            nodes = yamlData.proxies;
          } else {
            nodes = [yamlData as Proxy];
          }
          
          // 验证节点
          const validNodes = nodes.filter(node => 
            node && node.name && node.server && node.port && node.type
          );
          
          console.log(`成功解析 ${validNodes.length} 个 YAML 节点`);
          
          // 排序并处理特殊节点，传入 true 表示来自 YAML 源
          const sortedProxies = SingleNodeParser.sortProxiesByRegion(validNodes);
          return sortedProxies.map(proxy => processSpecialNode(proxy, true));
        }
      } catch {
        // YAML 解析失败，继续使用原有解析方式
        console.log('YAML 解析失败，使用逐行解析');
      }
      
      // 分割节点信息，每行一个节点
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      
      // 解析所有节点
      const proxies = await Promise.all(lines.map(parseNodeOrSubscription));
      
      // 展平数组并过滤掉 null 值
      const filteredProxies = proxies
        .filter((item): item is Proxy | Proxy[] => item !== null)
        .flatMap(item => Array.isArray(item) ? item : [item]);
      
      // 排序并处理特殊节点
      const sortedProxies = SingleNodeParser.sortProxiesByRegion(filteredProxies);
      return sortedProxies.map(proxy => processSpecialNode(proxy, false));
    }
    
    // 处理其他域名的节点解析
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const proxies = await Promise.all(lines.map(parseNodeOrSubscription));
    
    const filteredProxies = proxies
      .filter((item): item is Proxy | Proxy[] => item !== null)
      .flatMap(item => Array.isArray(item) ? item : [item]);
    
    // 对于特定域名，按地区排序
    if (url.includes('githubusercontent.com') || url.includes('pastebin.com') || url.includes('raw')) {
      console.log('对远程获取的节点按地区排序（保留原始名称）');
      const sortedProxies = SingleNodeParser.sortProxiesByRegion(filteredProxies);
      
      // 如果是 githubusercontent.com 域名，检查并添加链式代理标记
      if (url.includes('githubusercontent.com')) {
        return sortedProxies.map(proxy => processSpecialNode(proxy, true));
      }
      
      return sortedProxies;
    }
    
    // 默认返回解析后的节点
    return filteredProxies;
  } catch (error) {
    console.error('获取远程节点失败:', error);
    throw error;
  }
}