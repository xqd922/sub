import yaml from 'js-yaml'
import { isProxyUri, parseProxyUriList } from '@/modules/proxy/proxy.registry'
import type { Proxy } from '@/modules/proxy/proxy.types'
import type { YamlSubscription } from '@/modules/renderer/renderer.types'
import { deduplicateProxies } from '@/modules/subscription/proxy-dedup'
import { decodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

const MAX_SUBSCRIPTION_BYTES = 10 * 1024 * 1024

function normalizeYamlProxies(rawProxies: unknown[]): Proxy[] {
  const normalized: Proxy[] = []
  for (const item of rawProxies) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.type !== 'string' || typeof record.server !== 'string') continue

    normalized.push({
      ...(record as unknown as Proxy),
      name: typeof record.name === 'string' && record.name.trim() ? record.name : record.server,
      port: parsePort(record.port as string | number | undefined),
    })
  }
  return normalized
}

function parsePlainProxyLines(text: string): Proxy[] {
  // 按行切分而非按空白切分，保留节点名 (#fragment) 中未编码的空格
  const proxyText = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isProxyUri)
    .join('\n')

  return deduplicateProxies(parseProxyUriList(proxyText), { keepStrategy: 'shorter' })
}

export function parseSubscriptionText(text: string): Proxy[] {
  if (/^\s*proxies\s*:/m.test(text)) {
    try {
      const config = yaml.load(text) as YamlSubscription | null
      if (config && Array.isArray(config.proxies)) {
        return deduplicateProxies(normalizeYamlProxies(config.proxies), {
          keepStrategy: 'shorter',
        })
      }
    } catch {
      // YAML 语法无效时降级尝试明文 URI 或 Base64 解析
    }
  }

  const plainProxies = parsePlainProxyLines(text)
  if (plainProxies.length > 0) {
    return plainProxies
  }

  try {
    return parsePlainProxyLines(decodeBase64Utf8(text.trim()))
  } catch {
    return []
  }
}

export async function parseSubscriptionResponse(response: Response): Promise<Proxy[]> {
  const contentLength = Number(response.headers.get('content-length'))
  if (contentLength > MAX_SUBSCRIPTION_BYTES) {
    throw new Error(
      `订阅文件过大 (${(contentLength / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`,
    )
  }

  const text = await response.text()
  if (!text.trim()) {
    throw new Error('订阅内容为空，请检查订阅链接是否正确')
  }

  const actualBytes = new TextEncoder().encode(text).byteLength
  if (actualBytes > MAX_SUBSCRIPTION_BYTES) {
    throw new Error(
      `订阅文件过大 (${(actualBytes / 1024 / 1024).toFixed(2)}MB)，超过10MB限制`,
    )
  }

  return parseSubscriptionText(text)
}
