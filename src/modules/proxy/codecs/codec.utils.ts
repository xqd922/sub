import type {
  BaseProxy,
  EchOptions,
  GrpcOptions,
  H2Options,
  HttpTransportOptions,
  RealityOptions,
  ShadowTlsOptions,
  SingboxMultiplexConfig,
  SingboxOutbound,
  SingboxTlsConfig,
  SingboxTransportConfig,
  SmuxOptions,
  WsOptions,
  XhttpDownloadSettings,
  XhttpOptions,
  XhttpReuseSettings,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function stripIpv6Brackets(host: string): string {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1)
  }
  return host
}

export function formatHostForUri(host: string): string {
  return host.includes(':') ? `[${host}]` : host
}

export function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function extractFragmentName(url: URL, fallback: string): string {
  return url.hash ? safeDecodeUriComponent(url.hash.slice(1)) || fallback : fallback
}

export function parseBoolFlag(value: string | null | undefined): boolean {
  if (!value) return false
  const lower = value.trim().toLowerCase()
  return lower === '1' || lower === 'true' || lower === 'yes'
}

/** 完整提取 URI 认证信息（若包含冒号如 user:pass，不丢弃后半部分） */
export function extractRawAuth(url: URL): string {
  const user = safeDecodeUriComponent(url.username)
  if (url.password) {
    return `${user}:${safeDecodeUriComponent(url.password)}`
  }
  return user
}

export function cleanStringHeaders(
  headers?: Record<string, string | undefined>,
): Record<string, string> {
  if (!headers) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== '') {
      result[key] = value
    }
  }
  return result
}

export function normalizeAlpnList(alpn?: string[] | string): string[] | undefined {
  if (!alpn) return undefined
  const list = (Array.isArray(alpn) ? alpn : alpn.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}

export function parseBandwidthMbps(value?: string | number | null): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(gbps|g|mbps|m|kbps|k|bps|b)?$/i)
  if (!match) {
    const digits = trimmed.match(/(\d+)/)
    if (!digits) return undefined
    const parsed = parseInt(digits[1], 10)
    return parsed > 0 ? parsed : undefined
  }
  const amount = parseFloat(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  const unit = (match[2] || 'mbps').toLowerCase()
  if (unit === 'gbps' || unit === 'g') return Math.round(amount * 1000)
  if (unit === 'kbps' || unit === 'k') return Math.max(1, Math.round(amount / 1000))
  if (unit === 'bps' || unit === 'b') return Math.max(1, Math.round(amount / 1_000_000))
  return Math.round(amount)
}

export function normalizeBandwidthLabel(value?: string | number | null): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `${Math.round(value)} Mbps`
  }
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return /^\d+$/.test(trimmed) ? `${trimmed} Mbps` : trimmed
}

export function normalizeSingboxServerPorts(ports?: string): string[] | undefined {
  if (!ports) return undefined
  const list = ports
    .split(',')
    .map((part) => {
      const cleaned = part.trim()
      if (!cleaned) return ''
      if (cleaned.includes('-')) return cleaned.replace(/-/g, ':')
      if (cleaned.includes(':')) return cleaned
      return `${cleaned}:${cleaned}`
    })
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}

export function formatSingboxDuration(value?: string | number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') {
    return value > 0 ? `${value}s` : undefined
  }
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return /^\d+$/.test(trimmed) ? `${trimmed}s` : trimmed
}

export function parseEchParams(params: URLSearchParams): EchOptions | undefined {
  const ech = params.get('ech')
  const echConfig = params.get('ech-config')
  const echQuery = params.get('ech-query-server-name') || params.get('ech-sni')
  if (!parseBoolFlag(ech) && !echConfig && !echQuery) {
    // 某些链接直接把 base64 ECH config 放在 ech=<config> 中
    if (ech && ech !== '0' && ech !== 'false') {
      return { enable: true, config: ech }
    }
    return undefined
  }
  return {
    enable: true,
    ...(echConfig ? { config: echConfig } : {}),
    ...(echQuery ? { 'query-server-name': echQuery } : {}),
  }
}

