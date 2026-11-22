import { cleanStringHeaders, stripIpv6Brackets } from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  VmessProxy,
} from '@/modules/proxy/proxy.types'
import { decodeBase64Utf8, encodeBase64Utf8 } from '@/shared/base64.utils'
import { parsePort } from '@/shared/url.utils'

interface RawVmessConfig {
  ps?: string
  add?: string
  port?: string | number
  id?: string
  aid?: string | number
  scy?: string
  net?: string
  type?: string
  tls?: string
  sni?: string
  host?: string
  path?: string
  alpn?: string
  fp?: string
  allowInsecure?: boolean | number | string
  insecure?: boolean | number | string
}

export function parseVmessUri(uri: string): VmessProxy {
  const content = uri.slice(8)
  const config = JSON.parse(decodeBase64Utf8(content)) as RawVmessConfig

  const server = stripIpv6Brackets(config.add || '')
  const network = config.net || 'tcp'
  const skipCertVerify =
    config.allowInsecure === true ||
    config.allowInsecure === 1 ||
    config.allowInsecure === '1' ||
    config.insecure === true ||
    config.insecure === 1 ||
    config.insecure === '1'

  return {
    type: 'vmess',
    name: config.ps || server,
    server,
    port: parsePort(config.port),
    uuid: config.id || '',
    alterId: parseInt(String(config.aid), 10) || 0,
    cipher: config.scy || 'auto',
    network,
    tls: config.tls === 'tls',
    'skip-cert-verify': skipCertVerify,
    servername: config.sni || '',
    tfo: false,
    ...(config.fp ? { 'client-fingerprint': config.fp } : {}),
    ...(config.alpn ? { alpn: config.alpn.split(',') } : {}),
    ...(network === 'ws'
      ? {
          'ws-opts': {
            path: config.path || '',
            headers: {
              Host: config.host || server,
            },
          },
        }
      : {}),
    ...(network === 'grpc'
      ? {
          'grpc-opts': {
            'grpc-service-name': config.path || '',
            ...(config.type && config.type !== 'none' ? { 'grpc-mode': config.type } : {}),
          },
        }
      : {}),
  }
}

export function validateVmessProxy(proxy: unknown): proxy is VmessProxy {
  return (
    typeof proxy === 'object' &&
    proxy !== null &&
    'type' in proxy &&
    proxy.type === 'vmess' &&
    'uuid' in proxy &&
    typeof proxy.uuid === 'string' &&
    proxy.uuid.length > 0
  )
}

export function vmessToUri(proxy: VmessProxy): string {
  const isGrpc = proxy.network === 'grpc'
  const config = {
    v: '2',
    ps: proxy.name,
    add: proxy.server,
    port: String(proxy.port),
    id: proxy.uuid,
    aid: String(proxy.alterId || 0),
    scy: proxy.cipher || 'auto',
    net: proxy.network || 'tcp',
    type: isGrpc ? proxy['grpc-opts']?.['grpc-mode'] || 'gun' : 'none',
    tls: proxy.tls ? 'tls' : '',
    sni: proxy.servername || '',
    host: proxy['ws-opts']?.headers?.Host || proxy.wsHeaders?.Host || '',
    path: isGrpc
      ? proxy['grpc-opts']?.['grpc-service-name'] || ''
      : proxy['ws-opts']?.path || proxy.wsPath || '',
    ...(proxy['client-fingerprint'] ? { fp: proxy['client-fingerprint'] } : {}),
    ...(proxy.alpn ? { alpn: Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn } : {}),
  }

  return `vmess://${encodeBase64Utf8(JSON.stringify(config))}`
}

export function vmessToSingboxOutbound(proxy: VmessProxy): SingboxOutbound {
  const outbound: SingboxOutbound = {
    type: 'vmess',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    security: proxy.cipher || 'auto',
    alter_id: proxy.alterId || 0,
  }

  if (proxy.tls) {
    outbound.tls = {
      enabled: true,
      server_name: proxy.servername || proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false,
      ...(proxy.alpn ? { alpn: Array.isArray(proxy.alpn) ? [...proxy.alpn] : [proxy.alpn] } : {}),
      ...(proxy['client-fingerprint']
        ? { utls: { enabled: true, fingerprint: proxy['client-fingerprint'] } }
        : {}),
    }
  }

  if (proxy.network === 'grpc') {
    outbound.transport = {
      type: 'grpc',
      service_name: proxy['grpc-opts']?.['grpc-service-name'] || proxy.path || '',
      idle_timeout: '15s',
      ping_timeout: '15s',
    }
  } else if (proxy.network && proxy.network !== 'tcp') {
    const headers = proxy['ws-opts']?.headers || proxy.wsHeaders
    outbound.transport = {
      type: proxy.network,
      path: proxy['ws-opts']?.path || proxy.wsPath || '',
      ...(headers ? { headers: cleanStringHeaders(headers) } : {}),
    }
  }

  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const vmessCodec: ProtocolCodec<VmessProxy> = {
  types: ['vmess'],
  prefixes: ['vmess://'],
  parse: parseVmessUri,
  validate: (proxy: Proxy) => validateVmessProxy(proxy),
  toUri: vmessToUri,
  toSingboxOutbound: vmessToSingboxOutbound,
}
