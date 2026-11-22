import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  isProxyUri,
  parseProxyUri,
  proxyToClashProxy,
  proxyToSingboxBundle,
  proxyToSingboxOutbound,
  proxyToUri,
  validateProxy,
} from '@/modules/proxy/proxy.registry'
import { renderClashConfig } from '@/modules/renderer/clash.renderer'
import { buildSingboxConfig } from '@/modules/renderer/sing-box.renderer'
import { parseSubscriptionText } from '@/modules/subscription/subscription.parser'
import { encodeBase64UrlUtf8, encodeBase64Utf8 } from '@/shared/base64.utils'

describe('full protocol matrix (Mihomo / sing-box / Xray)', () => {
  it('supports VLESS XHTTP + Reality + extra JSON + PQ encryption + HTTPUpgrade + WS early data', () => {
    const extra = JSON.stringify({
      headers: { 'X-Custom': '1' },
      noGRPCHeader: true,
      xPaddingBytes: '100-1000',
      xmux: { maxConcurrency: '16-32', hKeepAlivePeriod: 30 },
    })
    const xhttpUri = `vless://11111111-1111-1111-1111-111111111111@xhttp.example.net:443?type=xhttp&mode=packet-up&path=%2Fxhttp&host=cdn.example.net&security=reality&sni=www.apple.com&fp=chrome&pbk=pubKey43Chars&sid=ab12&spx=%2F&extra=${encodeURIComponent(extra)}#VLESS-XHTTP`
    const xhttp = parseProxyUri(xhttpUri)
    expect(xhttp).toMatchObject({
      type: 'vless',
      name: 'VLESS-XHTTP',
      network: 'xhttp',
      tls: true,
      'reality-opts': { 'public-key': 'pubKey43Chars', 'short-id': 'ab12', 'spider-x': '/' },
      'xhttp-opts': {
        path: '/xhttp',
        host: 'cdn.example.net',
        mode: 'packet-up',
        'no-grpc-header': true,
        'x-padding-bytes': '100-1000',
        'reuse-settings': { 'max-concurrency': '16-32', 'h-keep-alive-period': 30 },
      },
    })
    expect(validateProxy(xhttp!)).toBe(true)
    // Mihomo YAML 保留 xhttp-opts 并清理内部字段 _rawExtra / spider-x
    const clashXhttp = proxyToClashProxy(xhttp!)
    expect(clashXhttp).toMatchObject({
      type: 'vless',
      network: 'xhttp',
      'xhttp-opts': { path: '/xhttp', mode: 'packet-up' },
    })
    expect((clashXhttp?.['xhttp-opts'] as Record<string, unknown>)?._rawExtra).toBeUndefined()
    // sing-box 暂不支持 xhttp，应返回 null 而非生成无效配置
    expect(proxyToSingboxOutbound(xhttp!)).toBeNull()
    expect(proxyToUri(xhttp!)).toContain('type=xhttp')

    // VLESS Post-Quantum encryption
    const pqVless = parseProxyUri(
      'vless://11111111-1111-1111-1111-111111111111@pq.example.net:443?encryption=mlkem768x25519plus.native.0rtt.key&security=none&type=tcp#VLESS-PQ',
    )
    expect(pqVless).toMatchObject({
      type: 'vless',
      encryption: 'mlkem768x25519plus.native.0rtt.key',
      tls: false,
    })
    expect(proxyToSingboxOutbound(pqVless!)).toBeNull()
    expect(proxyToUri(pqVless!)).toContain('encryption=mlkem768x25519plus')

    // VLESS HTTPUpgrade: Mihomo 用 network: ws + v2ray-http-upgrade: true，sing-box 用 type: httpupgrade
    const huVless = parseProxyUri(
      'vless://11111111-1111-1111-1111-111111111111@hu.example.net:443?security=tls&sni=hu.example.net&type=httpupgrade&path=%2Fup&host=cdn.example.net&ed=2048#VLESS-HU',
    )
    expect(proxyToClashProxy(huVless!)).toMatchObject({
      network: 'ws',
      'ws-opts': { path: '/up', 'v2ray-http-upgrade': true, 'v2ray-http-upgrade-fast-open': true },
    })
    expect(proxyToSingboxOutbound(huVless!)).toMatchObject({
      type: 'vless',
      transport: { type: 'httpupgrade', path: '/up', host: 'cdn.example.net' },
    })

    // VLESS WS Early Data (?ed=2048 内嵌在 path 中)
    const wsEd = parseProxyUri(
      'vless://11111111-1111-1111-1111-111111111111@ws.example.net:443?security=tls&type=ws&path=%2Fws%3Fed%3D2048&host=ws.example.net#VLESS-ED',
    )
    expect(wsEd).toMatchObject({
      'ws-opts': {
        path: '/ws',
        'max-early-data': 2048,
        'early-data-header-name': 'Sec-WebSocket-Protocol',
      },
    })
    expect(proxyToSingboxOutbound(wsEd!)).toMatchObject({
      transport: {
        type: 'ws',
        path: '/ws',
        max_early_data: 2048,
        early_data_header_name: 'Sec-WebSocket-Protocol',
      },
    })
  })

  it('supports Snell v1-v6, v5->v4 sing-box compat, v6 mode, and Snell+ShadowTLS detour chaining', () => {
    const snellV2 = parseProxyUri('snell://psk@sn2.example.net:6160?version=2#Snell-v2')
    expect(snellV2).toMatchObject({ type: 'snell', psk: 'psk', version: 2, udp: false })
    expect(proxyToClashProxy(snellV2!)).not.toHaveProperty('udp')
    expect(proxyToSingboxOutbound(snellV2!)).toBeNull()

    const snellV5 = parseProxyUri('snell://sn5.example.net:6160?psk=secret5&version=5&obfs=tls&obfs-host=bing.com#Snell-v5')
    expect(proxyToSingboxOutbound(snellV5!)).toMatchObject({
      type: 'snell',
      version: 4,
      psk: 'secret5',
      obfs_mode: 'tls',
      obfs_host: 'bing.com',
    })

    const snellV6 = parseProxyUri('snell://sn6.example.net:6160?psk=secret6&version=6&mode=unshaped&userkey=uk1#Snell-v6')
    expect(proxyToSingboxOutbound(snellV6!)).toMatchObject({
      type: 'snell',
      version: 6,
      psk: 'secret6',
      userkey: 'uk1',
      mode: 'unshaped',
    })
    expect(proxyToUri(snellV6!)).toContain('mode=unshaped')

    // Snell + ShadowTLS 自动拆分为 shadowtls 前置出站 + snell detour
    const snellStls = parseProxyUri(
      'snell://stls.example.net:443?psk=mypsk&version=4&obfs=shadow-tls&obfs-host=gateway.icloud.com&shadow-tls-password=stpw&shadow-tls-version=3#Snell-STLS',
    )
    const bundle = proxyToSingboxBundle(snellStls!)
    expect(bundle?.extraOutbounds).toHaveLength(1)
    expect(bundle?.extraOutbounds?.[0]).toMatchObject({
      type: 'shadowtls',
      server: 'stls.example.net',
      server_port: 443,
      version: 3,
      password: 'stpw',
      tls: { enabled: true, server_name: 'gateway.icloud.com' },
    })
    expect(bundle?.outbound).toMatchObject({
      type: 'snell',
      version: 4,
      psk: 'mypsk',
      detour: 'Snell-STLS-shadowtls',
    })
    expect(bundle?.outbound?.obfs_mode).toBeUndefined()
  })

  it('supports Hysteria2 host port-hopping, user:pass auth, pinSHA256, hop-interval, Gbps, gecko obfs & realm', () => {
    const hy2Hop = parseProxyUri(
      'hy2://user:pass@hy.example.net:20000-30000?sni=hy.example.net&pinSHA256=abcdef123456&hop-interval=30&up=1%20Gbps&down=500%20Mbps&obfs=gecko&obfs-password=gpw&obfs-min-packet-size=64&obfs-max-packet-size=512&bbr-profile=aggressive#HY2-Hop',
    )
    expect(hy2Hop).toMatchObject({
      type: 'hysteria2',
      server: 'hy.example.net',
      port: 20000,
      ports: '20000-30000',
      password: 'user:pass',
      fingerprint: 'abcdef123456',
      'hop-interval': '30',
      'bbr-profile': 'aggressive',
    })
    expect(proxyToSingboxOutbound(hy2Hop!)).toMatchObject({
      type: 'hysteria2',
      server_port: 20000,
      server_ports: ['20000:30000'],
      hop_interval: '30s',
      up_mbps: 1000,
      down_mbps: 500,
      password: 'user:pass',
      bbr_profile: 'aggressive',
      obfs: { type: 'gecko', password: 'gpw', min_packet_size: 64, max_packet_size: 512 },
      tls: { enabled: true, certificate_sha256: ['abcdef123456'] },
    })

    const hy2Realm = parseProxyUri(
      'hy2+realm://tok123@realm.example.net:443/my-realm?stun=stun.l.google.com:19302&auth=rpw#HY2-Realm',
    )
    expect(hy2Realm).toMatchObject({
      type: 'hysteria2',
      password: 'rpw',
      'realm-opts': {
        enable: true,
        'server-url': 'https://realm.example.net:443',
        token: 'tok123',
        'realm-id': 'my-realm',
        'stun-servers': ['stun.l.google.com:19302'],
      },
    })
  })

  it('supports TUIC v5/v4, Hysteria v1, SSR, WireGuard (Mihomo + sing-box endpoint), HTTP, SSH, Mieru, Naive, ShadowTLS, Sudoku', () => {
    // TUIC v5
    const tuic5 = parseProxyUri(
      'tuic://11111111-1111-1111-1111-111111111111:tpw@tuic.example.net:443?congestion_control=bbr&udp_relay_mode=native&alpn=h3&sni=tuic.example.net&reduce_rtt=1&heartbeat_interval=10000#TUIC-v5',
    )
    expect(validateProxy(tuic5!)).toBe(true)
    expect(proxyToSingboxOutbound(tuic5!)).toMatchObject({
      type: 'tuic',
      uuid: '11111111-1111-1111-1111-111111111111',
      password: 'tpw',
      congestion_control: 'bbr',
      udp_relay_mode: 'native',
      zero_rtt_handshake: true,
      heartbeat: '10s',
      tls: { enabled: true, server_name: 'tuic.example.net', alpn: ['h3'] },
    })
    expect(parseProxyUri(proxyToUri(tuic5!)!)).toMatchObject({ type: 'tuic', password: 'tpw' })

    // TUIC v4 (Mihomo 支持，sing-box 跳过)
    const tuic4 = parseProxyUri('tuic://v4token@tuic4.example.net:443?sni=tuic4.example.net#TUIC-v4')
    expect(validateProxy(tuic4!)).toBe(true)
    expect(proxyToClashProxy(tuic4!)).toMatchObject({ type: 'tuic', token: 'v4token' })
    expect(proxyToSingboxOutbound(tuic4!)).toBeNull()

    // Hysteria v1
    const hy1 = parseProxyUri(
      'hysteria://hy1.example.net:443?protocol=udp&auth=hy1pw&peer=hy1.example.net&insecure=1&upmbps=50&downmbps=200&obfsParam=xplus#HY1',
    )
    expect(validateProxy(hy1!)).toBe(true)
    expect(proxyToSingboxOutbound(hy1!)).toMatchObject({
      type: 'hysteria',
      auth_str: 'hy1pw',
      up_mbps: 50,
      down_mbps: 200,
      obfs: 'xplus',
      tls: { enabled: true, server_name: 'hy1.example.net', insecure: true },
    })

    // ShadowsocksR
    const ssrPayload = `ssr.example.net:8388:auth_aes128_md5:aes-128-ctr:tls1.2_ticket_auth:${encodeBase64UrlUtf8('ssrpw')}/?obfsparam=${encodeBase64UrlUtf8('bing.com')}&protoparam=${encodeBase64UrlUtf8('123:abc')}&remarks=${encodeBase64UrlUtf8('SSR-Node')}`
    const ssr = parseProxyUri(`ssr://${encodeBase64UrlUtf8(ssrPayload)}`)
    expect(ssr).toMatchObject({
      type: 'ssr',
      name: 'SSR-Node',
      server: 'ssr.example.net',
      port: 8388,
      cipher: 'aes-128-ctr',
      password: 'ssrpw',
      protocol: 'auth_aes128_md5',
      obfs: 'tls1.2_ticket_auth',
      'obfs-param': 'bing.com',
      'protocol-param': '123:abc',
    })
    expect(validateProxy(ssr!)).toBe(true)
    expect(proxyToSingboxOutbound(ssr!)).toBeNull()
    expect(parseProxyUri(proxyToUri(ssr!)!)).toMatchObject({ name: 'SSR-Node', password: 'ssrpw' })

    // WireGuard (Mihomo proxy + sing-box 1.11+ endpoint)
    const wg = parseProxyUri(
      'wireguard://privKeyBase64@wg.example.net:51820?publickey=pubKeyBase64&address=172.16.0.2/32,2606:4700::2/128&reserved=1,2,3&mtu=1280#WARP-WG',
    )
    expect(validateProxy(wg!)).toBe(true)
    expect(proxyToClashProxy(wg!)).toMatchObject({
      type: 'wireguard',
      ip: '172.16.0.2',
      ipv6: '2606:4700::2',
      'public-key': 'pubKeyBase64',
      reserved: [1, 2, 3],
      mtu: 1280,
    })
    const sbConfig = buildSingboxConfig([wg!, tuic5!])
    expect(sbConfig.endpoints).toHaveLength(1)
    expect(sbConfig.endpoints?.[0]).toMatchObject({
      type: 'wireguard',
      tag: 'WARP-WG',
      address: ['172.16.0.2/32', '2606:4700::2/128'],
      private_key: 'privKeyBase64',
      mtu: 1280,
      peers: [
        {
          address: 'wg.example.net',
          port: 51820,
          public_key: 'pubKeyBase64',
          reserved: [1, 2, 3],
        },
      ],
    })
    // Manual selector 包含 WireGuard endpoint tag
    const manualGroup = sbConfig.outbounds.find((ob) => ob.tag === 'Manual') as unknown as {
      outbounds: string[]
    }
    expect(manualGroup.outbounds).toContain('WARP-WG')

    // SSH
    const ssh = parseProxyUri('ssh://root:sshpass@ssh.example.net:2222#SSH-Tunnel')
    expect(validateProxy(ssh!)).toBe(true)
    expect(proxyToSingboxOutbound(ssh!)).toMatchObject({
      type: 'ssh',
      server: 'ssh.example.net',
      server_port: 2222,
      user: 'root',
      password: 'sshpass',
    })

    // Mieru (Mihomo only)
    const mieru = parseProxyUri(
      'mierus://muser:mpass@mieru.example.net?port=10000-20000&protocol=TCP&multiplexing=MULTIPLEXING_HIGH#Mieru-01',
    )
    expect(validateProxy(mieru!)).toBe(true)
    expect(proxyToClashProxy(mieru!)).toMatchObject({
      type: 'mieru',
      'port-range': '10000-20000',
      transport: 'TCP',
      username: 'muser',
      password: 'mpass',
      multiplexing: 'MULTIPLEXING_HIGH',
    })
    expect(proxyToSingboxOutbound(mieru!)).toBeNull()

    // NaiveProxy (sing-box only, Clash renderer safely skips it)
    const naive = parseProxyUri('naive+https://nuser:npass@naive.example.net:443?padding=true#Naive-01')
    expect(validateProxy(naive!)).toBe(true)
    expect(proxyToClashProxy(naive!)).toBeNull()
    expect(proxyToSingboxOutbound(naive!)).toMatchObject({
      type: 'naive',
      username: 'nuser',
      password: 'npass',
      tls: { enabled: true, server_name: 'naive.example.net' },
    })

    // HTTP proxy (explicit scheme doesn't collide with regular https:// subscription URLs)
    expect(isProxyUri('https://airport.example.net/sub?token=abc')).toBe(false)
    expect(isProxyUri('https-proxy://u:p@proxy.example.net:443#HTTPS-Proxy')).toBe(true)
    const httpProxy = parseProxyUri('https-proxy://u:p@proxy.example.net:443?sni=proxy.example.net#HTTPS-Proxy')
    expect(proxyToSingboxOutbound(httpProxy!)).toMatchObject({
      type: 'http',
      username: 'u',
      password: 'p',
      tls: { enabled: true, server_name: 'proxy.example.net' },
    })

    // ShadowTLS & Sudoku
    const stls = parseProxyUri('shadowtls://stpw@st.example.net:443?version=3&sni=apple.com#STLS')
    expect(proxyToClashProxy(stls!)).toBeNull()
    expect(proxyToSingboxOutbound(stls!)).toMatchObject({ type: 'shadowtls', version: 3, password: 'stpw' })

    const sudoku = parseProxyUri('sudoku://skey@su.example.net:443?aead-method=chacha20-poly1305&table-type=prefer_ascii#Sudoku-01')
    expect(validateProxy(sudoku!)).toBe(true)
    expect(proxyToClashProxy(sudoku!)).toMatchObject({ type: 'sudoku', key: 'skey', 'table-type': 'prefer_ascii' })
    expect(proxyToSingboxOutbound(sudoku!)).toBeNull()
  })

  it('supports SS-2022 plaintext, SS v2ray-plugin/shadow-tls, VMess AEAD URI, AnyTLS ECH fix, and sing-box JSON -> Clash YAML round-trip', () => {
    // SS-2022 plaintext + v2ray-plugin + uot
    const ssPlain = parseProxyUri(
      'ss://2022-blake3-aes-128-gcm:c2VydmVyLWtleQ==@ss2022.example.net:8388/?plugin=v2ray-plugin%3Bmode%3Dwebsocket%3Btls%3Bhost%3Dcdn.example.net%3Bpath%3D%2Fws&uot=1#SS2022',
    )
    expect(ssPlain).toMatchObject({
      type: 'ss',
      cipher: '2022-blake3-aes-128-gcm',
      password: 'c2VydmVyLWtleQ==',
      plugin: 'v2ray-plugin',
      'plugin-opts': { mode: 'websocket', tls: true, host: 'cdn.example.net', path: '/ws' },
      'udp-over-tcp': true,
    })
    expect(proxyToSingboxOutbound(ssPlain!)).toMatchObject({
      type: 'shadowsocks',
      plugin: 'v2ray-plugin',
      udp_over_tcp: { enabled: true },
    })

    // SS + ShadowTLS -> sing-box detour chain -> parsed back from sing-box JSON -> Mihomo YAML
    const ssStls = parseProxyUri(
      `ss://${encodeBase64Utf8('aes-128-gcm:sspw')}@stls-ss.example.net:443/?plugin=${encodeURIComponent('shadow-tls;host=gateway.icloud.com;password=stpw;version=3')}#SS-STLS`,
    )
    const sbConfig = buildSingboxConfig([ssStls!])
    const reparsedFromSingbox = parseSubscriptionText(JSON.stringify(sbConfig))
    expect(reparsedFromSingbox).toHaveLength(1)
    expect(reparsedFromSingbox[0]).toMatchObject({
      type: 'ss',
      name: 'SS-STLS',
      server: 'stls-ss.example.net',
      port: 443,
      plugin: 'shadow-tls',
      'plugin-opts': { host: 'gateway.icloud.com', password: 'stpw', version: 3 },
    })
    const clashYaml = renderClashConfig(reparsedFromSingbox)
    const parsedYaml = yaml.load(clashYaml) as { proxies: Array<Record<string, unknown>> }
    expect(parsedYaml.proxies[0]).toMatchObject({
      type: 'ss',
      plugin: 'shadow-tls',
    })

    // Xray VMessAEAD URL format
    const vmessAead = parseProxyUri(
      'vmess://11111111-1111-1111-1111-111111111111@vm.example.net:443?security=tls&type=http&host=h2.example.net&path=%2Fh2&sni=h2.example.net#VMess-AEAD',
    )
    expect(vmessAead).toMatchObject({
      type: 'vmess',
      name: 'VMess-AEAD',
      network: 'h2',
      'h2-opts': { host: ['h2.example.net'], path: '/h2' },
    })
    expect(proxyToSingboxOutbound(vmessAead!)).toMatchObject({
      type: 'vmess',
      transport: { type: 'http', host: ['h2.example.net'], path: '/h2' },
    })

    // AnyTLS ECH query_server_name（修复原先误写入 config_path 的 bug）
    const anytlsEch = parseProxyUri(
      'anytls://pw@at.example.net:443?sni=at.example.net&hpkp=pin123&ech=1&ech-query-server-name=cloudflare-ech.com&client-metadata=meta1#AnyTLS-ECH',
    )
    expect(proxyToSingboxOutbound(anytlsEch!)).toMatchObject({
      type: 'anytls',
      client_metadata: 'meta1',
      tls: {
        enabled: true,
        ech: { enabled: true, query_server_name: 'cloudflare-ech.com' },
      },
    })
    expect(proxyToSingboxOutbound(anytlsEch!)?.tls?.ech?.config_path).toBeUndefined()
  })
})
