import { describe, expect, it } from 'vitest'
import {
  parseVmessUri,
  validateVmessProxy,
  vmessToSingboxOutbound,
  vmessToUri,
} from '@/modules/proxy/codecs/vmess.codec'
import { encodeBase64Utf8 } from '@/shared/base64.utils'

function buildVmessUri(config: Record<string, string | number>): string {
  return `vmess://${encodeBase64Utf8(JSON.stringify(config))}`
}

function defaultConfig(overrides: Record<string, string | number> = {}) {
  return {
    v: '2',
    ps: 'test-node',
    add: '1.2.3.4',
    port: '443',
    id: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
    aid: '0',
    scy: 'auto',
    net: 'tcp',
    tls: '',
    sni: '',
    host: '',
    path: '',
    ...overrides,
  }
}

describe('vmess.codec', () => {
  it('parses basic TCP VMess nodes and defaults', () => {
    const proxy = parseVmessUri(buildVmessUri(defaultConfig()))
    expect(proxy).toMatchObject({
      type: 'vmess',
      name: 'test-node',
      server: '1.2.3.4',
      port: 443,
      uuid: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
      alterId: 0,
      cipher: 'auto',
      network: 'tcp',
      tls: false,
      'skip-cert-verify': false,
      tfo: false,
    })
  })

  it('falls back to server when ps is empty and parses TLS / SNI / alterId', () => {
    const noName = parseVmessUri(buildVmessUri(defaultConfig({ ps: '' })))
    expect(noName.name).toBe('1.2.3.4')

    const withTls = parseVmessUri(
      buildVmessUri(defaultConfig({ tls: 'tls', sni: 'example.com', aid: '16' })),
    )
    expect(withTls.tls).toBe(true)
    expect(withTls.servername).toBe('example.com')
    expect(withTls.alterId).toBe(16)

    const badAid = parseVmessUri(buildVmessUri(defaultConfig({ aid: 'abc' })))
    expect(badAid.alterId).toBe(0)
  })

  it('preserves scy cipher, gRPC transport, fp, alpn, and insecure flag across URI and sing-box', () => {
    const grpcProxy = parseVmessUri(
      buildVmessUri(
        defaultConfig({
          scy: 'aes-128-gcm',
          net: 'grpc',
          path: 'vmess-grpc-svc',
          tls: 'tls',
          sni: 'grpc.example.com',
          fp: 'firefox',
          alpn: 'h2,http/1.1',
          allowInsecure: 1,
        }),
      ),
    )

    expect(grpcProxy.cipher).toBe('aes-128-gcm')
    expect(grpcProxy.network).toBe('grpc')
    expect(grpcProxy['grpc-opts']?.['grpc-service-name']).toBe('vmess-grpc-svc')
    expect(grpcProxy['client-fingerprint']).toBe('firefox')
    expect(grpcProxy.alpn).toEqual(['h2', 'http/1.1'])
    expect(grpcProxy['skip-cert-verify']).toBe(true)

    const outbound = vmessToSingboxOutbound(grpcProxy)
    expect(outbound).toMatchObject({
      type: 'vmess',
      security: 'aes-128-gcm',
      transport: { type: 'grpc', service_name: 'vmess-grpc-svc' },
      tls: {
        enabled: true,
        server_name: 'grpc.example.com',
        insecure: true,
        alpn: ['h2', 'http/1.1'],
        utls: { enabled: true, fingerprint: 'firefox' },
      },
    })

    const reparsed = parseVmessUri(vmessToUri(grpcProxy))
    expect(reparsed.cipher).toBe('aes-128-gcm')
    expect(reparsed.network).toBe('grpc')
    expect(reparsed['grpc-opts']?.['grpc-service-name']).toBe('vmess-grpc-svc')
    expect(reparsed['client-fingerprint']).toBe('firefox')
    expect(reparsed.alpn).toEqual(['h2', 'http/1.1'])
  })

  it('parses WebSocket transport and defaults network to tcp when missing', () => {
    const ws = parseVmessUri(
      buildVmessUri(defaultConfig({ net: 'ws', path: '/ws-path', host: 'ws.example.com' })),
    )
    expect(ws.network).toBe('ws')
    expect(ws['ws-opts']?.path).toBe('/ws-path')
    expect(ws['ws-opts']?.headers?.Host).toBe('ws.example.com')

    const wsFallbackHost = parseVmessUri(
      buildVmessUri(defaultConfig({ net: 'ws', path: '/path', host: '' })),
    )
    expect(wsFallbackHost['ws-opts']?.headers?.Host).toBe('1.2.3.4')

    const missingNet = defaultConfig()
    delete (missingNet as Record<string, unknown>).net
    expect(parseVmessUri(buildVmessUri(missingNet)).network).toBe('tcp')
  })

  it('roundtrips vmess URIs and throws on malformed base64/empty payloads', () => {
    const proxy = parseVmessUri(buildVmessUri(defaultConfig({ ps: '香港 VMess 01', tls: 'tls' })))
    const roundtripped = parseVmessUri(vmessToUri(proxy))
    expect(roundtripped.name).toBe('香港 VMess 01')
    expect(roundtripped.tls).toBe(true)

    expect(() => parseVmessUri('vmess://not-valid-base64!!!')).toThrow()
    expect(() => parseVmessUri('vmess://')).toThrow()
  })

  it('validates vmess proxy objects', () => {
    expect(
      validateVmessProxy({
        type: 'vmess',
        name: 'test',
        server: '1.2.3.4',
        port: 443,
        uuid: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
      }),
    ).toBe(true)

    expect(
      validateVmessProxy({
        type: 'ss',
        name: 'test',
        server: '1.2.3.4',
        port: 443,
        uuid: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
      }),
    ).toBe(false)

    expect(
      validateVmessProxy({
        type: 'vmess',
        name: 'test',
        server: '1.2.3.4',
        port: 443,
      }),
    ).toBe(false)
  })
})
