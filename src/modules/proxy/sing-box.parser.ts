import type {
  EchOptions,
  H2Options,
  HttpTransportOptions,
  Proxy,
  RealityOptions,
  ShadowTlsOptions,
  SmuxOptions,
  WsOptions,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

type JsonRecord = Record<string, unknown>

const IGNORED_SINGBOX_TYPES = new Set(['direct', 'block', 'dns', 'selector', 'urltest', 'tor'])

function asRecord(val: unknown): JsonRecord | undefined {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as JsonRecord) : undefined
}

function asString(val: unknown): string | undefined {
  return typeof val === 'string' && val ? val : undefined
}

function asStringArray(val: unknown): string[] | undefined {
  if (typeof val === 'string' && val) return [val]
  if (Array.isArray(val)) {
    const list = val.filter((item): item is string => typeof item === 'string' && item.length > 0)
    return list.length > 0 ? list : undefined
  }
  return undefined
}

function asNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && /^\d+$/.test(val.trim())) return parseInt(val.trim(), 10)
  return undefined
}

function parseDurationToSeconds(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val !== 'string') return undefined
  const m = val.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i)
  if (!m) return undefined
  const num = parseFloat(m[1])
  const unit = (m[2] || 's').toLowerCase()
  if (unit === 'ms') return Math.max(1, Math.round(num / 1000))
  if (unit === 'm') return Math.round(num * 60)
  if (unit === 'h') return Math.round(num * 3600)
  return Math.round(num)
}

function parseSingboxTls(rawTls: unknown): {
  tls?: boolean
  sni?: string
  servername?: string
  'skip-cert-verify'?: boolean
  alpn?: string[]
  'client-fingerprint'?: string
  fingerprint?: string
  certificate?: string
  'disable-sni'?: boolean
  'reality-opts'?: RealityOptions
  'ech-opts'?: EchOptions
} {
  const tls = asRecord(rawTls)
  if (!tls || !tls.enabled) return {}

  const alpn = asStringArray(tls.alpn)
  const utls = asRecord(tls.utls)
  const reality = asRecord(tls.reality)
  const ech = asRecord(tls.ech)
  const cert = asStringArray(tls.certificate)?.[0]
  const sha = asStringArray(tls.certificate_sha256)?.[0] || asStringArray(tls.certificate_public_key_sha256)?.[0]

  return {
    tls: true,
    ...(asString(tls.server_name)
      ? { sni: asString(tls.server_name), servername: asString(tls.server_name) }
      : {}),
    ...(tls.disable_sni === true ? { 'disable-sni': true } : {}),
    ...(tls.insecure === true ? { 'skip-cert-verify': true } : {}),
    ...(alpn ? { alpn } : {}),
    ...(utls?.enabled && asString(utls.fingerprint)
      ? { 'client-fingerprint': asString(utls.fingerprint) }
      : {}),
    ...(sha ? { fingerprint: sha } : {}),
    ...(cert ? { certificate: cert } : {}),
    ...(reality?.enabled && asString(reality.public_key)
      ? {
          'reality-opts': {
            'public-key': asString(reality.public_key)!,
            'short-id': asString(reality.short_id) || '',
          },
        }
      : {}),
    ...(ech?.enabled
      ? {
          'ech-opts': {
            enable: true,
            ...(asStringArray(ech.config)?.[0] ? { config: asStringArray(ech.config)![0] } : {}),
            ...(asString(ech.query_server_name)
              ? { 'query-server-name': asString(ech.query_server_name) }
              : {}),
          },
        }
      : {}),
  }
}

