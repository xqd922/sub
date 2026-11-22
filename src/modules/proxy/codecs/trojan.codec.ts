import {
  cleanStringHeaders,
  extractFragmentName,
  formatHostForUri,
  normalizeAlpnList,
  safeDecodeUriComponent,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  TrojanProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseTrojanUri(uri: string): TrojanProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const allowInsecure = params.get('allowInsecure') || params.get('skip-cert-verify')
  const fp = params.get('fp') || params.get('client-fingerprint')
  const alpn = params.get('alpn')

  const proxy: TrojanProxy = {
    type: 'trojan',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    password: safeDecodeUriComponent(url.username),
    sni: params.get('sni') || server,
    'skip-cert-verify': allowInsecure === '1' || allowInsecure === 'true',
    ...(fp ? { 'client-fingerprint': fp } : {}),
    ...(alpn ? { alpn: alpn.split(',') } : {}),
  }

  const transportType = params.get('type')
  if (transportType === 'grpc') {
    proxy.network = 'grpc'
    proxy['grpc-opts'] = {
      'grpc-service-name': params.get('serviceName') || '',
      ...(params.get('mode') === 'gun' ? { 'grpc-mode': 'gun' } : {}),
    }
  } else if (transportType === 'ws') {
    proxy.network = 'ws'
    proxy['ws-opts'] = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host')! } : {},
    }
  }

  return proxy
}

export function validateTrojanProxy(proxy: Proxy): boolean {
  return proxy.type === 'trojan' && Boolean(proxy.password)
}

export function trojanToUri(proxy: TrojanProxy): string {
  const params = new URLSearchParams()
  if (proxy.sni) params.set('sni', proxy.sni)
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy['client-fingerprint'] || proxy.fp) {
    params.set('fp', proxy['client-fingerprint'] || proxy.fp || '')
  }
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)

  if (proxy.network === 'ws') {
    params.set('type', 'ws')
    if (proxy['ws-opts']?.path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts']?.headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
  } else if (proxy.network === 'grpc') {
    params.set('type', 'grpc')
    if (proxy['grpc-opts']?.['grpc-service-name']) {
      params.set('serviceName', proxy['grpc-opts']['grpc-service-name'])
    }
    if (proxy['grpc-opts']?.['grpc-mode']) {
      params.set('mode', proxy['grpc-opts']['grpc-mode'])
    }
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  return `trojan://${encodeURIComponent(proxy.password)}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function trojanToSingboxOutbound(proxy: TrojanProxy): SingboxOutbound {
  const alpn = normalizeAlpnList(proxy.alpn)
  const fp = proxy['client-fingerprint'] || proxy.fp

  const outbound: SingboxOutbound = {
    type: 'trojan',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    password: proxy.password || '',
    tls: {
      enabled: true,
      server_name: proxy.sni || proxy.servername || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false,
      ...(alpn ? { alpn } : {}),
      ...(fp ? { utls: { enabled: true, fingerprint: fp } } : {}),
    },
  }

  if (proxy.network === 'grpc' && proxy['grpc-opts']) {
    outbound.transport = {
      type: 'grpc',
      service_name: proxy['grpc-opts']['grpc-service-name'] || '',
      idle_timeout: '15s',
      ping_timeout: '15s',
    }
  } else if (proxy.network === 'ws' && proxy['ws-opts']) {
    outbound.transport = {
      type: 'ws',
      path: proxy['ws-opts'].path || '/',
      headers: cleanStringHeaders(proxy['ws-opts'].headers),
    }
  }

  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const trojanCodec: ProtocolCodec<TrojanProxy> = {
  types: ['trojan'],
  prefixes: ['trojan://'],
  parse: parseTrojanUri,
  validate: validateTrojanProxy,
  toUri: trojanToUri,
  toSingboxOutbound: trojanToSingboxOutbound,
}