export function appendEchParams(params: URLSearchParams, ech?: EchOptions): void {
  if (!ech?.enable && !ech?.config && !ech?.['query-server-name']) return
  params.set('ech', '1')
  if (ech.config) params.set('ech-config', ech.config)
  if (ech['query-server-name']) params.set('ech-query-server-name', ech['query-server-name'])
}

export function parseWsEarlyData(
  rawPath: string | null | undefined,
  queryEd?: string | null,
  queryEh?: string | null,
): { path: string; maxEarlyData?: number; earlyDataHeaderName?: string } {
  let path = rawPath || ''
  let maxEarlyData: number | undefined
  let earlyDataHeaderName: string | undefined

  if (path.includes('?')) {
    try {
      const parsed = new URL(path.startsWith('/') ? `https://dummy.local${path}` : `https://dummy.local/${path}`)
      const pathEd = parsed.searchParams.get('ed')
      const pathEh = parsed.searchParams.get('eh')
      if (pathEd && /^\d+$/.test(pathEd)) {
        maxEarlyData = parseInt(pathEd, 10)
        earlyDataHeaderName = 'Sec-WebSocket-Protocol'
        parsed.searchParams.delete('ed')
      }
      if (pathEh) {
        earlyDataHeaderName = pathEh
        parsed.searchParams.delete('eh')
      }
      const remainingQuery = parsed.searchParams.toString()
      path = remainingQuery ? `${parsed.pathname}?${remainingQuery}` : parsed.pathname
    } catch {
      // 保留原始 path
    }
  }

  if (queryEd && /^\d+$/.test(queryEd)) {
    maxEarlyData = parseInt(queryEd, 10)
    if (!earlyDataHeaderName) earlyDataHeaderName = 'Sec-WebSocket-Protocol'
  }
  if (queryEh) {
    earlyDataHeaderName = queryEh
  }

  return { path, maxEarlyData, earlyDataHeaderName }
}