function parseSingboxMultiplex(rawMux: unknown): SmuxOptions | undefined {
  const mux = asRecord(rawMux)
  if (!mux || !mux.enabled) return undefined
  const brutal = asRecord(mux.brutal)
  return {
    enabled: true,
    ...(asString(mux.protocol) ? { protocol: asString(mux.protocol) } : {}),
    ...(asNumber(mux.max_connections) ? { 'max-connections': asNumber(mux.max_connections) } : {}),
    ...(asNumber(mux.min_streams) ? { 'min-streams': asNumber(mux.min_streams) } : {}),
    ...(asNumber(mux.max_streams) ? { 'max-streams': asNumber(mux.max_streams) } : {}),
    ...(typeof mux.padding === 'boolean' ? { padding: mux.padding } : {}),
    ...(brutal?.enabled
      ? {
          'brutal-opts': {
            enabled: true,
            ...(asNumber(brutal.up_mbps) ? { up: `${asNumber(brutal.up_mbps)} Mbps` } : {}),
            ...(asNumber(brutal.down_mbps) ? { down: `${asNumber(brutal.down_mbps)} Mbps` } : {}),
          },
        }
      : {}),
  }
}

function parseSingboxTransport(rawTransport: unknown): {
  network?: string
  'ws-opts'?: WsOptions
  'grpc-opts'?: { 'grpc-service-name': string }
  'http-opts'?: HttpTransportOptions
  'h2-opts'?: H2Options
} {
  const tr = asRecord(rawTransport)
  if (!tr) return {}
  const type = asString(tr.type)?.toLowerCase()
  if (!type) return {}

  if (type === 'ws' || type === 'httpupgrade') {
    const rawHeaders = asRecord(tr.headers)
    const headers: Record<string, string> = {}
    if (rawHeaders) {
      for (const [k, v] of Object.entries(rawHeaders)) {
        const val = Array.isArray(v) ? asString(v[0]) : asString(v)
        if (val) headers[k] = val
      }
    }
    const host = asString(tr.host)
    if (host && !headers.Host && !headers.host) {
      headers.Host = host
    }
    return {
      network: type,
      'ws-opts': {
        path: asString(tr.path) || '/',
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(type === 'httpupgrade' ? { 'v2ray-http-upgrade': true } : {}),
        ...(asNumber(tr.max_early_data) ? { 'max-early-data': asNumber(tr.max_early_data) } : {}),
        ...(asString(tr.early_data_header_name)
          ? { 'early-data-header-name': asString(tr.early_data_header_name) }
          : {}),
      },
    }
  }

  if (type === 'grpc') {
    return {
      network: 'grpc',
      'grpc-opts': {
        'grpc-service-name': asString(tr.service_name) || '',
      },
    }
  }

  if (type === 'http') {
    const host = asStringArray(tr.host)
    const path = asString(tr.path) || '/'
    const method = asString(tr.method)
    if (method) {
      return {
        network: 'http',
        'http-opts': {
          method,
          path: [path],
          ...(host ? { headers: { Host: host } } : {}),
        },
      }
    }
    return {
      network: 'h2',
      'h2-opts': {
        path,
        ...(host ? { host } : {}),
      },
    }
  }

  if (type === 'quic') {
    return { network: 'quic' }
  }

  return {}
}

function normalizeServerPortsFromSingbox(val: unknown): string | undefined {
  const list = asStringArray(val)
  if (!list) return undefined
  return list.map((item) => item.replace(/:/g, '-')).join(',')
}

function parsePluginOptsString(rawOpts?: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {}
  if (!rawOpts) return result
  for (const part of rawOpts.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      result[trimmed.toLowerCase()] = true
    } else {
      result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  }
  return result
}

