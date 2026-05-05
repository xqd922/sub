import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { VmessProxy, WsTransport, GrpcTransport, Transport } from "../core/proxy";
import type { ClashVmess } from "../core/clash";
import type { SingboxVmessOutbound, SingboxTlsBlock, SingboxTransportBlock } from "../core/singbox";
import { base64Decode, base64Encode, stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";

/**
 * VMess protocol handler.
 *
 * URI shape: `vmess://base64(json)` where the JSON is the legacy v2rayN format
 * `{v, ps, add, port, id, aid, scy, net, tls, sni, host, path, type}`.
 */

interface VmessJson {
  v?: string | number;
  ps?: string;
  add: string;
  port: string | number;
  id: string;
  aid?: string | number;
  scy?: string;
  net?: string;
  tls?: string;
  sni?: string;
  host?: string;
  path?: string;
  // Some exporters (e.g. clash) also use these:
  alpn?: string;
}

const handler: ProtocolHandler<VmessProxy> = {
  type: "vmess",
  schemes: ["vmess"],

  parseUri(uri) {
    let json: VmessJson;
    try {
      json = JSON.parse(base64Decode(uri.slice("vmess://".length))) as VmessJson;
    } catch (cause) {
      throw errors.parseFailed("vmess: invalid base64 JSON", cause);
    }
    if (!json.add || !json.id) throw errors.parseFailed("vmess: missing add/id");

    const server = stripIpv6Brackets(json.add);
    const network = (json.net || "tcp").toLowerCase();
    const useTls = json.tls === "tls";

    const proxy: VmessProxy = {
      type: "vmess",
      name: json.ps || server,
      server,
      port: parsePort(json.port, 443),
      uuid: json.id,
      alterId: typeof json.aid === "number" ? json.aid : Number.parseInt(String(json.aid ?? 0), 10) || 0,
      cipher: normaliseCipher(json.scy),
    };

    if (useTls) {
      proxy.tls = {
        enabled: true,
        ...(json.sni && { serverName: json.sni }),
        ...(json.alpn && { alpn: json.alpn.split(",") }),
      };
    }

    if (network === "ws") {
      const ws: WsTransport = {
        type: "ws",
        ...(json.path && { path: json.path }),
        ...(json.host && { headers: { Host: json.host } }),
      };
      proxy.transport = ws;
    } else if (network === "grpc") {
      const grpc: GrpcTransport = {
        type: "grpc",
        serviceName: json.path || "",
      };
      proxy.transport = grpc;
    }

    return proxy;
  },

  toUri(p) {
    const json: VmessJson = {
      v: "2",
      ps: p.name,
      add: p.server,
      port: String(p.port),
      id: p.uuid,
      aid: String(p.alterId),
      scy: p.cipher,
      net: p.transport?.type ?? "tcp",
      tls: p.tls ? "tls" : "",
      sni: p.tls?.serverName ?? "",
      host: getWsHost(p.transport) ?? "",
      path: getWsPath(p.transport) ?? getGrpcServiceName(p.transport) ?? "",
    };
    return `vmess://${base64Encode(JSON.stringify(json))}`;
  },

  toSingbox(p): SingboxVmessOutbound {
    const out: SingboxVmessOutbound = {
      type: "vmess",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      uuid: p.uuid,
      alter_id: p.alterId,
      security: p.cipher,
    };
    if (p.tls) out.tls = toSingboxTls(p.tls);
    if (p.transport) out.transport = toSingboxTransport(p.transport);
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashVmess {
    const c: ClashVmess = {
      name: p.name,
      type: "vmess",
      server: p.server,
      port: p.port,
      uuid: p.uuid,
      alterId: p.alterId,
      cipher: p.cipher,
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
    if (p.tls) {
      c.tls = true;
      if (p.tls.serverName) c.servername = p.tls.serverName;
      if (p.tls.insecure) c["skip-cert-verify"] = true;
    }
    if (p.transport?.type === "ws") {
      c.network = "ws";
      c["ws-opts"] = {
        ...(p.transport.path && { path: p.transport.path }),
        ...(p.transport.headers && { headers: p.transport.headers }),
      };
    } else if (p.transport?.type === "grpc") {
      c.network = "grpc";
      c["grpc-opts"] = { "grpc-service-name": p.transport.serviceName };
    }
    return c;
  },

  dedupKey(p) {
    const ws = p.transport?.type === "ws" ? p.transport : null;
    const grpc = p.transport?.type === "grpc" ? p.transport : null;
    return [
      "vmess",
      p.server,
      p.port,
      p.uuid,
      p.alterId,
      p.cipher,
      p.transport?.type ?? "tcp",
      p.tls ? "tls" : "",
      p.tls?.serverName ?? "",
      ws?.path ?? "",
      ws?.headers?.Host ?? "",
      grpc?.serviceName ?? "",
    ].join("|");
  },
};

function normaliseCipher(c: string | undefined): VmessProxy["cipher"] {
  switch (c) {
    case "aes-128-gcm":
    case "chacha20-poly1305":
    case "none":
      return c;
    default:
      return "auto";
  }
}

// ── Shared transport / TLS converters (re-used by vless and trojan too) ──
export function toSingboxTls(tls: NonNullable<VmessProxy["tls"]>): SingboxTlsBlock {
  const out: SingboxTlsBlock = { enabled: true };
  if (tls.serverName) out.server_name = tls.serverName;
  if (tls.insecure) out.insecure = true;
  if (tls.alpn?.length) out.alpn = tls.alpn;
  if (tls.fingerprint) out.utls = { enabled: true, fingerprint: tls.fingerprint };
  if (tls.reality) {
    out.reality = {
      enabled: true,
      public_key: tls.reality.publicKey,
      ...(tls.reality.shortId && { short_id: tls.reality.shortId }),
    };
  }
  return out;
}

export function toSingboxTransport(t: Transport): SingboxTransportBlock {
  if (t.type === "ws") {
    const out: SingboxTransportBlock = { type: "ws" };
    if (t.path) out.path = t.path;
    if (t.headers) out.headers = t.headers;
    if (t.earlyDataHeaderName) out.early_data_header_name = t.earlyDataHeaderName;
    if (t.maxEarlyData) out.max_early_data = t.maxEarlyData;
    return out;
  }
  if (t.type === "grpc") {
    return { type: "grpc", service_name: t.serviceName };
  }
  // h2 — rarely used in practice
  return { type: "http", ...(t.path && { path: t.path }) };
}

function getWsHost(t: Transport | undefined): string | null {
  return t?.type === "ws" ? (t.headers?.Host ?? null) : null;
}
function getWsPath(t: Transport | undefined): string | null {
  return t?.type === "ws" ? (t.path ?? null) : null;
}
function getGrpcServiceName(t: Transport | undefined): string | null {
  return t?.type === "grpc" ? t.serviceName : null;
}

registerProtocol(handler);
