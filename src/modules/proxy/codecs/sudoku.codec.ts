import {
  extractFragmentName,
  extractRawAuth,
  formatHostForUri,
  parseBoolFlag,
  sanitizeBaseClashProxy,
  stripIpv6Brackets,
} from '@/modules/proxy/codecs/codec.utils'
import type {
  ProtocolCodec,
  Proxy,
  SudokuProxy,
} from '@/modules/proxy/proxy.types'
import { parsePort } from '@/shared/url.utils'

export function parseSudokuUri(uri: string): SudokuProxy {
  const url = new URL(uri)
  const params = url.searchParams
  const server = stripIpv6Brackets(url.hostname)
  const key = extractRawAuth(url) || params.get('key') || ''
  const aeadMethod = params.get('aead-method') || params.get('aead') || undefined
  const tableType = params.get('table-type') || undefined
  const paddingMin = params.get('padding-min')
  const paddingMax = params.get('padding-max')
  const httpMaskMode = params.get('http-mask-mode') || undefined
  const httpMaskHost = params.get('http-mask-host') || undefined
  const pathRoot = params.get('path-root') || undefined
  const multiplex = params.get('multiplex') || undefined
  const customTable = params.get('custom-table') || undefined

  return {
    type: 'sudoku',
    name: extractFragmentName(url, server),
    server,
    port: parsePort(url.port, 443),
    key,
    ...(aeadMethod ? { 'aead-method': aeadMethod } : {}),
    ...(tableType ? { 'table-type': tableType } : {}),
    ...(paddingMin && /^\d+$/.test(paddingMin) ? { 'padding-min': parseInt(paddingMin, 10) } : {}),
    ...(paddingMax && /^\d+$/.test(paddingMax) ? { 'padding-max': parseInt(paddingMax, 10) } : {}),
    ...(params.has('http-mask') ? { 'http-mask': parseBoolFlag(params.get('http-mask')) } : {}),
    ...(httpMaskMode ? { 'http-mask-mode': httpMaskMode } : {}),
    ...(parseBoolFlag(params.get('http-mask-tls')) ? { 'http-mask-tls': true } : {}),
    ...(httpMaskHost ? { 'http-mask-host': httpMaskHost } : {}),
    ...(pathRoot ? { 'path-root': pathRoot } : {}),
    ...(multiplex ? { multiplex } : {}),
    ...(customTable ? { 'custom-table': customTable } : {}),
  }
}

export function validateSudokuProxy(proxy: Proxy): boolean {
  return proxy.type === 'sudoku' && Boolean(proxy.key)
}

export function sudokuToUri(proxy: SudokuProxy): string {
  const params = new URLSearchParams()
  if (proxy['aead-method']) params.set('aead-method', proxy['aead-method'])
  if (proxy['table-type']) params.set('table-type', proxy['table-type'])
  if (proxy['padding-min'] !== undefined) params.set('padding-min', String(proxy['padding-min']))
  if (proxy['padding-max'] !== undefined) params.set('padding-max', String(proxy['padding-max']))
  if (proxy['http-mask'] !== undefined) params.set('http-mask', proxy['http-mask'] ? '1' : '0')
  if (proxy['http-mask-mode']) params.set('http-mask-mode', proxy['http-mask-mode'])
  if (proxy['http-mask-tls']) params.set('http-mask-tls', '1')
  if (proxy['http-mask-host']) params.set('http-mask-host', proxy['http-mask-host'])
  if (proxy['path-root']) params.set('path-root', proxy['path-root'])
  if (proxy.multiplex) params.set('multiplex', proxy.multiplex)
  if (proxy['custom-table']) params.set('custom-table', proxy['custom-table'])

  const query = params.toString() ? `?${params.toString()}` : ''
  return `sudoku://${encodeURIComponent(proxy.key)}@${formatHostForUri(proxy.server)}:${proxy.port}${query}#${encodeURIComponent(proxy.name)}`
}

export function sudokuToClashProxy(proxy: SudokuProxy): Record<string, unknown> {
  return sanitizeBaseClashProxy(proxy)
}

export const sudokuCodec: ProtocolCodec<SudokuProxy> = {
  types: ['sudoku'],
  prefixes: ['sudoku://'],
  parse: parseSudokuUri,
  validate: validateSudokuProxy,
  toUri: sudokuToUri,
  toClashProxy: sudokuToClashProxy,
  // sing-box 暂不支持 Sudoku 出站
  toSingboxOutbound: () => null,
}