function parseWireGuardEntry(entry: JsonRecord): Proxy | null {
  const privateKey = asString(entry.private_key)
  if (!privateKey) return null

  const rawAddresses = asStringArray(entry.address) || asStringArray(entry.local_address) || []
  let ip: string | undefined
  let ipv6: string | undefined
  for (const addr of rawAddresses) {
    if (addr.includes(':')) {
      if (!ipv6) ipv6 = addr
    } else if (!ip) {
      ip = addr
    }
  }

  const rawPeers = Array.isArray(entry.peers) ? entry.peers.map(asRecord).filter((p): p is JsonRecord => Boolean(p)) : []
  const firstPeer = rawPeers[0]
  const server = asString(firstPeer?.address) || asString(entry.server) || ''
  const port = parsePort(asNumber(firstPeer?.port) ?? asNumber(entry.server_port), 51820)
  const pubKey = asString(firstPeer?.public_key) || asString(entry.peer_public_key)
  if (!server || !pubKey) return null

  const psk = asString(firstPeer?.pre_shared_key) || asString(entry.pre_shared_key)
  const reserved = Array.isArray(firstPeer?.reserved)
    ? firstPeer.reserved.filter((n): n is number => typeof n === 'number')
    : Array.isArray(entry.reserved)
      ? entry.reserved.filter((n): n is number => typeof n === 'number')
      : undefined
  const allowedIps = asStringArray(firstPeer?.allowed_ips)
  const keepalive = asNumber(firstPeer?.persistent_keepalive_interval)

  return {
    type: 'wireguard',
    name: asString(entry.tag) || server,
    server,
    port,
    'private-key': privateKey,
    'public-key': pubKey,
    ...(psk ? { 'pre-shared-key': psk } : {}),
    ...(ip ? { ip } : {}),
    ...(ipv6 ? { ipv6 } : {}),
    ...(reserved?.length ? { reserved } : {}),
    ...(allowedIps?.length ? { 'allowed-ips': allowedIps } : {}),
    ...(asNumber(entry.mtu) ? { mtu: asNumber(entry.mtu) } : {}),
    ...(asNumber(entry.workers) ? { workers: asNumber(entry.workers) } : {}),
    ...(keepalive ? { 'persistent-keepalive': keepalive } : {}),
    udp: true,
    ...(asString(entry.detour) ? { detour: asString(entry.detour) } : {}),
  }
}

