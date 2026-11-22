import { anyTlsCodec } from '@/modules/proxy/codecs/anytls.codec'
import { sanitizeBaseClashProxy } from '@/modules/proxy/codecs/codec.utils'
import { httpCodec } from '@/modules/proxy/codecs/http.codec'
import { hysteriaCodec } from '@/modules/proxy/codecs/hysteria.codec'
import { hysteria2Codec } from '@/modules/proxy/codecs/hysteria2.codec'
import { mieruCodec } from '@/modules/proxy/codecs/mieru.codec'
import { naiveCodec } from '@/modules/proxy/codecs/naive.codec'
import { shadowsocksCodec } from '@/modules/proxy/codecs/shadowsocks.codec'
import { shadowTlsCodec } from '@/modules/proxy/codecs/shadowtls.codec'
import { snellCodec } from '@/modules/proxy/codecs/snell.codec'
import { socksCodec } from '@/modules/proxy/codecs/socks.codec'
import { sshCodec } from '@/modules/proxy/codecs/ssh.codec'
import { ssrCodec } from '@/modules/proxy/codecs/ssr.codec'
import { sudokuCodec } from '@/modules/proxy/codecs/sudoku.codec'
import { trojanCodec } from '@/modules/proxy/codecs/trojan.codec'
import { tuicCodec } from '@/modules/proxy/codecs/tuic.codec'
import { vlessCodec } from '@/modules/proxy/codecs/vless.codec'
import { vmessCodec } from '@/modules/proxy/codecs/vmess.codec'
import { wireGuardCodec } from '@/modules/proxy/codecs/wireguard.codec'
import type {
  ProtocolCodec,
  Proxy,
  SingboxConversionBundle,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { logger } from '@/server/logger'
import { encodeBase64Utf8 } from '@/shared/base64.utils'

function registerCodec<T extends Proxy>(codec: ProtocolCodec<T>): ProtocolCodec<Proxy> {
  return codec as unknown as ProtocolCodec<Proxy>
}

const REGISTERED_CODECS: ReadonlyArray<ProtocolCodec<Proxy>> = [
  registerCodec(shadowsocksCodec),
  registerCodec(ssrCodec),
  registerCodec(vmessCodec),
  registerCodec(trojanCodec),
  registerCodec(vlessCodec),
  registerCodec(hysteriaCodec),
  registerCodec(hysteria2Codec),
  registerCodec(tuicCodec),
  registerCodec(socksCodec),
  registerCodec(httpCodec),
  registerCodec(anyTlsCodec),
  registerCodec(snellCodec),
  registerCodec(wireGuardCodec),
  registerCodec(sshCodec),
  registerCodec(mieruCodec),
  registerCodec(naiveCodec),
  registerCodec(shadowTlsCodec),
  registerCodec(sudokuCodec),
]

const CODEC_BY_TYPE = new Map<Proxy['type'], ProtocolCodec<Proxy>>()
for (const codec of REGISTERED_CODECS) {
  for (const type of codec.types) {
    CODEC_BY_TYPE.set(type, codec)
  }
}

export const SUPPORTED_PROTOCOL_PREFIXES: readonly string[] = REGISTERED_CODECS.flatMap(
  (codec) => codec.prefixes,
)

export function isProxyUri(value: string): boolean {
  const lower = value.trim().toLowerCase()
  return SUPPORTED_PROTOCOL_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export function parseProxyUri(uri: string): Proxy | null {
  try {
    const trimmed = uri.trim()
    const lower = trimmed.toLowerCase()
    const codec = REGISTERED_CODECS.find((item) =>
      item.prefixes.some((prefix) => lower.startsWith(prefix)),
    )
    if (!codec) {
      throw new Error('不支持的代理协议类型，请检查链接格式')
    }
    return codec.parse(trimmed)
  } catch (error) {
    logger.error('节点解析失败:', error)
    return null
  }
}

export function parseProxyUriList(input: string): Proxy[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseProxyUri)
    .filter((proxy): proxy is Proxy => proxy !== null)
}

export function validateProxy(proxy: Proxy): boolean {
  if (!proxy.server || !proxy.port || !proxy.type) return false
  if (proxy.port < 1 || proxy.port > 65535) return false

  const codec = CODEC_BY_TYPE.get(proxy.type)
  return codec ? codec.validate(proxy) : false
}

export function proxyToUri(proxy: Proxy): string | null {
  const codec = CODEC_BY_TYPE.get(proxy.type)
  return codec?.toUri ? codec.toUri(proxy) : null
}

export function proxiesToUris(proxies: Proxy[]): string[] {
  return proxies.map(proxyToUri).filter((uri): uri is string => uri !== null)
}

export function encodeBase64Subscription(proxies: Proxy[]): string {
  return encodeBase64Utf8(proxiesToUris(proxies).join('\n'))
}

export function proxyToClashProxy(proxy: Proxy): Record<string, unknown> | null {
  const codec = CODEC_BY_TYPE.get(proxy.type)
  if (!codec) return sanitizeBaseClashProxy(proxy)
  return codec.toClashProxy ? codec.toClashProxy(proxy) : sanitizeBaseClashProxy(proxy)
}

export function proxyToSingboxBundle(proxy: Proxy): SingboxConversionBundle | null {
  const codec = CODEC_BY_TYPE.get(proxy.type)
  if (!codec) return null
  if (codec.toSingboxBundle) {
    return codec.toSingboxBundle(proxy)
  }
  const outbound = codec.toSingboxOutbound(proxy)
  return outbound ? { outbound } : null
}

export function proxyToSingboxOutbound(proxy: Proxy): SingboxOutbound | null {
  const codec = CODEC_BY_TYPE.get(proxy.type)
  return codec ? codec.toSingboxOutbound(proxy) : null
}