/** 参照 Mihomo parseXHTTPExtra，将 Xray XHTTP extra JSON 映射为 Mihomo xhttp-opts 字段 */
export function parseXhttpExtra(extraRaw: string): Partial<XhttpOptions> {
  try {
    const extra = JSON.parse(extraRaw) as Record<string, unknown>
    if (!extra || typeof extra !== 'object') return {}

    const mapReuse = (xmux: Record<string, unknown>): XhttpReuseSettings | undefined => {
      const reuse: XhttpReuseSettings = {}
      const pickStr = (src: string, dst: keyof XhttpReuseSettings) => {
        const val = xmux[src]
        if (typeof val === 'string' && val) {
          ;(reuse as Record<string, unknown>)[dst] = val
        } else if (typeof val === 'number' && Number.isFinite(val)) {
          ;(reuse as Record<string, unknown>)[dst] = String(Math.trunc(val))
        }
      }
      pickStr('maxConnections', 'max-connections')
      pickStr('maxConcurrency', 'max-concurrency')
      pickStr('cMaxReuseTimes', 'c-max-reuse-times')
      pickStr('hMaxRequestTimes', 'h-max-request-times')
      pickStr('hMaxReusableSecs', 'h-max-reusable-secs')
      if (typeof xmux.hKeepAlivePeriod === 'number' && Number.isFinite(xmux.hKeepAlivePeriod)) {
        reuse['h-keep-alive-period'] = Math.trunc(xmux.hKeepAlivePeriod)
      }
      return Object.keys(reuse).length > 0 ? reuse : undefined
    }

    const opts: Partial<XhttpOptions> = { _rawExtra: extraRaw }
    if (extra.headers && typeof extra.headers === 'object' && !Array.isArray(extra.headers)) {
      const headers = cleanStringHeaders(extra.headers as Record<string, string>)
      if (Object.keys(headers).length > 0) opts.headers = headers
    }
    if (extra.noGRPCHeader === true) opts['no-grpc-header'] = true
    if (typeof extra.xPaddingBytes === 'string' && extra.xPaddingBytes) {
      opts['x-padding-bytes'] = extra.xPaddingBytes
    }
    if (typeof extra.xPaddingObfsMode === 'boolean') {
      opts['x-padding-obfs-mode'] = extra.xPaddingObfsMode
    }
    if (typeof extra.xPaddingKey === 'string' && extra.xPaddingKey) {
      opts['x-padding-key'] = extra.xPaddingKey
    }
    if (typeof extra.xPaddingHeader === 'string' && extra.xPaddingHeader) {
      opts['x-padding-header'] = extra.xPaddingHeader
    }
    if (typeof extra.xPaddingPlacement === 'string' && extra.xPaddingPlacement) {
      opts['x-padding-placement'] = extra.xPaddingPlacement
    }
    if (typeof extra.xPaddingMethod === 'string' && extra.xPaddingMethod) {
      opts['x-padding-method'] = extra.xPaddingMethod
    }
    if (typeof extra.uplinkHTTPMethod === 'string' && extra.uplinkHTTPMethod) {
      opts['uplink-http-method'] = extra.uplinkHTTPMethod
    }
    const sessionPlacement =
      (typeof extra.sessionIDPlacement === 'string' && extra.sessionIDPlacement) ||
      (typeof extra.sessionPlacement === 'string' && extra.sessionPlacement)
    if (sessionPlacement) opts['session-placement'] = sessionPlacement
    const sessionKey =
      (typeof extra.sessionIDKey === 'string' && extra.sessionIDKey) ||
      (typeof extra.sessionKey === 'string' && extra.sessionKey)
    if (sessionKey) opts['session-key'] = sessionKey
    if (typeof extra.sessionIDTable === 'string' && extra.sessionIDTable) {
      opts['session-table'] = extra.sessionIDTable
    }
    if (typeof extra.sessionIDLength === 'string' && extra.sessionIDLength) {
      opts['session-length'] = extra.sessionIDLength
    } else if (typeof extra.sessionIDLength === 'number') {
      opts['session-length'] = String(Math.trunc(extra.sessionIDLength))
    }
    if (typeof extra.seqPlacement === 'string' && extra.seqPlacement) {
      opts['seq-placement'] = extra.seqPlacement
    }
    if (typeof extra.seqKey === 'string' && extra.seqKey) opts['seq-key'] = extra.seqKey
    if (typeof extra.uplinkDataPlacement === 'string' && extra.uplinkDataPlacement) {
      opts['uplink-data-placement'] = extra.uplinkDataPlacement
    }
    if (typeof extra.uplinkDataKey === 'string' && extra.uplinkDataKey) {
      opts['uplink-data-key'] = extra.uplinkDataKey
    }
    if (typeof extra.uplinkChunkSize === 'number') {
      opts['uplink-chunk-size'] = Math.trunc(extra.uplinkChunkSize)
    }
    if (typeof extra.scMaxEachPostBytes === 'number' || typeof extra.scMaxEachPostBytes === 'string') {
      opts['sc-max-each-post-bytes'] = extra.scMaxEachPostBytes
    }
    if (typeof extra.scMinPostsIntervalMs === 'number' || typeof extra.scMinPostsIntervalMs === 'string') {
      opts['sc-min-posts-interval-ms'] = extra.scMinPostsIntervalMs
    }
    if (extra.xmux && typeof extra.xmux === 'object') {
      const reuse = mapReuse(extra.xmux as Record<string, unknown>)
      if (reuse) opts['reuse-settings'] = reuse
    }
    if (extra.downloadSettings && typeof extra.downloadSettings === 'object') {
      const dsRaw = extra.downloadSettings as Record<string, unknown>
      const ds: XhttpDownloadSettings = {}
      if (typeof dsRaw.address === 'string' && dsRaw.address) ds.server = dsRaw.address
      if (typeof dsRaw.port === 'number') ds.port = Math.trunc(dsRaw.port)
      const sec = typeof dsRaw.security === 'string' ? dsRaw.security.toLowerCase() : ''
      if (sec === 'tls' || sec === 'reality') {
        ds.tls = true
        if (dsRaw.tlsSettings && typeof dsRaw.tlsSettings === 'object') {
          const tlsSet = dsRaw.tlsSettings as Record<string, unknown>
          if (typeof tlsSet.serverName === 'string' && tlsSet.serverName) ds.servername = tlsSet.serverName
          if (typeof tlsSet.fingerprint === 'string' && tlsSet.fingerprint) {
            ds['client-fingerprint'] = tlsSet.fingerprint
          }
          if (Array.isArray(tlsSet.alpn)) {
            const alpn = tlsSet.alpn.filter((a): a is string => typeof a === 'string')
            if (alpn.length > 0) ds.alpn = alpn
          }
          if (tlsSet.allowInsecure === true) ds['skip-cert-verify'] = true
        }
        if (sec === 'reality' && dsRaw.realitySettings && typeof dsRaw.realitySettings === 'object') {
          const rSet = dsRaw.realitySettings as Record<string, unknown>
          const rOpts: RealityOptions = {}
          if (typeof rSet.publicKey === 'string' && rSet.publicKey) rOpts['public-key'] = rSet.publicKey
          if (typeof rSet.shortId === 'string' && rSet.shortId) rOpts['short-id'] = rSet.shortId
          if (Object.keys(rOpts).length > 0) ds['reality-opts'] = rOpts
        }
      }
      if (dsRaw.xhttpSettings && typeof dsRaw.xhttpSettings === 'object') {
        const xSet = dsRaw.xhttpSettings as Record<string, unknown>
        if (typeof xSet.path === 'string' && xSet.path) ds.path = xSet.path
        if (typeof xSet.host === 'string' && xSet.host) ds.host = xSet.host
        if (xSet.headers && typeof xSet.headers === 'object') {
          const headers = cleanStringHeaders(xSet.headers as Record<string, string>)
          if (Object.keys(headers).length > 0) ds.headers = headers
        }
        if (xSet.extra && typeof xSet.extra === 'object') {
          const dsExtra = xSet.extra as Record<string, unknown>
          if (dsExtra.xmux && typeof dsExtra.xmux === 'object') {
            const reuse = mapReuse(dsExtra.xmux as Record<string, unknown>)
            if (reuse) ds['reuse-settings'] = reuse
          }
        }
      }
      if (Object.keys(ds).length > 0) opts['download-settings'] = ds
    }
    return opts
  } catch {
    return {}
  }
}

