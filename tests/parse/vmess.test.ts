import { describe, it, expect } from 'vitest'
import { parse, validate } from '@/node/proto/vmess'

/**
 * Helper: build a vmess:// URI from a config object
 * VMess format: vmess://BASE64(JSON config)
 */
function buildVmessUri(config: Record<string, string | number>): string {
  const json = JSON.stringify(config)
  return `vmess://${Buffer.from(json).toString('base64')}`
}

/** Standard VMess config with sensible defaults */
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

describe('parse (vmess)', () => {
  // --- Happy path ---

  it('parses a basic VMess TCP node', () => {
    const uri = buildVmessUri(defaultConfig())
    const proxy = parse(uri)

    expect(proxy.type).toBe('vmess')
    expect(proxy.server).toBe('1.2.3.4')
    expect(proxy.port).toBe(443)
    expect(proxy.uuid).toBe('a3482e88-686a-4a58-8126-99c9df64b7bf')
    expect(proxy.alterId).toBe(0)
    expect(proxy.cipher).toBe('auto')
    expect(proxy.network).toBe('tcp')
    expect(proxy.tls).toBe(false)
  })

  it('uses the "ps" field as the proxy name', () => {
    const uri = buildVmessUri(defaultConfig({ ps: 'My-Vmess-Node' }))
    const proxy = parse(uri)

    expect(proxy.name).toBe('My-Vmess-Node')
  })

  it('falls back to server as name when ps is empty', () => {
    const uri = buildVmessUri(defaultConfig({ ps: '' }))
    const proxy = parse(uri)

    expect(proxy.name).toBe('1.2.3.4')
  })

  // --- TLS ---

  it('enables TLS when tls field is "tls"', () => {
    const uri = buildVmessUri(defaultConfig({ tls: 'tls' }))
    const proxy = parse(uri)

    expect(proxy.tls).toBe(true)
  })

  it('disables TLS when tls field is empty', () => {
    const uri = buildVmessUri(defaultConfig({ tls: '' }))
    const proxy = parse(uri)

    expect(proxy.tls).toBe(false)
  })

  // --- WebSocket transport ---

  it('parses WebSocket transport config', () => {
    const uri = buildVmessUri(defaultConfig({
      net: 'ws',
      path: '/ws-path',
      host: 'ws.example.com',
    }))
    const proxy = parse(uri)

    expect(proxy.network).toBe('ws')
    expect(proxy['ws-opts']?.path).toBe('/ws-path')
    expect(proxy['ws-opts']?.headers?.Host).toBe('ws.example.com')
  })

  it('uses server as WS host when host field is empty', () => {
    const uri = buildVmessUri(defaultConfig({
      net: 'ws',
      path: '/path',
      host: '',
    }))
    const proxy = parse(uri)

    expect(proxy['ws-opts']?.headers?.Host).toBe('1.2.3.4')
  })

  // --- SNI ---

  it('parses SNI field into servername', () => {
    const uri = buildVmessUri(defaultConfig({ sni: 'example.com' }))
    const proxy = parse(uri)

    expect(proxy.servername).toBe('example.com')
  })

  // --- AlterId ---

  it('parses numeric alterId', () => {
    const uri = buildVmessUri(defaultConfig({ aid: '16' }))
    const proxy = parse(uri)

    expect(proxy.alterId).toBe(16)
  })

  it('defaults alterId to 0 for non-numeric string', () => {
    const uri = buildVmessUri(defaultConfig({ aid: 'abc' }))
    const proxy = parse(uri)

    expect(proxy.alterId).toBe(0)
  })

  // --- Default values ---

  it('defaults network to tcp when net is missing', () => {
    const cfg = defaultConfig()
    delete (cfg as Record<string, unknown>).net
    const uri = buildVmessUri(cfg)
    const proxy = parse(uri)

    expect(proxy.network).toBe('tcp')
  })

  it('sets skip-cert-verify to false by default', () => {
    const uri = buildVmessUri(defaultConfig())
    const proxy = parse(uri)

    expect(proxy['skip-cert-verify']).toBe(false)
  })

  it('sets tfo to false by default', () => {
    const uri = buildVmessUri(defaultConfig())
    const proxy = parse(uri)

    expect(proxy.tfo).toBe(false)
  })

  // --- Error cases ---

  it('throws on invalid JSON', () => {
    expect(() => parse('vmess://not-valid-base64!!!')).toThrow()
  })

  it('throws on empty URI after vmess:// prefix', () => {
    expect(() => parse('vmess://')).toThrow()
  })
})

describe('validate (vmess)', () => {
  it('returns true for a valid vmess proxy with uuid', () => {
    const proxy = {
      type: 'vmess',
      name: 'test',
      server: '1.2.3.4',
      port: 443,
      uuid: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
    }
    expect(validate(proxy as any)).toBe(true)
  })

  it('returns false when type is not vmess', () => {
    const proxy = {
      type: 'ss',
      name: 'test',
      server: '1.2.3.4',
      port: 443,
      uuid: 'a3482e88-686a-4a58-8126-99c9df64b7bf',
    }
    expect(validate(proxy as any)).toBe(false)
  })

  it('returns false when uuid is missing', () => {
    const proxy = {
      type: 'vmess',
      name: 'test',
      server: '1.2.3.4',
      port: 443,
    }
    expect(validate(proxy as any)).toBe(false)
  })
})
