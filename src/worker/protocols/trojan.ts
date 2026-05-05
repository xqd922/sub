import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { TrojanProxy, WsTransport, GrpcTransport } from "../core/proxy";
import type { ClashTrojan } from "../core/clash";
import type { SingboxTrojanOutbound } from "../core/singbox";
import { stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";
import { toSingboxTls, toSingboxTransport } from "./vmess";

/**
 * Trojan protocol handler — TLS is implicit; ws + grpc transports supported.
 *
 * URI shape: `trojan://password@host:port?sni=…&type=ws|grpc&…#name`
 */
const handler: ProtocolHandler<TrojanProxy> = {
  type: "trojan",
  schemes: ["trojan"],

  parseUri(uri) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch (cause) {
      throw errors.parseFailed("trojan: invalid URI", cause);
    }
    if (!url.username) throw errors.parseFailed("trojan: missing password");

    const sp = url.searchParams;
    const server = stripIpv6Brackets(url.hostname);
    const type = (sp.get("type") || "tcp").toLowerCase();

    const proxy: TrojanProxy = {
      type: "trojan",
      name: url.hash ? safeDecode(url.hash.slice(1)) : server,
      server,
      port: parsePort(url.port, 443),
      password: decodeURIComponent(url.username),
      tls: {
        enabled: true,
        serverName: sp.get("sni") || server,
        ...(isInsecure(sp) && { insecure: true }),
        ...(sp.get("alpn") && { alpn: sp.get("alpn")!.split(",") }),
        ...(sp.get("fp") && { fingerprint: sp.get("fp")! }),
      },
    };

    if (type === "ws") {
      const ws: WsTransport = {
        type: "ws",
        path: sp.get("path") || "/",
        ...(sp.get("host") && { headers: { Host: sp.get("host")! } }),
      };
      proxy.transport = ws;
    } else if (type === "grpc") {
      const grpc: GrpcTransport = {
        type: "grpc",
        serviceName: sp.get("serviceName") || "",
      };
      proxy.transport = grpc;
    }

    return proxy;
  },

  toUri(p) {
    const params = new URLSearchParams();
    if (p.tls.serverName) params.set("sni", p.tls.serverName);
    if (p.tls.insecure) params.set("allowInsecure", "1");
    if (p.transport?.type === "ws") {
      params.set("type", "ws");
      if (p.transport.path) params.set("path", p.transport.path);
      if (p.transport.headers?.Host) params.set("host", p.transport.headers.Host);
    } else if (p.transport?.type === "grpc") {
      params.set("type", "grpc");
      params.set("serviceName", p.transport.serviceName);
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    return `trojan://${encodeURIComponent(p.password)}@${p.server}:${p.port}${q}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxTrojanOutbound {
    const out: SingboxTrojanOutbound = {
      type: "trojan",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      password: p.password,
      tls: toSingboxTls(p.tls),
    };
    if (p.transport) out.transport = toSingboxTransport(p.transport);
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashTrojan {
    const c: ClashTrojan = {
      name: p.name,
      type: "trojan",
      server: p.server,
      port: p.port,
      password: p.password,
      ...(p.tls.serverName && { sni: p.tls.serverName }),
      ...(p.tls.insecure && { "skip-cert-verify": true }),
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
    if (p.transport?.type === "ws") {
      c.network = "ws";
      c["ws-opts"] = {
        ...(p.transport.path && { path: p.transport.path }),
        ...(p.transport.headers && { headers: p.transport.headers }),
      };
    } else if (p.transport?.type === "grpc") {
      c.network = "grpc";
    }
    return c;
  },

  dedupKey(p) {
    const ws = p.transport?.type === "ws" ? p.transport : null;
    const grpc = p.transport?.type === "grpc" ? p.transport : null;
    return [
      "trojan",
      p.server,
      p.port,
      p.password,
      p.tls.serverName ?? "",
      p.transport?.type ?? "tcp",
      ws?.path ?? "",
      ws?.headers?.Host ?? "",
      grpc?.serviceName ?? "",
    ].join("|");
  },
};

function isInsecure(sp: URLSearchParams): boolean {
  const v = sp.get("allowInsecure") ?? sp.get("skip-cert-verify");
  return v === "1" || v === "true";
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

registerProtocol(handler);