export function buildSingboxTls(
  proxy: BaseProxy & {
    fp?: string
    insecure?: boolean
    'disable-sni'?: boolean
    'reality-opts'?: RealityOptions
  },
  options: {
    forceEnabled?: boolean
    allowUtls?: boolean
  } = {},
): SingboxTlsConfig | undefined {
  const realityOpts = proxy['reality-opts']
  const enabled = options.forceEnabled ?? Boolean(proxy.tls || realityOpts)
  if (!enabled) return undefined

  const alpn = normalizeAlpnList(proxy.alpn)
  const allowUtls = options.allowUtls !== false
  const fp = proxy['client-fingerprint'] || proxy.fp
  const serverName = proxy.servername || proxy.sni || proxy.server

  const tls: SingboxTlsConfig = {
    enabled: true,
    ...(proxy['disable-sni'] ? { disable_sni: true } : { server_name: serverName }),
    insecure: proxy['skip-cert-verify'] ?? proxy.insecure ?? false,
    ...(alpn ? { alpn } : {}),
  }

  if (allowUtls && (fp || realityOpts)) {
    tls.utls = {
      enabled: true,
      fingerprint: fp || 'chrome',
    }
  }

  if (realityOpts && realityOpts['public-key']) {
    tls.reality = {
      enabled: true,
      public_key: realityOpts['public-key'],
      short_id: realityOpts['short-id'] || '',
    }
  }

  if (proxy.certificate) {
    tls.certificate = proxy.certificate
  }

  if (proxy.fingerprint) {
    // Mihomo 的 fingerprint 为证书 SHA256 或 pinSHA256，在 sing-box 中映射为 certificate_sha256
    const pin = proxy.fingerprint.replace(/^sha256\//i, '').trim()
    if (pin) {
      if (/^[0-9a-fA-F:]+$/.test(pin)) {
        tls.certificate_sha256 = [pin.replace(/:/g, '').toLowerCase()]
      } else {
        tls.certificate_public_key_sha256 = [pin]
      }
    }
  }

  if (proxy['ech-opts'] && (proxy['ech-opts'].enable || proxy['ech-opts'].config || proxy['ech-opts']['query-server-name'])) {
    tls.ech = {
      enabled: proxy['ech-opts'].enable ?? true,
      ...(proxy['ech-opts'].config ? { config: [proxy['ech-opts'].config] } : {}),
      ...(proxy['ech-opts']['query-server-name']
        ? { query_server_name: proxy['ech-opts']['query-server-name'] }
        : {}),
    }
  }

  return tls
}

export function buildSingboxMultiplex(smux?: SmuxOptions): SingboxMultiplexConfig | undefined {
  if (!smux?.enabled) return undefined
  const mux: SingboxMultiplexConfig = {
    enabled: true,
    ...(smux.protocol ? { protocol: smux.protocol } : {}),
    ...(smux['max-connections'] ? { max_connections: smux['max-connections'] } : {}),
    ...(smux['min-streams'] ? { min_streams: smux['min-streams'] } : {}),
    ...(smux['max-streams'] ? { max_streams: smux['max-streams'] } : {}),
    ...(smux.padding !== undefined ? { padding: smux.padding } : {}),
  }
  if (smux['brutal-opts']?.enabled) {
    const upMbps = parseBandwidthMbps(smux['brutal-opts'].up)
    const downMbps = parseBandwidthMbps(smux['brutal-opts'].down)
    mux.brutal = {
      enabled: true,
      ...(upMbps ? { up_mbps: upMbps } : {}),
      ...(downMbps ? { down_mbps: downMbps } : {}),
    }
  }
  return mux
}

export type SingboxTransportResult =
  | { supported: true; transport?: SingboxTransportConfig }
  | { supported: false }

export function buildSingboxV2RayTransport(proxy: {
  network?: string
  path?: string
  host?: string
  wsPath?: string
  wsHeaders?: Record<string, string>
  'ws-opts'?: WsOptions
  'grpc-opts'?: GrpcOptions
  'http-opts'?: HttpTransportOptions
  'h2-opts'?: H2Options
}): SingboxTransportResult {
  const network = proxy.network?.toLowerCase()
  if (!network || network === 'tcp') {
    return { supported: true }
  }

  // sing-box 暂不支持 xhttp / splithttp / kcp / mkcp 传输层
  if (network === 'xhttp' || network === 'splithttp' || network === 'kcp' || network === 'mkcp') {
    return { supported: false }
  }

  if (network === 'grpc') {
    return {
      supported: true,
      transport: {
        type: 'grpc',
        service_name: proxy['grpc-opts']?.['grpc-service-name'] || proxy.path || '',
        idle_timeout: '15s',
        ping_timeout: '15s',
      },
    }
  }

  if (network === 'httpupgrade' || (network === 'ws' && proxy['ws-opts']?.['v2ray-http-upgrade'])) {
    const headers = cleanStringHeaders(proxy['ws-opts']?.headers || proxy.wsHeaders)
    const host = headers.Host || headers.host || proxy.host
    return {
      supported: true,
      transport: {
        type: 'httpupgrade',
        ...(host ? { host } : {}),
        path: proxy['ws-opts']?.path || proxy.wsPath || proxy.path || '',
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      },
    }
  }

  if (network === 'ws') {
    const wsOpts = proxy['ws-opts']
    const headers = cleanStringHeaders(wsOpts?.headers || proxy.wsHeaders)
    return {
      supported: true,
      transport: {
        type: 'ws',
        path: wsOpts?.path || proxy.wsPath || proxy.path || '',
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(wsOpts?.['max-early-data'] ? { max_early_data: wsOpts['max-early-data'] } : {}),
        ...(wsOpts?.['early-data-header-name']
          ? { early_data_header_name: wsOpts['early-data-header-name'] }
          : {}),
      },
    }
  }

  if (network === 'h2') {
    const h2 = proxy['h2-opts']
    return {
      supported: true,
      transport: {
        type: 'http',
        ...(h2?.host?.length ? { host: h2.host } : proxy.host ? { host: [proxy.host] } : {}),
        path: h2?.path || proxy.path || '/',
      },
    }
  }

  if (network === 'http') {
    const httpOpts = proxy['http-opts']
    const hostHeader = httpOpts?.headers?.Host || httpOpts?.headers?.host
    const otherHeaders: Record<string, string[]> = {}
    if (httpOpts?.headers) {
      for (const [k, v] of Object.entries(httpOpts.headers)) {
        if (k.toLowerCase() !== 'host' && Array.isArray(v) && v.length > 0) {
          otherHeaders[k] = v
        }
      }
    }
    return {
      supported: true,
      transport: {
        type: 'http',
        ...(hostHeader?.length ? { host: hostHeader } : proxy.host ? { host: [proxy.host] } : {}),
        path: httpOpts?.path?.[0] || proxy.path || '/',
        ...(httpOpts?.method ? { method: httpOpts.method } : {}),
        ...(Object.keys(otherHeaders).length > 0 ? { headers: otherHeaders } : {}),
      },
    }
  }

  if (network === 'quic') {
    return { supported: true, transport: { type: 'quic' } }
  }

  return { supported: false }
}

export function buildShadowTlsSingboxOutbound(
  proxy: BaseProxy,
  stls: ShadowTlsOptions,
  tag: string,
): SingboxOutbound {
  const alpn = normalizeAlpnList(stls.alpn || proxy.alpn)
  const fp = stls.fingerprint || proxy['client-fingerprint']
  return {
    type: 'shadowtls',
    tag,
    server: proxy.server,
    server_port: parsePort(proxy.port),
    version: stls.version || 3,
    ...(stls.password ? { password: stls.password } : {}),
    tls: {
      enabled: true,
      server_name: stls.host || stls.sni || proxy.sni || proxy.servername || proxy.server,
      insecure: stls['skip-cert-verify'] ?? proxy['skip-cert-verify'] ?? false,
      ...(alpn ? { alpn } : {}),
      ...(fp ? { utls: { enabled: true, fingerprint: fp } } : {}),
    },
    ...(proxy.detour ? { detour: proxy.detour } : {}),
  }
}

/** 将 Clash 通用内部字段清理为标准 Mihomo Proxy 对象 */
export function sanitizeBaseClashProxy(proxy: BaseProxy): Record<string, unknown> {
  const result: Record<string, unknown> = { ...proxy }
  if (typeof result.detour === 'string' && result.detour && !result['dialer-proxy']) {
    result['dialer-proxy'] = result.detour
  }
  delete result.detour
  delete result.insecure
  delete result.fp
  delete result.up_mbps
  delete result.down_mbps
  delete result.wsPath
  delete result.wsHeaders

  // 清理内部私有辅助字段（如 xhttp-opts._rawExtra、reality-opts.spider-x）
  if (result['xhttp-opts'] && typeof result['xhttp-opts'] === 'object') {
    const copy = { ...(result['xhttp-opts'] as Record<string, unknown>) }
    delete copy._rawExtra
    result['xhttp-opts'] = copy
  }
  if (result['reality-opts'] && typeof result['reality-opts'] === 'object') {
    const copy = { ...(result['reality-opts'] as Record<string, unknown>) }
    delete copy['spider-x']
    result['reality-opts'] = copy
  }

  // Mihomo 中 httpupgrade 必须表示为 network: ws + ws-opts.v2ray-http-upgrade: true
  if (result.network === 'httpupgrade') {
    result.network = 'ws'
    const existingWs =
      result['ws-opts'] && typeof result['ws-opts'] === 'object'
        ? { ...(result['ws-opts'] as Record<string, unknown>) }
        : {}
    existingWs['v2ray-http-upgrade'] = true
    result['ws-opts'] = existingWs
  }

  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) delete result[key]
  }
  return result
}
