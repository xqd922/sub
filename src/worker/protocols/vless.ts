import { registerProtocol } from "./registry";
import type { ProtocolHandler } from "./types";
import type { VlessProxy, WsTransport, GrpcTransport } from "../core/proxy";
import type { ClashVless } from "../core/clash";
import type { SingboxVlessOutbound } from "../core/singbox";
import { stripIpv6Brackets } from "../lib/base64";
import { parsePort } from "../lib/url";
import { errors } from "../lib/errors";
import { toSingboxTls, toSingboxTransport } from "./vmess";

/**
 * VLESS protocol handler — including REALITY transport.
 *
 * URI shape: `vless://uuid@host:port?security=tls|reality&type=tcp|ws|grpc&…#name`
 */
const handler: ProtocolHandler<VlessProxy> = {
  type: "vless",
  schemes: ["vless"],

  parseUri(uri) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch (cause) {
      throw errors.parseFailed("vless: invalid URI", cause);
    }
    if (!url.username) throw errors.parseFailed("vless: missing uuid");

    const sp = url.searchParams;
    const security = (sp.get("security") || "none").toLowerCase();
    const type = (sp.get("type") || "tcp").toLowerCase();
    const server = stripIpv6Brackets(url.hostname);

    const flowParam = sp.get("flow");
    const proxy: VlessProxy = {
      type: "vless",
      name: url.hash ? safeDecode(url.hash.slice(1)) : server,
      server,
      port: parsePort(url.port, 443),
      uuid: url.username,
      ...(flowParam ? { flow: flowParam as VlessProxy["flow"] } : {}),
    };

    if (security === "tls" || security === "reality") {
      proxy.tls = {
        enabled: true,
        ...(sp.get("sni") && { serverName: sp.get("sni")! }),
        ...(isInsecure(sp) && { insecure: true }),
        ...(sp.get("alpn") && { alpn: sp.get("alpn")!.split(",") }),
        ...(sp.get("fp") && { fingerprint: sp.get("fp")! }),
        ...(security === "reality" && sp.get("pbk") && {
          reality: {
            publicKey: sp.get("pbk")!,
            ...(sp.get("sid") && { shortId: sp.get("sid")! }),
          },
        }),
      };
    }

    if (type === "ws") {
      const ws: WsTransport = {
        type: "ws",
        ...(sp.get("path") && { path: sp.get("path")! }),
        ...(sp.get("host") && { headers: { Host: sp.get("host")! } }),
      };
      proxy.transport = ws;
    } else if (type === "grpc") {
      const grpc: GrpcTransport = {
        type: "grpc",
        serviceName: sp.get("serviceName") || sp.get("path") || "",
      };
      proxy.transport = grpc;
    }

    return proxy;
  },

  toUri(p) {
    const params = new URLSearchParams();
    params.set("type", p.transport?.type ?? "tcp");
    params.set("security", p.tls?.reality ? "reality" : p.tls ? "tls" : "none");
    if (p.flow) params.set("flow", p.flow);
    if (p.tls?.serverName) params.set("sni", p.tls.serverName);
    if (p.tls?.fingerprint) params.set("fp", p.tls.fingerprint);
    if (p.tls?.insecure) params.set("allowInsecure", "1");
    if (p.tls?.alpn?.length) params.set("alpn", p.tls.alpn.join(","));
    if (p.tls?.reality) {
      params.set("pbk", p.tls.reality.publicKey);
      if (p.tls.reality.shortId) params.set("sid", p.tls.reality.shortId);
    }
    if (p.transport?.type === "ws") {
      if (p.transport.path) params.set("path", p.transport.path);
      if (p.transport.headers?.Host) params.set("host", p.transport.headers.Host);
    } else if (p.transport?.type === "grpc") {
      params.set("serviceName", p.transport.serviceName);
    }
    return `vless://${p.uuid}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name)}`;
  },

  toSingbox(p): SingboxVlessOutbound {
    const out: SingboxVlessOutbound = {
      type: "vless",
      tag: p.name,
      server: p.server,
      server_port: p.port,
      uuid: p.uuid,
    };
    if (p.flow) out.flow = p.flow;
    if (p.tls) out.tls = toSingboxTls(p.tls);
    if (p.transport) out.transport = toSingboxTransport(p.transport);
    if (p.detour) out.detour = p.detour;
    return out;
  },

  toClash(p): ClashVless {
    const c: ClashVless = {
      name: p.name,
      type: "vless",
      server: p.server,
      port: p.port,
      uuid: p.uuid,
      ...(p.udp && { udp: true }),
      ...(p.detour && { "dialer-proxy": p.detour }),
    };
    if (p.flow) c.flow = p.flow;
    if (p.tls) {
      c.tls = true;
      if (p.tls.serverName) c.servername = p.tls.serverName;
      if (p.tls.insecure) c["skip-cert-verify"] = true;
      if (p.tls.fingerprint) c["client-fingerprint"] = p.tls.fingerprint;
      if (p.tls.reality) {
        c["reality-opts"] = {
          "public-key": p.tls.reality.publicKey,
          ...(p.tls.reality.shortId && { "short-id": p.tls.reality.shortId }),
        };
      }
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
      "vless",
      p.server,
      p.port,
      p.uuid,
      p.flow ?? "",
      p.transport?.type ?? "tcp",
      p.tls ? (p.tls.reality ? "reality" : "tls") : "",
      p.tls?.serverName ?? "",
      p.tls?.reality?.publicKey ?? "",
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
