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
  VlessProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseVlessUri(uri: string): VlessProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const host = params.get('host')
  const flow = params.get('flow')
  const fp = params.get('fp') || params.get('client-fingerprint') || 'chrome'
  const security = params.get('security') || 'none'
  const type = params.get('type') || 'tcp'
  const pbk = params.get('pbk')
  const sid = params.get('sid')
  const sni = params.get('sni') || ''
  const alpn = params.get('alpn')
  const allowInsecure = params.get('allowInsecure') || params.get('skip-cert-verify')
  const skipCertVerify = allowInsecure === '1' || allowInsecure === 'true'

  return {
    type: 'vless',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port),
    uuid: safeDecodeUriComponent(url.username),
    tls: security === 'tls' || security === 'reality',
    ...(flow ? { flow } : {}),
    servername: sni,
    'skip-cert-verify': skipCertVerify,
    'client-fingerprint': fp,
    network: type,
    tfo: false,
    ...(alpn ? { alpn: alpn.split(',') } : {}),
    ...(pbk
      ? {
          'reality-opts': {
            'public-key': pbk,
            'short-id': sid || '',
          },
        }
      : {}),
    ...(type === 'ws' || type === 'httpupgrade'
      ? {
          'ws-opts': {
            path: params.get('path') || '',
            headers: {
              Host: host || server,
            },
          },
        }
      : {}),
    ...(type === 'grpc'
      ? {
          'grpc-opts': {
            'grpc-service-name': params.get('serviceName') || '',
            ...(params.get('mode') ? { 'grpc-mode': params.get('mode')! } : {}),
          },
        }
      : {}),
  }
}

export function validateVlessProxy(proxy: Proxy): boolean {
  return proxy.type === 'vless' && Boolean(proxy.uuid)
}

export function vlessToUri(proxy: VlessProxy): string {
  const params = new URLSearchParams()
  params.set('type', proxy.network || 'tcp')
  params.set('security', proxy.tls ? (proxy['reality-opts'] ? 'reality' : 'tls') : 'none')

  const sni = proxy.servername || proxy.sni
  if (sni) params.set('sni', sni)
  if (proxy.flow) params.set('flow', proxy.flow)
  if (proxy['client-fingerprint']) params.set('fp', proxy['client-fingerprint'])
  if (proxy['skip-cert-verify']) params.set('allowInsecure', '1')
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)

  if (proxy['reality-opts']) {
    params.set('pbk', proxy['reality-opts']['public-key'] || '')
    if (proxy['reality-opts']['short-id']) params.set('sid', proxy['reality-opts']['short-id'])
  }

  if ((proxy.network === 'ws' || proxy.network === 'httpupgrade') && proxy['ws-opts']) {
    if (proxy['ws-opts'].path) params.set('path', proxy['ws-opts'].path)
    if (proxy['ws-opts'].headers?.Host) params.set('host', proxy['ws-opts'].headers.Host)
  } else if (proxy.network === 'grpc' && proxy['grpc-opts']) {
    if (proxy['grpc-opts']['grpc-service-name']) {
      params.set('serviceName', proxy['grpc-opts']['grpc-service-name'])
    }
    if (proxy['grpc-opts']['grpc-mode']) {
      params.set('mode', proxy['grpc-opts']['grpc-mode'])
    }
  }

  return `vless://${encodeURIComponent(proxy.uuid)}@${formatHostForUri(proxy.server)}:${proxy.port}?${params.toString()}#${encodeURIComponent(proxy.name)}`
}

export function vlessToSingboxOutbound(proxy: VlessProxy): SingboxOutbound {
  const realityOpts = proxy['reality-opts']
  const outbound: SingboxOutbound = {
    type: 'vless',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    uuid: proxy.uuid || '',
    ...(proxy.flow ? { flow: proxy.flow } : {}),
    packet_encoding: 'xudp',
  }

  if (proxy.tls) {
    const alpn = normalizeAlpnList(proxy.alpn)
    const fp = proxy['client-fingerprint'] || proxy.fp
    outbound.tls = {
      enabled: true,
      server_name: proxy.servername || proxy.sni || proxy.server,
      insecure: proxy['skip-cert-verify'] ?? false,
      ...(alpn ? { alpn } : {}),
      ...(fp ? { utls: { enabled: true, fingerprint: fp } } : {}),
      ...(realityOpts
        ? {
            reality: {
              enabled: true,
              public_key: realityOpts['public-key'] || '',
              short_id: realityOpts['short-id'] || '',
            },
            utls: {
              enabled: true,
              fingerprint: fp || 'chrome',
            },
          }
        : {}),
    }
  }

  if (proxy.network === 'grpc') {
    outbound.transport = {
      type: 'grpc',
      service_name: proxy['grpc-opts']?.['grpc-service-name'] || '',
      idle_timeout: '15s',
      ping_timeout: '15s',
    }
  } else if (proxy.network === 'ws') {
    outbound.transport = {
      type: 'ws',
      path: proxy['ws-opts']?.path || proxy.path || '',
      headers: cleanStringHeaders(proxy['ws-opts']?.headers),
    }
  } else if (proxy.network === 'httpupgrade') {
    const headers = cleanStringHeaders(proxy['ws-opts']?.headers)
    const host = headers.Host || headers.host
    outbound.transport = {
      type: 'httpupgrade',
      ...(host ? { host } : {}),
      path: proxy['ws-opts']?.path || proxy.path || '',
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    }
  } else if (proxy.network && proxy.network !== 'tcp') {
    outbound.transport = { type: proxy.network }
  }

  if (proxy.detour) {
    outbound.detour = proxy.detour
  }

  return outbound
}

export const vlessCodec: ProtocolCodec<VlessProxy> = {
  types: ['vless'],
  prefixes: ['vless://'],
  parse: parseVlessUri,
  validate: validateVlessProxy,
  toUri: vlessToUri,
  toSingboxOutbound: vlessToSingboxOutbound,
}
