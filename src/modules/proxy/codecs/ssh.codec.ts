import {
  extractFragmentName,
  formatHostForUri,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
  SshProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseSshUri(uri: string): SshProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  const username = safeDecodeUriComponent(url.username) || params.get('user') || params.get('username') || 'root'
  const password = safeDecodeUriComponent(url.password) || params.get('password') || ''
  const privateKey = params.get('private-key') || params.get('private_key') || ''
  const passphrase = params.get('private-key-passphrase') || params.get('private_key_passphrase') || ''
  const hostKey = params.getAll('host-key').concat(params.getAll('host_key')).filter(Boolean)
  const hostKeyAlgs = params
    .get('host-key-algorithms')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    type: 'ssh',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 22),
    username,
    ...(password ? { password } : {}),
    ...(privateKey ? { 'private-key': privateKey } : {}),
    ...(passphrase ? { 'private-key-passphrase': passphrase } : {}),
    ...(hostKey.length > 0 ? { 'host-key': hostKey } : {}),
    ...(hostKeyAlgs?.length ? { 'host-key-algorithms': hostKeyAlgs } : {}),
  }
}

export function validateSshProxy(proxy: Proxy): boolean {
  return proxy.type === 'ssh' && Boolean(proxy.username && (proxy.password || proxy['private-key']))
}

export function sshToUri(proxy: SshProxy): string {
  const auth = proxy.password
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}`
    : encodeURIComponent(proxy.username)
  const params = new URLSearchParams()
  if (proxy['private-key']) params.set('private-key', proxy['private-key'])
  if (proxy['private-key-passphrase']) {
    params.set('private-key-passphrase', proxy['private-key-passphrase'])
  }
  if (proxy['host-key']?.length) {
    for (const key of proxy['host-key']) params.append('host-key', key)
  }
  if (proxy['host-key-algorithms']?.length) {
    params.set('host-key-algorithms', proxy['host-key-algorithms'].join(','))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  return `ssh://${auth}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function sshToClashProxy(proxy: SshProxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  delete cleaned['client-version']
  return cleaned
}

export function sshToSingboxOutbound(proxy: SshProxy): SingboxOutbound {
  return {
    type: 'ssh',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 22),
    user: proxy.username,
    ...(proxy.password ? { password: proxy.password } : {}),
    ...(proxy['private-key'] ? { private_key: proxy['private-key'] } : {}),
    ...(proxy['private-key-passphrase']
      ? { private_key_passphrase: proxy['private-key-passphrase'] }
      : {}),
    ...(proxy['host-key']?.length ? { host_key: proxy['host-key'] } : {}),
    ...(proxy['host-key-algorithms']?.length
      ? { host_key_algorithms: proxy['host-key-algorithms'] }
      : {}),
    ...(proxy['client-version'] ? { client_version: proxy['client-version'] } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

export const sshCodec: ProtocolCodec<SshProxy> = {
  types: ['ssh'],
  prefixes: ['ssh://'],
  parse: parseSshUri,
  validate: validateSshProxy,
  toUri: sshToUri,
  toClashProxy: sshToClashProxy,
  toSingboxOutbound: sshToSingboxOutbound,
}
