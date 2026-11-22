import {
  appendEchParams,
  buildSingboxTls,
  extractFragmentName,
  extractRawAuth,
  formatHostForUri,
  formatSingboxDuration,
  normalizeAlpnList,
  normalizeBandwidthLabel,
  normalizeSingboxServerPorts,
  parseBandwidthMbps,
  parseBoolFlag,
  parseEchParams,
  safeDecodeUriComponent,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  Hysteria2Proxy,
  ProtocolCodec,
  Proxy,
  SingboxOutbound,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

/**
 * 按官方 Hysteria2 URI 规范及 Mihomo splitHysteria2Ports，
 * 拆解主机段中的端口跳跃写法（如 `hy2://pw@host:20000-30000?...` 或 `host:443,20000-30000`）。
 */
function splitHysteria2PortHopping(uri: string): { normalizedUri: string; hostPorts?: string } {
  const schemeEnd = uri.indexOf('://')
  if (schemeEnd === -1) return { normalizedUri: uri }

  const head = uri.slice(0, schemeEnd + 3)
  const rest = uri.slice(schemeEnd + 3)
  const tailIdx = rest.search(/[/?#]/)
  const authority = tailIdx === -1 ? rest : rest.slice(0, tailIdx)
  const tail = tailIdx === -1 ? '' : rest.slice(tailIdx)

  const atIdx = authority.lastIndexOf('@')
  const userInfo = atIdx === -1 ? '' : authority.slice(0, atIdx + 1)
  const hostPort = atIdx === -1 ? authority : authority.slice(atIdx + 1)

  let host: string
  let portPart: string
  if (hostPort.startsWith('[')) {
    const closeBracket = hostPort.indexOf(']')
    if (closeBracket === -1 || hostPort[closeBracket + 1] !== ':') {
      return { normalizedUri: uri }
    }
    host = hostPort.slice(0, closeBracket + 1)
    portPart = hostPort.slice(closeBracket + 2)
  } else {
    const colonIdx = hostPort.lastIndexOf(':')
    if (colonIdx === -1) return { normalizedUri: uri }
    host = hostPort.slice(0, colonIdx)
    portPart = hostPort.slice(colonIdx + 1)
  }

  if (!/[-,]/.test(portPart)) {
    return { normalizedUri: uri }
  }

  const firstPort = portPart.split(/[-,]/)[0]?.trim()
  if (!firstPort || !/^\d+$/.test(firstPort)) {
    return { normalizedUri: uri }
  }

  return {
    normalizedUri: `${head}${userInfo}${host}:${firstPort}${tail}`,
    hostPorts: portPart,
  }
}

export function parseHysteria2Uri(uri: string): Hysteria2Proxy {
  const lower = uri.toLowerCase()
  const isRealm = lower.startsWith('hy2+realm://') || lower.startsWith('hysteria2+realm://')
  const rawAfterScheme = uri.slice(uri.indexOf('://') + 3)
  const { normalizedUri, hostPorts } = splitHysteria2PortHopping(`hysteria2://${rawAfterScheme}`)

  const url = new URL(normalizedUri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)

  const upParam = normalizeBandwidthLabel(
    params.get('up') || params.get('upmbps') || params.get('up_mbps'),
  )
  const downParam = normalizeBandwidthLabel(
    params.get('down') || params.get('downmbps') || params.get('down_mbps'),
  )
  const obfs = params.get('obfs')
  const obfsPassword = params.get('obfs-password')
  const mport = params.get('mport') || params.get('ports') || hostPorts
  const hopInterval = params.get('hop-interval') || params.get('hop_interval')
  const skipCertVerify =
    parseBoolFlag(params.get('insecure')) ||
    parseBoolFlag(params.get('allowInsecure')) ||
    parseBoolFlag(params.get('skip-cert-verify'))
  const pinSha256 = params.get('pinSHA256') || params.get('pinsha256') || params.get('fingerprint')
  const alpn = params.get('alpn')
  const echOpts = parseEchParams(params)
  const bbrProfile = params.get('bbr-profile') || params.get('bbr_profile')
  const cwnd = params.get('cwnd')
  const udpMtu = params.get('udp-mtu')
  const obfsMin = params.get('obfs-min-packet-size')
  const obfsMax = params.get('obfs-max-packet-size')

  const auth = extractRawAuth(url)
  const password = isRealm ? params.get('auth') || '' : auth

  const proxy: Hysteria2Proxy = {
    type: 'hysteria2',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    password,
    sni: params.get('sni') || '',
    'skip-cert-verify': skipCertVerify,
    alpn: alpn ? normalizeAlpnList(alpn) : ['h3'],
    ...(pinSha256 ? { fingerprint: pinSha256 } : {}),
    ...(upParam ? { up: upParam } : {}),
    ...(downParam ? { down: downParam } : {}),
    ...(obfs ? { obfs } : {}),
    ...(obfsPassword ? { 'obfs-password': obfsPassword } : {}),
    ...(obfsMin && /^\d+$/.test(obfsMin) ? { 'obfs-min-packet-size': parseInt(obfsMin, 10) } : {}),
    ...(obfsMax && /^\d+$/.test(obfsMax) ? { 'obfs-max-packet-size': parseInt(obfsMax, 10) } : {}),
    ...(mport ? { ports: mport } : {}),
    ...(hopInterval ? { 'hop-interval': hopInterval } : {}),
    ...(bbrProfile ? { 'bbr-profile': bbrProfile } : {}),
    ...(cwnd && /^\d+$/.test(cwnd) ? { cwnd: parseInt(cwnd, 10) } : {}),
    ...(udpMtu && /^\d+$/.test(udpMtu) ? { 'udp-mtu': parseInt(udpMtu, 10) } : {}),
    ...(echOpts ? { 'ech-opts': echOpts } : {}),
  }

  if (isRealm) {
    const realmId = safeDecodeUriComponent(url.pathname.replace(/^\/+/, ''))
    const stuns = params.getAll('stun').filter(Boolean)
    proxy['realm-opts'] = {
      enable: true,
      'server-url': `https://${url.host}`,
      ...(auth ? { token: auth } : {}),
      ...(realmId ? { 'realm-id': realmId } : {}),
      ...(stuns.length > 0 ? { 'stun-servers': stuns } : {}),
    }
  }

  return proxy
}

export function validateHysteria2Proxy(proxy: Proxy): boolean {
  if (proxy.type !== 'hysteria2') return false
  return Boolean(proxy.password || proxy['realm-opts']?.enable)
}

export function hysteria2ToUri(proxy: Hysteria2Proxy): string {
  const params = new URLSearchParams()
  const sni = proxy.sni || proxy.servername
  if (sni) params.set('sni', sni)
  if (proxy['skip-cert-verify'] || proxy.insecure) params.set('insecure', '1')
  if (proxy.obfs) params.set('obfs', proxy.obfs)
  if (proxy['obfs-password']) params.set('obfs-password', proxy['obfs-password'])
  if (proxy.ports || proxy.mport) params.set('mport', proxy.ports || proxy.mport || '')
  if (proxy['hop-interval'] !== undefined) params.set('hop-interval', String(proxy['hop-interval']))
  if (proxy.up) params.set('up', proxy.up)
  else if (proxy.up_mbps) params.set('up', String(proxy.up_mbps))
  if (proxy.down) params.set('down', proxy.down)
  else if (proxy.down_mbps) params.set('down', String(proxy.down_mbps))
  if (proxy.alpn) params.set('alpn', Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn)
  if (proxy.fingerprint) params.set('pinSHA256', proxy.fingerprint)
  if (proxy['bbr-profile']) params.set('bbr-profile', proxy['bbr-profile'])
  appendEchParams(params, proxy['ech-opts'])

  const query = params.toString() ? `?${params.toString()}` : ''
  return `hy2://${encodeURIComponent(proxy.password)}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function hysteria2ToClashProxy(proxy: Hysteria2Proxy): Record<string, unknown> {
  const cleaned = sanitizeBaseClashProxy(proxy)
  if (!cleaned.sni && typeof cleaned.servername === 'string' && cleaned.servername) {
    cleaned.sni = cleaned.servername
  }
  delete cleaned.servername
  if (!cleaned.sni) delete cleaned.sni
  if (!cleaned.ports && typeof cleaned.mport === 'string') {
    cleaned.ports = cleaned.mport
  }
  delete cleaned.mport
  if (!cleaned.up && proxy.up_mbps) cleaned.up = `${proxy.up_mbps} Mbps`
  if (!cleaned.down && proxy.down_mbps) cleaned.down = `${proxy.down_mbps} Mbps`
  // Mihomo Hysteria2 不使用 client-fingerprint
  delete cleaned['client-fingerprint']
  return cleaned
}

export function hysteria2ToSingboxOutbound(proxy: Hysteria2Proxy): SingboxOutbound {
  const upMbps = parseBandwidthMbps(proxy.up_mbps ?? proxy.up)
  const downMbps = parseBandwidthMbps(proxy.down_mbps ?? proxy.down)
  const serverPorts = normalizeSingboxServerPorts(proxy.ports || proxy.mport)
  const hopInterval = formatSingboxDuration(proxy['hop-interval'])
  const tls = buildSingboxTls(proxy, { forceEnabled: true, allowUtls: false })

  const outbound: SingboxOutbound = {
    type: 'hysteria2',
    tag: proxy.name,
    server: proxy.server,
    server_port: parsePort(proxy.port, 443),
    ...(serverPorts ? { server_ports: serverPorts } : {}),
    ...(hopInterval ? { hop_interval: hopInterval } : {}),
    password: proxy.password || '',
    tls,
    ...(upMbps ? { up_mbps: upMbps } : {}),
    ...(downMbps ? { down_mbps: downMbps } : {}),
    ...(proxy['bbr-profile'] ? { bbr_profile: proxy['bbr-profile'] } : {}),
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }

  if (proxy.obfs && (proxy['obfs-password'] || proxy.obfs === 'gecko')) {
    outbound.obfs = {
      type: proxy.obfs,
      ...(proxy['obfs-password'] ? { password: proxy['obfs-password'] } : {}),
      ...(proxy['obfs-min-packet-size'] ? { min_packet_size: proxy['obfs-min-packet-size'] } : {}),
      ...(proxy['obfs-max-packet-size'] ? { max_packet_size: proxy['obfs-max-packet-size'] } : {}),
    }
  }

  if (proxy['realm-opts']?.enable && proxy['realm-opts']['server-url']) {
    outbound.realm = {
      server_url: proxy['realm-opts']['server-url'],
      ...(proxy['realm-opts'].token ? { token: proxy['realm-opts'].token } : {}),
      ...(proxy['realm-opts']['realm-id'] ? { realm_id: proxy['realm-opts']['realm-id'] } : {}),
      ...(proxy['realm-opts']['stun-servers']?.length
        ? { stun_servers: proxy['realm-opts']['stun-servers'] }
        : {}),
    }
  }

  return outbound
}

export const hysteria2Codec: ProtocolCodec<Hysteria2Proxy> = {
  types: ['hysteria2'],
  prefixes: ['hysteria2://', 'hy2://', 'hysteria2+realm://', 'hy2+realm://'],
  parse: parseHysteria2Uri,
  validate: validateHysteria2Proxy,
  toUri: hysteria2ToUri,
  toClashProxy: hysteria2ToClashProxy,
  toSingboxOutbound: hysteria2ToSingboxOutbound,
}