export function parseSingboxJsonConfig(raw: unknown): Proxy[] {
  const root = asRecord(raw)
  if (!root) return []

  const rawOutbounds = Array.isArray(root.outbounds) ? root.outbounds.map(asRecord).filter((x): x is JsonRecord => Boolean(x)) : []
  const rawEndpoints = Array.isArray(root.endpoints) ? root.endpoints.map(asRecord).filter((x): x is JsonRecord => Boolean(x)) : []
  if (rawOutbounds.length === 0 && rawEndpoints.length === 0) return []

  // 建立 shadowtls 出站索引，便于把 detour 指向 shadowtls 的组合节点还原为统一模型
  const shadowTlsByTag = new Map<string, JsonRecord>()
  const consumedShadowTlsTags = new Set<string>()
  for (const ob of rawOutbounds) {
    if (asString(ob.type)?.toLowerCase() === 'shadowtls' && asString(ob.tag)) {
      shadowTlsByTag.set(asString(ob.tag)!, ob)
    }
  }

  const proxies: Proxy[] = []

  for (const ob of rawOutbounds) {
    const type = asString(ob.type)?.toLowerCase()
    if (!type || IGNORED_SINGBOX_TYPES.has(type) || type === 'shadowtls') continue

    const detourTag = asString(ob.detour)
    const linkedShadowTls = detourTag ? shadowTlsByTag.get(detourTag) : undefined
    if (linkedShadowTls && detourTag) {
      consumedShadowTlsTags.add(detourTag)
    }

    const server = asString(ob.server) || asString(linkedShadowTls?.server) || ''
    const port = parsePort(asNumber(ob.server_port) ?? asNumber(linkedShadowTls?.server_port))
    const name = asString(ob.tag) || server
    const udp = asString(ob.network)?.toLowerCase() === 'tcp' ? false : true
    const tfo = ob.tcp_fast_open === true ? true : undefined
    const smux = parseSingboxMultiplex(ob.multiplex)
    const tlsFields = parseSingboxTls(ob.tls)
    const effectiveDetour = linkedShadowTls ? asString(linkedShadowTls.detour) : detourTag

    let stlsOpts: ShadowTlsOptions | undefined
    if (linkedShadowTls) {
      const stlsTls = parseSingboxTls(linkedShadowTls.tls)
      stlsOpts = {
        version: asNumber(linkedShadowTls.version) || 3,
        ...(asString(linkedShadowTls.password) ? { password: asString(linkedShadowTls.password) } : {}),
        ...(stlsTls.sni ? { host: stlsTls.sni, sni: stlsTls.sni } : {}),
        ...(stlsTls['skip-cert-verify'] ? { 'skip-cert-verify': true } : {}),
        ...(stlsTls['client-fingerprint'] ? { fingerprint: stlsTls['client-fingerprint'] } : {}),
        ...(stlsTls.alpn ? { alpn: stlsTls.alpn } : {}),
      }
    }

    if (type === 'wireguard') {
      const wg = parseWireGuardEntry(ob)
      if (wg) proxies.push(wg)
      continue
    }

    if (!server) continue

    if (type === 'vless') {
      const uuid = asString(ob.uuid)
      if (!uuid) continue
      const transport = parseSingboxTransport(ob.transport)
      proxies.push({
        type: 'vless',
        name,
        server,
        port,
        uuid,
        udp,
        ...(asString(ob.flow) ? { flow: asString(ob.flow) } : {}),
        ...(asString(ob.packet_encoding) ? { 'packet-encoding': asString(ob.packet_encoding) } : {}),
        ...(tfo ? { tfo } : {}),
        ...tlsFields,
        ...transport,
        ...(stlsOpts ? { 'shadow-tls-opts': stlsOpts } : {}),
        ...(smux ? { smux } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'vmess') {
      const uuid = asString(ob.uuid)
      if (!uuid) continue
      const transport = parseSingboxTransport(ob.transport)
      proxies.push({
        type: 'vmess',
        name,
        server,
        port,
        uuid,
        alterId: asNumber(ob.alter_id) || 0,
        cipher: asString(ob.security) || 'auto',
        udp,
        ...(ob.global_padding === true ? { 'global-padding': true } : {}),
        ...(ob.authenticated_length === true ? { 'authenticated-length': true } : {}),
        ...(asString(ob.packet_encoding) ? { 'packet-encoding': asString(ob.packet_encoding) } : {}),
        ...(tfo ? { tfo } : {}),
        ...tlsFields,
        ...transport,
        ...(stlsOpts ? { 'shadow-tls-opts': stlsOpts } : {}),
        ...(smux ? { smux } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'trojan') {
      const password = asString(ob.password)
      if (!password) continue
      const transport = parseSingboxTransport(ob.transport)
      proxies.push({
        type: 'trojan',
        name,
        server,
        port,
        password,
        udp,
        ...(tfo ? { tfo } : {}),
        ...tlsFields,
        ...transport,
        ...(stlsOpts ? { 'shadow-tls-opts': stlsOpts } : {}),
        ...(smux ? { smux } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'shadowsocks') {
      const cipher = asString(ob.method)
      const password = asString(ob.password) || ''
      if (!cipher) continue
      const uot = asRecord(ob.udp_over_tcp)
      const pluginName = asString(ob.plugin)
      const pluginKv = parsePluginOptsString(asString(ob.plugin_opts))
      let plugin: string | undefined
      let pluginOpts: Record<string, unknown> | undefined
      if (stlsOpts) {
        plugin = 'shadow-tls'
        pluginOpts = { ...stlsOpts }
      } else if (pluginName?.includes('obfs')) {
        plugin = 'obfs'
        pluginOpts = {
          mode: asString(pluginKv.obfs) || asString(pluginKv.mode) || 'http',
          ...(asString(pluginKv['obfs-host']) || asString(pluginKv.host)
            ? { host: asString(pluginKv['obfs-host']) || asString(pluginKv.host) }
            : {}),
        }
      } else if (pluginName?.includes('v2ray-plugin')) {
        plugin = 'v2ray-plugin'
        pluginOpts = {
          mode: asString(pluginKv.mode) || 'websocket',
          ...(asString(pluginKv.host) ? { host: asString(pluginKv.host) } : {}),
          ...(asString(pluginKv.path) ? { path: asString(pluginKv.path) } : {}),
          ...(pluginKv.tls ? { tls: true } : {}),
          ...(pluginKv.mux ? { mux: true } : {}),
        }
      }
      proxies.push({
        type: 'ss',
        name,
        server,
        port,
        cipher,
        password,
        udp,
        ...(tfo ? { tfo } : {}),
        ...(plugin ? { plugin, 'plugin-opts': pluginOpts } : {}),
        ...(ob.udp_over_tcp === true || uot?.enabled
          ? {
              'udp-over-tcp': true,
              ...(asNumber(uot?.version) ? { 'udp-over-tcp-version': asNumber(uot?.version) } : {}),
            }
          : {}),
        ...(smux ? { smux } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'shadowsocksr') {
      const cipher = asString(ob.method)
      const password = asString(ob.password)
      if (!cipher || !password) continue
      proxies.push({
        type: 'ssr',
        name,
        server,
        port,
        cipher,
        password,
        obfs: asString(ob.obfs) || 'plain',
        protocol: asString(ob.protocol) || 'origin',
        ...(asString(ob.obfs_param) ? { 'obfs-param': asString(ob.obfs_param) } : {}),
        ...(asString(ob.protocol_param) ? { 'protocol-param': asString(ob.protocol_param) } : {}),
        udp,
      })
    } else if (type === 'hysteria') {
      const ports = normalizeServerPortsFromSingbox(ob.server_ports)
      const upMbps = asNumber(ob.up_mbps)
      const downMbps = asNumber(ob.down_mbps)
      proxies.push({
        type: 'hysteria',
        name,
        server,
        port,
        ...(ports ? { ports } : {}),
        ...(asString(ob.auth_str) ? { 'auth-str': asString(ob.auth_str) } : {}),
        ...(asString(ob.auth) ? { auth: asString(ob.auth) } : {}),
        ...(upMbps ? { up: `${upMbps} Mbps`, up_mbps: upMbps } : asString(ob.up) ? { up: asString(ob.up) } : {}),
        ...(downMbps
          ? { down: `${downMbps} Mbps`, down_mbps: downMbps }
          : asString(ob.down)
            ? { down: asString(ob.down) }
            : {}),
        ...(asString(ob.obfs) ? { obfs: asString(ob.obfs) } : {}),
        ...(parseDurationToSeconds(ob.hop_interval)
          ? { 'hop-interval': parseDurationToSeconds(ob.hop_interval) }
          : {}),
        ...tlsFields,
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'hysteria2') {
      const obfs = asRecord(ob.obfs)
      const realm = asRecord(ob.realm)
      const ports = normalizeServerPortsFromSingbox(ob.server_ports)
      const upMbps = asNumber(ob.up_mbps)
      const downMbps = asNumber(ob.down_mbps)
      proxies.push({
        type: 'hysteria2',
        name,
        server,
        port,
        password: asString(ob.password) || '',
        ...(ports ? { ports } : {}),
        ...(asString(ob.hop_interval) ? { 'hop-interval': asString(ob.hop_interval) } : {}),
        ...(upMbps ? { up: `${upMbps} Mbps`, up_mbps: upMbps } : {}),
        ...(downMbps ? { down: `${downMbps} Mbps`, down_mbps: downMbps } : {}),
        ...(asString(obfs?.type) ? { obfs: asString(obfs?.type) } : {}),
        ...(asString(obfs?.password) ? { 'obfs-password': asString(obfs?.password) } : {}),
        ...(asNumber(obfs?.min_packet_size)
          ? { 'obfs-min-packet-size': asNumber(obfs?.min_packet_size) }
          : {}),
        ...(asNumber(obfs?.max_packet_size)
          ? { 'obfs-max-packet-size': asNumber(obfs?.max_packet_size) }
          : {}),
        ...(asString(ob.bbr_profile) ? { 'bbr-profile': asString(ob.bbr_profile) } : {}),
        ...(realm && asString(realm.server_url)
          ? {
              'realm-opts': {
                enable: true,
                'server-url': asString(realm.server_url),
                ...(asString(realm.token) ? { token: asString(realm.token) } : {}),
                ...(asString(realm.realm_id) ? { 'realm-id': asString(realm.realm_id) } : {}),
                ...(asStringArray(realm.stun_servers)
                  ? { 'stun-servers': asStringArray(realm.stun_servers) }
                  : {}),
              },
            }
          : {}),
        ...tlsFields,
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'tuic') {
      const uuid = asString(ob.uuid)
      if (!uuid) continue
      const hbSec = parseDurationToSeconds(ob.heartbeat)
      proxies.push({
        type: 'tuic',
        name,
        server,
        port,
        uuid,
        password: asString(ob.password) || '',
        udp,
        ...(asString(ob.congestion_control)
          ? { 'congestion-controller': asString(ob.congestion_control) }
          : {}),
        ...(asString(ob.udp_relay_mode) ? { 'udp-relay-mode': asString(ob.udp_relay_mode) } : {}),
        ...(ob.udp_over_stream === true ? { 'udp-over-stream': true } : {}),
        ...(ob.zero_rtt_handshake === true ? { 'reduce-rtt': true } : {}),
        ...(hbSec ? { 'heartbeat-interval': hbSec * 1000 } : {}),
        ...tlsFields,
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'snell') {
      const psk = asString(ob.psk)
      if (!psk) continue
      const version = asNumber(ob.version) || 4
      const obfsMode = asString(ob.obfs_mode)
      const obfsHost = asString(ob.obfs_host)
      proxies.push({
        type: 'snell',
        name,
        server,
        port,
        psk,
        version,
        udp,
        ...(asString(ob.userkey) ? { userkey: asString(ob.userkey) } : {}),
        ...(ob.reuse === true ? { reuse: true } : {}),
        ...(asString(ob.mode) ? { mode: asString(ob.mode) } : {}),
        ...(stlsOpts
          ? { 'obfs-opts': { mode: 'shadow-tls', ...stlsOpts } }
          : obfsMode && obfsMode !== 'none'
            ? { 'obfs-opts': { mode: obfsMode, ...(obfsHost ? { host: obfsHost } : {}) } }
            : {}),
        ...(tfo ? { tfo } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'anytls') {
      const password = asString(ob.password)
      if (!password) continue
      const checkSec = parseDurationToSeconds(ob.idle_session_check_interval)
      const timeoutSec = parseDurationToSeconds(ob.idle_session_timeout)
      proxies.push({
        type: 'anytls',
        name,
        server,
        port,
        password,
        udp,
        ...(checkSec ? { 'idle-session-check-interval': checkSec } : {}),
        ...(timeoutSec ? { 'idle-session-timeout': timeoutSec } : {}),
        ...(asNumber(ob.min_idle_session) ? { 'min-idle-session': asNumber(ob.min_idle_session) } : {}),
        ...(asString(ob.client_metadata) ? { 'client-metadata': asString(ob.client_metadata) } : {}),
        ...(tfo ? { tfo } : {}),
        ...tlsFields,
        ...(stlsOpts ? { 'shadow-tls-opts': stlsOpts } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'socks') {
      const ver = asString(ob.version)
      const uot = asRecord(ob.udp_over_tcp)
      proxies.push({
        type: 'socks5',
        name,
        server,
        port,
        ...(ver === '4' || ver === '4a' || ver === '5' ? { version: ver } : {}),
        ...(asString(ob.username) ? { username: asString(ob.username) } : {}),
        ...(asString(ob.password) ? { password: asString(ob.password) } : {}),
        udp,
        ...(ob.udp_over_tcp === true || uot?.enabled ? { 'udp-over-tcp': true } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'http') {
      const rawHeaders = asRecord(ob.headers)
      const headers: Record<string, string> = {}
      if (rawHeaders) {
        for (const [k, v] of Object.entries(rawHeaders)) {
          const val = Array.isArray(v) ? asString(v[0]) : asString(v)
          if (val) headers[k] = val
        }
      }
      proxies.push({
        type: 'http',
        name,
        server,
        port,
        ...(asString(ob.username) ? { username: asString(ob.username) } : {}),
        ...(asString(ob.password) ? { password: asString(ob.password) } : {}),
        ...(asString(ob.path) ? { path: asString(ob.path) } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...tlsFields,
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'ssh') {
      proxies.push({
        type: 'ssh',
        name,
        server,
        port: parsePort(asNumber(ob.server_port), 22),
        username: asString(ob.user) || 'root',
        ...(asString(ob.password) ? { password: asString(ob.password) } : {}),
        ...(asStringArray(ob.private_key)?.[0]
          ? { 'private-key': asStringArray(ob.private_key)![0] }
          : {}),
        ...(asString(ob.private_key_passphrase)
          ? { 'private-key-passphrase': asString(ob.private_key_passphrase) }
          : {}),
        ...(asStringArray(ob.host_key) ? { 'host-key': asStringArray(ob.host_key) } : {}),
        ...(asStringArray(ob.host_key_algorithms)
          ? { 'host-key-algorithms': asStringArray(ob.host_key_algorithms) }
          : {}),
        ...(asString(ob.client_version) ? { 'client-version': asString(ob.client_version) } : {}),
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    } else if (type === 'naive') {
      const uot = asRecord(ob.udp_over_tcp)
      proxies.push({
        type: 'naive',
        name,
        server,
        port,
        ...(asString(ob.username) ? { username: asString(ob.username) } : {}),
        ...(asString(ob.password) ? { password: asString(ob.password) } : {}),
        ...(asNumber(ob.insecure_concurrency)
          ? { 'insecure-concurrency': asNumber(ob.insecure_concurrency) }
          : {}),
        ...(ob.quic === true ? { quic: true } : {}),
        ...(asString(ob.quic_congestion_control)
          ? { 'quic-congestion-control': asString(ob.quic_congestion_control) }
          : {}),
        ...(ob.udp_over_tcp === true || uot?.enabled ? { 'udp-over-tcp': true } : {}),
        ...tlsFields,
        ...(effectiveDetour ? { detour: effectiveDetour } : {}),
      })
    }
  }

  // 未被消费的独立 shadowtls 出站仍保留
  for (const [tag, ob] of shadowTlsByTag.entries()) {
    if (consumedShadowTlsTags.has(tag)) continue
    const server = asString(ob.server)
    if (!server) continue
    const tlsFields = parseSingboxTls(ob.tls)
    proxies.push({
      type: 'shadowtls',
      name: tag,
      server,
      port: parsePort(asNumber(ob.server_port)),
      version: asNumber(ob.version) || 3,
      ...(asString(ob.password) ? { password: asString(ob.password) } : {}),
      ...tlsFields,
      ...(asString(ob.detour) ? { detour: asString(ob.detour) } : {}),
    })
  }

  // sing-box 1.11+ WireGuard endpoints
  for (const ep of rawEndpoints) {
    if (asString(ep.type)?.toLowerCase() === 'wireguard') {
      const wg = parseWireGuardEntry(ep)
      if (wg) proxies.push(wg)
    }
  }

  return proxies
}
